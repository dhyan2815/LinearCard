import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

const VALID_ARCHETYPES = ['loyalty', 'membership', 'id_card', 'access_badge'] as const;

export async function GET(request: NextRequest) {
  try {
    const tenantId = new URL(request.url).searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'tenantId is required' }, { status: 400 });
    }

    const { data: templates, error } = await supabase
      .from('PassTemplate')
      .select('*')
      .eq('tenantId', tenantId)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    const formattedTemplates = (templates || []).map((t) => ({
      ...t,
      name: t.title,
    }));

    return NextResponse.json({ success: true, templates: formattedTemplates });
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, name, archetype, classSuffix, fieldRows, hexBackgroundColor, logoUrl, heroImageUrl } = body;

    if (!tenantId || !name || !archetype || !classSuffix) {
      return NextResponse.json(
        { success: false, error: 'tenantId, name, archetype, and classSuffix are required' },
        { status: 400 }
      );
    }

    if (!VALID_ARCHETYPES.includes(archetype)) {
      return NextResponse.json(
        { success: false, error: `archetype must be one of: ${VALID_ARCHETYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const { data: template, error } = await supabase
      .from('PassTemplate')
      .insert({
        tenantId,
        title: name,
        subtitle: name,
        archetype,
        classSuffix,
        fieldRows: fieldRows || [],
        hexBackgroundColor: hexBackgroundColor || '#1A365D',
        logoUrl: logoUrl || null,
        heroImageUrl: heroImageUrl || null,
        status: 'draft',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      template: {
        ...template,
        name: template.title,
      },
    });
  } catch (error: any) {
    console.error('Error creating template:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
