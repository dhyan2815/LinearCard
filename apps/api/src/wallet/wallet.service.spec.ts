import { WalletService } from './wallet.service';

describe('WalletService.createGenericClass locations mapping', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ISSUER_ID = 'test_issuer';
    process.env.GOOGLE_CLIENT_EMAIL = 'test@test.iam.gserviceaccount.com';
    process.env.GOOGLE_PRIVATE_KEY = 'dummy_key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should include locations in payload when provided', async () => {
    const mockSupabase = {} as any;
    const mockNotify = {} as any;
    const service = new WalletService(mockSupabase, mockNotify);
    // Spy on the private method to capture the payload before it's sent
    const capturedPayloads: any[] = [];
    const fakeClient = {
      request: jest.fn().mockImplementation((opts: any) => {
        capturedPayloads.push(opts.data);
        return Promise.resolve({ data: { id: 'test.class' } });
      }),
    };
    jest
      .spyOn(service, 'getGoogleAuthClient')
      .mockResolvedValue(fakeClient as any);

    await service.createGenericClass({
      classSuffix: 'test_class',
      cardTitle: 'Test Store',
      locations: [
        { latitude: 19.076, longitude: 72.8777 },
        { latitude: 28.6139, longitude: 77.209 },
      ],
    });

    const payload = capturedPayloads[0];
    expect(payload.locations).toHaveLength(2);
    expect(payload.locations[0]).toEqual({
      kind: 'walletobjects#latLongPoint',
      latitude: 19.076,
      longitude: 72.8777,
    });
    expect(payload.locations[1]).toEqual({
      kind: 'walletobjects#latLongPoint',
      latitude: 28.6139,
      longitude: 77.209,
    });
  });

  it('should NOT include locations in payload when none provided', async () => {
    const mockSupabase = {} as any;
    const mockNotify = {} as any;
    const service = new WalletService(mockSupabase, mockNotify);
    const capturedPayloads: any[] = [];
    const fakeClient = {
      request: jest.fn().mockImplementation((opts: any) => {
        capturedPayloads.push(opts.data);
        return Promise.resolve({ data: { id: 'test.class' } });
      }),
    };
    jest
      .spyOn(service, 'getGoogleAuthClient')
      .mockResolvedValue(fakeClient as any);

    await service.createGenericClass({
      classSuffix: 'test_class',
      cardTitle: 'Test Store',
    });

    const payload = capturedPayloads[0];
    expect(payload.locations).toBeUndefined();
  });

  it('should NOT include locations in payload when empty array provided', async () => {
    const mockSupabase = {} as any;
    const mockNotify = {} as any;
    const service = new WalletService(mockSupabase, mockNotify);
    const capturedPayloads: any[] = [];
    const fakeClient = {
      request: jest.fn().mockImplementation((opts: any) => {
        capturedPayloads.push(opts.data);
        return Promise.resolve({ data: { id: 'test.class' } });
      }),
    };
    jest
      .spyOn(service, 'getGoogleAuthClient')
      .mockResolvedValue(fakeClient as any);

    await service.createGenericClass({
      classSuffix: 'test_class',
      cardTitle: 'Test Store',
      locations: [],
    });

    const payload = capturedPayloads[0];
    expect(payload.locations).toBeUndefined();
  });

  it('should cap locations at 10 even if more are supplied', async () => {
    const mockSupabase = {} as any;
    const mockNotify = {} as any;
    const service = new WalletService(mockSupabase, mockNotify);
    const capturedPayloads: any[] = [];
    const fakeClient = {
      request: jest.fn().mockImplementation((opts: any) => {
        capturedPayloads.push(opts.data);
        return Promise.resolve({ data: { id: 'test.class' } });
      }),
    };
    jest
      .spyOn(service, 'getGoogleAuthClient')
      .mockResolvedValue(fakeClient as any);

    const twelveLocations = Array.from({ length: 12 }, (_, i) => ({
      latitude: i,
      longitude: i,
    }));

    await service.createGenericClass({
      classSuffix: 'test_class',
      cardTitle: 'Test',
      locations: twelveLocations,
    });

    expect(capturedPayloads[0].locations).toHaveLength(10);
  });
});

describe('WalletService.sendPromoMessageWithAudit', () => {
  let service: WalletService;
  let mockSupabaseService: any;
  let mockNotifyService: any;

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
    service = new WalletService(mockSupabaseService, mockNotifyService);
  });

  it('should reject member without consent', async () => {
    mockSupabaseService.client.single.mockResolvedValue({ data: null }); // No consent

    await expect(
      service.sendPromoMessageWithAudit('pass-1', 'mem-1', 'tenant-1', 'Header', 'Body'),
    ).rejects.toThrow('Member has not consented');
  });

  it('should reject on rate limit (3+ messages in 24h)', async () => {
    // Consent check passes
    mockSupabaseService.client.single.mockResolvedValueOnce({ data: { consentedAt: '2023-01-01' } });
    // Quota check returns count = 3
    mockSupabaseService.client.gte.mockResolvedValueOnce({ count: 3 });

    await expect(
      service.sendPromoMessageWithAudit('pass-1', 'mem-1', 'tenant-1', 'Header', 'Body'),
    ).rejects.toThrow('Rate limit reached');
  });

  it('should allow sending when bypassQuota is true even if rate limit is reached', async () => {
    mockSupabaseService.client.single.mockResolvedValueOnce({ data: { consentedAt: '2023-01-01' } });
    // Note: gte for quota is not even called or if called ignored
    const fakeClient = {
      request: jest.fn().mockResolvedValue({ data: { success: true } }),
    };
    jest.spyOn(service, 'getGoogleAuthClient').mockResolvedValue(fakeClient as any);

    const result = await service.sendPromoMessageWithAudit('pass-1', 'mem-1', 'tenant-1', 'Header', 'Body', true);
    expect(result.success).toBe(true);
  });

  it('should log success after Google API succeeds', async () => {
    mockSupabaseService.client.single.mockResolvedValueOnce({ data: { consentedAt: '2023-01-01' } });
    mockSupabaseService.client.gte.mockResolvedValueOnce({ count: 1 });

    const fakeClient = {
      request: jest.fn().mockResolvedValue({ data: { success: true } }),
    };
    jest.spyOn(service, 'getGoogleAuthClient').mockResolvedValue(fakeClient as any);

    const result = await service.sendPromoMessageWithAudit('pass-1', 'mem-1', 'tenant-1', 'Header', 'Body');

    expect(result.success).toBe(true);
    expect(mockNotifyService.logNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'sent',
        type: 'promo_message',
      }),
    );
  });

  it('should log failure if Google API fails', async () => {
    mockSupabaseService.client.single.mockResolvedValueOnce({ data: { consentedAt: '2023-01-01' } });
    mockSupabaseService.client.gte.mockResolvedValueOnce({ count: 1 });

    const fakeClient = {
      request: jest.fn().mockRejectedValue(new Error('Google API Error')),
    };
    jest.spyOn(service, 'getGoogleAuthClient').mockResolvedValue(fakeClient as any);

    await expect(
      service.sendPromoMessageWithAudit('pass-1', 'mem-1', 'tenant-1', 'Header', 'Body'),
    ).rejects.toThrow();

    expect(mockNotifyService.logNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorReason: 'Google Wallet addMessage failed',
      }),
    );
  });
});
