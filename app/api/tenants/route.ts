import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  try {
    const { data: tenants, error } = await supabase
      .from('Tenant')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`DB Error: ${error.message}`);
    }

    return NextResponse.json({ success: true, tenants });
  } catch (error: any) {
    console.error('API Error fetching tenants:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch tenants' }, { status: 500 });
  }
}
