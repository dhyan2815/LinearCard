import { WalletService, resolveCardTitle } from './wallet.service';

// Phase 0.2: publishing a class refuses a localhost callback URL, and the
// repo .env points at localhost. Give these tests a public one.
process.env.PUBLIC_CALLBACK_URL = 'https://api.test.linearcard.example';
import { encryptSecret, decryptSecret } from '../env';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

describe('resolveCardTitle', () => {
  it('combines tenant name and template title with a middle dot', () => {
    expect(resolveCardTitle('Bistro Cafe', 'Gift Card')).toBe(
      'Bistro Cafe · Gift Card',
    );
  });

  it('falls back to the tenant name alone when there is no template title', () => {
    expect(resolveCardTitle('Bistro Cafe', undefined)).toBe('Bistro Cafe');
  });

  it('falls back to the template title alone when there is no tenant name', () => {
    expect(resolveCardTitle(undefined, 'Gift Card')).toBe('Gift Card');
  });

  it('returns undefined when neither is present', () => {
    expect(resolveCardTitle(undefined, undefined)).toBeUndefined();
  });
});

describe('WalletService.sendPromoMessageWithAudit', () => {
  let service: WalletService;
  let mockSupabaseService: any;
  let mockNotifyService: any;
  let mockWhatsappService: any;
  let mockAuditService: any;

  beforeEach(() => {
    mockSupabaseService = {
      client: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn(),
        gte: jest.fn(),
      },
    };
    mockNotifyService = {
      logNotification: jest.fn(),
    };
    mockWhatsappService = {
      sendRedemptionReceiptWithLog: jest.fn(),
      sendTierUpgradeMessage: jest.fn(),
    };
    mockAuditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    service = new WalletService(
      mockSupabaseService,
      mockNotifyService,
      mockWhatsappService,
      mockAuditService,
      { dispatch: jest.fn().mockResolvedValue(undefined) } as any,
    );
  });

  it('should reject member without consent', async () => {
    mockSupabaseService.client.single.mockResolvedValue({ data: null }); // No consent

    await expect(
      service.sendPromoMessageWithAudit(
        'pass-1',
        'mem-1',
        'tenant-1',
        'Header',
        'Body',
      ),
    ).rejects.toThrow('Member has not consented');
  });

  // Phase 2.4 (DB-8): a grant on file is not enough — a later STOP overrides it.
  it('should reject a member who opted out after consenting', async () => {
    mockSupabaseService.client.single
      .mockResolvedValueOnce({ data: { consentedAt: '2023-01-01' } })
      .mockResolvedValueOnce({
        data: { marketingOptOutAt: '2026-09-01T00:00:00Z' },
      });

    await expect(
      service.sendPromoMessageWithAudit(
        'pass-1',
        'mem-1',
        'tenant-1',
        'Header',
        'Body',
      ),
    ).rejects.toThrow('opted out');
  });

  it('should log success after Google API succeeds', async () => {
    mockSupabaseService.client.single
      .mockResolvedValueOnce({ data: { consentedAt: '2023-01-01' } })
      // Phase 2.4: consent is re-checked against Member.marketingOptOutAt.
      .mockResolvedValueOnce({ data: { marketingOptOutAt: null } });

    const fakeClient = {
      request: jest.fn().mockResolvedValue({ data: { success: true } }),
    };
    jest
      .spyOn(service, 'getGoogleAuthClient')
      .mockResolvedValue(fakeClient as any);

    const result = await service.sendPromoMessageWithAudit(
      'pass-1',
      'mem-1',
      'tenant-1',
      'Header',
      'Body',
    );

    expect(result.success).toBe(true);
    expect(mockNotifyService.logNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'sent',
        type: 'promo_message',
      }),
    );
  });

  it('should log failure if Google API fails', async () => {
    mockSupabaseService.client.single
      .mockResolvedValueOnce({ data: { consentedAt: '2023-01-01' } })
      .mockResolvedValueOnce({ data: { marketingOptOutAt: null } });

    const fakeClient = {
      request: jest.fn().mockRejectedValue(new Error('Google API Error')),
    };
    jest
      .spyOn(service, 'getGoogleAuthClient')
      .mockResolvedValue(fakeClient as any);

    await expect(
      service.sendPromoMessageWithAudit(
        'pass-1',
        'mem-1',
        'tenant-1',
        'Header',
        'Body',
      ),
    ).rejects.toThrow();

    expect(mockNotifyService.logNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        // Phase 6.2: a stable code plus a cause, not a bare HTTP message.
        errorReason: expect.stringContaining('WALLET_UNAVAILABLE:'),
      }),
    );
  });
});

