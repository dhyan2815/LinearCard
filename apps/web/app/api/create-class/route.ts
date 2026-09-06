import { NextRequest, NextResponse } from 'next/server';
import { createGenericClass } from '@/lib/google-wallet';

/**
 * POST /api/create-class
 * Validates and pushes a generic class template to the Google Wallet API.
 * This defines the visual appearance and row structure for passes.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // Google Wallet strictly requires absolute URLs for images; convert relative paths
    if (body.logoUrl?.startsWith('/')) {
      body.logoUrl = `${request.nextUrl.origin}${body.logoUrl}`;
    }
    if (body.heroImageUrl?.startsWith('/')) {
      body.heroImageUrl = `${request.nextUrl.origin}${body.heroImageUrl}`;
    }
    
    // In a real scenario, you'd parse `body` for background color, logo URL, etc.
    // For now we just pass it to createGenericClass
    const result = await createGenericClass(body);

    return NextResponse.json({ success: true, classData: result });
  } catch (error: any) {
    console.error('API Error creating Google Wallet class:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create generic class'
      },
      { status: 500 }
    );
  }
}
