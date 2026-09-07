import { Module } from '@nestjs/common';
import { PassesController } from './passes.controller';
import { PController } from './p.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { NotificationModule } from '../notification/notification.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [SupabaseModule, NotificationModule, WalletModule],
  controllers: [PassesController, PController],
})
export class PassesModule {}
