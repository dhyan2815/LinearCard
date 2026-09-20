import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { WalletService } from '../wallet/wallet.service';
import { TenantGuard, TenantRequest } from '../auth/tenant.guard';

const RESYNC_BATCH_SIZE = 10;

@Controller('templates')
export class TemplatesController {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly walletService: WalletService,
  ) {}

  // Tenant comes from the guard, never from `?tenantId=` — the query param
  // is accepted (the dashboard still sends it) but ignored.
  @Get()
  @UseGuards(TenantGuard)
  async getTemplates(@Req() req: TenantRequest) {
    try {
      const { data: templates, error } = await this.supabaseService.client
        .from('PassTemplate')
        .select('*')
        .eq('tenantId', req.tenantId)
        .order('createdAt', { ascending: false });

      if (error) throw error;
      return {
        success: true,
        templates: (templates || []).map((t: any) => ({ ...t, name: t.title })),
      };
    } catch {
      throw new HttpException(
        { success: false, error: 'Failed to fetch templates' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Validates and normalises a hexBackgroundColor value, throwing an
   * HttpException with the same shape/message used across the controller.
   * Returns the uppercased hex string.
   */
  private validateHexColor(value: any): string {
    if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
      throw new HttpException(
        {
          success: false,
          error: 'hexBackgroundColor must be a 6-digit hex code, e.g. #1A365D',
          message: 'hexBackgroundColor must be a 6-digit hex code, e.g. #1A365D',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return value.toUpperCase();
  }

  /**
   * Validates a tierThresholds payload, throwing an HttpException with the
   * same shape/message used across createTemplate and updateTemplate.
   */
  private validateTierThresholds(value: any): void {
    if (!Array.isArray(value)) {
      throw new HttpException(
        {
          success: false,
          error: 'tierThresholds must be an array',
          message: 'tierThresholds must be an array',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const seenMins = new Set<number>();
    for (const t of value) {
      if (!t || typeof t.name !== 'string' || t.name.trim() === '') {
        throw new HttpException(
          {
            success: false,
            error: 'each tier threshold requires a non-empty name',
            message: 'each tier threshold requires a non-empty name',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (typeof t.min !== 'number' || t.min < 0) {
        throw new HttpException(
          {
            success: false,
            error: 'threshold min must be a number >= 0',
            message: 'threshold min must be a number >= 0',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (seenMins.has(t.min)) {
        throw new HttpException(
          {
            success: false,
            error: 'tier thresholds must have distinct min values',
            message: 'tier thresholds must have distinct min values',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      seenMins.add(t.min);
    }
  }

  /**
   * Validates a storeLocations payload (max 10 pins, lat/lng in range),
   * throwing an HttpException with the same shape/message used across
   * createTemplate and updateTemplate.
   */
  private validateStoreLocations(value: any): void {
    if (!Array.isArray(value)) {
      throw new HttpException(
        { success: false, error: 'storeLocations must be an array', message: 'storeLocations must be an array' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (value.length > 10) {
      throw new HttpException(
        {
          success: false,
          error: 'storeLocations must contain at most 10 entries',
          message: 'storeLocations must contain at most 10 entries',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    for (const loc of value) {
      if (!loc || typeof loc !== 'object') {
        throw new HttpException(
          { success: false, error: 'Each store location must be an object', message: 'Each store location must be an object' },
          HttpStatus.BAD_REQUEST,
        );
      }
      const lat = Number(loc.latitude);
      const lng = Number(loc.longitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        throw new HttpException(
          { success: false, error: `Invalid latitude: ${loc.latitude}`, message: `Invalid latitude: ${loc.latitude}` },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (isNaN(lng) || lng < -180 || lng > 180) {
        throw new HttpException(
          { success: false, error: `Invalid longitude: ${loc.longitude}`, message: `Invalid longitude: ${loc.longitude}` },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  // Tenant comes from the guard, never from `body.tenantId`.
  @Post()
  @UseGuards(TenantGuard)
  async createTemplate(@Body() body: any, @Req() req: TenantRequest) {
    try {
      const insertPayload: Record<string, any> = {
        tenantId: req.tenantId,
        title: body.name || 'New Template',
        archetype: body.archetype || 'loyalty',
        subtitle: body.name || 'New Template',
        status: 'draft',
        classSuffix: body.classSuffix,
      };

      if (body.fieldRows !== undefined)
        insertPayload.fieldRows = body.fieldRows;
      if (body.hexBackgroundColor !== undefined)
        insertPayload.hexBackgroundColor = this.validateHexColor(
          body.hexBackgroundColor,
        );
      if (body.logoUrl !== undefined) insertPayload.logoUrl = body.logoUrl;
      if (body.heroImageUrl !== undefined)
        insertPayload.heroImageUrl = body.heroImageUrl;

      if (body.tierThresholds !== undefined) {
        this.validateTierThresholds(body.tierThresholds);
        insertPayload.tierThresholds = body.tierThresholds;
      } else {
        insertPayload.tierThresholds = [];
      }

      if (body.storeLocations !== undefined) {
        this.validateStoreLocations(body.storeLocations);
        insertPayload.storeLocations = body.storeLocations;
      }

      const { data: template, error } = await this.supabaseService.client
        .from('PassTemplate')
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;

      return { success: true, template: { ...template, name: template.title } };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @UseGuards(TenantGuard)
  async getTemplateById(@Param('id') id: string, @Req() req: TenantRequest) {
    try {
      const { data: template, error } = await this.supabaseService.client
        .from('PassTemplate')
        .select('*')
        .eq('id', id)
        .eq('tenantId', req.tenantId)
        .single();
      if (error || !template)
        throw new HttpException(
          { success: false, error: 'Template not found' },
          HttpStatus.NOT_FOUND,
        );
      return { success: true, template: { ...template, name: template.title } };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  @UseGuards(TenantGuard)
  async deleteTemplate(@Param('id') id: string, @Req() req: TenantRequest) {
    try {
      const { data, error } = await this.supabaseService.client
        .from('PassTemplate')
        .delete()
        .eq('id', id)
        .eq('tenantId', req.tenantId)
        .select();
      if (error) throw error;
      if (!data || !data.length)
        throw new HttpException(
          { success: false, error: 'Template not found' },
          HttpStatus.NOT_FOUND,
        );
      return { success: true };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/publish')
  @UseGuards(TenantGuard)
  async publishTemplate(@Param('id') id: string, @Req() req: TenantRequest) {
    try {
      const { data: template, error: fetchError } =
        await this.supabaseService.client
          .from('PassTemplate')
          .select('*, tenant:Tenant(*)')
          .eq('id', id)
          .eq('tenantId', req.tenantId)
          .single();
      if (fetchError || !template)
        throw new HttpException(
          { success: false, error: 'Template not found' },
          HttpStatus.NOT_FOUND,
        );

      function resolveImageUrl(url?: string): string | undefined {
        if (!url) return undefined;
        if (url.includes('localhost') || url.includes('127.0.0.1')) {
          return 'https://storage.googleapis.com/wallet-lab-tools-codelab-artifacts-public/pass_google_logo.jpg';
        }
        if (url.startsWith('/')) {
          const baseUrl =
            process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace('-api', '')}` : 'http://localhost:3000');
          if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
            return 'https://storage.googleapis.com/wallet-lab-tools-codelab-artifacts-public/pass_google_logo.jpg';
          }
          return `${baseUrl}${url}`;
        }
        return url;
      }

      const rawLogoUrl = template.logoUrl || template.tenant?.logoUrl;
      const rawHeroImageUrl = template.heroImageUrl || template.tenant?.heroUrl;
      const logoUrl = resolveImageUrl(rawLogoUrl);
      const heroImageUrl = resolveImageUrl(rawHeroImageUrl);

      const rowsWithKeys = (template.fieldRows || []).map((row: any) => ({
        ...row,
        columns: row.columns.map((col: any, idx: number) => ({
          ...col,
          key: col.key || `${row.id}_${idx}`,
        })),
      }));

      const tenantWallet = await this.walletService.forTenant(req.tenantId!);
      const classData: any = await tenantWallet.createGenericClass({
        classSuffix: template.classSuffix || template.tenant?.classSuffix,
        cardTitle: template.tenant?.name || template.title,
        hexBackgroundColor:
          template.hexBackgroundColor || template.tenant?.brandHexColor,
        rows: rowsWithKeys,
        logoUrl,
        heroImageUrl,
        storeLocations: template.storeLocations ?? [],
        isUpdate: !!template.googleClassId,
      });

      // The 409 fallback returns {existing:true, updated:false} when its own
      // PATCH attempt also failed — without this check that silent failure
      // used to still flip status to 'published'.
      if (classData?.updated === false) {
        throw new HttpException(
          {
            success: false,
            error:
              'Failed to publish: Google Wallet class update was rejected. Template left as draft.',
          },
          HttpStatus.BAD_GATEWAY,
        );
      }

      const { data: updated, error: updateError } =
        await this.supabaseService.client
          .from('PassTemplate')
          .update({
            status: 'published',
            googleClassId: classData.id,
            updatedAt: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('tenantId', req.tenantId)
          .select()
          .single();
      if (updateError) throw updateError;

      return {
        success: true,
        classData,
        template: { ...updated, name: updated.title },
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Pushes the template's current design (currently: colour) onto every
   * already-issued, non-deleted Pass of the calling tenant. A colour fix on
   * the template only reaches passes issued *after* the fix unless this is
   * run — this patches the ones issued before it.
   */
  @Post(':id/resync-passes')
  @UseGuards(TenantGuard)
  async resyncPasses(@Param('id') id: string, @Req() req: TenantRequest) {
    try {
      const { data: template, error: fetchError } =
        await this.supabaseService.client
          .from('PassTemplate')
          .select('*')
          .eq('id', id)
          .eq('tenantId', req.tenantId)
          .single();
      if (fetchError || !template)
        throw new HttpException(
          { success: false, error: 'Template not found' },
          HttpStatus.NOT_FOUND,
        );

      const { data: passes, error: passesError } = await this.supabaseService
        .client.from('Pass')
        .select('id, fullPassId')
        .eq('tenantId', req.tenantId)
        .is('deletedAt', null);
      if (passesError) throw passesError;

      const tenantWallet = await this.walletService.forTenant(req.tenantId!);
      // Batched, not an unbounded fan-out: a tenant with thousands of passes
      // would otherwise open thousands of concurrent Google Wallet requests.
      // ponytail: fixed chunk size, no queue — move to a job queue if resync
      // ever needs to survive a process restart.
      const all = passes || [];
      let succeeded = 0;
      let failed = 0;
      for (let i = 0; i < all.length; i += RESYNC_BATCH_SIZE) {
        const results = await Promise.allSettled(
          all.slice(i, i + RESYNC_BATCH_SIZE).map((p: any) =>
            tenantWallet.updateGenericObject(p.fullPassId, {
              hexBackgroundColor: template.hexBackgroundColor,
            }),
          ),
        );
        succeeded += results.filter((r) => r.status === 'fulfilled').length;
        failed += results.filter((r) => r.status === 'rejected').length;
      }

      return {
        success: true,
        total: all.length,
        succeeded,
        failed,
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id')
  @UseGuards(TenantGuard)
  async updateTemplate(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: TenantRequest,
  ) {
    try {
      const updatePayload: Record<string, any> = {
        updatedAt: new Date().toISOString(),
      };

      // Selectively apply only the fields provided in the body
      if (body.name !== undefined) updatePayload.title = body.name;
      if (body.archetype !== undefined)
        updatePayload.archetype = body.archetype;
      if (body.fieldRows !== undefined)
        updatePayload.fieldRows = body.fieldRows;
      if (body.hexBackgroundColor !== undefined)
        updatePayload.hexBackgroundColor = this.validateHexColor(
          body.hexBackgroundColor,
        );
      if (body.logoUrl !== undefined) updatePayload.logoUrl = body.logoUrl;
      if (body.heroImageUrl !== undefined)
        updatePayload.heroImageUrl = body.heroImageUrl;

      if (body.tierThresholds !== undefined) {
        this.validateTierThresholds(body.tierThresholds);
        updatePayload.tierThresholds = body.tierThresholds;
      }

      if (body.storeLocations !== undefined) {
        this.validateStoreLocations(body.storeLocations);
        updatePayload.storeLocations = body.storeLocations;
      }

      const { data: updated, error } = await this.supabaseService.client
        .from('PassTemplate')
        .update(updatePayload)
        .eq('id', id)
        .eq('tenantId', req.tenantId)
        .select()
        .single();

      if (error) throw error;
      if (!updated) {
        throw new HttpException(
          { success: false, error: 'Template not found' },
          HttpStatus.NOT_FOUND,
        );
      }

      return { success: true, template: { ...updated, name: updated.title } };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
