import { Module } from '@nestjs/common';
import { ProgramsController } from './programs.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { TemplatesModule } from '../templates/templates.module';
import { TenantGuard } from '../auth/tenant.guard';

@Module({
  imports: [SupabaseModule, TemplatesModule],
  controllers: [ProgramsController],
  providers: [TenantGuard],
})
export class ProgramsModule {}
