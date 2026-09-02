import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { updateGenericObject } from '@/lib/google-wallet';
import { logNotification } from '@/lib/notify';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-demo-key';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: memberId } = await params;
    const cookie = request.cookies.get('admin_session');
    if (!cookie?.value) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    let adminPayload: any;
    try {
      adminPayload = jwt.verify(cookie.value, JWT_SECRET);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
    }

    const { passId, newBalance, newTier, note } = await request.json();
    if (passId === undefined || newBalance === undefined)
      return NextResponse.json({ success: false, error: 'passId and newBalance are required' }, { status: 400 });

    const parsedBalance = parseInt(String(newBalance), 10);
    if (isNaN(parsedBalance) || parsedBalance < 0)
      return NextResponse.json({ success: false, error: 'newBalance must be a non-negative integer' }, { status: 400 });

    const { data: pass, error: passError } = await supabase
      .from('Pass')
      .select('*')
      .eq('id', passId)
      .eq('memberId', memberId)
      .single();
    if (passError || !pass) return NextResponse.json({ success: false, error: 'Pass not found for this member' }, { status: 404 });

    const previousValue = { balance: pass.balance, tier: pass.tier };
    const newTierValue = newTier || pass.tier;

    const { error: updateError } = await supabase
      .from('Pass')
      .update({ balance: parsedBalance, tier: newTierValue, updatedAt: new Date().toISOString() })
      .eq('id', passId);
    if (updateError) throw updateError;

    await supabase.from('AuditLog').insert({
      tenantId: pass.tenantId,
      memberId,
      action: 'manual_balance_adjustment',
      actor: adminPayload.adminId ? `admin:${adminPayload.adminId}` : 'admin',
      details: {
        passId,
        adminId: adminPayload.adminId || null,
        previousValue,
        newValue: { balance: parsedBalance, tier: newTierValue },
        note: note || null,
      },
    });

    const pushMessage = note || `Your balance was updated to ${parsedBalance} points.`;
    Promise.all([
      updateGenericObject(pass.fullPassId, { balance: parsedBalance.toString(), tier: newTierValue, pushNotification: pushMessage })
        .then(() => logNotification({ supabase, tenantId: pass.tenantId, memberId, type: 'balance_update', channel: 'wallet_push', status: 'sent' }))
        .catch((err) => logNotification({ supabase, tenantId: pass.tenantId, memberId, type: 'balance_update', channel: 'wallet_push', status: 'failed', errorReason: err.message })),
    ]).catch((err) => console.error('Async adjust failed:', err));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
