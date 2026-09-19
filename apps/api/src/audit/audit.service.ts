import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface AuditRecordInput {
  tenantId: string;
  memberId: string;
  passId?: string | null;
  actor: string;
  action: string;
  details?: Record<string, any> | null;
}

/**
 * Single writer for the `AuditLog` table. The table has no `passId` column,
 * so passId (when given) is folded into `details` — keeps all call sites
 * consistent instead of each inlining its own shape.
 */
@Injectable()
export class AuditService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async record({
    tenantId,
    memberId,
    passId,
    actor,
    action,
    details,
  }: AuditRecordInput): Promise<void> {
    await this.supabaseService.client.from('AuditLog').insert({
      tenantId,
      memberId,
      actor,
      action,
      details: passId ? { passId, ...details } : details || {},
    });
  }
}
