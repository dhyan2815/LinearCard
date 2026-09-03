import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-demo-key';

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

    let pass: any = null;

    // 1. Phone number check (if passId is likely a phone number)
    if (/^\d{8,}$/.test(passId) || /^\+\d+$/.test(passId)) {
       const { data: phonePasses } = await supabase
         .from('Pass')
         .select('*, Member!inner(*)')
         .ilike('Member.phone', `%${passId}%`)
         .order('createdAt', { ascending: false });

       if (phonePasses && phonePasses.length > 0) {
         const cookie = request.cookies.get('admin_session');
         let staffTenantId = null;
         if (cookie?.value) {
            try {
               const decoded: any = jwt.verify(cookie.value, JWT_SECRET);
               staffTenantId = decoded.tenantId;
            } catch (e) {
               // Ignore invalid session
            }
         }
         
         // If a staff member is logged in, prioritize returning the pass for their tenant
         if (staffTenantId) {
            pass = phonePasses.find((p: any) => p.tenantId === staffTenantId) || phonePasses[0];
         } else {
            pass = phonePasses[0];
         }
       }
    }

    // 2. Exact match check using fullPassId
    if (!pass) {
      const fullPassId = passId.includes('.') ? passId : `${process.env.ISSUER_ID}.${passId}`;
      const { data: exactPass } = await supabase
        .from('Pass')
        .select('*, Member!inner(*)')
        .eq('fullPassId', fullPassId)
        .single();
        
      pass = exactPass;
    }

    // 3. Fallback suffix/partial match
    if (!pass) {
       let { data: fallbackPass } = await supabase
         .from('Pass')
         .select('*, Member!inner(*)')
         .ilike('fullPassId', `%${passId}%`)
         .order('createdAt', { ascending: false })
         .limit(1)
         .single();
       pass = fallbackPass;
    }
    
    if (!pass) {
       return NextResponse.json({ valid: false, error: 'Pass not found or invalid' }, { status: 404 });
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