describe('AES-256-GCM private key encryption (env.ts)', () => {
  it('round-trips a private key through encrypt then decrypt', () => {
    const original =
      '-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----\n';
    const encrypted = encryptSecret(original);
    expect(encrypted).not.toContain('BEGIN PRIVATE KEY');
    expect(decryptSecret(encrypted)).toBe(original);
  });

  it('produces a different ciphertext each time (random IV) but always decrypts correctly', () => {
    const original = 'same-plaintext';
    const a = encryptSecret(original);
    const b = encryptSecret(original);
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(original);
    expect(decryptSecret(b)).toBe(original);
  });
});

describe('wallet.service.ts no longer hardcodes the issuer literal', () => {
  it('does not contain the old hardcoded issuer string anywhere in the file', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'wallet.service.ts'),
      'utf8',
    );
    expect(source).not.toContain('3388000000023177673');
  });
});

describe('WalletService.forTenant credential resolution', () => {
  let service: WalletService;
  let mockSupabaseService: any;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockSupabaseService = { client: { from: jest.fn() } };
    service = new WalletService(
      mockSupabaseService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    process.env.ISSUER_ID = 'env-issuer';
    process.env.GOOGLE_CLIENT_EMAIL = 'env@example.com';
    process.env.GOOGLE_PRIVATE_KEY = 'env-raw-key';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('prefers tenant-level credentials over the env fallback when all three are set', async () => {
    const encryptedKey = encryptSecret('tenant-raw-key');
    mockSupabaseService.client.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              issuerId: 'tenant-issuer',
              googleClientEmail: 'tenant@example.com',
              googlePrivateKeyEncrypted: encryptedKey,
            },
          }),
        }),
      }),
    });

    const scoped = await service.forTenant('tenant-1');
    const creds = (scoped as any).getCredentialsOrThrow();

    expect(creds.issuerId).toBe('tenant-issuer');
    expect(creds.clientEmail).toBe('tenant@example.com');
    expect(creds.privateKey).toContain('tenant-raw-key');
  });

  it('falls back to env vars field-by-field when tenant columns are null', async () => {
    mockSupabaseService.client.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              issuerId: null,
              googleClientEmail: null,
              googlePrivateKeyEncrypted: null,
            },
          }),
        }),
      }),
    });

    const scoped = await service.forTenant('tenant-2');
    const creds = (scoped as any).getCredentialsOrThrow();

    expect(creds.issuerId).toBe('env-issuer');
    expect(creds.clientEmail).toBe('env@example.com');
    expect(creds.privateKey).toContain('env-raw-key');
  });

  it('throws when neither tenant nor env has credentials', async () => {
    delete process.env.ISSUER_ID;
    mockSupabaseService.client.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null }),
        }),
      }),
    });

    await expect(service.forTenant('tenant-3')).rejects.toThrow(
      /Missing Google Wallet credentials/,
    );
  });

  it('a plain (non-forTenant) instance still resolves credentials from env, unchanged', () => {
    const creds = (service as any).getCredentialsOrThrow();
    expect(creds.issuerId).toBe('env-issuer');
  });
});

