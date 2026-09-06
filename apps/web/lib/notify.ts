import type { SupabaseClient } from '@supabase/supabase-js';

export interface LogNotificationOpts {
  supabase: SupabaseClient;
  tenantId: string;
  memberId?: string;
  type: string;
  channel: 'whatsapp' | 'wallet_push';
  status: 'sent' | 'failed';
  errorReason?: string;
}

/** Never throws — logging failures must not crash the main request. */
export async function logNotification(opts: LogNotificationOpts): Promise<void> {
  const { supabase, tenantId, memberId, type, channel, status, errorReason } = opts;
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
      console.error('[notify] Failed to write NotificationLog:', error);
    }
  } catch (err) {
    console.error('[notify] Failed to write NotificationLog:', err);
  }
}
