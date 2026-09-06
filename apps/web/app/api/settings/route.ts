import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-demo-key';

async function getTenantId(request: NextRequest): Promise<string | null> {
  const cookie = request.cookies.get('admin_session');
  if (!cookie?.value) return null;
  try {
    const p: any = jwt.verify(cookie.value, JWT_SECRET);
    return p.tenantId || null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const tenantId = await getTenantId(request);
  if (!tenantId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const { data: tenant, error } = await supabase
    .from('Tenant')
    .select('id, name, classSuffix, brandHexColor, apiKey, webhookUrl')
    .eq('id', tenantId)
    .single();
  if (error || !tenant) return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
  return NextResponse.json({ success: true, tenant });
}

export async function PATCH(request: NextRequest) {
  const tenantId = await getTenantId(request);
  if (!tenantId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  
  const body = await request.json().catch(() => ({}));
  const { webhookUrl } = body;
  const patch: Record<string, any> = {};
  if (webhookUrl !== undefined) {
    if (webhookUrl && !/^https?:\/\/.+/.test(webhookUrl)) {
      return NextResponse.json({ success: false, error: 'webhookUrl must be a valid http/https URL' }, { status: 400 });
    }
    patch.webhookUrl = webhookUrl || null;
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ success: false, error: 'No updateable fields provided' }, { status: 400 });
  }
  const { error } = await supabase.from('Tenant').update(patch).eq('id', tenantId);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
