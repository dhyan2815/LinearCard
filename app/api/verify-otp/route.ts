import { NextRequest, NextResponse } from 'next/server';
import { createGoogleWalletPass } from '@/lib/google-wallet';
import { sendPassLinkWithLog } from '@/lib/whatsapp';
import { supabase } from '@/lib/db';
import { verifyOtp } from '@/lib/otp';

/**
 * POST /api/verify-otp
 * Validates a submitted OTP, logs user consent, provisions a new Google Wallet pass,
 * and records the enrollment in the database.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { phone, otp, consentGiven, tenantId, ...passData } = body;

    if (!phone || !otp || !consentGiven) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    phone = phone.replace(/[^\d+]/g, '');

    // 1. Validate OTP
    const { data: otpSessions, error: otpError } = await supabase
      .from('OtpSession')
      .select('*')
      .eq('phone', phone)
      .eq('purpose', 'enrollment')
      .is('consumedAt', null)
      .order('createdAt', { ascending: false })
      .limit(1);

    // Deny access if no valid OTP session exists for this phone number
    if (otpError || !otpSessions || otpSessions.length === 0) {
      return NextResponse.json({ success: false, error: 'No active OTP found. Please request a new code.' }, { status: 401 });
    }

    const otpSession = otpSessions[0];

    // Enforce the 5-minute expiration window
    if (new Date().toISOString() > otpSession.expiresAt) {
      return NextResponse.json({ success: false, error: 'OTP has expired. Please request a new code.' }, { status: 401 });
    }

    // Verify the provided code matches the stored (hashed) code
    if (!verifyOtp(otp, otpSession.otpHash)) {
      return NextResponse.json({ success: false, error: 'Incorrect code. Please try again.' }, { status: 401 });
    }

    // Mark consumed
    await supabase
      .from('OtpSession')
      .update({ consumedAt: new Date().toISOString() })
      .eq('id', otpSession.id);

    // 2. Fetch tenant
    let targetTenantId = otpSession.tenantId || tenantId; // Use session's tenantId if available
    
    // Fallback if tenantId is missing (backwards compatibility for earlier flows)
    if (!targetTenantId) {
       const { data: coffeeTenant } = await supabase.from('Tenant').select('id').eq('classSuffix', 'beanhouse_coffee').single();
       targetTenantId = coffeeTenant?.id;
    }

    // Fail if tenant context cannot be resolved
    if (!targetTenantId) {
       return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
    }

    const { data: tenant, error: tenantError } = await supabase.from('Tenant').select('*').eq('id', targetTenantId).single();
    // Validate that the resolved tenant actually exists in the DB
    if (tenantError || !tenant) {
       return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
    }

    // 3. Log consent & Create member
    const { data: member, error: memberError } = await supabase.from('Member').insert({
      phone,
      name: passData.memberName || phone,
      tenantId: targetTenantId,
      consentedAt: new Date().toISOString(),
    }).select().single();

    if (memberError || !member) {
      throw new Error(`Failed to create member: ${memberError?.message}`);
    }

    const { error: consentError } = await supabase.from('ConsentLog').insert({
      memberId: member.id,
      phone,
      ipAddress: request.headers.get('x-forwarded-for') || null,
      userAgent: request.headers.get('user-agent') || null,
      legalTextVersion: 'DPDP_v1',
    });

    if (consentError) {
      console.error('Failed to log consent:', consentError);
    }

    // 4. Generate Google Wallet pass with Tenant branding
    const startingTier = passData.tier || 'Bronze';
    const startingBalance = passData.balance || '0 Pts';

    const passResult = await createGoogleWalletPass({
      ...passData,
      tier: startingTier,
      balance: startingBalance,
      barcodeAltText: `${startingTier} Tier • ${startingBalance}`,
      cardTitle: tenant.name,
      classSuffix: tenant.classSuffix,
      hexBackgroundColor: tenant.brandHexColor,
      logoUrl: tenant.logoUrl?.startsWith('/') ? `${request.nextUrl.origin}${tenant.logoUrl}` : tenant.logoUrl,
      heroImageUrl: tenant.heroUrl?.startsWith('/') ? `${request.nextUrl.origin}${tenant.heroUrl}` : tenant.heroUrl,
    });
    
    let passRecordId = null;
    if (passResult.passId) {
      // Save Pass record in DB
      const { data: insertedPass, error: passError } = await supabase.from('Pass').insert({
        memberId: member.id,
        tenantId: targetTenantId,
        fullPassId: passResult.passId,
        balance: 0,
        tier: startingTier,
      }).select().single();
      
      if (passError) {
        console.error('Failed to save pass to DB:', passError);
      } else if (insertedPass) {
        passRecordId = insertedPass.id;
      }
    }

    // 5. Send WhatsApp pass link (parallel, non-blocking)
    // Only dispatch the WhatsApp message if the pass URL was generated and a DB record exists
    if (passResult.googleWalletUrl && passRecordId) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
      const shortUrl = `${baseUrl}/api/p/${passRecordId}`;
      
      sendPassLinkWithLog(
        phone, 
        shortUrl, 
        passData.memberName || phone, 
        tenant.name,
        { tenantId: targetTenantId, memberId: member.id }
      ).catch(err => console.error('WhatsApp pass link failed (non-fatal):', err)); // Log but do not crash on delivery failure
    }

    return NextResponse.json({ success: true, ...passResult });
  } catch (error: any) {
    console.error('API Error verifying OTP:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}
