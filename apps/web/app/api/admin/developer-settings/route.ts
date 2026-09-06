import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-demo-key';

export async function GET(request: NextRequest) {
  try {
    const adminSession = request.cookies.get('admin_session');
    if (!adminSession?.value) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let tenantId: string | null = null;
    try {
      const decoded: any = jwt.verify(adminSession.value, JWT_SECRET);
      tenantId = decoded.tenantId || null;
    } catch {}

    const query = supabase.from('Tenant').select('*');
    if (tenantId) query.eq('id', tenantId);
    const { data: tenant } = await query.limit(1).single();

    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, apiKey: tenant.apiKey });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminSession = request.cookies.get('admin_session');
    if (!adminSession?.value) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let tenantId: string | null = null;
    try {
      const decoded: any = jwt.verify(adminSession.value, JWT_SECRET);
      tenantId = decoded.tenantId || null;
    } catch {}

    const query = supabase.from('Tenant').select('id');
    if (tenantId) query.eq('id', tenantId);
    const { data: tenant } = await query.limit(1).single();

    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
    }

    const newApiKey = crypto.randomUUID().replace(/-/g, '');
    
    const { error } = await supabase.from('Tenant').update({ apiKey: newApiKey }).eq('id', tenant.id);
    if (error) {
       throw new Error(`DB Error: ${error.message}`);
    }

    return NextResponse.json({ success: true, apiKey: newApiKey });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
