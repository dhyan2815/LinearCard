import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  try {
    const { data: members, error } = await supabase
      .from('Member')
      .select('id, name, phone, tenantId, createdAt, passes:Pass(id, fullPassId, tier, balance)')
      .order('createdAt', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, members });
  } catch (error: any) {
    console.error('API Error fetching members:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch members' }, { status: 500 });
  }
}
