import { Test, TestingModule } from '@nestjs/testing';
import { PassesController } from './passes.controller';
import { SupabaseService } from '../supabase/supabase.service';
import { OtpService } from '../notification/otp.service';
import { WhatsappService } from '../notification/whatsapp.service';
import { WalletService } from '../wallet/wallet.service';
import { NotifyService } from '../notification/notify.service';
import { TenantGuard } from '../auth/tenant.guard';
import { AuditService } from '../audit/audit.service';
import { WebhookService } from '../developers/webhook.service';

describe('PassesController.postGoogleWalletWebhook', () => {
  let controller: PassesController;
  let logNotificationMock: jest.Mock;
  let sendWalletSaveConfirmationMock: jest.Mock;
  let updateMock: jest.Mock;
  let insertMock: jest.Mock;
  let fromMock: jest.Mock;
  let passRow: any;
  let auditRecordMock: jest.Mock;

  const mockRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  const setup = async (pass: any) => {
    passRow = pass;
    logNotificationMock = jest.fn().mockResolvedValue(undefined);
    sendWalletSaveConfirmationMock = jest.fn().mockResolvedValue(undefined);
    updateMock = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
    insertMock = jest.fn().mockResolvedValue({ error: null });
    auditRecordMock = jest.fn().mockResolvedValue(undefined);

    fromMock = jest.fn().mockImplementation((table: string) => {
      if (table === 'Pass') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: passRow, error: null }),
            }),
          }),
          update: updateMock,
        };
      }
      if (table === 'AuditLog') {
        return { insert: insertMock };
      }
      return { insert: insertMock };
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PassesController],
      providers: [
        { provide: SupabaseService, useValue: { client: { from: fromMock } } },
        { provide: OtpService, useValue: {} },
        {
          provide: WhatsappService,
          useValue: { sendWalletSaveConfirmationWithLog: sendWalletSaveConfirmationMock },
        },
        { provide: WalletService, useValue: {} },
        { provide: NotifyService, useValue: { logNotification: logNotificationMock } },
        { provide: TenantGuard, useValue: {} },
        { provide: AuditService, useValue: { record: auditRecordMock } },
        { provide: WebhookService, useValue: { dispatch: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
    controller = module.get<PassesController>(PassesController);
  };

  it('fires WhatsApp confirmation on a valid save event', async () => {
    await setup({
      id: 'p1',
      tenantId: 't1',
      memberId: 'm1',
      fullPassId: 'obj1',
      Member: { phone: '+911234567890' },
      Tenant: { name: 'Acme' },
    });
    const req: any = { body: { signedMessage: JSON.stringify({ objectId: 'obj1', eventType: 'save' }) } };
    const res = mockRes();

    await controller.postGoogleWalletWebhook(req, res);

    expect(sendWalletSaveConfirmationMock).toHaveBeenCalledWith(
      '+911234567890',
      'Acme',
      { tenantId: 't1', memberId: 'm1' },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('sets deletedAt and writes AuditLog on a del event, no WhatsApp', async () => {
    await setup({ id: 'p1', tenantId: 't1', memberId: 'm1', fullPassId: 'obj1', Member: { phone: '+91' }, Tenant: {} });
    const req: any = { body: { signedMessage: JSON.stringify({ objectId: 'obj1', eventType: 'del' }) } };
    const res = mockRes();

    await controller.postGoogleWalletWebhook(req, res);

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: expect.any(String) }));
    expect(auditRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'pass_deleted', tenantId: 't1', passId: 'p1' }),
    );
    expect(sendWalletSaveConfirmationMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('clears deletedAt when a previously-removed pass is saved again', async () => {
    await setup({
      id: 'p1',
      tenantId: 't1',
      memberId: 'm1',
      fullPassId: 'obj1',
      deletedAt: '2026-01-01T00:00:00.000Z',
      Member: { phone: '+911234567890' },
      Tenant: { name: 'Acme' },
    });
    const req: any = { body: { signedMessage: JSON.stringify({ objectId: 'obj1', eventType: 'save' }) } };
    const res = mockRes();

    await controller.postGoogleWalletWebhook(req, res);

    expect(updateMock).toHaveBeenCalledWith({ deletedAt: null });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('warns (and never attempts a NotificationLog insert) for an unknown objectId', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await setup(null);
    const req: any = { body: { signedMessage: JSON.stringify({ objectId: 'missing', eventType: 'save' }) } };
    const res = mockRes();

    await controller.postGoogleWalletWebhook(req, res);

    // A NotificationLog row for an unknown objectId has no tenantId/memberId
    // to satisfy its NOT NULL FKs, so no insert must be attempted at all.
    expect(logNotificationMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('missing'));
    expect(sendWalletSaveConfirmationMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    warnSpy.mockRestore();
  });

  it('returns non-200 for malformed JSON body', async () => {
    await setup({ id: 'p1' });
    const req: any = { body: { signedMessage: 'not-json{' } };
    const res = mockRes();

    await controller.postGoogleWalletWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 200 and logs a failed NotificationLog for an unhandled eventType', async () => {
    await setup({ id: 'p1', tenantId: 't1', memberId: 'm1', fullPassId: 'obj1', Member: {}, Tenant: {} });
    const req: any = { body: { signedMessage: JSON.stringify({ objectId: 'obj1', eventType: 'expire' }) } };
    const res = mockRes();

    await controller.postGoogleWalletWebhook(req, res);

    expect(logNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', tenantId: 't1' }),
    );
    expect(sendWalletSaveConfirmationMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
