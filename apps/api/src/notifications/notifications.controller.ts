import { Controller, Get, Post, Put, Delete, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { SupabaseService } from '../supabase/supabase.service';
import { OtpService } from '../notification/otp.service';
import { WhatsappService } from '../notification/whatsapp.service';
import { WalletService } from '../wallet/wallet.service';
import { NotifyService } from '../notification/notify.service';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

@Controller('notifications')
export class NotificationsController {

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly otpService: OtpService,
    private readonly whatsappService: WhatsappService,
    private readonly walletService: WalletService,
    private readonly notifyService: NotifyService
  ) {}


  @Get('log')
  async getnotificationslog(@Req() req: Request, @Res() res: Response) {
    try {
      const tenantId = req.query["tenantId"] as string;
      const limit = parseInt((req.query["limit"] as string) || '50', 10);

      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'tenantId is required' });
      }

      const { data: logs, error } = await this.supabaseService.client
      .from('NotificationLog')
      .select('*, member:Member(name, phone)')
      .eq('tenantId', tenantId)
      .order('sentAt', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return res.status(200).json({ success: true, logs: logs || [] });
  } catch (error: any) {
    console.error('API Error fetching notification logs:', error);
    return res.status(500).json({ success: false, error: error.message });
  }

  }

  @Post('send')
  async postnotificationssend(@Req() req: Request, @Res() res: Response) {
    
  try {
    const { tenantId, channel, message } = req.body;
    if (!tenantId || !channel || !message) {
      return res.status(400).json({ success: false, error: 'tenantId, channel, and message are required' });
    }
    if (!["whatsapp", "wallet_push"].includes(channel as any)) {
      return res.status(400).json({ success: false, error: `channel must be one of: ${["whatsapp", "wallet_push"].join(', ')}` });
    }

    const { data: members, error: memberError } = await this.supabaseService.client
      .from('Member')
      .select('id, phone, name, passes:Pass(id, fullPassId)')
      .eq('tenantId', tenantId);

    if (memberError) throw memberError;
    if (!members?.length) {
      return res.status(200).json({ success: true, sent: 0, failed: 0, message: 'No members' });
    }

    let sent = 0;
    let failed = 0;

    for (const member of members) {
      try {
        if (channel === 'whatsapp') {
          await this.whatsappService["wahaPost"]('/api/sendText', { chatId: `${member.phone.replace(/^\+/, '')}@c.us`, text: message });
          await this.notifyService.logNotification({ tenantId, memberId: member.id, type: 'campaign', channel: 'whatsapp', status: 'sent' });
          sent++;
        } else {
          const passes: any[] = (member as any).passes || [];
          if (!passes.length) {
            await this.notifyService.logNotification({ tenantId, memberId: member.id, type: 'campaign', channel: 'wallet_push', status: 'failed', errorReason: 'No pass' });
            failed++;
            continue;
          }
          for (const pass of passes) {
            await this.walletService.updateGenericObject(pass.fullPassId, { pushNotification: message });
            await this.notifyService.logNotification({ tenantId, memberId: member.id, type: 'campaign', channel: 'wallet_push', status: 'sent' });
          }
          sent++;
        }
      } catch (err: any) {
        await this.notifyService.logNotification({ tenantId, memberId: member.id, type: 'campaign', channel: channel as any, status: 'failed', errorReason: err.message });
        failed++;
      }
    }

    return res.status(200).json({ success: true, sent, failed });
  } catch (error: any) {
    console.error('API Error sending notifications:', error);
    return res.status(500).json({ success: false, error: error.message });
  }

  }
}
