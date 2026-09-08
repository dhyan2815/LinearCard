import { Test, TestingModule } from '@nestjs/testing';
import { TemplatesController } from './templates.controller';
import { SupabaseService } from '../supabase/supabase.service';
import { WalletService } from '../wallet/wallet.service';

describe('TemplatesController.publishTemplate', () => {
  let controller: TemplatesController;
  let walletService: { createGenericClass: jest.Mock };
  let mockTemplate: any;

  beforeEach(async () => {
    mockTemplate = {
      id: 'tmpl-123',
      title: 'VIP Pass',
      classSuffix: 'vip_pass',
      hexBackgroundColor: '#1A365D',
      fieldRows: [],
      tenant: {
        name: 'Brand Corp',
        brandHexColor: '#000000',
      },
      storeLocations: [
        { latitude: 19.076, longitude: 72.8777, label: 'Mumbai Store' },
      ],
    };

    walletService = {
      createGenericClass: jest
        .fn()
        .mockResolvedValue({ id: 'issuer.vip_pass' }),
    };

    const mockSupabaseService = {
      client: {
        from: jest.fn().mockImplementation(() => ({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest
                .fn()
                .mockImplementation(() =>
                  Promise.resolve({ data: mockTemplate, error: null }),
                ),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockImplementation(() =>
                  Promise.resolve({
                    data: {
                      ...mockTemplate,
                      status: 'published',
                      googleClassId: 'issuer.vip_pass',
                    },
                    error: null,
                  }),
                ),
              }),
            }),
          }),
        })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TemplatesController],
      providers: [
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: WalletService, useValue: walletService },
      ],
    }).compile();

    controller = module.get<TemplatesController>(TemplatesController);
  });

  it('should forward storeLocations to WalletService.createGenericClass', async () => {
    await controller.publishTemplate('tmpl-123');

    expect(walletService.createGenericClass).toHaveBeenCalledTimes(1);
    expect(walletService.createGenericClass).toHaveBeenCalledWith(
      expect.objectContaining({
        locations: [
          { latitude: 19.076, longitude: 72.8777, label: 'Mumbai Store' },
        ],
      }),
    );
  });

  it('should fall back to empty array if storeLocations is undefined or null', async () => {
    delete mockTemplate.storeLocations;

    await controller.publishTemplate('tmpl-123');

    expect(walletService.createGenericClass).toHaveBeenCalledTimes(1);
    expect(walletService.createGenericClass).toHaveBeenCalledWith(
      expect.objectContaining({
        locations: [],
      }),
    );
  });
});
