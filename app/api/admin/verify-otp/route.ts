import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-demo-key';

export async function POST(request: NextRequest) {
  try {
    let { phone, otp } = await request.json();

    if (!phone || !otp) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    phone = phone.replace(/[^\d+]/g, '');

    const { data: otpSessions } = await supabase
      .from('OtpSession')
      .select('*')
      .eq('phone', phone)
      .eq('purpose', 'admin_login')
      .is('consumedAt', null)
      .order('createdAt', { ascending: false })
      .limit(1);

    if (!otpSessions || otpSessions.length === 0) {
      return NextResponse.json({ success: false, error: 'No active OTP found. Please request a new code.' }, { status: 401 });
    }

    const otpSession = otpSessions[0];

    if (new Date().toISOString() > otpSession.expiresAt) {
      return NextResponse.json({ success: false, error: 'OTP expired. Please request a new code.' }, { status: 401 });
    }

    if (otpSession.otpHash !== otp) {
      return NextResponse.json({ success: false, error: 'Invalid code. Please try again.' }, { status: 401 });
    }

    // Mark consumed
    await supabase.from('OtpSession').update({ consumedAt: new Date().toISOString() }).eq('id', otpSession.id);

    let { data: admin } = await supabase.from('Admin').select('*').eq('phone', phone).limit(1).single();
    
    if (!admin) {
      // Auto-create admin for the demo for the first tenant
      const { data: tenant } = await supabase.from('Tenant').select('id').limit(1).single();
      if (!tenant) {
        return NextResponse.json({ success: false, error: 'No tenants configured' }, { status: 500 });
      }
      
      const { data: newAdmin } = await supabase.from('Admin').insert({
          phone,
          tenantId: tenant.id,
          role: 'admin',
      }).select().single();
      
      admin = newAdmin;
    }

    const token = jwt.sign(
      { adminId: admin.id, tenantId: admin.tenantId, role: admin.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    const response = NextResponse.json({ success: true });
    
    // Set httpOnly cookie
    response.cookies.set({
      name: 'admin_session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('API Error verifying Admin OTP:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}
