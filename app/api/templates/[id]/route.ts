import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

const VALID_ARCHETYPES = ['loyalty', 'membership', 'id_card', 'access_badge'] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: template, error } = await supabase
      .from('PassTemplate')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      template: {
        ...template,
        name: template.title,
      },
    });
  } catch (error: any) {
    console.error('Error fetching template by id:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, title, subtitle, archetype, classSuffix, fieldRows, hexBackgroundColor, logoUrl, heroImageUrl } = body;

    const patch: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) {
      patch.title = name;
      patch.subtitle = name;
    }
    if (title !== undefined) patch.title = title;
    if (subtitle !== undefined) patch.subtitle = subtitle;
    if (classSuffix !== undefined) patch.classSuffix = classSuffix;
    if (fieldRows !== undefined) patch.fieldRows = fieldRows;
    if (hexBackgroundColor !== undefined) patch.hexBackgroundColor = hexBackgroundColor;
    if (logoUrl !== undefined) patch.logoUrl = logoUrl;
    if (heroImageUrl !== undefined) patch.heroImageUrl = heroImageUrl;

    if (archetype !== undefined) {
      if (!VALID_ARCHETYPES.includes(archetype)) {
        return NextResponse.json(
          { success: false, error: `archetype must be one of: ${VALID_ARCHETYPES.join(', ')}` },
          { status: 400 }
        );
      }
      patch.archetype = archetype;
    }

    const { data: template, error } = await supabase
      .from('PassTemplate')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error || !template) {
      return NextResponse.json({ success: false, error: error ? error.message : 'Template not found' }, { status: error ? 500 : 404 });
    }

    return NextResponse.json({
      success: true,
      template: {
        ...template,
        name: template.title,
      },
    });
  } catch (error: any) {
    console.error('Error updating template:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await supabase.from('PassTemplate').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