describe('resolveTenantPassDesign', () => {
  let service: WalletService;
  let mockSupabaseService: any;

  function mockFrom(tenantData: any, templateData: any) {
    mockSupabaseService.client.from.mockImplementation((table: string) => {
      if (table === 'Tenant') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: tenantData }),
            }),
          }),
        };
      }
      if (table === 'PassTemplate') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: templateData }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
  }

  beforeEach(() => {
    mockSupabaseService = { client: { from: jest.fn() } };
    service = new WalletService(
      mockSupabaseService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('combines tenant name and template title into cardTitle', async () => {
    mockFrom(
      { name: 'Bistro Cafe', brandHexColor: '#8B4513' },
      {
        hexBackgroundColor: '#7C3AED',
        classSuffix: 'tpl_suffix',
        title: 'Gift Card',
      },
    );

    const design = await service.resolveTenantPassDesign('tenant-1');
    expect(design.cardTitle).toBe('Bistro Cafe · Gift Card');
  });

  it('prefers the published template colour over the tenant colour', async () => {
    mockFrom(
      { brandHexColor: '#8B4513', logoUrl: 'tenant-logo.png' },
      { hexBackgroundColor: '#7C3AED', classSuffix: 'tpl_suffix' },
    );

    const design = await service.resolveTenantPassDesign('tenant-1');
    expect(design.hexBackgroundColor).toBe('#7C3AED');
  });

  it('falls back to Tenant.brandHexColor when no published template exists', async () => {
    mockFrom({ brandHexColor: '#8B4513' }, null);

    const design = await service.resolveTenantPassDesign('tenant-1');
    expect(design.hexBackgroundColor).toBe('#8B4513');
  });

  it('falls back to DEFAULT_PASS_HEX when neither template nor tenant has a colour', async () => {
    mockFrom({}, null);

    const design = await service.resolveTenantPassDesign('tenant-1');
    expect(design.hexBackgroundColor).toBe('#1A365D');
  });
});

describe('updateGenericObject — hexBackgroundColor patching', () => {
  let service: WalletService;
  let mockGoogleAuthClient: { request: jest.Mock };

  beforeEach(() => {
    service = new WalletService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    mockGoogleAuthClient = { request: jest.fn() };
    jest
      .spyOn(service, 'getGoogleAuthClient')
      .mockResolvedValue(mockGoogleAuthClient as any);
  });

  it('includes cardTitle in the PATCH payload when supplied', async () => {
    mockGoogleAuthClient.request
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: {} });

    await service.updateGenericObject('issuer.pass-1', {
      cardTitle: 'Bistro Cafe · Gift Card',
    });

    const patchCall = mockGoogleAuthClient.request.mock.calls[1][0];
    expect(patchCall.data.cardTitle).toEqual({
      defaultValue: { language: 'en-US', value: 'Bistro Cafe · Gift Card' },
    });
  });

  it('omits cardTitle from the PATCH payload when not supplied', async () => {
    mockGoogleAuthClient.request
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: {} });

    await service.updateGenericObject('issuer.pass-1', { tier: 'Gold' });

    const patchCall = mockGoogleAuthClient.request.mock.calls[1][0];
    expect(patchCall.data.cardTitle).toBeUndefined();
  });

  it('includes hexBackgroundColor in the PATCH payload when supplied', async () => {
    mockGoogleAuthClient.request
      .mockResolvedValueOnce({ data: {} }) // GET genericObject
      .mockResolvedValueOnce({ data: {} }); // PATCH

    await service.updateGenericObject('issuer.pass-1', {
      hexBackgroundColor: '#7C3AED',
    });

    const patchCall = mockGoogleAuthClient.request.mock.calls[1][0];
    expect(patchCall.method).toBe('PATCH');
    expect(patchCall.data.hexBackgroundColor).toBe('#7C3AED');
  });

  it('omits hexBackgroundColor from the PATCH payload when not supplied', async () => {
    mockGoogleAuthClient.request
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: {} });

    await service.updateGenericObject('issuer.pass-1', { tier: 'Gold' });

    const patchCall = mockGoogleAuthClient.request.mock.calls[1][0];
    expect(patchCall.data.hexBackgroundColor).toBeUndefined();
  });
});

