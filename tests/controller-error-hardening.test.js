// ERROR-UX hardening — scans + confirmation controllers.
// Prouve que les erreurs client typées (404/409/400) ne retombent pas dans un
// 500 générique, et que les fautes internes non typées restent 500 avec code stable.

jest.mock('../src/core/validation/validation.service');
jest.mock('../src/core/scan/scan.service');
jest.mock('../src/core/offline/offline.service');

const validationService = require('../src/core/validation/validation.service');
const scanService = require('../src/core/scan/scan.service');
const offlineService = require('../src/core/offline/offline.service');
const scansController = require('../src/api/controllers/scans.controller');

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

beforeEach(() => jest.clearAllMocks());

describe('scans controller — ERROR-UX hardening', () => {
  test('validateTicket: typed 404 thrown by validation service is honored (not 500)', async () => {
    const err = new Error('Ticket introuvable');
    err.statusCode = 404;
    err.code = 'TICKET_NOT_FOUND';
    validationService.validateTicket.mockRejectedValue(err);

    const res = mockRes();
    await scansController.validateTicket({ body: { qrCode: 'QR' } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TICKET_NOT_FOUND');
    expect(res.body.message).toMatch(/introuvable/i);
  });

  test('validateTicket: untyped internal fault stays 500 with stable code + generic message', async () => {
    validationService.validateTicket.mockRejectedValue(new Error('db exploded'));

    const res = mockRes();
    await scansController.validateTicket({ body: { qrCode: 'QR' } }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe('TICKET_VALIDATION_FAILED');
    expect(res.body.message).toBe('Échec de la validation du ticket');
  });

  test('validateTicket: missing qrCode -> explicit 400 MISSING_QR_CODE', async () => {
    const res = mockRes();
    await scansController.validateTicket({ body: {} }, res);

    expect(res.statusCode).toBe(400);
    // ticketValidationErrorResponse expose le code stable dans error.validationCode
    expect(res.body.error.validationCode).toBe('MISSING_QR_CODE');
    expect(validationService.validateTicket).not.toHaveBeenCalled();
  });

  test('startScanSession: typed 409 conflict thrown is honored (not 500)', async () => {
    const err = new Error('Session déjà active pour cet appareil');
    err.statusCode = 409;
    err.code = 'SESSION_ALREADY_ACTIVE';
    scanService.startScanSession.mockRejectedValue(err);

    const res = mockRes();
    await scansController.startScanSession(
      { body: { operatorId: 'op1', deviceId: 'd1', location: 'Gate A' } },
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe('SESSION_ALREADY_ACTIVE');
  });

  test('startScanSession: missing context -> explicit 400 MISSING_SESSION_CONTEXT', async () => {
    const res = mockRes();
    await scansController.startScanSession({ body: { operatorId: 'op1' } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.validationCode).toBe('MISSING_SESSION_CONTEXT');
    expect(scanService.startScanSession).not.toHaveBeenCalled();
  });

  test('validateTicketOffline: typed 404 honored (not 500)', async () => {
    const err = new Error('Ticket non présent dans le cache offline');
    err.statusCode = 404;
    err.code = 'OFFLINE_TICKET_NOT_FOUND';
    offlineService.validateTicketOffline.mockRejectedValue(err);

    const res = mockRes();
    await scansController.validateTicketOffline({ body: { ticketId: 't1' } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe('OFFLINE_TICKET_NOT_FOUND');
  });
});

describe('confirmation controller — ERROR-UX hardening', () => {
  // Charge le module en isolant pg pour éviter toute connexion réelle.
  let receiveScanConfirmation;
  beforeAll(() => {
    jest.isolateModules(() => {
      jest.doMock('pg', () => ({
        Pool: class { connect() { return Promise.reject(new Error('no db')); } }
      }));
      receiveScanConfirmation = require('../src/api/controllers/confirmation.controller').receiveScanConfirmation;
    });
  });

  test('missing ticketId/validationResult -> explicit 400 MISSING_REQUIRED_FIELDS', async () => {
    const res = mockRes();
    await receiveScanConfirmation({ body: {} }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('MISSING_REQUIRED_FIELDS');
  });
});
