import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { NotifyService } from '../notification/notify.service';
import { WalletService } from '../wallet/wallet.service';

@Controller('members')
export class MembersController {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notifyService: NotifyService,
    private readonly walletService: WalletService,
  ) {}

  @Get()
  async getMembers() {
    try {
      const { data: members, error } = await this.supabaseService.client
        .from('Member')
        .select(
          'id, name, phone, tenantId, createdAt, passes:Pass(id, fullPassId, tier, balance)',
        )
        .order('createdAt', { ascending: false });

      if (error) {
        throw error;
      }
      return { success: true, members };
    } catch {
      throw new HttpException(
        { success: false, error: 'Failed to fetch members' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getMemberById(@Param('id') id: string) {
    try {
      const { data: member, error } = await this.supabaseService.client
        .from('Member')
        .select('*, Tenant(name)')
        .eq('id', id)
        .single();
      if (error || !member)
        throw new HttpException(
          { success: false, error: 'Member not found' },
          HttpStatus.NOT_FOUND,
        );

      let [{ data: passes }, { data: auditLog }, { data: consentLog }] =
        await Promise.all([
          this.supabaseService.client
            .from('Pass')
            .select('*')
            .eq('memberId', id)
            .order('createdAt', { ascending: false }),
          this.supabaseService.client
            .from('AuditLog')
            .select('*')
            .eq('memberId', id)
            .order('createdAt', { ascending: false })
            .limit(50),
          this.supabaseService.client
            .from('ConsentLog')
            .select('*')
            .eq('memberId', id)
            .order('consentedAt', { ascending: false }),
        ]);

      // Check Google Wallet synchronization
      if (passes && passes.length > 0) {
        let deletedPassesCount = 0;
        const passesToKeep = [];
        
        for (const pass of passes) {
          if (pass.fullPassId) {
            try {
              const googlePass = await this.walletService.getGenericObject(pass.fullPassId);
              if (googlePass && googlePass.hasUsers === false) {
                // Pass was deleted from wallet app
                await this.supabaseService.client.from('Pass').delete().eq('id', pass.id);
                deletedPassesCount++;
                continue;
              }
            } catch (err) {
              // Ignore errors and assume pass is active if wallet API fails
            }
          }
          passesToKeep.push(pass);
        }

        if (deletedPassesCount > 0 && passesToKeep.length === 0) {
          // All passes were deleted, eliminate member completely
          await this.deleteMemberData(id);
          throw new HttpException(
            { success: false, error: 'Member has deleted their pass from Google Wallet and was removed from the system' },
            HttpStatus.NOT_FOUND,
          );
        }
        passes = passesToKeep;
      }

      const formattedAuditLog = (auditLog || []).map((entry: any) => ({
        ...entry,
        ...(entry.details && typeof entry.details === 'object'
          ? entry.details
          : {}),
      }));

      return {
        success: true,
        member: {
          ...member,
          passes: passes || [],
          auditLog: formattedAuditLog,
          consentLog: consentLog || [],
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async deleteMember(@Param('id') id: string) {
    try {
      await this.deleteMemberData(id);
      return { success: true };
    } catch (error: any) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async deleteMemberData(memberId: string) {
    // Delete related records manually to ensure they're removed if no CASCADE is set
    await this.supabaseService.client.from('Pass').delete().eq('memberId', memberId);
    await this.supabaseService.client.from('AuditLog').delete().eq('memberId', memberId);
    await this.supabaseService.client.from('ConsentLog').delete().eq('memberId', memberId);
    await this.supabaseService.client.from('NotificationLog').delete().eq('memberId', memberId);
    
    const { error } = await this.supabaseService.client
      .from('Member')
      .delete()
      .eq('id', memberId);
      
    if (error) throw error;
  }

  @Post(':id/adjust-balance')
  async adjustBalance(@Param('id') memberId: string, @Body() body: any) {
    try {
      const { amount, reason, passId, adminId } = body;
      const { data: pass, error: passError } = await this.supabaseService.client
        .from('Pass')
        .select('*')
        .eq('id', passId)
        .single();
      if (passError || !pass)
        return { success: false, error: 'Pass not found' };

      const newBalance = (pass.balance || 0) + Number(amount);
      const { error: updateError } = await this.supabaseService.client
        .from('Pass')
        .update({ balance: newBalance })
        .eq('id', passId);
      if (updateError) throw updateError;

      await this.supabaseService.client.from('AuditLog').insert({
        memberId,
        passId,
        adminId: adminId || 'unknown-admin',
        action: 'balance_adjusted',
        details: { amount, reason, previousBalance: pass.balance, newBalance },
      });

      this.walletService
        .updateGenericObject(pass.fullPassId, {
          balance: String(newBalance),
          tier: pass.tier,
          pushNotification: `Balance updated: ${newBalance} Pts. (${reason})`,
        })
        .then(() =>
          this.notifyService.logNotification({
            tenantId: pass.tenantId,
            memberId,
            type: 'balance_update',
            channel: 'wallet_push',
            status: 'sent',
          }),
        )
        .catch((err) =>
          this.notifyService.logNotification({
            tenantId: pass.tenantId,
            memberId,
            type: 'balance_update',
            channel: 'wallet_push',
            status: 'failed',
            errorReason: err?.message || String(err),
          }),
        );

      return { success: true, newBalance };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
