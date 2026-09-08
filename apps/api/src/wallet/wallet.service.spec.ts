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
    const service = new WalletService();
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
      latitude: 19.076,
      longitude: 72.8777,
    });
    expect(payload.locations[1]).toEqual({
      latitude: 28.6139,
      longitude: 77.209,
    });
  });

  it('should NOT include locations in payload when none provided', async () => {
    const service = new WalletService();
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
    const service = new WalletService();
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
    const service = new WalletService();
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
