import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  try {
    const [{ count: memberCount }, { count: passCount }, { data: passTiers }] = await Promise.all([
      supabase.from('Member').select('*', { count: 'exact', head: true }),
      supabase.from('Pass').select('*', { count: 'exact', head: true }),
      supabase.from('Pass').select('tier'),
    ]);

    const tierDistribution: Record<string, number> = {};
    (passTiers || []).forEach((p: any) => {
      const t = p.tier || 'Unknown';
      tierDistribution[t] = (tierDistribution[t] || 0) + 1;
    });

    const googleConnected = !!(process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.ISSUER_ID);

    return NextResponse.json({
      success: true,
      memberCount: memberCount || 0,
      passCount:   passCount   || 0,
      tierDistribution,
      walletStatus: {
        google:  googleConnected ? 'connected' : 'not_configured',
        apple:   'not_configured',
        samsung: 'pending_approval',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}
