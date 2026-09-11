import { Module } from '@nestjs/common';
import { TemplatesController } from './templates.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { NotificationModule } from '../notification/notification.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [SupabaseModule, NotificationModule, WalletModule],
  controllers: [TemplatesController],
})
export class TemplatesModule {}
