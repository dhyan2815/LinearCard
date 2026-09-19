import { Test, TestingModule } from '@nestjs/testing';
import { TemplatesController } from './templates.controller';
import { SupabaseService } from '../supabase/supabase.service';
import { WalletService } from '../wallet/wallet.service';
import { TenantGuard } from '../auth/tenant.guard';

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

    const res = await (controller as any).updateTemplate('tmpl-123', body, {
      tenantId: 'tenant-1',
    });

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
      (controller as any).updateTemplate(
        'tmpl-123',
        {
          name: 'Nonexistent',
        },
        { tenantId: 'tenant-1' },
      ),
    ).rejects.toMatchObject({
      status: 404,
      response: { success: false, error: 'Template not found' },
    });
  });

  describe('updateTemplate — hexBackgroundColor validation', () => {
    it('rejects a malformed hex code', async () => {
      await expect(
        controller.updateTemplate(
          'template-1',
          { hexBackgroundColor: '#GGGGGG' },
          { tenantId: 'tenant-1' } as any,
        ),
      ).rejects.toThrow('hexBackgroundColor must be a 6-digit hex code');
    });

    it('rejects a non-hex color name', async () => {
      await expect(
        controller.updateTemplate(
          'template-1',
          { hexBackgroundColor: 'red' },
          { tenantId: 'tenant-1' } as any,
        ),
      ).rejects.toThrow('hexBackgroundColor must be a 6-digit hex code');
    });

    it('accepts and uppercases a valid lowercase hex code', async () => {
      const result = await controller.updateTemplate(
        'template-1',
        { hexBackgroundColor: '#7c3aed' },
        { tenantId: 'tenant-1' } as any,
      );
      expect(result.success).toBe(true);
      expect(mockUpdatePayload).toEqual(
        expect.objectContaining({ hexBackgroundColor: '#7C3AED' }),
      );
    });
  });

  describe('updateTemplate — tierThresholds validation', () => {
    it('rejects a non-array tierThresholds', async () => {
      await expect(
        controller.updateTemplate(
          'template-1',
          { tierThresholds: 'Gold' },
          { tenantId: 'tenant-1' } as any,
        ),
      ).rejects.toThrow('tierThresholds must be an array');
    });

    it('rejects a threshold missing a name', async () => {
      await expect(
        controller.updateTemplate(
          'template-1',
          {
            tierThresholds: [{ min: 0 }],
          },
          { tenantId: 'tenant-1' } as any,
        ),
      ).rejects.toThrow('each tier threshold requires a non-empty name');
    });

    it('rejects a threshold with a negative min', async () => {
      await expect(
        controller.updateTemplate(
          'template-1',
          {
            tierThresholds: [{ name: 'Bronze', min: -10 }],
          },
          { tenantId: 'tenant-1' } as any,
        ),
      ).rejects.toThrow('threshold min must be a number >= 0');
    });

    it('rejects duplicate thresholds at the same min', async () => {
      await expect(
        controller.updateTemplate(
          'template-1',
          {
            tierThresholds: [
              { name: 'Bronze', min: 0 },
              { name: 'Silver', min: 0 },
            ],
          },
          { tenantId: 'tenant-1' } as any,
        ),
      ).rejects.toThrow('tier thresholds must have distinct min values');
    });

    it('accepts and persists a valid tierThresholds array', async () => {
      const valid = [
        { name: 'Bronze', min: 0 },
        { name: 'Silver', min: 500 },
        { name: 'Gold', min: 2000 },
      ];
      const result = await controller.updateTemplate(
        'template-1',
        {
          tierThresholds: valid,
        },
        { tenantId: 'tenant-1' } as any,
      );
      expect(result.success).toBe(true);
      expect(supabaseServiceMock.client.from).toHaveBeenCalledWith(
        'PassTemplate',
      );
    });
  });

  describe('updateTemplate — storeLocations validation', () => {
    it('rejects more than 10 locations', async () => {
      const tooMany = Array.from({ length: 11 }, (_, i) => ({
        latitude: 10 + i,
        longitude: 20 + i,
      }));
      await expect(
        controller.updateTemplate(
          'template-1',
          { storeLocations: tooMany },
          { tenantId: 'tenant-1' } as any,
        ),
      ).rejects.toThrow('storeLocations must contain at most 10 entries');
    });

    it('rejects an out-of-range latitude', async () => {
      await expect(
        controller.updateTemplate(
          'template-1',
          { storeLocations: [{ latitude: 95, longitude: 20 }] },
          { tenantId: 'tenant-1' } as any,
        ),
      ).rejects.toThrow('Invalid latitude: 95');
    });

    it('rejects an out-of-range longitude', async () => {
      await expect(
        controller.updateTemplate(
          'template-1',
          { storeLocations: [{ latitude: 10, longitude: 200 }] },
          { tenantId: 'tenant-1' } as any,
        ),
      ).rejects.toThrow('Invalid longitude: 200');
    });

    it('accepts and persists a valid storeLocations array', async () => {
      const valid = [{ latitude: 19.076, longitude: 72.8777 }];
      const result = await controller.updateTemplate(
        'template-1',
        { storeLocations: valid },
        { tenantId: 'tenant-1' } as any,
      );
      expect(result.success).toBe(true);
      expect(mockUpdatePayload).toEqual(
        expect.objectContaining({ storeLocations: valid }),
      );
    });
  });
});