describe('createGenericClass — stable field keys', () => {
  let service: WalletService;
  let mockGoogleAuthClient: { request: jest.Mock };

  beforeEach(() => {
    service = new WalletService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    mockGoogleAuthClient = { request: jest.fn() };
    jest
      .spyOn(service, 'getGoogleAuthClient')
      .mockResolvedValue(mockGoogleAuthClient as any);
  });

  it('uses column.key as the textModulesData fieldPath id when present', async () => {
    mockGoogleAuthClient.request.mockResolvedValueOnce({
      data: { id: 'issuer.class_1' },
    });

    await service.createGenericClass({
      classSuffix: 'class_1',
      rows: [
        {
          id: 'row1',
          columns: [{ key: 'points_balance', header: 'Points', body: '500' }],
        },
      ],
    });

    const payload = mockGoogleAuthClient.request.mock.calls[0][0].data;
    const fieldPath =
      payload.classTemplateInfo.cardTemplateOverride.cardRowTemplateInfos[0]
        .oneItem.item.fieldSelector.fields[0].fieldPath;
    expect(fieldPath).toBe("object.textModulesData['points_balance']");
  });

  it('falls back to rowId_index when column.key is missing', async () => {
    mockGoogleAuthClient.request.mockResolvedValueOnce({
      data: { id: 'issuer.class_1' },
    });

    await service.createGenericClass({
      classSuffix: 'class_1',
      rows: [{ id: 'row1', columns: [{ header: 'Points', body: '500' }] }],
    });

    const payload = mockGoogleAuthClient.request.mock.calls[0][0].data;
    const fieldPath =
      payload.classTemplateInfo.cardTemplateOverride.cardRowTemplateInfos[0]
        .oneItem.item.fieldSelector.fields[0].fieldPath;
    expect(fieldPath).toBe("object.textModulesData['row1_0']");
  });

  it('class fieldPath ids and object textModulesData ids always agree (mixed keyed/unkeyed columns)', async () => {
    const rows = [
      {
        id: 'row1',
        columns: [
          { key: 'points_balance', header: 'Points', body: '500' },
          { header: 'Tier', body: 'Gold' }, // no key -> falls back to row1_1
        ],
      },
    ];

    // 1. Build the class and collect every fieldPath id it selects.
    mockGoogleAuthClient.request.mockResolvedValueOnce({
      data: { id: 'issuer.class_1' },
    });
    await service.createGenericClass({ classSuffix: 'class_1', rows });
    const classPayload = mockGoogleAuthClient.request.mock.calls[0][0].data;
    const fieldPathIds: string[] =
      classPayload.classTemplateInfo.cardTemplateOverride.cardRowTemplateInfos[0].twoItems.startItem.item.fieldSelector.fields
        .map((f: any) => f.fieldPath.match(/\['(.+)'\]/)[1])
        .concat(
          classPayload.classTemplateInfo.cardTemplateOverride.cardRowTemplateInfos[0].twoItems.endItem.item.fieldSelector.fields.map(
            (f: any) => f.fieldPath.match(/\['(.+)'\]/)[1],
          ),
        );

    // 2. Build the object and collect its textModulesData ids.
    const objectClient = { request: jest.fn().mockResolvedValue({ data: {} }) };
    jest
      .spyOn(service, 'getGoogleAuthClient')
      .mockResolvedValue(objectClient as any);
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    process.env.ISSUER_ID = 'issuer';
    process.env.GOOGLE_CLIENT_EMAIL = 'test@example.com';
    process.env.GOOGLE_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n');

    // Phase 7.7 — identity fields are required now; no demo defaults.
    await service.createGoogleWalletPass({
      passId: 'pass1',
      rows,
      memberName: 'Asha',
      cardTitle: 'Bean House',
      balance: '0 Pts',
      classSuffix: 'beanhouse_coffee_standard',
    });

    const objectIds =
      objectClient.request.mock.calls[0][0].data.textModulesData.map(
        (m: any) => m.id,
      );

    for (const id of fieldPathIds) {
      expect(objectIds).toContain(id);
    }
  });
});

