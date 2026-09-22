/**
 * Phase 8 — PassKit project model: self-serve signup and program-scoped views.
 * One assertion per defect the phase closed.
 */
import * as jwt from 'jsonwebtoken';
import { PassIssuanceService } from './passes/pass-issuance.service';
import { AuthController } from './auth/auth.controller';
import { JWT_SECRET } from './env';

/** Minimal chainable Supabase stub: one table -> canned rows, records writes. */
function supabaseStub(tables: Record<string, any[]>) {
  const writes: any[] = [];
  const client = {
    from(table: string) {
      const filters: Record<string, any> = {};
      const rowsFor = () => {
        let rows = tables[table] ?? [];
        for (const [col, val] of Object.entries(filters))
          rows = rows.filter((r: any) => r[col] === val);
        return rows;
      };
      const chain: any = {
        select: () => chain,
        insert: (payload: any) => {
          writes.push({ table, op: 'insert', payload });
          const rows = (Array.isArray(payload) ? payload : [payload]).map(
            (p: any, i: number) => ({ id: `${table}-${i}`, ...p }),
          );
          chain._inserted = rows;
          return chain;
        },
        update: (payload: any) => {
          writes.push({ table, op: 'update', payload });
          chain._updated = payload;
          return chain;
        },
        delete: () => {
          writes.push({ table, op: 'delete' });
          return chain;
        },
        eq: (col: string, val: any) => {
          filters[col] = val;
          return chain;
        },
        is: () => chain,
        gte: () => chain,
        lte: () => chain,
        or: () => chain,
        range: () => chain,
        limit: () => chain,
        order: () => chain,
        maybeSingle: async () => ({ data: rowsFor()[0] ?? null, error: null }),
        single: async () => ({
          data: chain._inserted?.[0] ?? chain._updated ?? rowsFor()[0] ?? null,
          error: null,
        }),
        then: (resolve: any) =>
          resolve({ data: rowsFor(), error: null, count: rowsFor().length }),
      };
      return chain;
    },
  };
  return { client, writes };
}

