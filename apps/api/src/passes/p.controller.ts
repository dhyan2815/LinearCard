import {
  Controller,
  Get,
  Param,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { SupabaseService } from '../supabase/supabase.service';
import { WalletService } from '../wallet/wallet.service';

@Controller('p')
export class PController {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly walletService: WalletService,
  ) {}

  @Get(':id')
  async redirectPass(@Param('id') id: string, @Res() res: Response) {
    try {
      if (!id)
        throw new HttpException('Missing pass ID', HttpStatus.BAD_REQUEST);

      const { data: pass, error } = await this.supabaseService.client
        .from('Pass')
        .select('*, member:Member(*), tenant:Tenant(*)')
        .eq('id', id)
        .single();

      if (error || !pass) {
        throw new HttpException('Pass not found', HttpStatus.NOT_FOUND);
      }

      const objectSuffixOverride = pass.fullPassId.split('.').pop();
      if (!objectSuffixOverride) {
        throw new HttpException(
          'Invalid pass configuration',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const passResult = await this.walletService.createGoogleWalletPass({
        memberName: pass.member.name || pass.member.phone,
        cardTitle: pass.tenant.name,
        balance: String(pass.balance),
        tier: pass.tier,
        hexBackgroundColor: pass.tenant.brandHexColor,
        barcodeValue: `https://linearcard.vercel.app/m/${pass.member.phone.replace(/[^0-9]/g, '')}`,
        barcodeAltText:
          pass.barcodeAlt || pass.member.phone.replace(/[^0-9]/g, ''),
        classSuffix: pass.tenant.classSuffix,
        logoUrl: pass.tenant.logoUrl?.startsWith('/')
          ? `http://localhost:3000${pass.tenant.logoUrl}`
          : pass.tenant.logoUrl,
        heroImageUrl: pass.tenant.heroUrl?.startsWith('/')
          ? `http://localhost:3000${pass.tenant.heroUrl}`
          : pass.tenant.heroUrl,
        passId: objectSuffixOverride,
      });

      if (passResult.success && passResult.googleWalletUrl) {
        return res.redirect(passResult.googleWalletUrl);
      } else {
        throw new HttpException(
          'Failed to generate pass URL',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
