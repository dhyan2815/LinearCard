import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface LogNotificationOpts {
  tenantId: string;
  memberId?: string;
  type: string;
  channel: 'whatsapp' | 'wallet_push';
  status: 'sent' | 'failed';
  errorReason?: string;
}

@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /** Never throws — logging failures must not crash the main request. */
  async logNotification(opts: LogNotificationOpts): Promise<void> {
    const { tenantId, memberId, type, channel, status, errorReason } = opts;
    try {
      const { error } = await this.supabaseService.client
        .from('NotificationLog')
        .insert({
          tenantId,
          memberId: memberId || null,
          type,
          channel,
          status,
          error: errorReason || null,
        });
      if (error) {
        this.logger.error('[notify] Failed to write NotificationLog:', error);
      }
    } catch (err) {
      this.logger.error('[notify] Failed to write NotificationLog:', err);
    }
  }
}
