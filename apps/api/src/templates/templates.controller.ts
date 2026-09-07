import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
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
}
