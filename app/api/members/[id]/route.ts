import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data: member, error } = await supabase.from('Member').select('*, Tenant(name)').eq('id', id).single();
    if (error || !member) return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 });

    const [{ data: passes }, { data: auditLog }, { data: consentLog }] = await Promise.all([
      supabase.from('Pass').select('*').eq('memberId', id).order('createdAt', { ascending: false }),
      supabase.from('AuditLog').select('*').eq('memberId', id).order('createdAt', { ascending: false }).limit(50),
      supabase.from('ConsentLog').select('*').eq('memberId', id).order('consentedAt', { ascending: false }),
    ]);

    const formattedAuditLog = (auditLog || []).map((entry: any) => ({
      ...entry,
      ...(entry.details && typeof entry.details === 'object' ? entry.details : {}),
    }));

    return NextResponse.json({
      success: true,
      member: {
        ...member,
        passes: passes || [],
        auditLog: formattedAuditLog,
        consentLog: consentLog || [],
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