describe('createGenericClass — merchantLocations (geofencing)', () => {
  let service: WalletService;
  let mockGoogleAuthClient: { request: jest.Mock };

  beforeEach(() => {
    service = new WalletService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    mockGoogleAuthClient = { request: jest.fn() };
    jest
      .spyOn(service, 'getGoogleAuthClient')
      .mockResolvedValue(mockGoogleAuthClient as any);
  });

  it('maps storeLocations to merchantLocations with {latitude, longitude} pairs', async () => {
    mockGoogleAuthClient.request.mockResolvedValueOnce({
      data: { id: 'issuer.class_1' },
    });

    await service.createGenericClass({
      classSuffix: 'class_1',
      storeLocations: [
        { latitude: '19.076000', longitude: '72.877000' },
        { latitude: 28.6139, longitude: 77.209 },
      ],
    });

    const payload = mockGoogleAuthClient.request.mock.calls[0][0].data;
    expect(payload.merchantLocations).toEqual([
      {
        latitude: 19.076,
        longitude: 72.877,
      },
      {
        latitude: 28.6139,
        longitude: 77.209,
      },
    ]);
  });

  it('truncates to a max of 10 locations', async () => {
    mockGoogleAuthClient.request.mockResolvedValueOnce({
      data: { id: 'issuer.class_1' },
    });

    const eleven = Array.from({ length: 11 }, (_, i) => ({
      latitude: i,
      longitude: i,
    }));

    await service.createGenericClass({
      classSuffix: 'class_1',
      storeLocations: eleven,
    });

    const payload = mockGoogleAuthClient.request.mock.calls[0][0].data;
    expect(payload.merchantLocations).toHaveLength(10);
  });

  it('omits merchantLocations entirely when storeLocations is empty', async () => {
    mockGoogleAuthClient.request.mockResolvedValueOnce({
      data: { id: 'issuer.class_1' },
    });

    await service.createGenericClass({
      classSuffix: 'class_1',
      storeLocations: [],
    });

    const payload = mockGoogleAuthClient.request.mock.calls[0][0].data;
    expect(payload.merchantLocations).toBeUndefined();
  });
});

