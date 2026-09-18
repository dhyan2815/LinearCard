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

  @Post()
  async createTemplate(@Body() body: any) {
    try {
      if (!body.tenantId) {
        throw new HttpException('tenantId is required', HttpStatus.BAD_REQUEST);
      }

      const insertPayload: Record<string, any> = {
        tenantId: body.tenantId,
        title: body.name || 'New Template',
        archetype: body.archetype || 'loyalty',
        subtitle: body.name || 'New Template',
        status: 'draft',
        classSuffix: body.classSuffix,
      };

      if (body.fieldRows !== undefined)
        insertPayload.fieldRows = body.fieldRows;
      if (body.hexBackgroundColor !== undefined)
        insertPayload.hexBackgroundColor = body.hexBackgroundColor;
      if (body.logoUrl !== undefined) insertPayload.logoUrl = body.logoUrl;
      if (body.heroImageUrl !== undefined)
        insertPayload.heroImageUrl = body.heroImageUrl;

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

      const classData: any = await this.walletService.createGenericClass({
        classSuffix: template.classSuffix || template.tenant?.classSuffix,
        cardTitle: template.tenant?.name || template.title,
        hexBackgroundColor:
          template.hexBackgroundColor || template.tenant?.brandHexColor,
        rows: template.fieldRows,
        logoUrl,
        heroImageUrl,
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
