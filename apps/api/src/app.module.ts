import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { WalletModule } from './wallet/wallet.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [SupabaseModule, WalletModule, NotificationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
