import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { createGoogleWalletPass } from '@/lib/google-wallet';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return new NextResponse('Missing pass ID', { status: 400 });
    }

    const { data: pass, error } = await supabase
      .from('Pass')
      .select('*, member:Member(*), tenant:Tenant(*)')
      .eq('id', id)
      .single();

    if (error || !pass) {
      console.error('Failed to fetch pass:', error);
      return new NextResponse('Pass not found', { status: 404 });
    }

    // Extract objectSuffix from fullPassId (e.g., 'ISSUER_ID.linearcard_sandbox_class_882190_baf0')
    const objectSuffixOverride = pass.fullPassId.split('.').pop();
    
    if (!objectSuffixOverride) {
       return new NextResponse('Invalid pass configuration', { status: 500 });
    }

    // Regenerate the JWT
    const passResult = await createGoogleWalletPass({
      memberName: pass.member.name || pass.member.phone,
      cardTitle: pass.tenant.name,
      balance: String(pass.balance),
      tier: pass.tier,
      hexBackgroundColor: pass.tenant.brandHexColor,
      barcodeValue: `https://linearcard.vercel.app/m/${pass.member.phone.replace(/[^0-9]/g, '')}`,
      barcodeAltText: pass.barcodeAlt || pass.member.phone.replace(/[^0-9]/g, ''),
      classSuffix: pass.tenant.classSuffix,
      logoUrl: pass.tenant.logoUrl?.startsWith('/') ? `${request.nextUrl.origin}${pass.tenant.logoUrl}` : pass.tenant.logoUrl,
      heroImageUrl: pass.tenant.heroUrl?.startsWith('/') ? `${request.nextUrl.origin}${pass.tenant.heroUrl}` : pass.tenant.heroUrl,
      objectSuffixOverride
    });

    if (passResult.success && passResult.googleWalletUrl) {
      return NextResponse.redirect(passResult.googleWalletUrl);
    } else {
      return new NextResponse('Failed to generate pass URL', { status: 500 });
    }
  } catch (err: any) {
    console.error('Error in short URL redirect:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
