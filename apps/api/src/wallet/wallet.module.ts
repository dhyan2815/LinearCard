import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
