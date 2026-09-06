import { NextRequest, NextResponse } from 'next/server';
import { sendOtp } from '@/lib/whatsapp';
import { supabase } from '@/lib/db';
import { hashOtp, isOtpRateLimited } from '@/lib/otp';

export async function POST(request: NextRequest) {
  try {
    let { phone, tenantId } = await request.json();
    if (!phone) return NextResponse.json({ success: false, error: 'phone required' }, { status: 400 });
    phone = phone.replace(/[^\d+]/g, '');

    if (await isOtpRateLimited(phone, 'enrollment', supabase)) {
      return NextResponse.json(
        { success: false, error: 'An OTP was recently sent. Please wait before requesting a new code.' },
        { status: 429 }
      );
    }

    const otp       = '1234'; // HARDCODED for WAHA error workaround
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    let brandName = 'LinearCard';
    if (tenantId) {
      const { data: tenant } = await supabase.from('Tenant').select('name').eq('id', tenantId).single();
      if (tenant) brandName = tenant.name;
    }

    const { error: insertError } = await supabase.from('OtpSession').insert({
      phone, otpHash: hashOtp(otp), purpose: 'enrollment', tenantId: tenantId || null, expiresAt,
    });
    if (insertError) throw new Error(`DB Error: ${insertError.message}`);

    await sendOtp(phone, otp, brandName);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error sending OTP:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to send OTP' }, { status: 500 });
  }
}
