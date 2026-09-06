import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

export interface LogNotificationOpts {
  supabase: SupabaseClient;
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

  /** Never throws — logging failures must not crash the main request. */
  async logNotification(opts: LogNotificationOpts): Promise<void> {
    const { supabase, tenantId, memberId, type, channel, status, errorReason } =
      opts;
    try {
      const { error } = await supabase.from('NotificationLog').insert({
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
