import { Injectable, Logger } from '@nestjs/common';
import { NotifyService } from './notify.service';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly notifyService: NotifyService) {}

  private toWahaId(phone: string): string {
    // Convert E.164 (+919876543210) -> Waha format (919876543210@c.us)
    return `${phone.replace(/^\+/, '')}@c.us`;
  }

  private async wahaPost(endpoint: string, body: object) {
    // WAHA temporarily disabled per RM due to unstable sessions causing errors
    this.logger.log(
      `[WAHA TEMPORARILY DISABLED] Skipping message to ${endpoint}. Payload: ${JSON.stringify(body)}`,
    );
    return { success: true };

    const WAHA_BASE_URL = process.env.WAHA_BASE_URL;
    const WAHA_API_KEY = process.env.WAHA_API_KEY;
    const WAHA_SESSION = process.env.WAHA_SESSION ?? 'default';

    // Gracefully handle missing base URL so the app can still run in offline/dev modes
    if (!WAHA_BASE_URL) {
      this.logger.warn(
        'WAHA_BASE_URL not set in .env. Skipping WhatsApp message.',
      );
      return;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // Optionally append the API key if configured
    if (WAHA_API_KEY) {
      headers['X-Api-Key'] = WAHA_API_KEY;
    }

    const url = `${WAHA_BASE_URL.replace(/\/$/, '')}${endpoint}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ session: WAHA_SESSION, ...body }),
      });

      // Throw a detailed error if the WAHA provider rejects the payload
      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Waha error ${res.status}: ${text}`);
        throw new Error(`Waha error ${res.status}: ${text}`);
      }

      return await res.json();
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp message to ${endpoint}:`,
        error,
      );
      throw error;
    }
  }

  public async sendOtp(phone: string, otp: string, brandName?: string) {
    const brand = brandName || 'LinearCard';
    this.logger.log(`[DEV OTP] Target: ${phone} | Code: ${otp}`);
    return this.wahaPost('/api/sendText', {
      chatId: this.toWahaId(phone),
      text: `🔐 Your ${brand} verification code is: *${otp}*\n\nThis code expires in 5 minutes. Do not share it with anyone.`,
    });
  }

  public async sendPassLink(
    phone: string,
    walletUrl: string,
    memberName: string,
    brandName: string,
  ) {
    return this.wahaPost('/api/sendText', {
      chatId: this.toWahaId(phone),
      text: `🎉 Welcome, ${memberName}!\n\nYour *${brandName}* loyalty pass is ready.\n\nTap to add it to Google Wallet:\n${walletUrl}\n\n_Powered by LinearCard_`,
    });
  }

  public async sendRedemptionReceipt(
    phone: string,
    newBalance: string,
    brandName: string,
  ) {
    return this.wahaPost('/api/sendText', {
      chatId: this.toWahaId(phone),
      text: `✅ *Transaction Confirmed*\n\nYour *${brandName}* balance has been updated.\n\nNew Balance: *${newBalance}*\n\n_Your wallet pass will refresh automatically._`,
    });
  }

  // Logged wrappers
  public async sendPassLinkWithLog(
    phone: string,
    walletUrl: string,
    memberName: string,
    brandName: string,
    opts: { tenantId: string; memberId?: string },
  ): Promise<void> {
    const text = `🎟️ Welcome, ${memberName}!\n\nYour *${brandName}* loyalty pass is ready.\n\nTap to add it to Google Wallet:\n${walletUrl}\n\n_Powered by LinearCard_`;
    try {
      await this.wahaPost('/api/sendText', {
        chatId: this.toWahaId(phone),
        text,
      });
      await this.notifyService.logNotification({
        tenantId: opts.tenantId,
        memberId: opts.memberId,
        type: 'pass_link',
        channel: 'whatsapp',
        status: 'sent',
      });
    } catch (err: any) {
      await this.notifyService.logNotification({
        tenantId: opts.tenantId,
        memberId: opts.memberId,
        type: 'pass_link',
        channel: 'whatsapp',
        status: 'failed',
        errorReason: err?.message || String(err),
      });
      throw err;
    }
  }

  public async sendRedemptionReceiptWithLog(
    phone: string,
    newBalance: string,
    brandName: string,
    opts: { tenantId: string; memberId?: string },
  ): Promise<void> {
    const text = `🛒 *Transaction Confirmed*\n\nYour *${brandName}* balance has been updated.\n\nNew Balance: *${newBalance}*\n\n_Your wallet pass will refresh automatically._`;
    try {
      await this.wahaPost('/api/sendText', {
        chatId: this.toWahaId(phone),
        text,
      });
      await this.notifyService.logNotification({
        tenantId: opts.tenantId,
        memberId: opts.memberId,
        type: 'receipt',
        channel: 'whatsapp',
        status: 'sent',
      });
    } catch (err: any) {
      await this.notifyService.logNotification({
        tenantId: opts.tenantId,
        memberId: opts.memberId,
        type: 'receipt',
        channel: 'whatsapp',
        status: 'failed',
        errorReason: err?.message || String(err),
      });
      throw err;
    }
  }
}
