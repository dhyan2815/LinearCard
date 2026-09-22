import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { TenantGuard, TenantRequest } from '../auth/tenant.guard';

const DEFAULT_WINDOW_DAYS = 30;

/**
 * Phase 8 — the program Overview tab.
 *
 * Current state comes from Pass columns, history from AuditLog rows. Install
 * history starts the day event recording shipped: the wallet 'save' callback
 * previously persisted nothing, so `historyStartsAt` is reported rather than
 * implying zero activity before it.
 *
 * ponytail: buckets are computed in JS over the window's rows, not in SQL.
 * Fine at current volume — push to a SQL date_trunc aggregate if a program
 * ever has enough events that pulling the window hurts.
 */
@Controller('programs')
@UseGuards(TenantGuard)
export class ProgramAnalyticsController {
  constructor(private readonly supabaseService: SupabaseService) {}

  private bucketKey(iso: string, groupBy: string): string {
    return groupBy === 'month' ? iso.slice(0, 7) : iso.slice(0, 10);
  }

  @Get(':id/overview')
  async overview(
    @Param('id') id: string,
    @Req() req: TenantRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('groupBy') groupBy: string = 'day',
  ) {
    const { data: program } = await this.supabaseService.client
      .from('Program')
      .select('id')
      .eq('id', id)
      .eq('tenantId', req.tenantId)
      .maybeSingle();
    if (!program)
      throw new HttpException(
        { success: false, error: 'Program not found' },
        HttpStatus.NOT_FOUND,
      );

    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getTime() - DEFAULT_WINDOW_DAYS * 86400_000);

    const [{ data: passes }, { data: events }] = await Promise.all([
      this.supabaseService.client
        .from('Pass')
        .select('id, deletedAt, installedAt')
        .eq('tenantId', req.tenantId)
        .eq('programId', id),
      this.supabaseService.client
        .from('AuditLog')
        .select('action, createdAt')
        .eq('tenantId', req.tenantId)
        .eq('programId', id)
        .gte('createdAt', fromDate.toISOString())
        .lte('createdAt', toDate.toISOString()),
    ]);

    const live = (passes || []).filter((p: any) => !p.deletedAt);
    const buckets = new Map<
      string,
      { bucket: string; created: number; installed: number; deleted: number }
    >();
    const totals = { created: 0, installed: 0, deleted: 0 };

    for (const e of events || []) {
      const key = this.bucketKey(e.createdAt, groupBy);
      const bucket = buckets.get(key) || {
        bucket: key,
        created: 0,
        installed: 0,
        deleted: 0,
      };
      if (e.action === 'pass_created') {
        bucket.created++;
        totals.created++;
      } else if (e.action === 'pass_installed') {
        bucket.installed++;
        totals.installed++;
      } else if (e.action === 'pass_deleted') {
        bucket.deleted++;
        totals.deleted++;
      }
      buckets.set(key, bucket);
    }

    const { data: firstEvent } = await this.supabaseService.client
      .from('AuditLog')
      .select('createdAt')
      .eq('tenantId', req.tenantId)
      .eq('programId', id)
      .order('createdAt', { ascending: true })
      .limit(1)
      .maybeSingle();

    return {
      success: true,
      overview: {
        active: live.length,
        created: totals.created,
        installed: totals.installed,
        deleted: totals.deleted,
        // Apple Wallet is not implemented; reported as 0 rather than omitted,
        // so the UI can show the row and say why it is empty.
        devices: {
          google: live.filter((p: any) => p.installedAt).length,
          apple: 0,
          other: 0,
        },
        series: [...buckets.values()].sort((a, b) =>
          a.bucket.localeCompare(b.bucket),
        ),
        historyStartsAt: firstEvent?.createdAt ?? null,
      },
    };
  }
}
