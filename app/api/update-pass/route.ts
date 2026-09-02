import { NextRequest, NextResponse } from 'next/server';
import { updateGenericObject } from '@/lib/google-wallet';
import { sendRedemptionReceiptWithLog } from '@/lib/whatsapp';
import { logNotification } from '@/lib/notify';
import { supabase } from '@/lib/db';

/**
 * POST /api/update-pass
 * Updates an existing generic object (pass) with a new balance or tier.
 * Verifies authorization and syncs the changes to both the database and Google Wallet API.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { passId, balance, tier, pushNotification, phone, brandName } = body;
    if (!passId) {
      return NextResponse.json({ success: false, error: 'passId is required' }, { status: 400 });
    }

    // API Key Validation: check if the request is authenticated via a session cookie or a Bearer token
    const adminSession = request.cookies.get('admin_session');
    const authHeader = request.headers.get('authorization');
    let authenticatedTenantId = null;

    // If no session cookie exists, fallback to evaluating the Bearer token
    if (!adminSession?.value) {
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ success: false, error: 'Unauthorized: Missing API Key' }, { status: 401 });
      }
      const token = authHeader.substring(7);
      const { data: tenant } = await supabase.from('Tenant').select('id').eq('apiKey', token).single();
      // Ensure the provided token maps to a valid tenant in the database
      if (!tenant) {
        return NextResponse.json({ success: false, error: 'Invalid API Key' }, { status: 401 });
      }
      authenticatedTenantId = tenant.id;
    }

    const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(passId);
    let pass = null;

    // 1. Strict Match: Try matching by the explicit Pass ID (database UUID)
    if (isUUID) {
      const { data } = await supabase
        .from('Pass')
        .select('*, Member(*), Tenant(*)')
        .eq('id', passId)
        .single();
      pass = data;
    }

    // 2. Legacy Fallback: Try matching by fullPassId or objectSuffix
    if (!pass) {
      const fullPassId = passId.includes('.') ? passId : `${process.env.ISSUER_ID}.${passId}`;
      let { data } = await supabase
        .from('Pass')
        .select('*, Member(*), Tenant(*)')
        .eq('fullPassId', fullPassId)
        .single();
      
      // 3. Partial Fallback: try doing a partial match if still not found
      if (!data) {
        const { data: fuzzyPass } = await supabase
          .from('Pass')
          .select('*, Member(*), Tenant(*)')
          .ilike('fullPassId', `%${passId}%`)
          .limit(1)
          .single();
        data = fuzzyPass;
      }
      pass = data;
    }

    if (!pass) {
      return NextResponse.json({ success: false, error: 'Pass not found in database.' }, { status: 404 });
    }

    // Security check: ensure the caller is authorized to modify passes for this specific tenant
    if (authenticatedTenantId && pass.tenantId !== authenticatedTenantId) {
       return NextResponse.json({ success: false, error: 'Unauthorized to modify this pass' }, { status: 403 });
    }

    const newBalance = parseInt(balance, 10);
    
    // Duplicate check: if the balance and tier are the same, just return success early.
    if (pass.balance === newBalance && pass.tier === tier) {
      return NextResponse.json({ success: true, updatedData: { skipped: true, reason: 'Duplicate' } });
    }

    // Write to DB first
    await supabase.from('Pass').update({
      balance: newBalance,
      tier: tier || pass.tier
    }).eq('id', pass.id);

    // Async follow-ups (Google PATCH + WAHA with logging)
    Promise.all([
      updateGenericObject(pass.fullPassId, { balance: balance.toString(), tier: tier || pass.tier, pushNotification })
        .then(() => logNotification({ supabase, tenantId: pass.tenantId, memberId: pass.memberId, type: 'balance_update', channel: 'wallet_push', status: 'sent' }))
        .catch(err => logNotification({ supabase, tenantId: pass.tenantId, memberId: pass.memberId, type: 'balance_update', channel: 'wallet_push', status: 'failed', errorReason: err?.message || String(err) })),
      (pass.Member?.phone || phone)
        ? sendRedemptionReceiptWithLog(pass.Member?.phone || phone, balance.toString(), pass.Tenant?.name || brandName || 'LinearCard', { tenantId: pass.tenantId, memberId: pass.memberId })
            .catch(err => console.error('WhatsApp receipt failed (non-fatal):', err))
        : Promise.resolve()
    ]).catch(err => {
      console.error('Async follow-up failed (non-fatal):', err);
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error updating pass:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update pass'
      },
      { status: 500 }
    );
  }
}
