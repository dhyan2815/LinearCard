import { WalletService } from './wallet.service';
import * as crypto from 'crypto';

describe('WalletService.sendPromoMessageWithAudit', () => {
  let service: WalletService;
  let mockSupabaseService: any;
  let mockNotifyService: any;
  let mockWhatsappService: any;

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
    service = new WalletService(
      mockSupabaseService,
      mockNotifyService,
      mockWhatsappService,
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

  it('should log success after Google API succeeds', async () => {
    mockSupabaseService.client.single.mockResolvedValueOnce({
      data: { consentedAt: '2023-01-01' },
    });

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
    mockSupabaseService.client.single.mockResolvedValueOnce({
      data: { consentedAt: '2023-01-01' },
    });
    mockSupabaseService.client.gte.mockResolvedValueOnce({ count: 1 });

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
        errorReason: 'Google Wallet addMessage failed',
      }),
    );
  });
});

describe('createGenericClass — stable field keys', () => {
  let service: WalletService;
  let mockGoogleAuthClient: { request: jest.Mock };

  beforeEach(() => {
    service = new WalletService({} as any, {} as any, {} as any);
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
    jest.spyOn(service, 'getGoogleAuthClient').mockResolvedValue(objectClient as any);
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    process.env.ISSUER_ID = 'issuer';
    process.env.GOOGLE_CLIENT_EMAIL = 'test@example.com';
    process.env.GOOGLE_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n');

    await service.createGoogleWalletPass({ passId: 'pass1', rows });

    const objectIds = objectClient.request.mock.calls[0][0].data.textModulesData.map(
      (m: any) => m.id,
    );

    for (const id of fieldPathIds) {
      expect(objectIds).toContain(id);
    }
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
    tierThresholds: [
      { name: 'Bronze', min: 0 },
      { name: 'Silver', min: 500 },
      { name: 'Gold', min: 2000 },
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
    (whatsappService.sendRedemptionReceiptWithLog as jest.Mock).mockRejectedValueOnce(
      new Error('WAHA down'),
    );
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
      { type: 'redeem', pointsChanged: 1900, newBalance: 100, orderAmount: 3800 },
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

  it('keeps a manually-set tier unchanged when the tenant has no configured tierThresholds', async () => {
    const manualTierPass = { ...basePass, tier: 'VIP', tierThresholds: [] };
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

  beforeEach(() => {
    supabaseServiceMock = {
      client: {
        from: jest.fn(),
      },
    };
    const mockNotifyService: any = {
      logNotification: jest.fn(),
    };
    const mockWhatsappService: any = {
      sendRedemptionReceiptWithLog: jest.fn().mockResolvedValue(undefined),
      sendTierUpgradeMessage: jest.fn().mockResolvedValue(undefined),
    };

    service = new WalletService(
      supabaseServiceMock,
      mockNotifyService,
      mockWhatsappService,
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
                  Tenant: {
                    name: 'Acme Cafe',
                    PassTemplate: [{ tierThresholds: [{ name: 'Silver', min: 500 }] }],
                  },
                },
              }),
            }),
          }),
          update: () => ({ eq: async () => ({ error: null }) }),
          insert: async () => ({ error: null }),
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
  });
});
