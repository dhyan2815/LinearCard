import { NextRequest, NextResponse } from 'next/server';
import { sendOtp } from '@/lib/whatsapp';
import { supabase } from '@/lib/db';
import { hashOtp, isOtpRateLimited } from '@/lib/otp';

export async function POST(request: NextRequest) {
  try {
    let { phone } = await request.json();
    if (!phone) return NextResponse.json({ success: false, error: 'phone required' }, { status: 400 });
    phone = phone.replace(/[^\d+]/g, '');

    if (await isOtpRateLimited(phone, 'admin_login', supabase)) {
      return NextResponse.json(
        { success: false, error: 'An OTP was recently sent. Please wait before requesting a new code.' },
        { status: 429 }
      );
    }

    const otp       = String(Math.floor(1000 + Math.random() * 9000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error } = await supabase.from('OtpSession').insert({
      phone, otpHash: hashOtp(otp), purpose: 'admin_login', expiresAt,
    });
    if (error) throw new Error(`DB Error: ${error.message}`);

    await sendOtp(phone, otp);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error sending Admin OTP:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to send OTP' }, { status: 500 });
  }
}
