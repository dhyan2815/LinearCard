import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

/**
 * POST /api/validate-pass
 * Checks if a scanned pass ID exists in the database and returns its current balance and tier.
 * Used by the frontend QR scanner.
 */
export async function POST(request: NextRequest) {
  try {
    const { passId } = await request.json();
    if (!passId) {
      return NextResponse.json({ success: false, error: 'passId is required' }, { status: 400 });
    }

    const fullPassId = passId.includes('.') ? passId : `${process.env.ISSUER_ID}.${passId}`;

    let { data: pass } = await supabase
      .from('Pass')
      .select('*, Member!inner(*)')
      .eq('fullPassId', fullPassId)
      .single();

    if (!pass) {
       // Also check short pass id just in case the scanner only read the suffix (using ilike)
       let { data: fallbackPass } = await supabase
         .from('Pass')
         .select('*, Member!inner(*)')
         .ilike('fullPassId', `%${passId}%`)
         .limit(1)
         .single();
       
       // If the scanned passId consists of digits, it might be the user's phone number
       if (!fallbackPass && /^\d+$/.test(passId)) {
          const { data: phonePass } = await supabase
            .from('Pass')
            .select('*, Member!inner(*)')
            .ilike('Member.phone', `%${passId}%`)
            .order('createdAt', { ascending: false })
            .limit(1)
            .single();
            
          if (phonePass) {
             fallbackPass = phonePass;
          }
       }
       
       pass = fallbackPass;
       
       // If no pass record matches, return a 404 so the scanner can display an invalid state
       if (!pass) {
          return NextResponse.json({ valid: false, error: 'Pass not found or invalid' }, { status: 404 });
       }
    }

    const member = pass.Member;

    return NextResponse.json({
      valid: true,
      memberName: member?.name || 'Unknown Member',
      balance: pass.balance.toString(),
      tier: pass.tier,
      fullPassId: pass.fullPassId,
      phone: member?.phone
    });
  } catch (error: any) {
    console.error('API Error validating pass:', error);
    return NextResponse.json({ 
      valid: false, 
      error: `Internal Server Error: ${error.message}`
    }, { status: 500 });
  }
}
