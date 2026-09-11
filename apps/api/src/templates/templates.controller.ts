import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { WalletService } from '../wallet/wallet.service';

@Controller('templates')
export class TemplatesController {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly walletService: WalletService,
  ) {}

  @Get()
  async getTemplates(@Query('tenantId') tenantId: string) {
    try {
      const { data: templates, error } = await this.supabaseService.client
        .from('PassTemplate')
        .select('*')
        .eq('tenantId', tenantId)
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

  @Get(':id')
  async getTemplateById(@Param('id') id: string) {
    try {
      const { data: template, error } = await this.supabaseService.client
        .from('PassTemplate')
        .select('*')
        .eq('id', id)
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
  async deleteTemplate(@Param('id') id: string) {
    try {
      const { error } = await this.supabaseService.client
        .from('PassTemplate')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/publish')
  async publishTemplate(@Param('id') id: string) {
    try {
      const { data: template, error: fetchError } =
        await this.supabaseService.client
          .from('PassTemplate')
          .select('*, tenant:Tenant(*)')
          .eq('id', id)
          .single();
      if (fetchError || !template)
        throw new HttpException(
          { success: false, error: 'Template not found' },
          HttpStatus.NOT_FOUND,
        );

      const origin = 'http://localhost:3000';
      const rawLogoUrl = template.logoUrl || template.tenant?.logoUrl;
      const rawHeroImageUrl = template.heroImageUrl || template.tenant?.heroUrl;
      const logoUrl = rawLogoUrl?.startsWith('/')
        ? `${origin}${rawLogoUrl}`
        : rawLogoUrl;
      const heroImageUrl = rawHeroImageUrl?.startsWith('/')
        ? `${origin}${rawHeroImageUrl}`
        : rawHeroImageUrl;

      const classData: any = await this.walletService.createGenericClass({
        classSuffix: template.classSuffix || template.tenant?.classSuffix,
        cardTitle: template.tenant?.name || template.title,
        hexBackgroundColor:
          template.hexBackgroundColor || template.tenant?.brandHexColor,
        rows: template.fieldRows,
        logoUrl,
        heroImageUrl,
        // Pass the store coordinates to Google Wallet's proximity feature.
        // Falls back to [] for older templates that predate this column.
        locations: template.storeLocations ?? [],
      });

      const { data: updated, error: updateError } =
        await this.supabaseService.client
          .from('PassTemplate')
          .update({
            status: 'published',
            googleClassId: classData.id,
            updatedAt: new Date().toISOString(),
          })
          .eq('id', id)
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

  @Patch(':id')
  async updateTemplate(@Param('id') id: string, @Body() body: any) {
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
        updatePayload.hexBackgroundColor = body.hexBackgroundColor;
      if (body.logoUrl !== undefined) updatePayload.logoUrl = body.logoUrl;
      if (body.heroImageUrl !== undefined)
        updatePayload.heroImageUrl = body.heroImageUrl;

      // Validate and apply storeLocations
      if (body.storeLocations !== undefined) {
        if (!Array.isArray(body.storeLocations)) {
          throw new HttpException(
            'storeLocations must be an array',
            HttpStatus.BAD_REQUEST,
          );
        }
        if (body.storeLocations.length > 10) {
          throw new HttpException(
            'storeLocations must contain at most 10 entries',
            HttpStatus.BAD_REQUEST,
          );
        }
        for (const loc of body.storeLocations) {
          if (!loc || typeof loc !== 'object') {
            throw new HttpException(
              'Each store location must be an object',
              HttpStatus.BAD_REQUEST,
            );
          }
          const lat = Number(loc.latitude);
          const lng = Number(loc.longitude);
          if (isNaN(lat) || lat < -90 || lat > 90) {
            throw new HttpException(
              `Invalid latitude: ${loc.latitude}`,
              HttpStatus.BAD_REQUEST,
            );
          }
          if (isNaN(lng) || lng < -180 || lng > 180) {
            throw new HttpException(
              `Invalid longitude: ${loc.longitude}`,
              HttpStatus.BAD_REQUEST,
            );
          }
        }
        updatePayload.storeLocations = body.storeLocations;
      }

      const { data: updated, error } = await this.supabaseService.client
        .from('PassTemplate')
        .update(updatePayload)
        .eq('id', id)
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
