import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { NotificationModule } from '../notification/notification.module';
import { WalletModule } from '../wallet/wallet.module';
import { DevelopersModule } from '../developers/developers.module';

@Module({
  imports: [SupabaseModule, NotificationModule, WalletModule, DevelopersModule],
  controllers: [AuthController],
})
export class AuthModule {}
