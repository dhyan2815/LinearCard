import { NextRequest, NextResponse } from 'next/server';
import { createGoogleWalletPass } from '@/lib/google-wallet';
import { supabase } from '@/lib/db';
import { sendPassLink } from '@/lib/whatsapp';
import crypto from 'crypto';

/**
 * POST /api/generate-pass
 * Generates a signed Google Wallet pass (JWT) for a specific member and logs the pass in the database.
 * It strictly uses a UUID as the Pass ID to ensure exact alignment between the database and Google Wallet.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    let targetTenantId = body.tenantId;
    // Default to the first available tenant in the database if no tenant ID is explicitly provided
    if (!targetTenantId) {
      const { data: firstTenant } = await supabase.from('Tenant').select('id').limit(1).single();
      if (firstTenant) targetTenantId = firstTenant.id;
    }

    if (!targetTenantId) {
      throw new Error('No tenant found to associate with the pass.');
    }

    const phone = body.phone || body.barcodeAltText || '0000000000';
    
    // 1. Find or create the Member record first
    let { data: member } = await supabase
      .from('Member')
      .select('*')
      .eq('phone', phone)
      .eq('tenantId', targetTenantId)
      .single();
      
    // If the member does not exist in the database, create a new record for them
    if (!member) {
      const { data: newMember } = await supabase.from('Member').insert({
           phone,
           name: body.memberName || 'Unknown Member',
           tenantId: targetTenantId
      }).select().single();
      member = newMember;
    }

    if (!member) {
       throw new Error('Failed to resolve Member record.');
    }

    // 2. Generate the definitive, explicit Pass ID (UUID)
    const explicitPassId = crypto.randomUUID();

    // 3. Create the Google Wallet Pass using the explicit Pass ID
    const result = await createGoogleWalletPass({
      passId: explicitPassId,
      memberName: body.memberName,
      cardTitle: body.cardTitle,
      balance: body.balance ?? body.issueBalance,
      tier: body.tier ?? body.issueTier,
      hexBackgroundColor: body.hexBackgroundColor,
      barcodeValue: body.barcodeValue, // will fallback to passId if not provided
      barcodeAltText: body.barcodeAltText, // will fallback to passId if not provided
      classSuffix: body.classSuffix,
      logoUrl: body.logoUrl?.startsWith('/') ? `${request.nextUrl.origin}${body.logoUrl}` : body.logoUrl,
      heroImageUrl: body.heroImageUrl?.startsWith('/') ? `${request.nextUrl.origin}${body.heroImageUrl}` : body.heroImageUrl,
      rows: body.rows
    });

    // 4. Record the newly generated pass in the database, linked to the member and tenant
    let passRecordId = null;
    if (result.success && result.fullPassId) {
      const { data: insertedPass, error: passError } = await supabase.from('Pass').insert({
        id: explicitPassId, // Enforcing Pass ID as the primary key
        fullPassId: result.fullPassId,
        memberId: member.id,
        tenantId: targetTenantId,
        balance: parseInt(body.balance ?? body.issueBalance ?? '0', 10) || 0,
        tier: body.tier ?? body.issueTier ?? 'Standard',
        barcodeAlt: body.barcodeAltText || explicitPassId
      }).select().single();
      
      if (passError) {
        console.error("Error inserting Pass into database:", passError);
      } else if (insertedPass) {
        passRecordId = insertedPass.id;
      }

      // 5. Trigger WhatsApp delivery if requested
      if (body.deliverWhatsapp && body.phone && passRecordId) {
         const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
         const shortUrl = `${baseUrl}/api/p/${passRecordId}`;
         
         sendPassLink(
           body.phone,
           shortUrl,
           body.memberName || 'Member',
           body.cardTitle || 'LinearCard'
         ).catch(e => console.error("WAHA delivery error:", e)); // Log delivery errors without failing the overall request
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error generating Google Wallet pass:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate pass'
      },
      { status: 500 }
    );
  }
}
