import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { WalletService } from '../wallet/wallet.service';
import { WhatsappService } from '../notification/whatsapp.service';
import { PassIssuanceService } from '../passes/pass-issuance.service';
import type {
  NormalizedPayment,
  PaymentWebhookResult,
} from '@linearcard/types';

/** How far a signed payload's timestamp may be from now. */
export const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

export function signPaymentPayload(secret: string, rawBody: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

/** Constant-time compare that also tolerates length mismatch. */
export function signatureMatches(expected: string, provided?: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided.trim(), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * PSP adapter. Only `mock` ships (D3) — Razorpay/Cashfree become one more
 * `case` each, which is the whole point of normalizing here rather than in
 * the controller.
 *
 * The normalized shape is deliberately narrow: phone, amount, merchant
 * reference, time. **No PAN, no VPA, no card token ever enters this system**
 * — anything else on the payload is dropped right here and never stored.
 */
export function normalizePayment(
  provider: string,
  body: any,
): NormalizedPayment {
  const p = provider || 'mock';
  if (p !== 'mock') {
    throw new HttpException(
      `Unsupported payment provider '${p}'. Only 'mock' ships today.`,
      HttpStatus.BAD_REQUEST,
    );
  }

  const phone = String(body?.phone ?? '').replace(/[^\d+]/g, '');
  // Amount is in the currency's minor unit (paise) so no float ever touches
  // money on the wire.
  const amountMinor = Math.round(Number(body?.amountMinor ?? NaN));

  if (!phone || phone.replace(/\D/g, '').length < 8) {
    throw new HttpException(
      'A valid customer phone is required.',
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    throw new HttpException(
      'amountMinor must be a positive integer in the minor unit (paise).',
      HttpStatus.BAD_REQUEST,
    );
  }

  return {
    phone,
    amountMinor,
    currency: String(body?.currency || 'INR').toUpperCase(),
    merchantRef: body?.merchantRef ? String(body.merchantRef) : null,
    occurredAt: body?.occurredAt
      ? new Date(body.occurredAt).toISOString()
      : new Date().toISOString(),
    nonce: String(body?.nonce ?? ''),
    timestamp: Number(body?.timestamp ?? NaN),
  };
}

/**
 * Phase 5 — payment-triggered enrollment.
 *
 * A PSP (today: the demo simulator) POSTs a signed payment event; an unknown
 * phone is enrolled and awarded points in one step, a known phone is simply
 * awarded on their existing pass. Everything downstream — tier compute,
 * wallet push, tier-change design swap — is `processOrderTransaction`, reused
 * as is.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly walletService: WalletService,
    private readonly whatsappService: WhatsappService,
    private readonly passIssuanceService: PassIssuanceService,
  ) {}

  /** Per-tenant HMAC secret, minted on first read. */
  async getOrCreateSecret(tenantId: string): Promise<string> {
    const { data: tenant } = await this.supabaseService.client
      .from('Tenant')
      .select('id, paymentWebhookSecret')
      .eq('id', tenantId)
      .single();
    if (!tenant) {
      throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);
    }
    if (tenant.paymentWebhookSecret) return tenant.paymentWebhookSecret;

    const secret = `lc_pay_${crypto.randomBytes(24).toString('hex')}`;
    const { error } = await this.supabaseService.client
      .from('Tenant')
      .update({ paymentWebhookSecret: secret })
      .eq('id', tenantId);
    if (error) throw new Error(`Failed to store secret: ${error.message}`);
    return secret;
  }

  /**
   * Full inbound path: verify → normalize → replay-check → award/enroll.
   * The simulator (5.3) goes through this exact method with a real
   * signature, so a demo exercises the production code path, not a bypass.
   */
  async handleWebhook(
    tenantId: string,
    rawBody: string,
    signature?: string,
    provider = 'mock',
  ): Promise<PaymentWebhookResult> {
    const { data: tenant } = await this.supabaseService.client
      .from('Tenant')
      .select('*')
      .eq('id', tenantId)
      .single();
    if (!tenant) {
      throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);
    }
    if (!tenant.paymentWebhookSecret) {
      throw new HttpException(
        'No payment webhook secret configured for this brand.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (
      !signatureMatches(
        signPaymentPayload(tenant.paymentWebhookSecret, rawBody),
        signature,
      )
    ) {
      throw new HttpException('Invalid signature', HttpStatus.UNAUTHORIZED);
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new HttpException('Malformed JSON body', HttpStatus.BAD_REQUEST);
    }

    const payment = normalizePayment(provider, body);

    // Replay protection (PRD §8): the signature alone is replayable forever,
    // so the payload carries a timestamp and a nonce and both must hold.
    if (
      !Number.isFinite(payment.timestamp) ||
      Math.abs(Date.now() - payment.timestamp) > TIMESTAMP_TOLERANCE_MS
    ) {
      throw new HttpException(
        'Stale or missing timestamp.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (!payment.nonce) {
      throw new HttpException('nonce is required.', HttpStatus.BAD_REQUEST);
    }

    // The unique index on (tenantId, nonce) is the replay check — a rejected
    // insert means we have already processed this event. Doing it in the DB
    // rather than in memory keeps it correct across restarts and instances.
    const { data: event, error: eventError } = await this.supabaseService.client
      .from('PaymentEvent')
      .insert({
        tenantId,
        provider,
        nonce: payment.nonce,
        phone: payment.phone,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        merchantRef: payment.merchantRef,
        occurredAt: payment.occurredAt,
      })
      .select('id')
      .single();
    if (eventError) {
      if (eventError.code === '23505') {
        throw new HttpException(
          'Duplicate payment event (nonce already processed).',
          HttpStatus.CONFLICT,
        );
      }
      throw new Error(`Failed to record payment event: ${eventError.message}`);
    }

    const result = await this.applyPayment(tenant, payment, body?.programId);

    await this.supabaseService.client
      .from('PaymentEvent')
      .update({ passId: result.passId })
      .eq('id', event.id);

    return result;
  }

  /**
   * Which program a payment scores against (D8): an explicit id that belongs
   * to this tenant, else the tenant's oldest *loyalty* program. A ticket
   * program has no points pipeline, so it can never be the default.
   */
  async resolveProgram(
    tenantId: string,
    programId?: string,
  ): Promise<any | null> {
    if (programId) {
      const { data } = await this.supabaseService.client
        .from('Program')
        .select('*')
        .eq('id', programId)
        .eq('tenantId', tenantId)
        .maybeSingle();
      if (!data) {
        throw new HttpException(
          'Program not found for this brand.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (data.kind === 'ticket') {
        throw new HttpException(
          'Ticket programs have no points pipeline; a payment cannot be applied to one.',
          HttpStatus.BAD_REQUEST,
        );
      }
      return data;
    }

    const { data } = await this.supabaseService.client
      .from('Program')
      .select('*')
      .eq('tenantId', tenantId)
      .eq('kind', 'loyalty')
      .order('createdAt', { ascending: true })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  }

  private async applyPayment(
    tenant: any,
    payment: NormalizedPayment,
    programId?: string,
  ): Promise<PaymentWebhookResult> {
    const program = await this.resolveProgram(tenant.id, programId);

    // Known member, or a new one enrolled on the spot with consent pending —
    // they have not seen a consent screen, so `consentedAt` stays null until
    // they act on the WhatsApp we send below.
    const { data: existingMember } = await this.supabaseService.client
      .from('Member')
      .select('*')
      .eq('tenantId', tenant.id)
      .eq('phone', payment.phone)
      .limit(1)
      .maybeSingle();

    let member = existingMember;
    let enrolled = false;
    if (!member) {
      // Admin Exclusivity Validation
      const { data: adminExists } = await this.supabaseService.client
        .from('Admin')
        .select('id')
        .eq('tenantId', tenant.id)
        .eq('phone', payment.phone)
        .maybeSingle();

      if (adminExists) {
        throw new HttpException(
          'Phone number is reserved for admin use.',
          HttpStatus.FORBIDDEN,
        );
      }

      const { data: created, error } = await this.supabaseService.client
        .from('Member')
        .insert({
          phone: payment.phone,
          name: payment.phone,
          tenantId: tenant.id,
        })
        .select()
        .single();
      if (error || !created) {
        throw new Error(`Failed to create member: ${error?.message}`);
      }
      member = created;
      enrolled = true;
    }

    const issued = await this.passIssuanceService.issueForMember({
      tenantId: tenant.id,
      member,
      program,
      tenant,
      // The save link goes out below together with the points, so the member
      // gets one message, not two.
      sendPassLink: false,
    });
    if (!issued.passId) {
      throw new HttpException(
        'Could not issue a pass for this payment.',
        HttpStatus.BAD_GATEWAY,
      );
    }
    enrolled = enrolled || !issued.existing;

    const orderAmount = payment.amountMinor / 100;
    const txn = await this.walletService.processOrderTransaction(
      issued.passId,
      orderAmount,
      'award',
      'webhook',
      payment.merchantRef || undefined,
      'payment-webhook',
      tenant.id,
    );

    this.notifyMember(tenant, member, payment, txn, issued, enrolled).catch(
      (err) => this.logger.warn(`Payment WhatsApp failed (non-fatal): ${err}`),
    );

    return {
      success: true,
      enrolled,
      memberId: member.id,
      passId: issued.passId,
      programId: program?.id ?? null,
      pointsAwarded: txn.pointsChanged,
      newBalance: txn.newBalance,
      tier: txn.tier,
      tierChanged: txn.tierChanged,
    };
  }

  private async notifyMember(
    tenant: any,
    member: any,
    payment: NormalizedPayment,
    txn: { pointsChanged: number; newBalance: number },
    issued: { passId: string | null },
    enrolled: boolean,
  ): Promise<void> {
    const brand = tenant.name || 'LinearCard';
    const amount = (payment.amountMinor / 100).toFixed(2);
    const opts = { tenantId: tenant.id, memberId: member.id };

    if (enrolled && issued.passId) {
      const link = this.passIssuanceService.shortPassUrl(issued.passId);
      await this.whatsappService.sendTextWithLog(
        member.phone,
        `🎉 Thanks for your ₹${amount} purchase at *${brand}*!\n\n` +
          `You earned *${txn.pointsChanged} points* — balance: *${txn.newBalance} Pts*.\n\n` +
          `Add your card to Google Wallet:\n${link}\n\n` +
          `We created this card from your payment so you can collect rewards. ` +
          `Reply STOP at any time to opt out of marketing messages.\n\n` +
          `_Powered by LinearCard_`,
        { ...opts, type: 'payment_enrollment' },
      );
      return;
    }

    await this.whatsappService.sendTextWithLog(
      member.phone,
      `✅ ₹${amount} purchase at *${brand}* — you earned *${txn.pointsChanged} points*.\n\n` +
        `New balance: *${txn.newBalance} Pts*.\n\n_Your wallet pass will refresh automatically._`,
      { ...opts, type: 'payment_award' },
    );
  }
}
