import { Controller, Get, Patch, Post, Body, Req, HttpException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-demo-key';

function getTenantId(req: Request): string | null {
  const cookie = req.cookies?.admin_session;
  if (!cookie) return null;
  try {
    const p: any = jwt.verify(cookie, JWT_SECRET);
    return p.tenantId || null;
  } catch {
    return null;
  }
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get()
  async getSettings(@Req() req: Request) {
    const tenantId = getTenantId(req);
    if (!tenantId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    
    const { data: tenant, error } = await this.supabaseService.client
      .from('Tenant')
      .select('id, name, classSuffix, brandHexColor, apiKey, webhookUrl')
      .eq('id', tenantId)
      .single();
    if (error || !tenant) throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);
    return { success: true, tenant };
  }

  @Patch()
  async updateSettings(@Req() req: Request, @Body() body: any) {
    const tenantId = getTenantId(req);
    if (!tenantId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    
    const { webhookUrl } = body || {};
    const patch: Record<string, any> = {};
    if (webhookUrl !== undefined) {
      if (webhookUrl && !/^https?:\/\/.+/.test(webhookUrl)) {
        throw new HttpException('webhookUrl must be a valid http/https URL', HttpStatus.BAD_REQUEST);
      }
      patch.webhookUrl = webhookUrl || null;
    }
    if (!Object.keys(patch).length) {
      throw new HttpException('No updateable fields provided', HttpStatus.BAD_REQUEST);
    }
    const { error } = await this.supabaseService.client.from('Tenant').update(patch).eq('id', tenantId);
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    return { success: true };
  }
}

@Controller('admin')
export class DeveloperSettingsController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get('developer-settings')
  async getDevSettings(@Req() req: Request) {
    const tenantId = getTenantId(req);
    if (!tenantId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

    const { data: tenant } = await this.supabaseService.client.from('Tenant').select('*').eq('id', tenantId).limit(1).single();
    if (!tenant) throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);

    return { success: true, apiKey: tenant.apiKey };
  }

  @Post('developer-settings')
  async generateApiKey(@Req() req: Request) {
    const tenantId = getTenantId(req);
    if (!tenantId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

    const { data: tenant } = await this.supabaseService.client.from('Tenant').select('id').eq('id', tenantId).limit(1).single();
    if (!tenant) throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);

    const newApiKey = crypto.randomUUID().replace(/-/g, '');
    const { error } = await this.supabaseService.client.from('Tenant').update({ apiKey: newApiKey }).eq('id', tenant.id);
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);

    return { success: true, apiKey: newApiKey };
  }
}
