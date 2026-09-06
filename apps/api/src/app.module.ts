import { NotificationsModule } from './notifications/notifications.module';
import { SettingsModule } from './settings/settings.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PassesModule } from './passes/passes.module';
import { MembersModule } from './members/members.module';
import { TemplatesModule } from './templates/templates.module';
import { TenantModule } from './tenant/tenant.module';
import { AuthModule } from './auth/auth.module';
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
    MembersModule,
    PassesModule,
    DashboardModule,
    SettingsModule,
    NotificationsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
