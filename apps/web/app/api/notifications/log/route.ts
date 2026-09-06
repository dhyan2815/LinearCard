import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const params = new URL(request.url).searchParams;
    const tenantId = params.get('tenantId');
    const limit = parseInt(params.get('limit') || '50', 10);

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'tenantId is required' }, { status: 400 });
    }

    const { data: logs, error } = await supabase
      .from('NotificationLog')
      .select('*, member:Member(name, phone)')
      .eq('tenantId', tenantId)
      .order('sentAt', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, logs: logs || [] });
  } catch (error: any) {
    console.error('API Error fetching notification logs:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