describe('TemplatesController — tenant scoping on :id routes', () => {
  let controller: TemplatesController;
  let eqSpy: jest.Mock;
  let singleResult: { data: any; error: any };
  let supabaseServiceMock: any;

  beforeEach(async () => {
    singleResult = { data: null, error: null };
    // select('*').eq('id', id).eq('tenantId', tenantId).single()
    const selectChain = {
      eq: jest.fn(),
    };
    eqSpy = jest.fn().mockImplementation((field: string, value: string) => {
      selectChain[`__${field}`] = value;
      return {
        eq: jest.fn().mockImplementation((field2: string, value2: string) => {
          selectChain[`__${field2}`] = value2;
          return {
            single: jest.fn().mockImplementation(() => Promise.resolve(singleResult)),
          };
        }),
      };
    });

    supabaseServiceMock = {
      client: {
        from: jest.fn().mockImplementation(() => ({
          select: jest.fn().mockImplementation(() => ({ eq: eqSpy })),
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

  it('filters the lookup by tenantId, so a foreign tenantId returns 404 instead of another tenant\'s template', async () => {
    // The mocked query returns no row (as Supabase would when the eq('tenantId', ...)
    // filter excludes the row), proving the controller does not fetch by id alone.
    singleResult = { data: null, error: null };

    await expect(
      controller.getTemplateById('template-1', {
        tenantId: 'attacker-tenant',
      } as any),
    ).rejects.toMatchObject({ status: 404 });

    expect(eqSpy).toHaveBeenCalledWith('id', 'template-1');
  });

  it('returns the template when it belongs to the requesting tenant', async () => {
    singleResult = {
      data: { id: 'template-1', tenantId: 'tenant-1', title: 'Mine' },
      error: null,
    };

    const result = await controller.getTemplateById('template-1', {
      tenantId: 'tenant-1',
    } as any);

    expect(result.success).toBe(true);
    expect(result.template.name).toBe('Mine');
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

    const result = await controller.createTemplate(
      { name: 'New Template', tierThresholds: valid },
      { tenantId: 'tenant-1' } as any,
    );

    expect(result.success).toBe(true);
    expect(mockInsertPayload).toEqual(
      expect.objectContaining({ tierThresholds: valid }),
    );
  });

  it('defaults tierThresholds to an empty array when not provided', async () => {
    await controller.createTemplate({ name: 'New Template' }, {
      tenantId: 'tenant-1',
    } as any);

    expect(mockInsertPayload).toEqual(
      expect.objectContaining({ tierThresholds: [] }),
    );
  });

  it('rejects an invalid (non-array) tierThresholds the same way updateTemplate does', async () => {
    await expect(
      controller.createTemplate(
        { name: 'New Template', tierThresholds: 'Gold' },
        { tenantId: 'tenant-1' } as any,
      ),
    ).rejects.toThrow('tierThresholds must be an array');
  });

  it('rejects a malformed hexBackgroundColor on create', async () => {
    await expect(
      controller.createTemplate(
        { name: 'New Template', hexBackgroundColor: 'red' },
        { tenantId: 'tenant-1' } as any,
      ),
    ).rejects.toThrow('hexBackgroundColor must be a 6-digit hex code');
  });
});

describe('TemplatesController collection-route tenant scoping', () => {
  it('guards both collection routes with TenantGuard', () => {
    expect(
      Reflect.getMetadata('__guards__', TemplatesController.prototype.getTemplates),
    ).toEqual([TenantGuard]);
    expect(
      Reflect.getMetadata('__guards__', TemplatesController.prototype.createTemplate),
    ).toEqual([TenantGuard]);
  });

  it('getTemplates filters by the guard tenant, not a query param', async () => {
    const eqMock = jest.fn().mockReturnValue({
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
    const controller = new TemplatesController(
      { client: { from: () => ({ select: () => ({ eq: eqMock }) }) } } as any,
      {} as any,
    );

    await controller.getTemplates({ tenantId: 'guard-tenant' } as any);

    expect(eqMock).toHaveBeenCalledWith('tenantId', 'guard-tenant');
  });

  it('createTemplate ignores a caller-supplied body.tenantId', async () => {
    let payload: any;
    const controller = new TemplatesController(
      {
        client: {
          from: () => ({
            insert: (p: any) => {
              payload = p;
              return {
                select: () => ({
                  single: async () => ({ data: { id: 'x', title: 'T' }, error: null }),
                }),
              };
            },
          }),
        },
      } as any,
      {} as any,
    );

    await controller.createTemplate({ name: 'T', tenantId: 'attacker-tenant' }, {
      tenantId: 'guard-tenant',
    } as any);

    expect(payload.tenantId).toBe('guard-tenant');
  });
});
