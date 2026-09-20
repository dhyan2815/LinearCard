import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { TenantGuard, TenantRequest } from '../auth/tenant.guard';

@Controller('settings')
@UseGuards(TenantGuard)
export class SettingsController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get()
  async getSettings(@Req() req: TenantRequest) {
    const tenantId = req.tenantId;

    const { data: tenant, error } = await this.supabaseService.client
      .from('Tenant')
      .select('id, name, classSuffix, brandHexColor, apiKey, webhookUrl')
      .eq('id', tenantId)
      .single();
    if (error || !tenant)
      throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);
    return { success: true, tenant };
  }

  @Patch()
  async updateSettings(@Req() req: TenantRequest, @Body() body: any) {
    const tenantId = req.tenantId;

    const { webhookUrl } = body || {};
    const patch: Record<string, any> = {};
    if (webhookUrl !== undefined) {
      if (webhookUrl && !/^https?:\/\/.+/.test(webhookUrl)) {
        throw new HttpException(
          'webhookUrl must be a valid http/https URL',
          HttpStatus.BAD_REQUEST,
        );
      }
      patch.webhookUrl = webhookUrl || null;
    }
    if (!Object.keys(patch).length) {
      throw new HttpException(
        'No updateable fields provided',
        HttpStatus.BAD_REQUEST,
      );
    }
    const { error } = await this.supabaseService.client
      .from('Tenant')
      .update(patch)
      .eq('id', tenantId);
    if (error)
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    return { success: true };
  }

  @Post('test-webhook')
  async testWebhook(@Req() req: TenantRequest) {
    const tenantId = req.tenantId;
    const { data: tenant } = await this.supabaseService.client
      .from('Tenant')
      .select('webhookUrl')
      .eq('id', tenantId)
      .single();
    if (!tenant?.webhookUrl) {
      throw new HttpException(
        'No webhook URL saved yet',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      const res = await fetch(tenant.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'test.ping',
          tenantId,
          sentAt: new Date().toISOString(),
        }),
      });
      return { success: res.ok, status: res.status };
    } catch (err: any) {
      throw new HttpException(
        `Could not reach webhook URL: ${err.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}

@Controller('admin')
@UseGuards(TenantGuard)
export class DeveloperSettingsController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get('developer-settings')
  async getDevSettings(@Req() req: TenantRequest) {
    const tenantId = req.tenantId;

    const { data: tenant } = await this.supabaseService.client
      .from('Tenant')
      .select('*')
      .eq('id', tenantId)
      .limit(1)
      .single();
    if (!tenant)
      throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);

    return { success: true, apiKey: tenant.apiKey };
  }

  // ponytail: legacy plaintext-minting path retired in favor of hashed keys.
  // Retained as a 410 so old clients get a clear signal instead of a 404.
  @Post('developer-settings')
  generateApiKey() {
    throw new HttpException(
      'This endpoint no longer issues API keys. Use POST /developers/api-keys instead.',
      HttpStatus.GONE,
    );
  }
}
