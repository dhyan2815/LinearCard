import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { JWT_SECRET } from '../env';

export interface ResolvedTenant {
  tenantId: string;
  role: string | null;
}

export type TenantRequest = Request & {
  tenantId?: string;
  authRole?: string | null;
};

function extractToken(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  if (req.cookies?.admin_session) {
    const c = req.cookies.admin_session;
    return typeof c === 'object' && c?.value ? c.value : c;
  }
  const rawCookie = req.headers['cookie'];
  if (rawCookie) {
    const match = rawCookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

/**
 * Single tenant-resolution path: JWT (bearer/cookie) first, falling back to
 * a Tenant.apiKey lookup. Used both as a hard guard (canActivate) and, via
 * resolveTenant(), as a soft/optional resolver for routes that allow
 * anonymous callers but still want to identify a tenant when possible.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async resolveTenant(req: Request): Promise<ResolvedTenant | null> {
    const token = extractToken(req);
    if (!token) {
      console.log('[TenantGuard] No token found');
      return null;
    }

    console.log('[TenantGuard] Token found, attempting JWT verification');
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (decoded?.tenantId) {
        console.log('[TenantGuard] JWT verified successfully, tenantId:', decoded.tenantId);
        return { tenantId: decoded.tenantId, role: decoded.role ?? null };
      }
    } catch (jwtErr) {
      console.log('[TenantGuard] JWT verification failed, falling back to API key lookup:', (jwtErr as Error).message);
    }

    // Hashed ApiKey table first (current path for keys issued via
    // POST /developers/api-keys). Falls back to the legacy plaintext
    // Tenant.apiKey column only when no hashed row matches, so existing
    // tenants' keys keep working during the migration window — new keys
    // are never written there again.
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    console.log('[TenantGuard] Querying ApiKey table with hash');
    const { data: apiKey, error: apiKeyErr } = await this.supabaseService.client
      .from('ApiKey')
      .select('id, tenantId, revokedAt')
      .eq('hash', hash)
      .is('revokedAt', null)
      .single();

    if (apiKeyErr) {
      console.log('[TenantGuard] ApiKey query error:', apiKeyErr.message);
    }

    if (apiKey) {
      console.log('[TenantGuard] ApiKey found, tenantId:', apiKey.tenantId);
      // Best-effort; must never block/fail auth on a logging write.
      Promise.resolve(
        this.supabaseService.client
          .from('ApiKey')
          .update({ lastUsedAt: new Date().toISOString() })
          .eq('id', apiKey.id),
      ).catch(() => {});
      return { tenantId: apiKey.tenantId, role: null };
    }

    console.log('[TenantGuard] Querying legacy Tenant.apiKey');
    const { data: tenant, error: tenantErr } = await this.supabaseService.client
      .from('Tenant')
      .select('id')
      .eq('apiKey', token)
      .single();

    if (tenantErr) {
      console.log('[TenantGuard] Tenant query error:', tenantErr.message);
    }

    if (tenant) {
      console.log('[TenantGuard] Legacy apiKey found, tenantId:', tenant.id);
      return { tenantId: tenant.id, role: null };
    }

    console.log('[TenantGuard] No authentication found (token invalid or not in DB)');
    return null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<TenantRequest>();
    console.log('[TenantGuard] canActivate called for:', req.path);

    try {
      const resolved = await this.resolveTenant(req);
      if (!resolved) {
        console.log('[TenantGuard] Auth failed: no tenant resolved');
        throw new UnauthorizedException(
          'Unauthorized: Missing or invalid authentication',
        );
      }
      req.tenantId = resolved.tenantId;
      req.authRole = resolved.role;
      console.log('[TenantGuard] Auth passed for tenantId:', resolved.tenantId);
      return true;
    } catch (err) {
      console.log('[TenantGuard] Exception during canActivate:', err instanceof Error ? err.message : String(err));
      throw err;
    }
  }
}