describe('8.1 — the demo gate covers every issuance path', () => {
  const walletStub: any = {
    resolveTenantPassDesign: async () => ({ classSuffix: 'x' }),
    forTenant: async () => ({
      buildSaveLink: () => ({ token: 't', googleWalletUrl: 'https://w' }),
      createGoogleWalletPass: async () => ({
        success: true,
        fullPassId: 'f1',
        googleWalletUrl: 'https://w',
      }),
    }),
  };
  const noopWhatsapp: any = {
    sendPassLinkWithLog: async () => {},
    sendTextWithLog: async () => {},
  };
  const noopWebhooks: any = { dispatch: async () => {} };

  function serviceFor(publishStatus: string, isTestAccount: boolean) {
    const { client } = supabaseStub({
      Tenant: [{ id: 't1', name: 'Demo Co', publishStatus }],
      Member: [{ id: 'm1', tenantId: 't1', phone: '+911', isTestAccount }],
      Tier: [],
      Pass: [],
      Program: [{ id: 'p1', tenantId: 't1' }],
    });
    return new PassIssuanceService(
      { client } as any,
      walletStub,
      noopWhatsapp,
      noopWebhooks,
    );
  }

  it('refuses a demo tenant issuing to a non-test member', async () => {
    const result = await serviceFor('demo', false).issueForMember({
      tenantId: 't1',
      member: { id: 'm1', phone: '+911' },
      program: { id: 'p1' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/demo mode/i);
  });

  it('allows a demo tenant issuing to a test member', async () => {
    const result = await serviceFor('demo', true).issueForMember({
      tenantId: 't1',
      member: { id: 'm1', phone: '+911' },
      program: { id: 'p1' },
    });
    expect(String(result.error ?? '')).not.toMatch(/demo mode/i);
  });

  it('fails open when publishStatus is missing', async () => {
    const result = await serviceFor(undefined as any, false).issueForMember({
      tenantId: 't1',
      member: { id: 'm1', phone: '+911' },
      program: { id: 'p1' },
    });
    expect(String(result.error ?? '')).not.toMatch(/demo mode/i);
  });
});

describe('8.2 — an unknown admin phone no longer joins the first tenant', () => {
  const otpServiceStub: any = {
    hashOtp: () => 'hash',
    isOtpRateLimited: async () => false,
    verifyOtpAttempt: async () => ({ ok: true, locked: false }),
  };

  function controllerFor(tables: Record<string, any[]>) {
    const stub = supabaseStub(tables);
    // Constructor order: supabase, otp, whatsapp, notify, passIssuance.
    const controller = new AuthController(
      { client: stub.client } as any,
      otpServiceStub,
      { sendOtp: async () => {} } as any,
      {} as any,
      {} as any,
    );
    return { controller, stub };
  }

  const otpRow = {
    id: 'o1',
    phone: '+919999999999',
    purpose: 'admin_login',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    consumedAt: null,
  };

  it('creates no Admin row and returns needsOnboarding', async () => {
    const { controller, stub } = controllerFor({
      OtpSession: [otpRow],
      Admin: [],
      Tenant: [{ id: 'someone-elses-tenant' }],
    });
    const res: any = { cookie: jest.fn() };

    const result: any = await controller.adminVerifyOtp(
      { phone: '+919999999999', otp: '1234' },
      res,
    );

    expect(result.needsOnboarding).toBe(true);
    expect(typeof result.signupToken).toBe('string');
    expect(res.cookie).not.toHaveBeenCalled();
    expect(
      stub.writes.some((w) => w.table === 'Admin' && w.op === 'insert'),
    ).toBe(false);
  });

  it('logs an existing admin in unchanged', async () => {
    const { controller } = controllerFor({
      OtpSession: [otpRow],
      Admin: [
        { id: 'a1', phone: '+919999999999', tenantId: 't1', role: 'admin' },
      ],
    });
    const res: any = { cookie: jest.fn() };

    const result: any = await controller.adminVerifyOtp(
      { phone: '+919999999999', otp: '1234' },
      res,
    );

    expect(result.success).toBe(true);
    expect(result.needsOnboarding).toBeUndefined();
    expect(res.cookie).toHaveBeenCalled();
  });
});

describe('8.3 — self-serve tenant signup', () => {
  function controllerFor(tables: Record<string, any[]>) {
    const stub = supabaseStub(tables);
    const controller = new AuthController(
      { client: stub.client } as any,
      { hashOtp: () => 'h' } as any,
      { sendOtp: async () => {} } as any,
      {} as any,
      {} as any,
    );
    return { controller, stub };
  }

  const token = () =>
    jwt.sign({ phone: '+919999999999', purpose: 'signup' }, JWT_SECRET, {
      expiresIn: '10m',
    });

  it('creates a demo tenant and its admin', async () => {
    const { controller, stub } = controllerFor({ Admin: [], Tenant: [] });
    const res: any = { cookie: jest.fn() };

    const result: any = await controller.adminSignup(
      { signupToken: token(), brandName: 'Blue Tokai' },
      res,
    );

    expect(result.success).toBe(true);
    const tenantInsert = stub.writes.find(
      (w) => w.table === 'Tenant' && w.op === 'insert',
    );
    expect(tenantInsert.payload.publishStatus).toBe('demo');
    expect(tenantInsert.payload.classSuffix).toBe('blue_tokai');
    expect(
      stub.writes.some((w) => w.table === 'Admin' && w.op === 'insert'),
    ).toBe(true);
    expect(res.cookie).toHaveBeenCalled();
  });

  it('refuses a token whose phone already has an admin', async () => {
    const { controller } = controllerFor({
      Admin: [{ id: 'a1', phone: '+919999999999', tenantId: 't1' }],
      Tenant: [],
    });
    const res: any = { cookie: jest.fn() };

    await expect(
      controller.adminSignup({ signupToken: token(), brandName: 'Dup' }, res),
    ).rejects.toThrow();
  });

  it('refuses a blank brand name', async () => {
    const { controller } = controllerFor({ Admin: [], Tenant: [] });
    const res: any = { cookie: jest.fn() };
    await expect(
      controller.adminSignup({ signupToken: token(), brandName: '   ' }, res),
    ).rejects.toThrow();
  });
});
