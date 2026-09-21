import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { WalletService } from '../wallet/wallet.service';
import { WhatsappService } from '../notification/whatsapp.service';
import { WebhookService } from '../developers/webhook.service';
import { resolveImageUrl } from './passes.controller';

export interface IssuePassResult {
  success: boolean;
  /** True when the member already held a live pass for this program. */
  existing: boolean;
  passId: string | null;
  fullPassId?: string;
  googleWalletUrl?: string;
  token?: string;
  error?: string;
}

/**
 * The one place a Google Wallet pass is minted for a member.
 *
 * Extracted from `verify-otp` in Phase 5 because payment-triggered
 * enrollment (5.2) needs exactly the same sequence — entry tier, program
 * design, existing-pass reuse, Pass row, `member.enrolled` webhook, save
 * link over WhatsApp. Two copies of this would drift the moment one of
 * them learned about a new program kind.
 */
@Injectable()
export class PassIssuanceService {
  private readonly logger = new Logger(PassIssuanceService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly walletService: WalletService,
    private readonly whatsappService: WhatsappService,
    private readonly webhookService: WebhookService,
  ) {}

  /** The program's lowest tier — never a hardcoded 'Bronze' that may not exist. */
  async resolveEntryTier(programId?: string | null): Promise<any | null> {
    if (!programId) return null;
    const { data } = await this.supabaseService.client
      .from('Tier')
      .select('*')
      .eq('programId', programId)
      .order('minPoints', { ascending: true })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  }

  async issueForMember(input: {
    tenantId: string;
    member: { id: string; phone: string; name?: string | null };
    program?: { id: string } | null;
    tenant?: { name?: string; classSuffix?: string } | null;
    /** Extra GenericObject fields (memberName, tier, balance, rows…). */
    passData?: Record<string, any>;
    /** Send the save link over WhatsApp. Off for silent/system issuance. */
    sendPassLink?: boolean;
  }): Promise<IssuePassResult> {
    const {
      tenantId,
      member,
      program,
      passData = {},
      sendPassLink = true,
    } = input;

    let tenant = input.tenant;
    if (!tenant) {
      const { data } = await this.supabaseService.client
        .from('Tenant')
        .select('*')
        .eq('id', tenantId)
        .single();
      tenant = data;
    }

    const entryTier = await this.resolveEntryTier(program?.id);
    const startingTier = passData.tier || entryTier?.name || 'Bronze';
    const startingBalance = passData.balance || '0 Pts';

    const passDesign = await this.walletService.resolveTenantPassDesign(
      tenantId,
      entryTier?.templateId,
      program?.id,
    );
    const tenantWallet = await this.walletService.forTenant(tenantId);

    // Already holds a live pass for this program → hand back the same pass
    // (and the same balance) instead of minting a second one. Scoped to the
    // program (D8): a coffee pass must not block enrolling in the gym.
    let existingQuery = this.supabaseService.client
      .from('Pass')
      .select('*')
      .eq('memberId', member.id)
      .eq('tenantId', tenantId)
      .is('deletedAt', null);
    if (program?.id) existingQuery = existingQuery.eq('programId', program.id);
    const { data: existingPass } = await existingQuery
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPass?.fullPassId) {
      const { token, googleWalletUrl } = tenantWallet.buildSaveLink(
        existingPass.fullPassId,
        passDesign.classSuffix || tenant?.classSuffix,
      );
      return {
        success: true,
        existing: true,
        googleWalletUrl,
        token,
        passId: existingPass.id,
        fullPassId: existingPass.fullPassId,
      };
    }

    const explicitPassId = crypto.randomUUID();
    const passResult = await tenantWallet.createGoogleWalletPass({
      ...passData,
      passId: explicitPassId,
      tier: startingTier,
      balance: startingBalance,
      barcodeAltText: `${startingTier} Tier • ${startingBalance}`,
      cardTitle: passDesign.cardTitle || tenant?.name,
      classSuffix: passDesign.classSuffix || tenant?.classSuffix,
      hexBackgroundColor: passDesign.hexBackgroundColor,
      logoUrl: resolveImageUrl(passDesign.logoUrl),
      heroImageUrl: resolveImageUrl(passDesign.heroImageUrl),
    });

    let passRecordId: string | null = null;
    if (passResult.success && passResult.fullPassId) {
      const { data: insertedPass, error: passError } =
        await this.supabaseService.client
          .from('Pass')
          .insert({
            id: explicitPassId,
            memberId: member.id,
            tenantId,
            programId: program?.id ?? null,
            tierId: entryTier?.id ?? null,
            fullPassId: passResult.fullPassId,
            balance: 0,
            tier: startingTier,
          })
          .select()
          .single();
      if (!passError && insertedPass) {
        passRecordId = insertedPass.id;
        this.webhookService
          .dispatch(tenantId, 'member.enrolled', {
            passId: passRecordId,
            memberId: member.id,
            phone: member.phone,
          })
          .catch(() => {});
      }
    }

    if (sendPassLink && passResult.googleWalletUrl && passRecordId) {
      this.whatsappService
        .sendPassLinkWithLog(
          member.phone,
          this.shortPassUrl(passRecordId),
          passData.memberName || member.name || member.phone,
          tenant?.name || 'LinearCard',
          { tenantId, memberId: member.id },
        )
        .catch((err) =>
          this.logger.warn(`WhatsApp pass link failed (non-fatal): ${err}`),
        );
    }

    return {
      success: !!passResult.success,
      existing: false,
      passId: passRecordId,
      ...passResult,
    };
  }

  /** Short link that redirects to a freshly signed save URL (JWTs expire in 3h). */
  shortPassUrl(passRecordId: string): string {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL.replace('-api', '')}`
        : 'http://localhost:3000');
    return `${baseUrl}/api/p/${passRecordId}`;
  }
}
