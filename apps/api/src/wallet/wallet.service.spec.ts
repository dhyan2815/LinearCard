import { WalletService } from './wallet.service';

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
