import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SupabaseService } from '../supabase/supabase.service';
import { OtpService } from '../notification/otp.service';
import { WhatsappService } from '../notification/whatsapp.service';
import { NotifyService } from '../notification/notify.service';
import * as jwt from 'jsonwebtoken';
import { SendOtpRequest, VerifyOtpRequest } from '@linearcard/types';
import { JWT_SECRET } from '../env';
import { PassIssuanceService } from '../passes/pass-issuance.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly otpService: OtpService,
    private readonly whatsappService: WhatsappService,
    private readonly notifyService: NotifyService,
    private readonly passIssuanceService: PassIssuanceService,
  ) {}

  @Post('send-otp')
  async sendOtp(@Body() body: SendOtpRequest) {
    try {
      const { tenantId } = body;
      let { phone } = body;
      if (!phone)
        throw new HttpException('phone required', HttpStatus.BAD_REQUEST);
      phone = phone.replace(/[^\d+]/g, '');

      if (await this.otpService.isOtpRateLimited(phone, 'enrollment')) {
        throw new HttpException(
          'Too many OTP requests. Please wait 5 minutes before requesting a new code.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      let brandName = 'LinearCard';

      if (tenantId) {
        const { data: tenant } = await this.supabaseService.client
          .from('Tenant')
          .select('name')
          .eq('id', tenantId)
          .single();
        if (tenant) brandName = tenant.name;
      }

      const { error: insertError } = await this.supabaseService.client
        .from('OtpSession')
        .insert({
          phone,
          otpHash: this.otpService.hashOtp(otp),
          purpose: 'enrollment',
          tenantId: tenantId || null,
          expiresAt,
        });
      if (insertError) throw new Error(`DB Error: ${insertError.message}`);

      await this.whatsappService.sendOtp(phone, otp, brandName);
      return { success: true };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error.message || 'Failed to send OTP',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Phase 3.6 — which program an enrollment issues against.
   *
   * An explicit `programId` must belong to the tenant, or the caller is
   * trying to enroll someone into someone else's program. With none, the
   * tenant's oldest program is the default, which is what keeps the
   * pre-Phase-3 `/enroll/:slug` URL working.
   */
  private async resolveEnrollmentProgram(
    tenantId: string,
    programId?: string,
  ): Promise<any | null> {
    if (programId) {
      const { data } = await this.supabaseService.client
        .from('Program')
        .select('*')
        .eq('id', programId)
        .eq('tenantId', tenantId)
        .maybeSingle();
      if (!data)
        throw new HttpException(
          'Program not found for this brand.',
          HttpStatus.NOT_FOUND,
        );
      return data;
    }

    const { data } = await this.supabaseService.client
      .from('Program')
      .select('*')
      .eq('tenantId', tenantId)
      .order('createdAt', { ascending: true })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  }

  @Post('verify-otp')
  async verifyOtp(@Body() body: VerifyOtpRequest, @Req() req: Request) {
    try {
      const { otp, consentGiven, tenantId, programId, ...passData } = body;
      let { phone } = body;
      if (!phone || !otp || !consentGiven)
        throw new HttpException(
          'Missing required fields',
          HttpStatus.BAD_REQUEST,
        );
      phone = phone.replace(/[^\d+]/g, '');

      const { data: otpSessions, error: otpError } =
        await this.supabaseService.client
          .from('OtpSession')
          .select('*')
          .eq('phone', phone)
          .eq('purpose', 'enrollment')
          .is('consumedAt', null)
          .order('createdAt', { ascending: false })
          .limit(1);

      if (otpError || !otpSessions || otpSessions.length === 0) {
        throw new HttpException(
          'No active OTP found. Please request a new code.',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const otpSession = otpSessions[0];
      if (new Date().toISOString() > otpSession.expiresAt) {
        throw new HttpException(
          'OTP has expired. Please request a new code.',
          HttpStatus.UNAUTHORIZED,
        );
      }
      const attempt = await this.otpService.verifyOtpAttempt(otp, otpSession);
      if (!attempt.ok) {
        throw new HttpException(
          attempt.locked
            ? 'Too many incorrect attempts. Please request a new code.'
            : 'Incorrect code. Please try again.',
          attempt.locked
            ? HttpStatus.TOO_MANY_REQUESTS
            : HttpStatus.UNAUTHORIZED,
        );
      }

      await this.supabaseService.client
        .from('OtpSession')
        .update({ consumedAt: new Date().toISOString() })
        .eq('id', otpSession.id);

      let targetTenantId = otpSession.tenantId || tenantId;
      if (!targetTenantId) {
        const { data: coffeeTenant } = await this.supabaseService.client
          .from('Tenant')
          .select('id')
          .eq('classSuffix', 'beanhouse_coffee')
          .single();
        targetTenantId = coffeeTenant?.id;
      }
      if (!targetTenantId)
        throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);

      const { data: tenant, error: tenantError } =
        await this.supabaseService.client
          .from('Tenant')
          .select('*')
          .eq('id', targetTenantId)
          .single();
      if (tenantError || !tenant)
        throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);

      // AUTH-1/DB-3: upsert on (tenantId, phone). Inserting unconditionally
      // gave a returning customer a duplicate member, a duplicate pass and a
      // fresh 0 balance, orphaning their real one.
      const { data: member, error: memberError } =
        await this.supabaseService.client
          .from('Member')
          .upsert(
            {
              phone,
              name: passData.memberName || phone,
              tenantId: targetTenantId,
              consentedAt: new Date().toISOString(),
            },
            { onConflict: 'tenantId,phone' },
          )
          .select()
          .single();
      if (memberError || !member)
        throw new Error(`Failed to create member: ${memberError?.message}`);

      await this.supabaseService.client.from('ConsentLog').insert({
        memberId: member.id,
        phone,
        ipAddress: (req.headers['x-forwarded-for'] as string) || null,
        userAgent: (req.headers['user-agent'] as string) || null,
        legalTextVersion: 'DPDP_v1',
      });

      // Phase 3.6 — the pass is issued against a *program*, not a tenant.
      // An explicit programId wins; otherwise fall back to the tenant's
      // oldest program so the old /enroll/:slug URL keeps working.
      const targetProgram = await this.resolveEnrollmentProgram(
        targetTenantId,
        programId,
      );

      // Phase 5 — issuance itself lives in PassIssuanceService, shared with
      // payment-triggered enrollment (5.2).
      const issued = await this.passIssuanceService.issueForMember({
        tenantId: targetTenantId,
        member,
        program: targetProgram,
        tenant,
        passData,
      });

      const { existing, success, ...rest } = issued;
      return existing
        ? { success, existing: true, ...rest }
        : { success, ...rest };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error.message || 'Failed to verify OTP',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('admin/send-otp')
  async adminSendOtp(@Body() body: any) {
    try {
      let { phone } = body || {};
      if (!phone)
        throw new HttpException('phone required', HttpStatus.BAD_REQUEST);
      phone = phone.replace(/[^\d+]/g, '');

      if (await this.otpService.isOtpRateLimited(phone, 'admin_login')) {
        throw new HttpException(
          'Too many OTP requests. Please wait 5 minutes before requesting a new code.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const { error: insertError } = await this.supabaseService.client
        .from('OtpSession')
        .insert({
          phone,
          otpHash: this.otpService.hashOtp(otp),
          purpose: 'admin_login',
          expiresAt,
        });
      if (insertError) throw new Error(`DB Error: ${insertError.message}`);

      await this.whatsappService.sendOtp(phone, otp, 'LinearCard Admin');
      return { success: true };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error.message || 'Failed to send Admin OTP',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('admin/verify-otp')
  async adminVerifyOtp(
    @Body() body: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const { otp } = body || {};
      let { phone } = body || {};
      if (!phone || !otp)
        throw new HttpException(
          'Missing required fields',
          HttpStatus.BAD_REQUEST,
        );
      phone = phone.replace(/[^\d+]/g, '');

      const { data: otpSessions, error: otpError } =
        await this.supabaseService.client
          .from('OtpSession')
          .select('*')
          .eq('phone', phone)
          .eq('purpose', 'admin_login')
          .is('consumedAt', null)
          .order('createdAt', { ascending: false })
          .limit(1);

      if (otpError || !otpSessions || otpSessions.length === 0) {
        throw new HttpException(
          'No active OTP found. Please request a new code.',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const otpSession = otpSessions[0];
      if (new Date().toISOString() > otpSession.expiresAt) {
        throw new HttpException(
          'OTP has expired. Please request a new code.',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const attempt = await this.otpService.verifyOtpAttempt(otp, otpSession);
      if (!attempt.ok) {
        throw new HttpException(
          attempt.locked
            ? 'Too many incorrect attempts. Please request a new code.'
            : 'Invalid code. Please try again.',
          attempt.locked
            ? HttpStatus.TOO_MANY_REQUESTS
            : HttpStatus.UNAUTHORIZED,
        );
      }

      await this.supabaseService.client
        .from('OtpSession')
        .update({ consumedAt: new Date().toISOString() })
        .eq('id', otpSession.id);

      // Check or create admin
      let { data: admin } = await this.supabaseService.client
        .from('Admin')
        .select('*')
        .eq('phone', phone)
        .limit(1)
        .single();
      if (!admin) {
        const { data: tenant } = await this.supabaseService.client
          .from('Tenant')
          .select('id')
          .limit(1)
          .single();
        if (!tenant)
          throw new HttpException(
            'No tenants configured',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );

        const { data: newAdmin, error: adminErr } =
          await this.supabaseService.client
            .from('Admin')
            .insert({
              phone,
              tenantId: tenant.id,
              role: 'admin',
            })
            .select()
            .single();
        if (adminErr || !newAdmin)
          throw new Error(`Failed to create admin: ${adminErr?.message}`);
        admin = newAdmin;
      }

      const token = jwt.sign(
        { adminId: admin.id, tenantId: admin.tenantId, role: admin.role },
        JWT_SECRET,
        { expiresIn: '1d' },
      );

      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('admin_session', token, {
        httpOnly: true, // Secure: JS cannot access, only sent automatically with credentials: 'include'
        secure: isProd, // HTTPS only in production
        // Prod serves web/api from separate Vercel domains (cross-site), which
        // requires SameSite=None; dev is same-site (just different ports), so
        // 'lax' works there and avoids needing HTTPS locally.
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      });

      return { success: true, token };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error.message || 'Failed to verify Admin OTP',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('me')
  async getMe(@Req() req: Request) {
    const token =
      req.cookies?.admin_session ||
      (req.headers['authorization']?.startsWith('Bearer ')
        ? req.headers['authorization'].substring(7)
        : null);
    if (!token)
      throw new HttpException('Not authenticated', HttpStatus.UNAUTHORIZED);
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      const { data: admin } = await this.supabaseService.client
        .from('Admin')
        .select('phone, role, tenantId')
        .eq('id', decoded.adminId)
        .single();
      if (!admin)
        throw new HttpException('Admin not found', HttpStatus.UNAUTHORIZED);
      return { success: true, admin };
    } catch {
      throw new HttpException('Invalid session', HttpStatus.UNAUTHORIZED);
    }
  }

  @Post('admin/logout')
  async adminLogout(@Res({ passthrough: true }) res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('admin_session', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    });
    return { success: true };
  }
}
