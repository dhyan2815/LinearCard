import { NextResponse, NextRequest } from 'next/server';
import { getGoogleAuthClient } from '@/lib/google-wallet';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classSuffix = searchParams.get('classSuffix');
    
    if (!classSuffix) {
      return NextResponse.json({ success: false, error: 'classSuffix is required' }, { status: 400 });
    }
    
    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID || '3388000000023177673';
    const classId = `${issuerId}.${classSuffix}`;
    
    const client = await getGoogleAuthClient();
    try {
      await client.request({
        url: `https://walletobjects.googleapis.com/walletobjects/v1/genericClass/${classId}`,
        method: 'GET'
      });
      return NextResponse.json({ success: true, exists: true });
    } catch (err: any) {
      if (err.response && err.response.status === 404) {
        return NextResponse.json({ success: true, exists: false });
      }
      throw err;
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
