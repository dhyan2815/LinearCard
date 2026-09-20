import { NotificationsModule } from './notifications/notifications.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { SettingsModule } from './settings/settings.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PassesModule } from './passes/passes.module';
import { MembersModule } from './members/members.module';
import { TemplatesModule } from './templates/templates.module';
import { ProgramsModule } from './programs/programs.module';
import { TenantModule } from './tenant/tenant.module';
import { AuthModule } from './auth/auth.module';
import { DevelopersModule } from './developers/developers.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { WalletModule } from './wallet/wallet.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    SupabaseModule,
    WalletModule,
    NotificationModule,
    AuthModule,
    TenantModule,
    TemplatesModule,
    ProgramsModule,
    MembersModule,
    PassesModule,
    DashboardModule,
    SettingsModule,
    NotificationsModule,
    CampaignsModule,
    DevelopersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
