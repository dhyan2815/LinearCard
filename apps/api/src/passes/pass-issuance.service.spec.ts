import { PassIssuanceService } from './pass-issuance.service';

describe('PassIssuanceService.issueForMember — dynamic field rows', () => {
  let service: PassIssuanceService;
  let mockSupabaseService: any;
  let mockWalletService: any;
  let createGoogleWalletPassCalls: any[];

  const giftCardFieldRows = [
    {
      id: 'row1',
      columns: [
        { key: 'balance', header: 'Balance', body: '0' },
        { key: 'card', header: 'Card', body: '—' },
      ],
    },
  ];

  beforeEach(() => {
    createGoogleWalletPassCalls = [];
    mockSupabaseService = {
      client: {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'Tier') {
            return {
              select: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: null }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'Pass') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    is: () => ({
                      eq: () => ({
                        order: () => ({
                          limit: () => ({
                            maybeSingle: async () => ({ data: null }),
                          }),
                        }),
                      }),
                      order: () => ({
                        limit: () => ({
                          maybeSingle: async () => ({ data: null }),
                        }),
                      }),
                    }),
                  }),
                }),
              }),
              insert: () => ({
                select: () => ({
                  single: async () => ({ data: { id: 'pass-1' }, error: null }),
                }),
              }),
            };
          }
          if (table === 'Program') {
            return {
              select: () => ({
                eq: () => ({ maybeSingle: async () => ({ data: null }) }),
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      },
    };
    mockWalletService = {
      resolveTenantPassDesign: async () => ({
        hexBackgroundColor: '#123456',
        cardTitle: 'Bistro Cafe · Gift Card',
        classSuffix: 'bistro_cafe_gift_card',
        fieldRows: giftCardFieldRows,
      }),
      forTenant: async () => ({
        buildSaveLink: () => ({
          token: 't',
          googleWalletUrl: 'https://pay.google.com/gp/v/save/t',
        }),
        createGoogleWalletPass: async (data: any) => {
          createGoogleWalletPassCalls.push(data);
          return {
            success: true,
            fullPassId: 'issuer.pass-1',
            googleWalletUrl: 'https://pay.google.com/gp/v/save/t',
          };
        },
      }),
    };
    service = new PassIssuanceService(
      mockSupabaseService,
      mockWalletService,
      { sendPassLinkWithLog: async () => {} } as any,
      { dispatch: () => ({ catch: () => {} }) } as any,
    );
  });

  it('forwards the template design fieldRows as rows on the created pass', async () => {
    await service.issueForMember({
      tenantId: 'tenant-1',
      member: { id: 'member-1', phone: '+911234567890' },
      program: { id: 'prog-1' },
      tenant: { name: 'Bistro Cafe' },
      sendPassLink: false,
    });

    expect(createGoogleWalletPassCalls[0].rows).toBe(giftCardFieldRows);
  });

  it('lets an explicit passData.rows override the template design', async () => {
    const customRows = [
      { id: 'row1', columns: [{ key: 'custom', header: 'Custom', body: 'x' }] },
    ];
    await service.issueForMember({
      tenantId: 'tenant-1',
      member: { id: 'member-1', phone: '+911234567890' },
      program: { id: 'prog-1' },
      tenant: { name: 'Bistro Cafe' },
      passData: { rows: customRows },
      sendPassLink: false,
    });

    expect(createGoogleWalletPassCalls[0].rows).toBe(customRows);
  });

  it('omits tier and balance for tier-less programs', async () => {
    await service.issueForMember({
      tenantId: 'tenant-1',
      member: { id: 'member-1', phone: '+911234567890' },
      program: { id: 'prog-1' },
      tenant: { name: 'Bistro Cafe' },
      sendPassLink: false,
    });

    const callArgs = createGoogleWalletPassCalls[0];
    expect(callArgs.tier).toBeUndefined();
    expect(callArgs.balance).toBeUndefined();
    expect(callArgs.barcodeAltText).toBeUndefined();
  });
});
