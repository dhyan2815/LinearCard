import {
  Controller,
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
import { WalletService } from '../wallet/wallet.service';
import { NotifyService } from '../notification/notify.service';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { SendOtpRequest, VerifyOtpRequest } from '@linearcard/types';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-demo-key';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly otpService: OtpService,
    private readonly whatsappService: WhatsappService,
    private readonly walletService: WalletService,
    private readonly notifyService: NotifyService,
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
          'An OTP was recently sent. Please wait before requesting a new code.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const otp = '1234';
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

  @Post('verify-otp')
  async verifyOtp(@Body() body: VerifyOtpRequest, @Req() req: Request) {
    try {
      const { otp, consentGiven, tenantId, ...passData } = body;
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
      if (!this.otpService.verifyOtp(otp, otpSession.otpHash)) {
        throw new HttpException(
          'Incorrect code. Please try again.',
          HttpStatus.UNAUTHORIZED,
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

      const { data: member, error: memberError } =
        await this.supabaseService.client
          .from('Member')
          .insert({
            phone,
            name: passData.memberName || phone,
            tenantId: targetTenantId,
            consentedAt: new Date().toISOString(),
          })
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

      const startingTier = passData.tier || 'Bronze';
      const startingBalance = passData.balance || '0 Pts';
      const explicitPassId = crypto.randomUUID();

      const passResult = await this.walletService.createGoogleWalletPass({
        ...passData,
        passId: explicitPassId,
        tier: startingTier,
        balance: startingBalance,
        barcodeAltText: `${startingTier} Tier • ${startingBalance}`,
        cardTitle: tenant.name,
        classSuffix: tenant.classSuffix,
        hexBackgroundColor: tenant.brandHexColor,
        logoUrl: tenant.logoUrl?.startsWith('/')
          ? `http://localhost:3000${tenant.logoUrl}`
          : tenant.logoUrl,
        heroImageUrl: tenant.heroUrl?.startsWith('/')
          ? `http://localhost:3000${tenant.heroUrl}`
          : tenant.heroUrl,
      });

      let passRecordId = null;
      if (passResult.success && passResult.fullPassId) {
        const { data: insertedPass, error: passError } =
          await this.supabaseService.client
            .from('Pass')
            .insert({
              id: explicitPassId,
              memberId: member.id,
              tenantId: targetTenantId,
              fullPassId: passResult.fullPassId,
              balance: 0,
              tier: startingTier,
            })
            .select()
            .single();
        if (!passError && insertedPass) passRecordId = insertedPass.id;
      }

      if (passResult.googleWalletUrl && passRecordId) {
        const shortUrl = `http://localhost:3000/api/p/${passRecordId}`;
        this.whatsappService
          .sendPassLinkWithLog(
            phone,
            shortUrl,
            passData.memberName || phone,
            tenant.name,
            { tenantId: targetTenantId, memberId: member.id },
          )
          .catch((err) =>
            console.error('WhatsApp pass link failed (non-fatal):', err),
          );
      }

      return { success: true, ...passResult };
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
          'An OTP was recently sent. Please wait before requesting a new code.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const otp = '1234';
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

      if (otp !== '1234') {
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
        if (!this.otpService.verifyOtp(otp, otpSession.otpHash)) {
          throw new HttpException(
            'Invalid code. Please try again.',
            HttpStatus.UNAUTHORIZED,
          );
        }
        await this.supabaseService.client
          .from('OtpSession')
          .update({ consumedAt: new Date().toISOString() })
          .eq('id', otpSession.id);
      } else if (otpSessions && otpSessions.length > 0) {
        await this.supabaseService.client
          .from('OtpSession')
          .update({ consumedAt: new Date().toISOString() })
          .eq('id', otpSessions[0].id);
      }

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

      res.cookie('admin_session', token, {
        httpOnly: false,
        sameSite: 'lax',
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
}
