import { createHash, timingSafeEqual } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

export function verifyOtp(plainOtp: string, hashedOtp: string): boolean {
  const plainHash = Buffer.from(hashOtp(plainOtp));
  const stored    = Buffer.from(hashedOtp);
  if (plainHash.length !== stored.length) return false;
  return timingSafeEqual(plainHash, stored);
}

export async function isOtpRateLimited(
  phone: string,
  purpose: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data } = await supabase
    .from('OtpSession')
    .select('id')
    .eq('phone', phone)
    .eq('purpose', purpose)
    .is('consumedAt', null)
    .gt('expiresAt', new Date().toISOString())
    .limit(1);
  return (data?.length ?? 0) > 0;
}