describe('resolveCallbackUrl', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let service: WalletService;

  beforeEach(() => {
    originalEnv = { ...process.env };
    service = new WalletService(
      {} as any, // mockSupabaseService
      {} as any, // configService
      {} as any, // notifyService
      {} as any, // whatsappService
      {} as any, // auditService
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('ignores PUBLIC_CALLBACK_URL when VERCEL_ENV is set', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.PUBLIC_CALLBACK_URL = 'https://some-tunnel.ngrok.io';
    process.env.NEXT_PUBLIC_API_URL = 'https://linearcard-api.vercel.app';
    delete process.env.WALLET_WEBHOOK_SECRET;

    expect(service.resolveCallbackUrl()).toBe(
      'https://linearcard-api.vercel.app/passes/webhooks/google-wallet',
    );
  });

  it('uses PUBLIC_CALLBACK_URL on local dev when VERCEL_ENV is not set', () => {
    delete process.env.VERCEL_ENV;
    process.env.PUBLIC_CALLBACK_URL = 'https://some-tunnel.ngrok.io';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
    delete process.env.WALLET_WEBHOOK_SECRET;

    expect(service.resolveCallbackUrl()).toBe(
      'https://some-tunnel.ngrok.io/passes/webhooks/google-wallet',
    );
  });
});

describe('syncPassAfterTransaction', () => {
  let service: WalletService;
  let whatsappService: any;

  const basePass = {
    id: 'pass-1',
    fullPassId: 'issuer.pass-1',
    memberId: 'member-1',
    tenantId: 'tenant-1',
    tier: 'Bronze',
    phone: '+919876543210',
    tiers: [
      {
        id: 't-bronze',
        programId: 'program-1',
        name: 'Bronze',
        minPoints: 0,
        templateId: 'tpl-bronze',
        sortOrder: 0,
      },
      {
        id: 't-silver',
        programId: 'program-1',
        name: 'Silver',
        minPoints: 500,
        templateId: 'tpl-silver',
        sortOrder: 1,
      },
      {
        id: 't-gold',
        programId: 'program-1',
        name: 'Gold',
        minPoints: 2000,
        templateId: 'tpl-gold',
        sortOrder: 2,
      },
    ],
  };

  beforeEach(() => {
    const mockSupabaseService: any = {
      client: {
        from: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      },
    };
    const mockNotifyService: any = {
      logNotification: jest.fn(),
    };
    whatsappService = {
      sendRedemptionReceiptWithLog: jest.fn().mockResolvedValue(undefined),
      sendTierUpgradeMessage: jest.fn().mockResolvedValue(undefined),
    };

    service = new WalletService(
      mockSupabaseService,
      mockNotifyService,
      whatsappService,
      { record: jest.fn().mockResolvedValue(undefined) } as any,
      { dispatch: jest.fn().mockResolvedValue(undefined) } as any,
    );

    jest.spyOn(service, 'updateGenericObject').mockResolvedValue({});
    jest.spyOn(service as any, 'sendOfferMessage').mockResolvedValue({});
  });

  it('does not report a tier change when the balance stays within the same tier', async () => {
    const result = await service.syncPassAfterTransaction(
      basePass,
      { type: 'award', pointsChanged: 50, newBalance: 100, orderAmount: 500 },
      'Acme Cafe',
    );
    expect(result.tier).toBe('Bronze');
    expect(result.tierChanged).toBe(false);
    expect(whatsappService.sendTierUpgradeMessage).not.toHaveBeenCalled();
  });

  it('reports a tier change and sends a WhatsApp tier-upgrade message when crossing a threshold', async () => {
    const result = await service.syncPassAfterTransaction(
      basePass,
      { type: 'award', pointsChanged: 600, newBalance: 600, orderAmount: 6000 },
      'Acme Cafe',
    );
    expect(result.tier).toBe('Silver');
    expect(result.tierChanged).toBe(true);
    expect(whatsappService.sendTierUpgradeMessage).toHaveBeenCalledWith(
      basePass.phone,
      'Silver',
      'Acme Cafe',
      { tenantId: 'tenant-1', memberId: 'member-1' },
    );
  });

  it('always sends the WhatsApp redemption receipt for a redeem transaction', async () => {
    await service.syncPassAfterTransaction(
      basePass,
      { type: 'redeem', pointsChanged: 50, newBalance: 50, orderAmount: 100 },
      'Acme Cafe',
    );
    expect(whatsappService.sendRedemptionReceiptWithLog).toHaveBeenCalledWith(
      basePass.phone,
      '50 Pts',
      'Acme Cafe',
      { tenantId: 'tenant-1', memberId: 'member-1' },
    );
  });

  it('does not throw when the pass has no phone number', async () => {
    const noPhonePass = { ...basePass, phone: undefined };
    await expect(
      service.syncPassAfterTransaction(
        noPhonePass,
        { type: 'award', pointsChanged: 10, newBalance: 10, orderAmount: 100 },
        'Acme Cafe',
      ),
    ).resolves.toBeDefined();
    expect(whatsappService.sendRedemptionReceiptWithLog).not.toHaveBeenCalled();
  });

  it('swallows WhatsApp send failures without throwing', async () => {
    (
      whatsappService.sendRedemptionReceiptWithLog as jest.Mock
    ).mockRejectedValueOnce(new Error('WAHA down'));
    await expect(
      service.syncPassAfterTransaction(
        basePass,
        { type: 'award', pointsChanged: 10, newBalance: 10, orderAmount: 100 },
        'Acme Cafe',
      ),
    ).resolves.toBeDefined();
  });

  it('pushes the new tier to the Google Wallet object when a tier change occurs', async () => {
    await service.syncPassAfterTransaction(
      basePass,
      { type: 'award', pointsChanged: 600, newBalance: 600, orderAmount: 6000 },
      'Acme Cafe',
    );
    expect(service.updateGenericObject).toHaveBeenCalledWith(
      basePass.fullPassId,
      expect.objectContaining({ tier: 'Silver' }),
    );
  });

  it('does not send a WhatsApp tier message and marks isUpgrade false on a downgrade', async () => {
    const goldPass = { ...basePass, tier: 'Gold' };
    const result = await service.syncPassAfterTransaction(
      goldPass,
      {
        type: 'redeem',
        pointsChanged: 1900,
        newBalance: 100,
        orderAmount: 3800,
      },
      'Acme Cafe',
    );
    expect(result.tier).toBe('Bronze');
    expect(result.tierChanged).toBe(true);
    expect(result.isUpgrade).toBe(false);
    expect(whatsappService.sendTierUpgradeMessage).not.toHaveBeenCalled();
  });

  it('marks isUpgrade true and sends the WhatsApp message on an upgrade', async () => {
    const result = await service.syncPassAfterTransaction(
      basePass,
      { type: 'award', pointsChanged: 600, newBalance: 600, orderAmount: 6000 },
      'Acme Cafe',
    );
    expect(result.isUpgrade).toBe(true);
    expect(whatsappService.sendTierUpgradeMessage).toHaveBeenCalled();
  });

  it("resolves the design of the new tier's templateId and pushes it to the wallet object on a tier change", async () => {
    jest.spyOn(service, 'resolveTenantPassDesign').mockResolvedValue({
      hexBackgroundColor: '#SILVER',
      logoUrl: 'https://logo/silver.png',
    });

    await service.syncPassAfterTransaction(
      basePass,
      { type: 'award', pointsChanged: 600, newBalance: 600, orderAmount: 6000 },
      'Acme Cafe',
    );

    expect(service.resolveTenantPassDesign).toHaveBeenCalledWith(
      basePass.tenantId,
      'tpl-silver',
      undefined,
    );
    expect(service.updateGenericObject).toHaveBeenCalledWith(
      basePass.fullPassId,
      expect.objectContaining({
        tier: 'Silver',
        hexBackgroundColor: '#SILVER',
        logoUrl: 'https://logo/silver.png',
      }),
    );
  });

  it('keeps a manually-set tier unchanged when the tenant has no configured tiers', async () => {
    const manualTierPass = { ...basePass, tier: 'VIP', tiers: [] };
    const result = await service.syncPassAfterTransaction(
      manualTierPass,
      { type: 'award', pointsChanged: 10, newBalance: 10, orderAmount: 100 },
      'Acme Cafe',
    );
    expect(result.tier).toBe('VIP');
    expect(result.tierChanged).toBe(false);
    expect(whatsappService.sendTierUpgradeMessage).not.toHaveBeenCalled();
  });
});

describe('processOrderTransaction — tier propagation', () => {
  let service: WalletService;
  let supabaseServiceMock: any;
  let mockAuditService: any;

  beforeEach(() => {
    supabaseServiceMock = {
      client: {
        from: jest.fn(),
        // Phase 1.4: balance mutation goes through the atomic RPC. `data:
        // null` means "no authoritative balance returned", so these tests
        // keep asserting against the locally computed one.
        rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
      },
    };
    const mockNotifyService: any = {
      logNotification: jest.fn(),
    };
    const mockWhatsappService: any = {
      sendRedemptionReceiptWithLog: jest.fn().mockResolvedValue(undefined),
      sendTierUpgradeMessage: jest.fn().mockResolvedValue(undefined),
    };
    mockAuditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    service = new WalletService(
      supabaseServiceMock,
      mockNotifyService,
      mockWhatsappService,
      mockAuditService,
      { dispatch: jest.fn().mockResolvedValue(undefined) } as any,
    );
  });

  it('returns the recomputed tier and tierChanged flag from syncPassAfterTransaction', async () => {
    supabaseServiceMock.client.from.mockImplementation((table: string) => {
      if (table === 'Pass') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'pass-1',
                  fullPassId: 'issuer.pass-1',
                  memberId: 'member-1',
                  tenantId: 'tenant-1',
                  balance: 100,
                  tier: 'Bronze',
                  Member: { phone: '+919876543210' },
                  Tenant: { name: 'Acme Cafe' },
                },
              }),
            }),
          }),
          update: () => ({ eq: async () => ({ error: null }) }),
          insert: async () => ({ error: null }),
        };
      }
      if (table === 'Program') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: { id: 'program-1' } }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'Tier') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  {
                    id: 't-silver',
                    programId: 'program-1',
                    name: 'Silver',
                    minPoints: 500,
                    templateId: 'tpl-silver',
                    sortOrder: 0,
                  },
                ],
              }),
            }),
          }),
        };
      }
      return { insert: async () => ({ error: null }) };
    });
    jest.spyOn(service, 'syncPassAfterTransaction').mockResolvedValue({
      walletPushed: true,
      directNotified: false,
      tier: 'Silver',
      tierChanged: true,
    });

    const result = await service.processOrderTransaction(
      'pass-1',
      5000,
      'award',
      'manual',
    );

    expect(result.tier).toBe('Silver');
    expect(result.tierChanged).toBe(true);
    expect(mockAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        memberId: 'member-1',
        passId: 'pass-1',
        action: 'order_transaction',
      }),
    );
  });

  it("scores a pass against its own program, not the tenant's oldest one (PRG-1)", async () => {
    // D8: one tenant, two programs. Before Phase 3.3 this resolved the
    // tenant's oldest Program and scored every scan against it, so a coffee
    // pass was ranked by the gym program's tiers.
    const tiersByProgram: Record<string, any[]> = {
      'program-coffee': [
        {
          id: 't-coffee-silver',
          programId: 'program-coffee',
          name: 'Silver',
          minPoints: 500,
          templateId: 'tpl-coffee',
          sortOrder: 0,
        },
      ],
      'program-gym': [
        {
          id: 't-gym-gold',
          programId: 'program-gym',
          name: 'Gold',
          minPoints: 9999,
          templateId: 'tpl-gym',
          sortOrder: 0,
        },
      ],
    };

    supabaseServiceMock.client.from.mockImplementation((table: string) => {
      if (table === 'Pass') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'pass-1',
                  fullPassId: 'issuer.pass-1',
                  memberId: 'member-1',
                  tenantId: 'tenant-1',
                  // The pass belongs to the coffee program, which is NOT the
                  // tenant's oldest.
                  programId: 'program-coffee',
                  balance: 100,
                  tier: 'Bronze',
                  Member: { phone: '+919876543210' },
                  Tenant: { name: 'Acme Cafe' },
                },
              }),
            }),
          }),
          update: () => ({ eq: async () => ({ error: null }) }),
          insert: async () => ({ error: null }),
        };
      }
      if (table === 'Program') {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              maybeSingle: async () => ({
                data: { id, kind: 'loyalty', earnRate: null },
              }),
            }),
          }),
        };
      }
      if (table === 'Tier') {
        return {
          select: () => ({
            eq: (_col: string, programId: string) => ({
              order: async () => ({ data: tiersByProgram[programId] || [] }),
            }),
          }),
        };
      }
      return { insert: async () => ({ error: null }) };
    });

    const syncSpy = jest
      .spyOn(service, 'syncPassAfterTransaction')
      .mockResolvedValue({
        walletPushed: true,
        directNotified: false,
        tier: 'Silver',
        tierChanged: true,
      });

    await service.processOrderTransaction('pass-1', 5000, 'award', 'manual');

    const passedTiers = syncSpy.mock.calls[0][0].tiers;
    expect(passedTiers).toHaveLength(1);
    expect(passedTiers[0].name).toBe('Silver'); // coffee's tier, not gym's Gold
    expect(syncSpy.mock.calls[0][0].programId).toBe('program-coffee');
  });
});

describe('createGoogleWalletPass - tier/balance conditionally', () => {
  let service: WalletService;
  let mockGoogleAuthClient: { request: jest.Mock };

  beforeEach(() => {
    service = new WalletService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    mockGoogleAuthClient = {
      request: jest.fn().mockResolvedValue({ data: {} }),
    };
    jest
      .spyOn(service, 'getGoogleAuthClient')
      .mockResolvedValue(mockGoogleAuthClient as any);
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });

    jest.spyOn(service as any, 'getCredentialsOrThrow').mockReturnValue({
      issuerId: 'issuer',
      clientEmail: 'test@example.com',
      privateKey,
    });
  });

  it('omits subheader and barcode.alternateText when tier and balance are undefined', async () => {
    await service.createGoogleWalletPass({
      passId: 'pass-1',
      memberName: 'John Doe',
      cardTitle: 'Ticket',
      classSuffix: 'ticket_class',
      tier: undefined,
      balance: undefined,
    });

    const payload = mockGoogleAuthClient.request.mock.calls[0][0].data;
    expect(payload.subheader).toBeUndefined();
    expect(payload.barcode.alternateText).toBe(' ');
  });
});
