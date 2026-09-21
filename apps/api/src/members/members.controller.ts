import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { NotifyService } from '../notification/notify.service';
import { WalletService } from '../wallet/wallet.service';
import { TenantGuard, TenantRequest } from '../auth/tenant.guard';
import { AuditService } from '../audit/audit.service';
import { describeError } from '../errors';

@Controller('members')
export class MembersController {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notifyService: NotifyService,
    private readonly walletService: WalletService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @UseGuards(TenantGuard)
  async getMembers(
    @Req() req: TenantRequest,
    @Query('limit') limitQuery?: string,
    @Query('offset') offsetQuery?: string,
    @Query('q') q?: string,
    @Query('dir') dir?: string,
  ) {
    try {
      // Phase 6.1 (FE-3) — `total` is what lets the caller page instead of
      // fetching the whole table and slicing it client-side.
      const limit = Math.min(
        Number(limitQuery) > 0 ? Number(limitQuery) : 50,
        200,
      );
      const offset = Number(offsetQuery) >= 0 ? Number(offsetQuery) : 0;

      let query = this.supabaseService.client
        .from('Member')
        .select(
          'id, name, phone, tenantId, createdAt, isTestAccount, Tenant(name), passes:Pass(id, fullPassId, tier, balance)',
          { count: 'exact' },
        )
        .eq('tenantId', req.tenantId);

      if (q) {
        query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
      }

      const {
        data: members,
        error,
        count,
      } = await query
        // Only a Member column can order a paged query; balance lives on the
        // child Pass rows, so sorting by it would only ever sort the page.
        .order('name', { ascending: dir !== 'desc' })
        .order('createdAt', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }
      return { success: true, members, total: count ?? 0, limit, offset };
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

      const [passesResult, auditLogResult, consentLogResult] =
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
      let passes = passesResult.data;
      const auditLog = auditLogResult.data;
      const consentLog = consentLogResult.data;

      // Check Google Wallet synchronization
      if (passes && passes.length > 0) {
        let deletedPassesCount = 0;
        const passesToKeep = [];

        for (const pass of passes) {
          if (pass.fullPassId) {
            try {
              const googlePass = await this.walletService.getGenericObject(
                pass.fullPassId,
              );
              if (googlePass && googlePass.hasUsers === false) {
                // Pass was deleted from wallet app
                await this.supabaseService.client
                  .from('Pass')
                  .delete()
                  .eq('id', pass.id);
                deletedPassesCount++;
                continue;
              }
            } catch {
              // Ignore errors and assume pass is active if wallet API fails
            }
          }
          passesToKeep.push(pass);
        }

        if (deletedPassesCount > 0 && passesToKeep.length === 0) {
          // All passes were deleted, eliminate member completely
          await this.deleteMemberData(id);
          throw new HttpException(
            {
              success: false,
              error:
                'Member has deleted their pass from Google Wallet and was removed from the system',
            },
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

  /**
   * Phase 1.5 — marks a member as a test account (§1.7). While the tenant's
   * `publishStatus` is 'demo', only test accounts may be issued passes; until
   * now that flag was settable only by a direct DB edit.
   */
  @Patch(':id/test-account')
  @UseGuards(TenantGuard)
  async setTestAccount(
    @Param('id') id: string,
    @Body() body: { isTestAccount: boolean },
    @Req() req: TenantRequest,
  ) {
    try {
      if (typeof body?.isTestAccount !== 'boolean') {
        throw new HttpException(
          { success: false, error: 'isTestAccount must be a boolean' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const { data, error } = await this.supabaseService.client
        .from('Member')
        .update({ isTestAccount: body.isTestAccount })
        .eq('id', id)
        .eq('tenantId', req.tenantId)
        .select('id, isTestAccount')
        .maybeSingle();

      if (error) throw error;
      if (!data)
        throw new HttpException(
          { success: false, error: 'Member not found' },
          HttpStatus.NOT_FOUND,
        );

      await this.auditService.record({
        tenantId: req.tenantId!,
        memberId: id,
        actor: 'admin',
        action: 'test_account_updated',
        details: { isTestAccount: body.isTestAccount },
      });

      return { success: true, member: data };
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
    await this.supabaseService.client
      .from('Pass')
      .delete()
      .eq('memberId', memberId);
    await this.supabaseService.client
      .from('AuditLog')
      .delete()
      .eq('memberId', memberId);
    await this.supabaseService.client
      .from('ConsentLog')
      .delete()
      .eq('memberId', memberId);
    await this.supabaseService.client
      .from('NotificationLog')
      .delete()
      .eq('memberId', memberId);

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

      // Route is not tenant-guarded yet (pre-existing gap, out of scope here);
      // use the fetched pass's tenantId rather than an unavailable req.tenantId.
      await this.auditService.record({
        tenantId: pass.tenantId,
        memberId,
        passId,
        actor: adminId || 'unknown-admin',
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
            errorReason: describeError(err),
          }),
        );

      return { success: true, newBalance };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
