import { Module } from '@nestjs/common';
import {
  SettingsController,
  DeveloperSettingsController,
} from './settings.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { NotificationModule } from '../notification/notification.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [SupabaseModule, NotificationModule, WalletModule],
  controllers: [SettingsController, DeveloperSettingsController],
})
export class SettingsModule {}
