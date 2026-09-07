import {
  Controller,
  Get,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('tenant')
export class TenantController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get('tenants')
  async getTenants() {
    try {
      const { data: tenants, error } = await this.supabaseService.client
        .from('Tenant')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        throw new Error(`DB Error: ${error.message}`);
      }
      return { success: true, tenants };
    } catch {
      throw new HttpException(
        { success: false, error: 'Failed to fetch tenants' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':slug')
  async getTenantBySlug(@Param('slug') slug: string) {
    try {
      if (slug === 'default' || slug === 'linearcard_demo') {
        const { data: demoTenant } = await this.supabaseService.client
          .from('Tenant')
          .select('*')
          .eq('classSuffix', 'linearcard_demo')
          .single();

        if (demoTenant) {
          return {
            tenantId: demoTenant.id,
            name: demoTenant.name,
            brandHexColor: demoTenant.brandHexColor,
            logoUrl: demoTenant.logoUrl,
            heroUrl: demoTenant.heroUrl,
            classSuffix: demoTenant.classSuffix,
          };
        }

        return {
          tenantId: 'demo-tenant-123',
          name: 'LinearCard Demo Pass',
          brandHexColor: '#F97316',
          logoUrl: '/logo-linearcard.png',
          heroUrl: '/hero-linearcard.png',
          classSuffix: 'linearcard_demo',
        };
      }

      const { data: tenant, error } = await this.supabaseService.client
        .from('Tenant')
        .select('*')
        .eq('classSuffix', slug)
        .single();

      if (error || !tenant) {
        throw new HttpException(
          { error: 'Tenant not found' },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        tenantId: tenant.id,
        name: tenant.name,
        brandHexColor: tenant.brandHexColor,
        logoUrl: tenant.logoUrl,
        heroUrl: tenant.heroUrl,
        classSuffix: tenant.classSuffix,
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { error: 'Failed to fetch tenant' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
