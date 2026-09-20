import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { GoogleAuth } from 'google-auth-library';
import { SupabaseService } from '../supabase/supabase.service';
import { NotifyService } from '../notification/notify.service';
import { WhatsappService } from '../notification/whatsapp.service';
import { computeTier } from '../tiers/tier.util';
import { AuditService } from '../audit/audit.service';
import { WebhookService } from '../developers/webhook.service';
import { DEFAULT_PASS_HEX, Tier } from '@linearcard/types';
import { decryptSecret } from '../env';

export interface WalletCredentials {
  issuerId: string;
  clientEmail: string;
  privateKey: string;
}

export interface GoogleWalletPassOptions {
  passId: string;
  memberName?: string;
  cardTitle?: string;
  balance?: string;
  tier?: string;
  hexBackgroundColor?: string;
  barcodeValue?: string;
  barcodeAltText?: string;
  classSuffix?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  rows?: any[];
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  // Set only on an instance returned by forTenant(); a plain injected
  // singleton has this null and resolves credentials from env on every call
  // — this is what keeps every pre-existing call site working unchanged.
  private credentials: WalletCredentials | null = null;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notifyService: NotifyService,
    private readonly whatsappService: WhatsappService,
    private readonly auditService: AuditService,
    private readonly webhookService: WebhookService,
  ) {}

  /**
   * Returns a WalletService instance scoped to one tenant's Google Wallet
   * credentials (decrypted from the Tenant row), falling back field-by-field
   * to the shared env vars when the tenant hasn't configured its own yet.
   * Shares this instance's already-injected collaborators (DB/notify/audit/
   * webhook services) — only the credential resolution differs.
   */
  public async forTenant(tenantId: string): Promise<WalletService> {
    const scoped = new WalletService(
      this.supabaseService,
      this.notifyService,
      this.whatsappService,
      this.auditService,
      this.webhookService,
    );
    scoped.credentials = await this.resolveTenantCredentials(tenantId);
    return scoped;
  }

  private async resolveTenantCredentials(
    tenantId: string,
  ): Promise<WalletCredentials> {
    const { data: tenant } = await this.supabaseService.client
      .from('Tenant')
      .select('issuerId, googleClientEmail, googlePrivateKeyEncrypted')
      .eq('id', tenantId)
      .single();

    const issuerId = tenant?.issuerId || process.env.ISSUER_ID;
    const clientEmail = tenant?.googleClientEmail || process.env.GOOGLE_CLIENT_EMAIL;
    const rawKey = tenant?.googlePrivateKeyEncrypted
      ? decryptSecret(tenant.googlePrivateKeyEncrypted)
      : process.env.GOOGLE_PRIVATE_KEY;

    if (!issuerId || !clientEmail || !rawKey) {
      throw new Error(
        `Missing Google Wallet credentials for tenant ${tenantId}. Configure Tenant.issuerId/googleClientEmail/googlePrivateKeyEncrypted or set ISSUER_ID/GOOGLE_CLIENT_EMAIL/GOOGLE_PRIVATE_KEY in .env.`,
      );
    }

    return { issuerId, clientEmail, privateKey: this.formatPrivateKey(rawKey) };
  }

  /**
   * Single source of truth for credential resolution. Collapses what used to
   * be five separate `process.env.ISSUER_ID` reads (three with a hardcoded
   * issuer-string fallback) into one path: prefer credentials set via
   * forTenant(), else resolve straight from env, else throw — never silently
   * produce a broken `"undefined.suffix"` class/object id.
   */
  private getCredentialsOrThrow(): WalletCredentials {
    if (this.credentials) return this.credentials;

    const issuerId = process.env.ISSUER_ID;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const rawKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!issuerId || !clientEmail || !rawKey) {
      throw new Error(
        'Missing Google Wallet credentials. Please ensure ISSUER_ID, GOOGLE_CLIENT_EMAIL, and GOOGLE_PRIVATE_KEY are set in .env',
      );
    }

    return { issuerId, clientEmail, privateKey: this.formatPrivateKey(rawKey) };
  }

  /**
   * Formats private key handling newline escapes and PEM headers
   */
  private formatPrivateKey(rawKey: string): string {
    if (!rawKey) {
      throw new Error('GOOGLE_PRIVATE_KEY is missing in environment variables');
    }
    let key = rawKey.replace(/\\n/g, '\n').trim();
    // Ensure the private key string contains the necessary PEM headers for JWT signing
    if (
      !key.includes('BEGIN PRIVATE KEY') &&
      !key.includes('BEGIN RSA PRIVATE KEY')
    ) {
      key = `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----\n`;
    }
    return key;
  }

  public async getGoogleAuthClient() {
    const { clientEmail, privateKey } = this.getCredentialsOrThrow();

    const auth = new GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
    });

    return await auth.getClient();
  }

  /**
   * Single source of truth for a tenant's pass design. Prefers the tenant's
   * published PassTemplate (what the designer shows) and falls back to
   * Tenant.brandHexColor only when no published template exists — avoids the
   * class/object mismatch where issuance stamped the stale tenant colour
   * over a template the designer had already re-coloured.
   *
   * `templateId` optionally pins the design to a specific PassTemplate
   * (e.g. the one a member's new `Tier` points at after a tier change)
   * instead of the tenant's latest published template.
   */
  public async resolveTenantPassDesign(
    tenantId: string,
    templateId?: string,
  ): Promise<{
    hexBackgroundColor: string;
    logoUrl?: string;
    heroImageUrl?: string;
    classSuffix?: string;
    cardTitle?: string;
    fieldRows?: any[];
  }> {
    const { data: tenant } = await this.supabaseService.client
      .from('Tenant')
      .select('*')
      .eq('id', tenantId)
      .single();

    let template: any = null;
    if (templateId) {
      const { data } = await this.supabaseService.client
        .from('PassTemplate')
        .select('*')
        .eq('id', templateId)
        .eq('tenantId', tenantId)
        .maybeSingle();
      template = data;
    }

    if (!template) {
      const { data } = await this.supabaseService.client
        .from('PassTemplate')
        .select('*')
        .eq('tenantId', tenantId)
        .eq('status', 'published')
        .order('updatedAt', { ascending: false })
        .limit(1)
        .maybeSingle();
      template = data;
    }

    if (template) {
      return {
        hexBackgroundColor:
          template.hexBackgroundColor ||
          tenant?.brandHexColor ||
          DEFAULT_PASS_HEX,
        logoUrl: template.logoUrl || tenant?.logoUrl,
        heroImageUrl: template.heroImageUrl || tenant?.heroUrl,
        classSuffix: template.classSuffix || tenant?.classSuffix,
        cardTitle: tenant?.name || template.title,
        fieldRows: template.fieldRows || [],
      };
    }

    return {
      hexBackgroundColor: tenant?.brandHexColor || DEFAULT_PASS_HEX,
      logoUrl: tenant?.logoUrl,
      heroImageUrl: tenant?.heroUrl,
      classSuffix: tenant?.classSuffix,
      cardTitle: tenant?.name,
      fieldRows: [],
    };
  }

  public async createGenericClass(templateData: any) {
    const client = await this.getGoogleAuthClient();
    const { issuerId } = this.getCredentialsOrThrow();
    const classId = `${issuerId}.${templateData.classSuffix || 'linearcard_sandbox_class'}`;

    const cardRowTemplateInfos: any[] = [];
    if (templateData.rows && templateData.rows.length > 0) {
      templateData.rows.forEach((row: any) => {
        const items = row.columns.map((col: any, idx: number) => {
          const fieldId = col.key || `${row.id}_${idx}`;
          return {
            item: {
              fieldSelector: {
                fields: [
                  {
                    fieldPath: `object.textModulesData['${fieldId}']`,
                  },
                ],
              },
            },
          };
        });

        if (items.length === 1)
          cardRowTemplateInfos.push({ oneItem: items[0] });
        else if (items.length === 2)
          cardRowTemplateInfos.push({
            twoItems: { startItem: items[0], endItem: items[1] },
          });
        else if (items.length === 3)
          cardRowTemplateInfos.push({
            threeItems: {
              startItem: items[0],
              middleItem: items[1],
              endItem: items[2],
            },
          });
      });
    }

    const classPayload: any = {
      id: classId,
      issuerName: templateData.cardTitle || 'LinearCard',
      hexBackgroundColor: templateData.hexBackgroundColor || DEFAULT_PASS_HEX,
    };

    // Google Wallet ignores hexBackgroundColor if no logo is provided.
    // To match the frontend preview card's behavior, we generate a fallback initials logo.
    let finalLogoUrl = templateData.logoUrl;
    if (!finalLogoUrl) {
      const initials = (templateData.cardTitle || 'LC').substring(0, 2).toUpperCase();
      finalLogoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=f1f5f9&color=94a3b8&size=128&font-size=0.45`;
    }

    if (finalLogoUrl) {
      classPayload.logo = { sourceUri: { uri: finalLogoUrl } };
    }
    if (templateData.heroImageUrl) {
      classPayload.heroImage = {
        sourceUri: { uri: templateData.heroImageUrl },
      };
    }

    if (cardRowTemplateInfos.length > 0) {
      classPayload.classTemplateInfo = {
        cardTemplateOverride: {
          cardRowTemplateInfos,
        },
      };
    }

    // Google Wallet OS-level proximity notifications. Max 10 per class;
    // extras are truncated here rather than relying on Google to do it.
    // Uses the non-deprecated `merchantLocations` field (simple
    // {latitude, longitude} pairs) — NOT the deprecated `locations` /
    // `walletobjects#latLongPoint` shape used by older code.
    if (
      Array.isArray(templateData.storeLocations) &&
      templateData.storeLocations.length > 0
    ) {
      classPayload.merchantLocations = templateData.storeLocations
        .slice(0, 10)
        .map((l: { latitude: number | string; longitude: number | string }) => ({
          latitude: Number(l.latitude),
          longitude: Number(l.longitude),
        }));
    }

    // Fallback order:
    // 1. Explicit NEXT_PUBLIC_API_URL (set statically for production)
    // 2. VERCEL_URL (injected automatically in preview serverless environments)
    // 3. Localhost (development)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 
      (process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL}` : 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001'));

    classPayload.callbackOptions = {
      url: `${apiUrl}/passes/webhooks/google-wallet`
    };

    const url = `https://walletobjects.googleapis.com/walletobjects/v1/genericClass`;

    try {
      if (templateData.isUpdate) {
        this.logger.log(`Class ${classId} exists. Updating directly...`);
        const patchPayload = { ...classPayload };
        const updateRes = await client.request({
          url: `${url}/${classId}`,
          method: 'PATCH',
          data: patchPayload,
        });
        return updateRes.data;
      } else {
        const res = await client.request({
          url,
          method: 'POST',
          data: classPayload,
        });
        return res.data;
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        this.logger.log(
          `Class ${classId} already exists. Attempting update as fallback...`,
        );
        try {
          const patchPayload = { ...classPayload };
          const updateRes = await client.request({
            url: `${url}/${classId}`,
            method: 'PATCH',
            data: patchPayload,
          });
          return updateRes.data;
        } catch {
          return { id: classId, existing: true, updated: false };
        }
      }
      throw error;
    }
  }

  public async getGenericObject(passId: string) {
    const client = await this.getGoogleAuthClient();
    const url = `https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${passId}`;
    try {
      const res = await client.request({
        url,
        method: 'GET',
      });
      return res.data as any;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      this.logger.error(
        `Error fetching genericObject ${passId}:`,
        error.message,
      );
      throw error;
    }
  }

  public async updateGenericObject(passId: string, updateData: any) {
    const client = await this.getGoogleAuthClient();
    const url = `https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${passId}`;

    try {
      const getRes = await client.request({
        url,
        method: 'GET',
      });
      const genericObject: any = getRes.data;

      const patchPayload: any = {
        notifyPreference: 'notifyOnUpdate',
      };

      const formattedBalance =
        updateData.balance !== undefined
          ? updateData.balance.toString().includes('Pts')
            ? updateData.balance
            : `${updateData.balance} Pts`
          : undefined;

      if (genericObject.textModulesData) {
        patchPayload.textModulesData = [];
        genericObject.textModulesData.forEach((mod: any) => {
          let newBody = mod.body;
          if (mod.header.toLowerCase().includes('tier') && updateData.tier)
            newBody = updateData.tier;
          if (
            (mod.header.toLowerCase().includes('balance') ||
              mod.header.toLowerCase().includes('points')) &&
            formattedBalance !== undefined
          )
            newBody = formattedBalance;

          patchPayload.textModulesData.push({
            id: mod.id,
            header: mod.header,
            body: newBody,
          });
        });
      } else if (formattedBalance !== undefined || updateData.tier) {
        patchPayload.textModulesData = [
          {
            id: 'balance',
            header: 'Points / Status',
            body: formattedBalance || '0 Pts',
          },
          {
            id: 'tier_info',
            header: 'Tier Level',
            body: updateData.tier || 'Standard',
          },
        ];
      }

      if (updateData.tier) {
        patchPayload.subheader = {
          defaultValue: {
            language: 'en-US',
            value: updateData.tier,
          },
        };
      }

      if (
        genericObject.barcode &&
        (formattedBalance !== undefined || updateData.tier)
      ) {
        const currentTier =
          updateData.tier ||
          genericObject.subheader?.defaultValue?.value ||
          'Member';

        let displayBalance = formattedBalance;
        if (displayBalance === undefined) {
          if (genericObject.textModulesData) {
            const balMod = genericObject.textModulesData.find(
              (m: any) =>
                m.header.toLowerCase().includes('balance') ||
                m.header.toLowerCase().includes('points'),
            );
            if (balMod) displayBalance = balMod.body;
          }
          if (displayBalance === undefined) displayBalance = '0 Pts';
        }

        patchPayload.barcode = {
          ...genericObject.barcode,
          alternateText: `${currentTier} • ${displayBalance}`,
        };
      }

      if (updateData.hexBackgroundColor) {
        patchPayload.hexBackgroundColor = updateData.hexBackgroundColor;
      }

      if (updateData.pushNotification) {
        patchPayload.messages = [
          {
            header: 'LinearCard Update',
            body: updateData.pushNotification,
            id: `msg_${Date.now()}`,
          },
        ];
      }

      const res = await client.request({
        url,
        method: 'PATCH',
        data: patchPayload,
      });
      return res.data;
    } catch (err) {
      throw err;
    }
  }

  public async createGoogleWalletPass(options: GoogleWalletPassOptions) {
    const {
      passId,
      memberName = 'Dhyan Patel',
      cardTitle = 'LinearCard Platinum',
      balance = '1250 Pts',
      tier = 'Platinum',
      hexBackgroundColor = DEFAULT_PASS_HEX,
      classSuffix = 'linearcard_sandbox_class',
      logoUrl = '',
      heroImageUrl = '',
      rows = [],
    } = options;

    const barcodeValue =
      options.barcodeValue || `https://linearcard.vercel.app/m/${passId}`;
    const barcodeAltText = options.barcodeAltText || passId;

    const { issuerId, clientEmail, privateKey } = this.getCredentialsOrThrow();

    if (!passId) {
      throw new Error('passId is required to generate a Google Wallet pass.');
    }

    const objectSuffix = passId;
    const fullPassId = `${issuerId}.${objectSuffix}`;
    const classId = `${issuerId}.${classSuffix}`;

    const passData = {
      memberName,
      cardTitle,
      balance,
      tier,
      hexBackgroundColor,
      barcodeValue,
      barcodeAltText,
      passId: objectSuffix,
      fullPassId: fullPassId,
      createdAt: new Date().toISOString(),
    };

    const textModulesData: any[] = [];
    if (rows && rows.length > 0) {
      rows.forEach((row: any) => {
        row.columns.forEach((col: any, idx: number) => {
          let displayBody = col.body;
          if (col.header.toLowerCase().includes('tier')) displayBody = tier;
          if (
            col.header.toLowerCase().includes('balance') ||
            col.header.toLowerCase().includes('points')
          )
            displayBody = balance;

          textModulesData.push({
            id: col.key || `${row.id}_${idx}`,
            header: col.header,
            body: displayBody,
          });
        });
      });
    } else {
      textModulesData.push(
        { id: 'balance', header: 'Points / Status', body: balance },
        { id: 'tier_info', header: 'Tier Level', body: tier || 'Standard' },
      );
    }

    const genericObjectPayload = {
      id: fullPassId,
      classId: classId,
      cardTitle: {
        defaultValue: {
          language: 'en-US',
          value: cardTitle || 'LinearCard',
        },
      },
      subheader: {
        defaultValue: {
          language: 'en-US',
          value: tier || 'Member',
        },
      },
      header: {
        defaultValue: {
          language: 'en-US',
          value: memberName,
        },
      },
      textModulesData,
      barcode: {
        type: 'QR_CODE',
        value: barcodeValue,
        alternateText: `${tier || 'Member'} • ${balance || '0 Pts'}`,
      },
      hexBackgroundColor: hexBackgroundColor || DEFAULT_PASS_HEX,
    } as any;

    // Google Wallet ignores hexBackgroundColor if no logo is provided.
    // To match the frontend preview card's behavior, we generate a fallback initials logo.
    let finalLogoUrl = logoUrl;
    if (!finalLogoUrl) {
      const initials = (cardTitle || 'LC').substring(0, 2).toUpperCase();
      finalLogoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=f1f5f9&color=94a3b8&size=128&font-size=0.45`;
    }

    if (finalLogoUrl) {
      genericObjectPayload.logo = { sourceUri: { uri: finalLogoUrl } };
    }
    if (heroImageUrl) {
      genericObjectPayload.heroImage = { sourceUri: { uri: heroImageUrl } };
    }

    const client = await this.getGoogleAuthClient();
    try {
      await client.request({
        url: 'https://walletobjects.googleapis.com/walletobjects/v1/genericObject',
        method: 'POST',
        data: genericObjectPayload,
      });
    } catch (error: any) {
      this.logger.error(
        'Failed to create generic object in Google Wallet:',
        error.response?.data || error.message,
      );

      try {
        this.logger.log(
          `Attempting to auto-create missing class ${classId}...`,
        );
        await this.createGenericClass({
          classSuffix,
          cardTitle,
          hexBackgroundColor,
          logoUrl,
          heroImageUrl,
          rows,
        });
        await client.request({
          url: 'https://walletobjects.googleapis.com/walletobjects/v1/genericObject',
          method: 'POST',
          data: genericObjectPayload,
        });
      } catch (retryError: any) {
        this.logger.error(
          'Failed to auto-create class and retry object creation:',
          retryError.response?.data || retryError.message,
        );

        let errorMsg =
          'Google Wallet API rejected the pass payload. Verify Class ID and image URLs.';
        if (retryError.response?.data?.error?.message) {
          errorMsg += ` Details: ${retryError.response.data.error.message}`;
        }
        throw new Error(errorMsg);
      }
    }

    const claims = {
      iss: clientEmail,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(Date.now() / 1000),
      origins: [],
      payload: {
        genericObjects: [
          {
            id: fullPassId,
            classId: classId,
          },
        ],
      },
    };

    const token = jwt.sign(claims, privateKey, { algorithm: 'RS256' });
    const googleWalletUrl = `https://pay.google.com/gp/v/save/${token}`;

    return {
      success: true,
      googleWalletUrl,
      passId: objectSuffix,
      fullPassId,
      token,
      passData,
    };
  }

  public async verifyMarketingConsent(memberId: string): Promise<void> {
    const { data, error } = await this.supabaseService.client
      .from('ConsentLog')
      .select('consentedAt')
      .eq('memberId', memberId)
      .not('consentedAt', 'is', null)
      .limit(1)
      .single();

    if (error || !data?.consentedAt) {
      throw new ForbiddenException(
        'Member has not consented to promotional notifications.',
      );
    }
  }

  public async checkNotificationQuota(
    memberId: string,
    bypassQuota = false,
  ): Promise<void> {
    // Note: The 3 wallet notifications per 24hr limit has been permanently removed.
    return;
  }

  public async sendOfferMessage(
    resourceId: string,
    messageId: string,
    header: string,
    body: string,
  ): Promise<{ success: boolean; messageId: string; data?: any }> {
    try {
      const client = await this.getGoogleAuthClient();
      const response = await client.request({
        url: `https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${resourceId}/addMessage`,
        method: 'POST',
        data: {
          message: {
            id: messageId,
            header,
            body,
            messageType: 'TEXT_AND_NOTIFY',
          },
        },
      });

      this.logger.log(`Message sent: ${messageId} to ${resourceId}`);

      return {
        success: true,
        messageId,
        data: response.data,
      };
    } catch (error: any) {
      this.logger.error(
        `sendOfferMessage failed for ${resourceId}: ${error.message}`,
      );

      throw new HttpException(
        error.response?.data?.error?.message ||
          'Google Wallet addMessage failed',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async sendPromoMessageWithAudit(
    passId: string,
    memberId: string,
    tenantId: string,
    header: string,
    body: string,
    bypassQuota = false,
  ): Promise<{ success: boolean; messageId: string }> {
    const messageId = `msg_${Date.now()}`;
    const { issuerId } = this.getCredentialsOrThrow();

    // Support both short ID and full ID formats
    const resourceId = passId.includes('.') ? passId : `${issuerId}.${passId}`;

    try {
      // 1. Check consent
      await this.verifyMarketingConsent(memberId);

      // 2. Check quota
      await this.checkNotificationQuota(memberId, bypassQuota);

      // 3. Send to Google Wallet
      await this.sendOfferMessage(resourceId, messageId, header, body);

      // 4. Log success
      await this.notifyService.logNotification({
        tenantId,
        memberId,
        type: 'promo_message',
        channel: 'wallet_push',
        status: 'sent',
        header,
        body,
      });

      return {
        success: true,
        messageId,
      };
    } catch (error: any) {
      // 5. Log failure
      await this.notifyService.logNotification({
        tenantId,
        memberId,
        type: 'promo_message',
        channel: 'wallet_push',
        status: 'failed',
        errorReason: error.message,
        header,
        body,
      });

      // Re-throw so controller handles it
      throw error;
    }
  }

  /**
   * Dispatches real-time Google Wallet heads-up push notifications (TEXT_AND_NOTIFY)
   * and refreshes the card visual balance. Resilient try/catch ensures downstream delivery
   * issues never roll back or crash the transaction.
   */
  public async sendTransactionNotification(
    pass: {
      id: string;
      fullPassId: string;
      memberId: string;
      tenantId: string;
      phone?: string;
    },
    transaction: {
      type: 'award' | 'redeem';
      pointsChanged: number;
      newBalance: number;
      orderId?: string;
      orderAmount: number;
    },
    tenantName: string = 'LinearCard',
    tier?: string,
    design?: {
      hexBackgroundColor?: string;
      logoUrl?: string;
      heroImageUrl?: string;
    },
  ): Promise<{
    walletPushed: boolean;
    directNotified: boolean;
    warning?: string;
  }> {
    const isAward = transaction.type === 'award';
    const orderRef = transaction.orderId ? ` #${transaction.orderId}` : '';

    const pushTitle = isAward ? 'Points Earned! 🎉' : 'Points Redeemed! 💳';
    const pushBody = isAward
      ? `+${transaction.pointsChanged} pts earned on order${orderRef}. Balance: ${transaction.newBalance} Pts.`
      : `-${transaction.pointsChanged} pts redeemed on order${orderRef}. Balance: ${transaction.newBalance} Pts.`;

    let walletPushed = false;
    const directNotified = false;
    let warning: string | undefined;

    // 1. Google Wallet Pass Visual Refresh & OS Notification
    try {
      // 1a. Update generic pass object text modules and notifyPreference
      await this.updateGenericObject(pass.fullPassId, {
        balance: `${transaction.newBalance} Pts`,
        pushNotification: pushBody,
        ...(tier ? { tier } : {}),
        ...(design || {}),
      });

      // 1b. Dispatch explicit Google Wallet system tray notification (TEXT_AND_NOTIFY)
      const messageId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const { issuerId } = this.getCredentialsOrThrow();
      const resourceId = pass.fullPassId.includes('.')
        ? pass.fullPassId
        : `${issuerId}.${pass.fullPassId}`;

      await this.sendOfferMessage(resourceId, messageId, pushTitle, pushBody);
      walletPushed = true;

      await this.notifyService.logNotification({
        tenantId: pass.tenantId,
        memberId: pass.memberId,
        type: isAward ? 'points_awarded' : 'points_redeemed',
        channel: 'wallet_push',
        status: 'sent',
        header: pushTitle,
        body: pushBody,
      });
    } catch (err: any) {
      this.logger.warn(
        `Google Wallet notification warning for ${pass.fullPassId}: ${err.message}`,
      );
      warning = `Google Wallet notification sync delayed: ${err.message}`;
      await this.notifyService.logNotification({
        tenantId: pass.tenantId,
        memberId: pass.memberId,
        type: isAward ? 'points_awarded' : 'points_redeemed',
        channel: 'wallet_push',
        status: 'failed',
        errorReason: err.message,
        header: pushTitle,
        body: pushBody,
      });
    }

    return { walletPushed, directNotified, warning };
  }

  /**
   * Single post-transaction sync point: recomputes tier from thresholds,
   * pushes the balance/tier to the Google Wallet object, and fires WhatsApp
   * (redemption receipt always; tier-upgrade message only on a tier change).
   * Never throws — a delivery failure on any channel is logged and swallowed
   * so it can never roll back the underlying loyalty transaction.
   */
  public async syncPassAfterTransaction(
    pass: {
      id: string;
      fullPassId: string;
      memberId: string;
      tenantId: string;
      tier?: string;
      phone?: string;
      tiers?: Tier[];
    },
    transaction: {
      type: 'award' | 'redeem';
      pointsChanged: number;
      newBalance: number;
      orderId?: string;
      orderAmount: number;
    },
    tenantName: string = 'LinearCard',
  ): Promise<{
    walletPushed: boolean;
    directNotified: boolean;
    warning?: string;
    tier: string;
    tierChanged: boolean;
    isUpgrade?: boolean;
  }> {
    const tiers = pass.tiers || [];
    const previousTier = pass.tier || 'Standard';

    // Every Google Wallet call this method fans out to must use the pass's
    // OWN tenant credentials, not whatever instance happened to be injected.
    // Already-scoped instances (from forTenant) are reused as-is; the plain
    // injected singleton resolves the tenant's credentials here, which falls
    // back to env when the tenant has none configured — so behaviour is
    // unchanged for env-backed tenants.
    let scoped: WalletService = this;
    if (!this.credentials) {
      try {
        scoped = await this.forTenant(pass.tenantId);
      } catch (err: any) {
        this.logger.warn(
          `Falling back to env wallet credentials for pass ${pass.id}: ${err.message}`,
        );
      }
    }

    // No tiers configured for this tenant: leave the pass's tier field alone.
    // computeTier([]) returns null, which would otherwise silently stomp a
    // manually-set tier (e.g. from the dashboard balance-adjust endpoint) on
    // the very next scan.
    if (tiers.length === 0) {
      const { walletPushed, directNotified, warning } =
        await scoped.sendTransactionNotification(
          pass,
          transaction,
          tenantName,
        );

      if (pass.phone) {
        try {
          await this.whatsappService.sendRedemptionReceiptWithLog(
            pass.phone,
            `${transaction.newBalance} Pts`,
            tenantName,
            { tenantId: pass.tenantId, memberId: pass.memberId },
          );
        } catch (err: any) {
          this.logger.warn(
            `WhatsApp redemption receipt failed for pass ${pass.id}: ${err.message}`,
          );
        }
      }

      return {
        walletPushed,
        directNotified,
        warning,
        tier: previousTier,
        tierChanged: false,
      };
    }

    const nextTierRow = computeTier(transaction.newBalance, tiers);
    const nextTier = nextTierRow?.name ?? previousTier;
    const tierChanged = nextTier !== previousTier;

    // A tier's rank is its configured `minPoints` — higher minPoints means a
    // higher tier. Missing tiers (e.g. a manually-set tier name with no
    // matching entry) are treated as rank -1 so we never mislabel that
    // transition.
    const rankOf = (name: string): number =>
      tiers.find((t) => t.name === name)?.minPoints ?? -1;
    const isUpgrade = tierChanged && rankOf(nextTier) > rankOf(previousTier);

    // Payoff: a tier change carries its own `templateId`, so the pass design
    // (colour/logo/hero) swaps to match the new tier's template.
    let design:
      | { hexBackgroundColor?: string; logoUrl?: string; heroImageUrl?: string }
      | undefined;
    if (tierChanged && nextTierRow?.templateId) {
      try {
        const resolved = await this.resolveTenantPassDesign(
          pass.tenantId,
          nextTierRow.templateId,
        );
        design = {
          hexBackgroundColor: resolved.hexBackgroundColor,
          logoUrl: resolved.logoUrl,
          heroImageUrl: resolved.heroImageUrl,
        };
      } catch (err: any) {
        this.logger.warn(
          `Failed to resolve tier design for pass ${pass.id}: ${err.message}`,
        );
      }
    }

    if (tierChanged) {
      try {
        await this.supabaseService.client
          .from('Pass')
          .update({ tier: nextTier, tierId: nextTierRow?.id ?? null })
          .eq('id', pass.id);
      } catch (err: any) {
        this.logger.warn(
          `Failed to persist tier change for pass ${pass.id}: ${err.message}`,
        );
      }

      this.webhookService
        .dispatch(pass.tenantId, 'tier.changed', {
          passId: pass.id,
          memberId: pass.memberId,
          previousTier,
          tier: nextTier,
          isUpgrade,
        })
        .catch(() => {});
    }

    const { walletPushed, directNotified, warning } =
      await scoped.sendTransactionNotification(
        pass,
        transaction,
        tenantName,
        nextTier,
        design,
      );

    if (pass.phone) {
      try {
        await this.whatsappService.sendRedemptionReceiptWithLog(
          pass.phone,
          `${transaction.newBalance} Pts`,
          tenantName,
          { tenantId: pass.tenantId, memberId: pass.memberId },
        );
      } catch (err: any) {
        this.logger.warn(
          `WhatsApp redemption receipt failed for pass ${pass.id}: ${err.message}`,
        );
      }

      // Only celebrate actual upgrades — a large redemption can drop a member
      // to a lower tier, and "Congratulations, you've been upgraded" would be
      // wrong (and confusing) in that case.
      if (isUpgrade) {
        try {
          await this.whatsappService.sendTierUpgradeMessage(
            pass.phone,
            nextTier,
            tenantName,
            { tenantId: pass.tenantId, memberId: pass.memberId },
          );
        } catch (err: any) {
          this.logger.warn(
            `WhatsApp tier-upgrade message failed for pass ${pass.id}: ${err.message}`,
          );
        }
      }
    }

    return {
      walletPushed,
      directNotified,
      warning,
      tier: nextTier,
      tierChanged,
      isUpgrade,
    };
  }

  /**
   * Processes order-linked loyalty transactions (Award 10% or Redeem max 50% cap).
   * Validates inputs, calculates point changes, updates database balance,
   * records an immutable AuditLog entry, and pushes real-time wallet notifications.
   */
  public async processOrderTransaction(
    passIdentifier: string,
    amountInput: number | string,
    transactionType: 'award' | 'redeem',
    source: 'manual' | 'webhook',
    orderId?: string,
    adminId?: string,
    staffTenantId?: string,
  ): Promise<{
    success: boolean;
    pointsChanged: number;
    newBalance: number;
    discountApplied: number;
    payableAmount: number;
    orderAmount: number;
    orderId: string | null;
    passUpdateStatus: 'pushed_to_wallet' | 'sync_delayed';
    warning?: string;
    tier: string;
    tierChanged: boolean;
    isUpgrade?: boolean;
    transaction: any;
  }> {
    if (!passIdentifier) {
      throw new HttpException(
        'Pass ID is required to process transaction.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const amount = Number(amountInput);
    if (!amount || isNaN(amount) || amount <= 0) {
      throw new HttpException(
        'Order amount must be greater than ₹0.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (transactionType !== 'award' && transactionType !== 'redeem') {
      throw new HttpException(
        "Invalid transaction type. Must be either 'award' or 'redeem'.",
        HttpStatus.BAD_REQUEST,
      );
    }

    // Resolve Pass
    let pass: any = null;
    const cleanId = passIdentifier.includes('/m/')
      ? passIdentifier.split('/m/')[1]
      : passIdentifier;

    const isUUID =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        cleanId,
      );

    if (isUUID) {
      const { data } = await this.supabaseService.client
        .from('Pass')
        .select('*, Member(*), Tenant(*, PassTemplate(tierThresholds))')
        .eq('id', cleanId)
        .single();
      pass = data;
    }

    if (!pass) {
      const fullPassId = cleanId.includes('.')
        ? cleanId
        : `${this.getCredentialsOrThrow().issuerId}.${cleanId}`;
      const { data } = await this.supabaseService.client
        .from('Pass')
        .select('*, Member(*), Tenant(*, PassTemplate(tierThresholds))')
        .eq('fullPassId', fullPassId)
        .single();
      pass = data;
    }

    if (!pass) {
      const { data } = await this.supabaseService.client
        .from('Pass')
        .select('*, Member(*), Tenant(*, PassTemplate(tierThresholds))')
        .ilike('fullPassId', `%${cleanId}%`)
        .limit(1)
        .single();
      pass = data;
    }

    if (!pass && (/^\d{8,}$/.test(cleanId) || /^\+\d+$/.test(cleanId))) {
      const { data: phonePasses } = await this.supabaseService.client
        .from('Pass')
        .select('*, Member!inner(*), Tenant(*, PassTemplate(tierThresholds))')
        .ilike('Member.phone', `%${cleanId}%`)
        .order('createdAt', { ascending: false });
      if (phonePasses && phonePasses.length > 0) {
        pass = phonePasses[0];
      }
    }

    if (!pass) {
      throw new HttpException(
        `Pass '${passIdentifier}' was not found. Please verify Pass ID or barcode.`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Cross-tenant security check
    if (staffTenantId && pass.tenantId && pass.tenantId !== staffTenantId) {
      throw new HttpException(
        'Unauthorized: This pass belongs to a different store or brand.',
        HttpStatus.FORBIDDEN,
      );
    }

    const currentBalance = Number(pass.balance) || 0;
    let pointsChanged = 0;
    let newBalance = currentBalance;
    let discountApplied = 0;
    let payableAmount = amount;

    if (transactionType === 'award') {
      // 10% Earning Rule
      pointsChanged = Math.floor(amount * 0.1);
      newBalance = currentBalance + pointsChanged;
      discountApplied = 0;
      payableAmount = amount;
    } else {
      // Redeem Rule: 1 Point = ₹1, Max 50% Cap
      if (currentBalance <= 0) {
        throw new HttpException(
          'Customer has 0 points available. Point redemption cannot be applied to this order.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const maxDeductible = Math.floor(amount * 0.5);
      if (maxDeductible <= 0) {
        throw new HttpException(
          'Order amount is too small for point redemption (minimum ₹2 order).',
          HttpStatus.BAD_REQUEST,
        );
      }

      pointsChanged = Math.min(currentBalance, maxDeductible);
      discountApplied = pointsChanged;
      payableAmount = amount - discountApplied;
      newBalance = currentBalance - pointsChanged;
    }

    // 1. Update Pass balance in database
    const { error: dbError } = await this.supabaseService.client
      .from('Pass')
      .update({ balance: newBalance })
      .eq('id', pass.id);

    if (dbError) {
      this.logger.error(
        `Failed to update balance in database for pass ${pass.id}:`,
        dbError,
      );
      throw new HttpException(
        `Database error updating balance: ${dbError.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // 2. Insert immutable AuditLog entry
    try {
      await this.auditService.record({
        tenantId: pass.tenantId,
        memberId: pass.memberId,
        passId: pass.id,
        actor: adminId || 'system',
        action: 'order_transaction',
        details: {
          transactionType,
          source,
          orderId: orderId || null,
          orderAmount: amount,
          pointsChanged,
          previousBalance: currentBalance,
          newBalance,
          discountApplied,
          payableAmount,
        },
      });
    } catch (auditErr: any) {
      this.logger.warn(
        `AuditLog insertion warning for pass ${pass.id}: ${auditErr.message}`,
      );
    }

    this.webhookService
      .dispatch(
        pass.tenantId,
        transactionType === 'award' ? 'points.awarded' : 'points.redeemed',
        {
          passId: pass.id,
          memberId: pass.memberId,
          pointsChanged,
          newBalance,
          orderId: orderId || null,
        },
      )
      .catch(() => {});

    // 3. Recompute tier, sync Google Wallet, and dispatch WhatsApp
    // Real `Tier` rows for this tenant's canonical program, sorted for
    // computeTier. A unique index on Program.tenantId guarantees exactly one
    // Program per tenant (enforced in the 20260919000006 migration). We
    // still resolve the Program explicitly (oldest first) rather than
    // filtering Tier by tenantId directly, so that if the constraint is
    // ever bypassed (e.g. a stale row from before it existed), we use one
    // deterministic Program instead of silently merging tiers across all of
    // the tenant's Programs.
    const { data: programRow } = await this.supabaseService.client
      .from('Program')
      .select('id')
      .eq('tenantId', pass.tenantId)
      .order('createdAt', { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: tierRows } = programRow
      ? await this.supabaseService.client
          .from('Tier')
          .select('*')
          .eq('programId', programRow.id)
          .order('sortOrder', { ascending: true })
      : { data: [] };
    const tiers: Tier[] = tierRows || [];

    const syncResult = await this.syncPassAfterTransaction(
      {
        id: pass.id,
        fullPassId: pass.fullPassId,
        memberId: pass.memberId,
        tenantId: pass.tenantId,
        tier: pass.tier,
        phone: pass.Member?.phone,
        tiers,
      },
      {
        type: transactionType,
        pointsChanged,
        newBalance,
        orderId,
        orderAmount: amount,
      },
      pass.Tenant?.name,
    );

    return {
      success: true,
      pointsChanged,
      newBalance,
      discountApplied,
      payableAmount,
      orderAmount: amount,
      orderId: orderId || null,
      passUpdateStatus: syncResult.walletPushed
        ? 'pushed_to_wallet'
        : 'sync_delayed',
      warning: syncResult.warning,
      tier: syncResult.tier,
      tierChanged: syncResult.tierChanged,
      isUpgrade: syncResult.isUpgrade,
      transaction: {
        passId: pass.id,
        memberId: pass.memberId,
        memberName: pass.Member?.name || 'Member',
        action: transactionType,
        source,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
