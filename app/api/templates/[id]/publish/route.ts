import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { createGenericClass } from '@/lib/google-wallet';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: template, error: fetchError } = await supabase
      .from('PassTemplate')
      .select('*, tenant:Tenant(*)')
      .eq('id', id)
      .single();

    if (fetchError || !template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    const origin = request.nextUrl.origin;
    const rawLogoUrl = template.logoUrl || template.tenant?.logoUrl;
    const rawHeroImageUrl = template.heroImageUrl || template.tenant?.heroUrl;
    const logoUrl = rawLogoUrl?.startsWith('/') ? `${origin}${rawLogoUrl}` : rawLogoUrl;
    const heroImageUrl = rawHeroImageUrl?.startsWith('/') ? `${origin}${rawHeroImageUrl}` : rawHeroImageUrl;

    const classData = await createGenericClass({
      classSuffix: template.classSuffix || template.tenant?.classSuffix,
      cardTitle: template.tenant?.name || template.title,
      hexBackgroundColor: template.hexBackgroundColor || template.tenant?.brandHexColor,
      rows: template.fieldRows,
      logoUrl,
      heroImageUrl,
    });

    const { data: updated, error: updateError } = await supabase
      .from('PassTemplate')
      .update({
        status: 'published',
        googleClassId: classData.id,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      classData,
      template: {
        ...updated,
        name: updated.title,
      },
    });
  } catch (error: any) {
    console.error('Error publishing template:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
