import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  try {
    const { count: memberCount, error: memberError } = await supabase
      .from('Member')
      .select('*', { count: 'exact', head: true });

    if (memberError) throw memberError;

    const { count: passCount, error: passError } = await supabase
      .from('Pass')
      .select('*', { count: 'exact', head: true });

    if (passError) throw passError;

    return NextResponse.json({
      success: true,
      memberCount: memberCount || 0,
      passCount: passCount || 0,
      walletStatus: 'Google Wallet — Active'
    });
  } catch (error: any) {
    console.error('API Error fetching stats:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}
