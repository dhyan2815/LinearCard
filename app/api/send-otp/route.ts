import { NextRequest, NextResponse } from 'next/server';
import { sendOtp } from '@/lib/whatsapp';
import { supabase } from '@/lib/db';

/**
 * POST /api/send-otp
 * Generates a 4-digit OTP, stores it temporarily in the database, and sends it via WhatsApp.
 */
export async function POST(request: NextRequest) {
  try {
    let { phone, tenantId } = await request.json();
    if (!phone) {
      return NextResponse.json({ success: false, error: 'phone required' }, { status: 400 });
    }
    phone = phone.replace(/[^\d+]/g, '');

    const otp = String(Math.floor(1000 + Math.random() * 9000)); // 4-digit OTP
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Fetch tenant to get brand name for OTP message if tenantId is provided
    let brandName = 'LinearCard';
    if (tenantId) {
      const { data: tenant } = await supabase.from('Tenant').select('*').eq('id', tenantId).single();
      // Use the tenant's custom brand name if the record exists
      if (tenant) brandName = tenant.name;
    }

    // In a real app we'd hash the OTP before storing it. For demo, we store it plainly in otpHash.
    const { error: insertError } = await supabase.from('OtpSession').insert({
      phone,
      otpHash: otp,
      purpose: 'enrollment',
      tenantId: tenantId || null,
      expiresAt,
    });

    // Terminate request if the OTP session fails to save
    if (insertError) {
      throw new Error(`DB Error: ${insertError.message}`);
    }

    await sendOtp(phone, otp, brandName);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error sending OTP:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send OTP' },
      { status: 500 }
    );
  }
}
