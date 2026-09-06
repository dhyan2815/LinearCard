import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const resolvedParams = await params;
    const slug = resolvedParams.slug;
    
    // Internal test tenant fallback
    if (slug === 'default' || slug === 'linearcard_demo') {
      const { data: demoTenant } = await supabase
        .from('Tenant')
        .select('*')
        .eq('classSuffix', 'linearcard_demo')
        .single();
      
      if (demoTenant) {
        return NextResponse.json({
          tenantId: demoTenant.id,
          name: demoTenant.name,
          brandHexColor: demoTenant.brandHexColor,
          logoUrl: demoTenant.logoUrl,
          heroUrl: demoTenant.heroUrl,
          classSuffix: demoTenant.classSuffix
        });
      }
      
      // Hardcoded fallback if DB seed hasn't run yet
      return NextResponse.json({
        tenantId: 'demo-tenant-123',
        name: 'LinearCard Demo Pass',
        brandHexColor: '#F97316',
        logoUrl: '/logo-linearcard.png',
        heroUrl: '/hero-linearcard.png',
        classSuffix: 'linearcard_demo'
      });
    }

    const { data: tenant, error } = await supabase
      .from('Tenant')
      .select('*')
      .eq('classSuffix', slug)
      .single();

    if (error || !tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      tenantId: tenant.id,
      name: tenant.name,
      brandHexColor: tenant.brandHexColor,
      logoUrl: tenant.logoUrl,
      heroUrl: tenant.heroUrl,
      classSuffix: tenant.classSuffix
    });

  } catch (error: any) {
    console.error('API Error fetching tenant:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tenant' },
      { status: 500 }
    );
  }
}
