import { Controller, Get, Post, Put, Delete, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { SupabaseService } from '../supabase/supabase.service';
import { OtpService } from '../notification/otp.service';
import { WhatsappService } from '../notification/whatsapp.service';
import { WalletService } from '../wallet/wallet.service';
import { NotifyService } from '../notification/notify.service';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-demo-key';

function extractAdminToken(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  if (req.cookies?.admin_session) {
    const c = req.cookies.admin_session;
    return typeof c === 'object' && c?.value ? c.value : c;
  }
  const rawCookie = req.headers['cookie'];
  if (rawCookie) {
    const match = rawCookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

@Controller('passes')
export class PassesController {

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly otpService: OtpService,
    private readonly whatsappService: WhatsappService,
    private readonly walletService: WalletService,
    private readonly notifyService: NotifyService
  ) {}


  @Post('generate-pass')
  async postgeneratepass(@Req() req: Request, @Res() res: Response) {
    
  try {
    const body = req.body;
    
    let targetTenantId = body.tenantId;
    // Default to the first available tenant in the database if no tenant ID is explicitly provided
    if (!targetTenantId) {
      const { data: firstTenant } = await this.supabaseService.client.from('Tenant').select('id').limit(1).single();
      if (firstTenant) targetTenantId = firstTenant.id;
    }

    if (!targetTenantId) {
      throw new Error('No tenant found to associate with the pass.');
    }

    const phone = body.phone || body.barcodeAltText || '0000000000';
    
    // 1. Find or create the Member record first
    let { data: member } = await this.supabaseService.client
      .from('Member')
      .select('*')
      .eq('phone', phone)
      .eq('tenantId', targetTenantId)
      .single();
      
    // If the member does not exist in the database, create a new record for them
    if (!member) {
      const { data: newMember } = await this.supabaseService.client.from('Member').insert({
           phone,
           name: body.memberName || 'Unknown Member',
           tenantId: targetTenantId
      }).select().single();
      member = newMember;
    }

    if (!member) {
       throw new Error('Failed to resolve Member record.');
    }

    // 2. Generate the definitive, explicit Pass ID (UUID)
    const explicitPassId = crypto.randomUUID();

    // 3. Create the Google Wallet Pass using the explicit Pass ID
    const result = await this.walletService.createGoogleWalletPass({
      passId: explicitPassId,
      memberName: body.memberName,
      cardTitle: body.cardTitle,
      balance: body.balance ?? body.issueBalance,
      tier: body.tier ?? body.issueTier,
      hexBackgroundColor: body.hexBackgroundColor,
      barcodeValue: body.barcodeValue, // will fallback to passId if not provided
      barcodeAltText: body.barcodeAltText, // will fallback to passId if not provided
      classSuffix: body.classSuffix,
      logoUrl: body.logoUrl?.startsWith('/') ? `${"http://localhost:3000"}${body.logoUrl}` : body.logoUrl,
      heroImageUrl: body.heroImageUrl?.startsWith('/') ? `${"http://localhost:3000"}${body.heroImageUrl}` : body.heroImageUrl,
      rows: body.rows
    });

    // 4. Record the newly generated pass in the database, linked to the member and tenant
    let passRecordId = null;
    if (result.success && result.fullPassId) {
      const { data: insertedPass, error: passError } = await this.supabaseService.client.from('Pass').insert({
        id: explicitPassId, // Enforcing Pass ID as the primary key
        fullPassId: result.fullPassId,
        memberId: member.id,
        tenantId: targetTenantId,
        balance: parseInt(body.balance ?? body.issueBalance ?? '0', 10) || 0,
        tier: body.tier ?? body.issueTier ?? 'Standard',
        barcodeAlt: body.barcodeAltText || explicitPassId
      }).select().single();
      
      if (passError) {
        console.error("Error inserting Pass into database:", passError);
      } else if (insertedPass) {
        passRecordId = insertedPass.id;
      }

      // 5. Trigger WhatsApp delivery if reqed
      if (body.deliverWhatsapp && body.phone && passRecordId) {
         const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
         const shortUrl = `${baseUrl}/api/p/${passRecordId}`;
         
         this.whatsappService.sendPassLinkWithLog(
           body.phone,
           shortUrl,
           body.memberName || 'Member',
           body.cardTitle || 'LinearCard',
           { tenantId: targetTenantId, memberId: member.id }
         ).catch(e => console.error("WAHA delivery error:", e)); // Log delivery errors without failing the overall req
      }
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('API Error generating Google Wallet pass:', error);
    return res.status(500).json(
      {
        success: false,
        error: error.message || 'Failed to generate pass'
      });
  }

  }

  @Post('validate-pass')
  async postvalidatepass(@Req() req: Request, @Res() res: Response) {
    
  try {
    const { passId } = req.body;
    if (!passId) {
      return res.status(400).json({ success: false, error: 'passId is required' });
    }

    let pass: any = null;

    // 1. Phone number check (if passId is likely a phone number)
    if (/^\d{8,}$/.test(passId) || /^\+\d+$/.test(passId)) {
       const { data: phonePasses } = await this.supabaseService.client
         .from('Pass')
         .select('*, Member!inner(*)')
         .ilike('Member.phone', `%${passId}%`)
         .order('createdAt', { ascending: false });

       if (phonePasses && phonePasses.length > 0) {
         const token = extractAdminToken(req);
         let staffTenantId = null;
         if (token) {
            try {
               const decoded: any = jwt.verify(token, JWT_SECRET);
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
      const { data: exactPass } = await this.supabaseService.client
        .from('Pass')
        .select('*, Member!inner(*)')
        .eq('fullPassId', fullPassId)
        .single();
        
      pass = exactPass;
    }

    // 3. Fallback suffix/partial match
    if (!pass) {
       let { data: fallbackPass } = await this.supabaseService.client
         .from('Pass')
         .select('*, Member!inner(*)')
         .ilike('fullPassId', `%${passId}%`)
         .order('createdAt', { ascending: false })
         .limit(1)
         .single();
       pass = fallbackPass;
    }
    
    if (!pass) {
       return res.status(404).json({ valid: false, error: 'Pass not found or invalid' });
    }

    const member = pass.Member;

    return res.status(200).json({
      valid: true,
      memberName: member?.name || 'Unknown Member',
      balance: pass.balance.toString(),
      tier: pass.tier,
      fullPassId: pass.fullPassId,
      phone: member?.phone
    });
  } catch (error: any) {
    console.error('API Error validating pass:', error);
    return res.status(500).json({ 
      valid: false, 
      error: `Internal Server Error: ${error.message}`
    });
  }

  }

  @Post('update-pass')
  async postupdatepass(@Req() req: Request, @Res() res: Response) {
    
  try {
    const body = req.body;
    
    const { passId, balance, tier, pushNotification, phone, brandName } = body;
    if (!passId) {
      return res.status(400).json({ success: false, error: 'passId is required' });
    }

    // API Key or Admin Session Validation
    const rawToken = extractAdminToken(req);
    let authenticatedTenantId = null;

    if (rawToken) {
      try {
        const decoded: any = jwt.verify(rawToken, JWT_SECRET);
        authenticatedTenantId = decoded.tenantId;
      } catch {
        // Fallback to evaluating as an API key if not a valid JWT
      }
    }

    if (!authenticatedTenantId) {
      const authHeader = req.headers['authorization'] as string;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const { data: tenant } = await this.supabaseService.client.from('Tenant').select('id').eq('apiKey', token).single();
        if (tenant) {
          authenticatedTenantId = tenant.id;
        }
      }
    }

    if (!authenticatedTenantId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid authentication' });
    }

    const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(passId);
    let pass = null;

    // 1. Strict Match: Try matching by the explicit Pass ID (database UUID)
    if (isUUID) {
      const { data } = await this.supabaseService.client
        .from('Pass')
        .select('*, Member(*), Tenant(*)')
        .eq('id', passId)
        .single();
      pass = data;
    }

    // 2. Legacy Fallback: Try matching by fullPassId or objectSuffix
    if (!pass) {
      const fullPassId = passId.includes('.') ? passId : `${process.env.ISSUER_ID}.${passId}`;
      let { data } = await this.supabaseService.client
        .from('Pass')
        .select('*, Member(*), Tenant(*)')
        .eq('fullPassId', fullPassId)
        .single();
      
      // 3. Partial Fallback: try doing a partial match if still not found
      if (!data) {
        const { data: fuzzyPass } = await this.supabaseService.client
          .from('Pass')
          .select('*, Member(*), Tenant(*)')
          .ilike('fullPassId', `%${passId}%`)
          .limit(1)
          .single();
        data = fuzzyPass;
      }
      pass = data;
    }

    if (!pass) {
      return res.status(404).json({ success: false, error: 'Pass not found in database.' });
    }

    // Security check: ensure the caller is authorized to modify passes for this specific tenant
    if (authenticatedTenantId && pass.tenantId !== authenticatedTenantId) {
       return res.status(403).json({ success: false, error: 'Unauthorized to modify this pass' });
    }

    const newBalance = parseInt(balance, 10);
    
    // Duplicate check: if the balance and tier are the same, just return success early.
    if (pass.balance === newBalance && pass.tier === tier) {
      return res.status(200).json({ success: true, updatedData: { skipped: true, reason: 'Duplicate' } });
    }

    // Write to DB first
    await this.supabaseService.client.from('Pass').update({
      balance: newBalance,
      tier: tier || pass.tier
    }).eq('id', pass.id);

    // Async follow-ups (Google PATCH + WAHA with logging)
    Promise.all([
      this.walletService.updateGenericObject(pass.fullPassId, { balance: balance.toString(), tier: tier || pass.tier, pushNotification })
        .then(() => this.notifyService.logNotification({ tenantId: pass.tenantId, memberId: pass.memberId as string, type: 'balance_update', channel: 'wallet_push', status: 'sent' }))
        .catch(err => this.notifyService.logNotification({ tenantId: pass.tenantId, memberId: pass.memberId as string, type: 'balance_update', channel: 'wallet_push', status: 'failed', errorReason: err?.message || String(err) })),
      (pass.Member?.phone || phone)
        ? this.whatsappService.sendRedemptionReceiptWithLog(pass.Member?.phone || phone, balance.toString(), pass.Tenant?.name || brandName || 'LinearCard', { tenantId: pass.tenantId, memberId: pass.memberId })
            .catch(err => console.error('WhatsApp receipt failed (non-fatal):', err))
        : Promise.resolve()
    ]).catch(err => {
      console.error('Async follow-up failed (non-fatal):', err);
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('API Error updating pass:', error);
    return res.status(500).json(
      {
        success: false,
        error: error.message || 'Failed to update pass'
      });
  }

  }

  @Post('create-class')
  async postcreateclass(@Req() req: Request, @Res() res: Response) {
    
  try {
    const body = req.body;
    
    // Google Wallet strictly requires absolute URLs for images; convert relative paths
    if (body.logoUrl?.startsWith('/')) {
      body.logoUrl = `${"http://localhost:3000"}${body.logoUrl}`;
    }
    if (body.heroImageUrl?.startsWith('/')) {
      body.heroImageUrl = `${"http://localhost:3000"}${body.heroImageUrl}`;
    }
    
    // In a real scenario, you'd parse `body` for background color, logo URL, etc.
    // For now we just pass it to createGenericClass
    const result = await this.walletService.createGenericClass(body);

    return res.status(200).json({ success: true, classData: result });
  } catch (error: any) {
    console.error('API Error creating Google Wallet class:', error);
    return res.status(500).json(
      {
        success: false,
        error: error.message || 'Failed to create generic class'
      });
  }

  }

  @Get('check-class')
  async getcheckclass(@Req() req: Request, @Res() res: Response) {
    
  try {
    const classSuffix = (req.query["classSuffix"] as string);
    
    if (!classSuffix) {
      return res.status(400).json({ success: false, error: 'classSuffix is required' });
    }
    
    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID || '3388000000023177673';
    const classId = `${issuerId}.${classSuffix}`;
    
    const client = await this.walletService.getGoogleAuthClient();
    try {
      await client.request({
        url: `https://walletobjects.googleapis.com/walletobjects/v1/genericClass/${classId}`,
        method: 'GET'
      });
      return res.status(200).json({ success: true, exists: true });
    } catch (err: any) {
      if (err.response && err.response.status === 404) {
        return res.status(200).json({ success: true, exists: false });
      }
      throw err;
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }

  }
}
