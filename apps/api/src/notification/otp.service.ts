import { Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class OtpService {
  constructor(private readonly supabaseService: SupabaseService) {}

  hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }

  verifyOtp(plainOtp: string, hashedOtp: string): boolean {
    const plainHash = Buffer.from(this.hashOtp(plainOtp));
    const stored = Buffer.from(hashedOtp);
    if (plainHash.length !== stored.length) return false;
    return timingSafeEqual(plainHash, stored);
  }

  async isOtpRateLimited(phone: string, purpose: string): Promise<boolean> {
    const { data } = await this.supabaseService.client
      .from('OtpSession')
      .select('id')
      .eq('phone', phone)
      .eq('purpose', purpose)
      .is('consumedAt', null)
      .gt('expiresAt', new Date().toISOString())
      .limit(1);
    return (data?.length ?? 0) > 0;
  }
}
