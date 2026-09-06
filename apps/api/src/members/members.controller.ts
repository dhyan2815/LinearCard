import { Controller, Get, Post, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { NotifyService } from '../notification/notify.service';
import { WalletService } from '../wallet/wallet.service';

@Controller('members')
export class MembersController {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notifyService: NotifyService,
    private readonly walletService: WalletService
  ) {}

  @Get()
  async getMembers() {
    try {
      const { data: members, error } = await this.supabaseService.client
        .from('Member')
        .select('id, name, phone, tenantId, createdAt, passes:Pass(id, fullPassId, tier, balance)')
        .order('createdAt', { ascending: false });

      if (error) {
        throw error;
      }
      return { success: true, members };
    } catch (error: any) {
      throw new HttpException({ success: false, error: 'Failed to fetch members' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  async getMemberById(@Param('id') id: string) {
    try {
      const { data: member, error } = await this.supabaseService.client.from('Member').select('*, Tenant(name)').eq('id', id).single();
      if (error || !member) throw new HttpException({ success: false, error: 'Member not found' }, HttpStatus.NOT_FOUND);

      const [{ data: passes }, { data: auditLog }, { data: consentLog }] = await Promise.all([
        this.supabaseService.client.from('Pass').select('*').eq('memberId', id).order('createdAt', { ascending: false }),
        this.supabaseService.client.from('AuditLog').select('*').eq('memberId', id).order('createdAt', { ascending: false }).limit(50),
        this.supabaseService.client.from('ConsentLog').select('*').eq('memberId', id).order('consentedAt', { ascending: false }),
      ]);

      const formattedAuditLog = (auditLog || []).map((entry: any) => ({
        ...entry,
        ...(entry.details && typeof entry.details === 'object' ? entry.details : {}),
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
      throw new HttpException({ success: false, error: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':id/adjust-balance')
  async adjustBalance(@Param('id') memberId: string, @Body() body: any) {
    try {
      const { amount, reason, passId, adminId } = body;
      const { data: pass, error: passError } = await this.supabaseService.client.from('Pass').select('*').eq('id', passId).single();
      if (passError || !pass) return { success: false, error: 'Pass not found' };

      const newBalance = (pass.balance || 0) + Number(amount);
      const { error: updateError } = await this.supabaseService.client.from('Pass').update({ balance: newBalance }).eq('id', passId);
      if (updateError) throw updateError;

      await this.supabaseService.client.from('AuditLog').insert({
        memberId, passId, adminId: adminId || 'unknown-admin', action: 'balance_adjusted', details: { amount, reason, previousBalance: pass.balance, newBalance },
      });

      this.walletService.updateGenericObject(pass.fullPassId, { balance: String(newBalance), tier: pass.tier, pushNotification: `Balance updated: ${newBalance} Pts. (${reason})` })
        .then(() => this.notifyService.logNotification({ tenantId: pass.tenantId, memberId, type: 'balance_update', channel: 'wallet_push', status: 'sent' }))
        .catch(err => this.notifyService.logNotification({ tenantId: pass.tenantId, memberId, type: 'balance_update', channel: 'wallet_push', status: 'failed', errorReason: err?.message || String(err) }));

      return { success: true, newBalance };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
