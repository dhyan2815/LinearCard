import { Injectable, Logger } from '@nestjs/common';
import { NotifyService } from './notify.service';
import { WhatsappProvider, WahaProvider } from './whatsapp.provider';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  /**
   * D6/Phase 2.6: every outbound message goes through one provider
   * interface. WAHA is the default implementation; a Cloud API provider
   * swaps in here and nowhere else.
   */
  private readonly provider: WhatsappProvider = new WahaProvider();

  constructor(private readonly notifyService: NotifyService) {}

  /**
   * Send-and-log, used by every message type below and by campaigns. Logging
   * both outcomes is the whole reason callers don't talk to the provider
   * directly.
   */
  public async sendTextWithLog(
    phone: string,
    text: string,
    opts: {
      tenantId: string;
      memberId?: string;
      type: string;
      campaignId?: string;
      header?: string;
    },
  ): Promise<void> {
    try {
      await this.provider.sendText(phone, text);
      await this.notifyService.logNotification({
        tenantId: opts.tenantId,
        memberId: opts.memberId,
        type: opts.type,
        channel: 'whatsapp',
        status: 'sent',
        campaignId: opts.campaignId,
        header: opts.header,
        body: text,
      });
    } catch (err: any) {
      await this.notifyService.logNotification({
        tenantId: opts.tenantId,
        memberId: opts.memberId,
        type: opts.type,
        channel: 'whatsapp',
        status: 'failed',
        errorReason: err?.message || String(err),
        campaignId: opts.campaignId,
        header: opts.header,
        body: text,
      });
      throw err;
    }
  }

  /** Unlogged send. Campaigns and one-offs that log themselves use this. */
  public async sendText(phone: string, text: string): Promise<any> {
    return this.provider.sendText(phone, text);
  }

  public async sendOtp(phone: string, otp: string, brandName?: string) {
    const brand = brandName || 'LinearCard';
    this.logger.log(`[DEV OTP] Target: ${phone} | Code: ${otp}`);
    return this.provider.sendText(
      phone,
      `🔐 Your ${brand} verification code is: *${otp}*\n\nThis code expires in 5 minutes. Do not share it with anyone.`,
    );
  }

  public async sendPassLink(
    phone: string,
    walletUrl: string,
    memberName: string,
    brandName: string,
  ) {
    return this.provider.sendText(
      phone,
      `🎉 Welcome, ${memberName}!\n\nYour *${brandName}* card has been securely saved to your Google Wallet.\nYou can now access it anytime to check your balance or scan at the store.\n\n_*Powered by LinearCard*_`,
    );
  }

  public async sendRedemptionReceipt(
    phone: string,
    newBalance: string,
    brandName: string,
  ) {
    return this.provider.sendText(
      phone,
      `✅ *Transaction Confirmed*\n\nYour *${brandName}* balance has been updated.\n\nNew Balance: *${newBalance}*\n\n_Your wallet pass will refresh automatically._`,
    );
  }

  // Logged wrappers
  public async sendPassLinkWithLog(
    phone: string,
    walletUrl: string,
    memberName: string,
    brandName: string,
    opts: { tenantId: string; memberId?: string },
  ): Promise<void> {
    return this.sendTextWithLog(
      phone,
      `🎟️ Welcome, ${memberName}!\n\nYour *${brandName}* loyalty pass is ready.\n\nTap to add it to Google Wallet:\n${walletUrl}\n\n_Powered by LinearCard_`,
      { ...opts, type: 'pass_link' },
    );
  }

  public async sendRedemptionReceiptWithLog(
    phone: string,
    newBalance: string,
    brandName: string,
    opts: { tenantId: string; memberId?: string },
  ): Promise<void> {
    return this.sendTextWithLog(
      phone,
      `🛒 *Transaction Confirmed*\n\nYour *${brandName}* balance has been updated.\n\nNew Balance: *${newBalance}*\n\n_Your wallet pass will refresh automatically._`,
      { ...opts, type: 'receipt' },
    );
  }

  public async sendWalletSaveConfirmationWithLog(
    phone: string,
    brandName: string,
    opts: { tenantId: string; memberId?: string },
  ): Promise<void> {
    return this.sendTextWithLog(
      phone,
      `🎉 Success! Your ${brandName} card has been securely saved to your Google Wallet. You can now access it anytime to check your balance or scan at the store.`,
      { ...opts, type: 'wallet_save_confirmation' },
    );
  }

  public async sendTierUpgradeMessage(
    phone: string,
    tierName: string,
    brandName: string,
    opts: { tenantId: string; memberId?: string },
  ): Promise<void> {
    return this.sendTextWithLog(
      phone,
      `🏆 Congratulations! You've been upgraded to *${tierName}* tier on your *${brandName}* card. Enjoy your new perks!`,
      { ...opts, type: 'tier_upgrade' },
    );
  }
}
