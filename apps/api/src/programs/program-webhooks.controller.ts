import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { TenantGuard, TenantRequest } from '../auth/tenant.guard';
import { isPublicWebhookUrl } from '../developers/webhook.service';
import { WEBHOOK_EVENTS } from '../developers/developers.controller';

/**
 * Phase 8 — webhook endpoints scoped to one program. A tenant-wide endpoint
 * (programId NULL, managed under Developers) fires for every program; these
 * fire only for theirs. Same SSRF check and event allowlist as the
 * tenant-wide routes — the list is imported rather than redeclared.
 */
@Controller('programs')
@UseGuards(TenantGuard)
export class ProgramWebhooksController {
  constructor(private readonly supabaseService: SupabaseService) {}

  /** Loads a program the calling tenant owns, or 404s. */
  private async load(id: string, tenantId: string) {
    const { data } = await this.supabaseService.client
      .from('Program')
      .select('id, name')
      .eq('id', id)
      .eq('tenantId', tenantId)
      .maybeSingle();
    if (!data)
      throw new HttpException(
        { success: false, error: 'Program not found' },
        HttpStatus.NOT_FOUND,
      );
    return data;
  }

  @Get(':id/webhooks')
  async list(@Param('id') id: string, @Req() req: TenantRequest) {
    await this.load(id, req.tenantId!);
    const { data, error } = await this.supabaseService.client
      .from('WebhookEndpoint')
      .select('id, url, events, active, createdAt')
      .eq('tenantId', req.tenantId)
      .eq('programId', id)
      .order('createdAt', { ascending: false });
    if (error)
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    return { success: true, webhooks: data || [] };
  }

  @Post(':id/webhooks')
  async create(
    @Param('id') id: string,
    @Req() req: TenantRequest,
    @Body() body: { url: string; events: string[] },
  ) {
    await this.load(id, req.tenantId!);
    const { url, events } = body || ({} as any);
    if (!url || !isPublicWebhookUrl(url)) {
      throw new HttpException(
        'url must be a valid http/https URL with a public (non-loopback, non-private) host',
        HttpStatus.BAD_REQUEST,
      );
    }
    const validEvents = (events || []).filter((e: string) =>
      WEBHOOK_EVENTS.includes(e),
    );
    if (!validEvents.length) {
      throw new HttpException(
        `events must include at least one of: ${WEBHOOK_EVENTS.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const secret = crypto.randomBytes(24).toString('hex');
    const { data, error } = await this.supabaseService.client
      .from('WebhookEndpoint')
      .insert({
        tenantId: req.tenantId,
        programId: id,
        url,
        events: validEvents,
        secret,
        active: true,
      })
      .select('id, url, events, active, createdAt, secret')
      .single();
    if (error)
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);

    // Secret is only ever returned in full on creation, like the API key.
    return { success: true, webhook: data };
  }

  @Delete(':id/webhooks/:webhookId')
  async remove(
    @Param('id') id: string,
    @Param('webhookId') webhookId: string,
    @Req() req: TenantRequest,
  ) {
    await this.load(id, req.tenantId!);
    const { error } = await this.supabaseService.client
      .from('WebhookEndpoint')
      .delete()
      .eq('id', webhookId)
      .eq('tenantId', req.tenantId)
      .eq('programId', id);
    if (error)
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    return { success: true };
  }
}
