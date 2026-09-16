import { Test, TestingModule } from '@nestjs/testing';
import { TemplatesController } from './templates.controller';
import { SupabaseService } from '../supabase/supabase.service';
import { WalletService } from '../wallet/wallet.service';

describe('TemplatesController.updateTemplate', () => {
  let controller: TemplatesController;
  let mockUpdatePayload: any;
  let mockUpdatedRecord: any;
  let updateMock: jest.Mock;

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
});
