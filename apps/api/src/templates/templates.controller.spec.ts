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

describe('TemplatesController.updateTemplate', () => {
  let controller: TemplatesController;
  let mockUpdatePayload: any;
  let mockUpdatedRecord: any;
  let updateMock: jest.Mock;

  beforeEach(async () => {
    mockUpdatedRecord = {
      id: 'tmpl-123',
      title: 'Updated Title',
      storeLocations: [
        { latitude: 19.076, longitude: 72.8777, label: 'Store 1' },
      ],
    };

    updateMock = jest.fn().mockImplementation((payload) => {
      mockUpdatePayload = payload;
      return {
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockImplementation(() =>
              Promise.resolve({
                data: mockUpdatedRecord,
                error: null,
              }),
            ),
          }),
        }),
      };
    });

    const mockSupabaseService = {
      client: {
        from: jest.fn().mockImplementation(() => ({
          update: updateMock,
        })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TemplatesController],
      providers: [
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: WalletService, useValue: {} },
      ],
    }).compile();

    controller = module.get<TemplatesController>(TemplatesController);
  });

  it('should update template fields including storeLocations and map name to title', async () => {
    const body = {
      name: 'Updated Title',
      storeLocations: [
        { latitude: 19.076, longitude: 72.8777, label: 'Store 1' },
      ],
    };

    const res = await (controller as any).updateTemplate('tmpl-123', body);

    expect(mockUpdatePayload).toEqual(
      expect.objectContaining({
        title: 'Updated Title',
        storeLocations: [
          { latitude: 19.076, longitude: 72.8777, label: 'Store 1' },
        ],
        updatedAt: expect.any(String),
      }),
    );
    expect(res).toEqual({
      success: true,
      template: {
        ...mockUpdatedRecord,
        name: 'Updated Title',
      },
    });
  });

  it('should reject storeLocations if not an array', async () => {
    await expect(
      (controller as any).updateTemplate('tmpl-123', {
        storeLocations: 'not-an-array',
      }),
    ).rejects.toThrow('storeLocations must be an array');
  });

  it('should reject storeLocations if more than 10 entries', async () => {
    const locations = Array(11).fill({ latitude: 10, longitude: 20 });
    await expect(
      (controller as any).updateTemplate('tmpl-123', {
        storeLocations: locations,
      }),
    ).rejects.toThrow('storeLocations must contain at most 10 entries');
  });

  it('should reject storeLocations if latitude is invalid', async () => {
    await expect(
      (controller as any).updateTemplate('tmpl-123', {
        storeLocations: [{ latitude: 95, longitude: 72.8777 }],
      }),
    ).rejects.toThrow('Invalid latitude: 95');

    await expect(
      (controller as any).updateTemplate('tmpl-123', {
        storeLocations: [{ latitude: 'invalid', longitude: 72.8777 }],
      }),
    ).rejects.toThrow('Invalid latitude: invalid');
  });

  it('should reject storeLocations if longitude is invalid', async () => {
    await expect(
      (controller as any).updateTemplate('tmpl-123', {
        storeLocations: [{ latitude: 19.076, longitude: 185 }],
      }),
    ).rejects.toThrow('Invalid longitude: 185');

    await expect(
      (controller as any).updateTemplate('tmpl-123', {
        storeLocations: [{ latitude: 19.076, longitude: 'invalid' }],
      }),
    ).rejects.toThrow('Invalid longitude: invalid');
  });

  it('should throw 404 if template not found', async () => {
    mockUpdatedRecord = null;
    await expect(
      (controller as any).updateTemplate('tmpl-123', {
        name: 'Nonexistent',
      }),
    ).rejects.toMatchObject({
      status: 404,
      response: { success: false, error: 'Template not found' },
    });
  });
});

