import { Test, TestingModule } from '@nestjs/testing';
import { TemplatesController } from './templates.controller';
import { SupabaseService } from '../supabase/supabase.service';
import { WalletService } from '../wallet/wallet.service';

describe('TemplatesController.updateTemplate', () => {
  let controller: TemplatesController;
  let mockUpdatePayload: any;
  let mockUpdatedRecord: any;
  let updateMock: jest.Mock;
  let supabaseServiceMock: any;

  beforeEach(async () => {
    mockUpdatedRecord = {
      id: 'tmpl-123',
      title: 'Updated Title',
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

    supabaseServiceMock = {
      client: {
        from: jest.fn().mockImplementation(() => ({
          update: updateMock,
        })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TemplatesController],
      providers: [
        { provide: SupabaseService, useValue: supabaseServiceMock },
        { provide: WalletService, useValue: {} },
      ],
    }).compile();

    controller = module.get<TemplatesController>(TemplatesController);
  });

  it('should update template fields and map name to title', async () => {
    const body = {
      name: 'Updated Title',
    };

    const res = await (controller as any).updateTemplate('tmpl-123', body);

    expect(mockUpdatePayload).toEqual(
      expect.objectContaining({
        title: 'Updated Title',
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

  describe('updateTemplate — tierThresholds validation', () => {
    it('rejects a non-array tierThresholds', async () => {
      await expect(
        controller.updateTemplate('template-1', { tierThresholds: 'Gold' }),
      ).rejects.toThrow('tierThresholds must be an array');
    });

    it('rejects a threshold missing a name', async () => {
      await expect(
        controller.updateTemplate('template-1', {
          tierThresholds: [{ min: 0 }],
        }),
      ).rejects.toThrow('each tier threshold requires a non-empty name');
    });

    it('rejects a threshold with a negative min', async () => {
      await expect(
        controller.updateTemplate('template-1', {
          tierThresholds: [{ name: 'Bronze', min: -10 }],
        }),
      ).rejects.toThrow('threshold min must be a number >= 0');
    });

    it('rejects duplicate thresholds at the same min', async () => {
      await expect(
        controller.updateTemplate('template-1', {
          tierThresholds: [
            { name: 'Bronze', min: 0 },
            { name: 'Silver', min: 0 },
          ],
        }),
      ).rejects.toThrow('tier thresholds must have distinct min values');
    });

    it('accepts and persists a valid tierThresholds array', async () => {
      const valid = [
        { name: 'Bronze', min: 0 },
        { name: 'Silver', min: 500 },
        { name: 'Gold', min: 2000 },
      ];
      const result = await controller.updateTemplate('template-1', {
        tierThresholds: valid,
      });
      expect(result.success).toBe(true);
      expect(supabaseServiceMock.client.from).toHaveBeenCalledWith(
        'PassTemplate',
      );
    });
  });
});

describe('TemplatesController.createTemplate', () => {
  let controller: TemplatesController;
  let mockInsertPayload: any;
  let mockInsertedRecord: any;
  let insertMock: jest.Mock;
  let supabaseServiceMock: any;

  beforeEach(async () => {
    mockInsertedRecord = {
      id: 'tmpl-new',
      title: 'New Template',
    };

    insertMock = jest.fn().mockImplementation((payload) => {
      mockInsertPayload = payload;
      return {
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockImplementation(() =>
            Promise.resolve({ data: mockInsertedRecord, error: null }),
          ),
        }),
      };
    });

    supabaseServiceMock = {
      client: {
        from: jest.fn().mockImplementation(() => ({
          insert: insertMock,
        })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TemplatesController],
      providers: [
        { provide: SupabaseService, useValue: supabaseServiceMock },
        { provide: WalletService, useValue: {} },
      ],
    }).compile();

    controller = module.get<TemplatesController>(TemplatesController);
  });

  it('persists a valid tierThresholds array on create', async () => {
    const valid = [
      { name: 'Bronze', min: 0 },
      { name: 'Silver', min: 500 },
    ];

    const result = await controller.createTemplate({
      tenantId: 'tenant-1',
      name: 'New Template',
      tierThresholds: valid,
    });

    expect(result.success).toBe(true);
    expect(mockInsertPayload).toEqual(
      expect.objectContaining({ tierThresholds: valid }),
    );
  });

  it('defaults tierThresholds to an empty array when not provided', async () => {
    await controller.createTemplate({
      tenantId: 'tenant-1',
      name: 'New Template',
    });

    expect(mockInsertPayload).toEqual(
      expect.objectContaining({ tierThresholds: [] }),
    );
  });

  it('rejects an invalid (non-array) tierThresholds the same way updateTemplate does', async () => {
    await expect(
      controller.createTemplate({
        tenantId: 'tenant-1',
        name: 'New Template',
        tierThresholds: 'Gold',
      }),
    ).rejects.toThrow('tierThresholds must be an array');
  });
});
