// Tests des capacités sessions de scan (start/end/active) + historique + stats
// sur le CHEMIN LIVE (service + controller). Le repository (DB) est entièrement
// moqué : aucun réseau ni base réelle. Prouve que la logique sessions/historique/
// stats est câblée et renvoie des codes d'erreur stables et explicites.

jest.mock('../src/core/database/scan.repository');

const scanRepository = require('../src/core/database/scan.repository');
const scanService = require('../src/core/scan/scan.service');
const scansController = require('../src/api/controllers/scans.controller');

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ScanService — sessions', () => {
  test('startScanSession : crée une session active et renvoie ses champs', async () => {
    scanRepository.createScanSession.mockResolvedValue({
      id: 10,
      uid: 'uid-10',
      started_at: '2026-06-21T09:00:00.000Z',
      event_id: 'ev-1',
      location: 'Gate A',
      device_info: { deviceId: 'dev-1' }
    });

    const res = await scanService.startScanSession({
      eventId: 'ev-1',
      operatorId: 5,
      location: 'Gate A',
      deviceInfo: { deviceId: 'dev-1' }
    });

    expect(res.success).toBe(true);
    expect(res.session.id).toBe(10);
    expect(res.session.status).toBe('active');
    expect(scanRepository.createScanSession).toHaveBeenCalledTimes(1);
  });

  test('startScanSession : échec repository -> code SESSION_START_FAILED', async () => {
    scanRepository.createScanSession.mockRejectedValue(new Error('db down'));

    const res = await scanService.startScanSession({
      operatorId: 5, location: 'Gate A', deviceInfo: { deviceId: 'd' }
    });

    expect(res.success).toBe(false);
    expect(res.code).toBe('SESSION_START_FAILED');
  });

  test('endScanSession : termine une session existante', async () => {
    scanRepository.endScanSession.mockResolvedValue({
      id: 10, uid: 'uid-10', started_at: 1, ended_at: 2
    });

    const res = await scanService.endScanSession(10, { updatedBy: 5 });
    expect(res.success).toBe(true);
    expect(res.session.id).toBe(10);
  });

  test('endScanSession : session introuvable -> code SESSION_END_FAILED', async () => {
    scanRepository.endScanSession.mockRejectedValue(new Error('Session non trouvée ou déjà terminée'));

    const res = await scanService.endScanSession(999);
    expect(res.success).toBe(false);
    expect(res.code).toBe('SESSION_END_FAILED');
  });

  test('getActiveScanSessions : renvoie la liste normalisée des sessions actives', async () => {
    scanRepository.getActiveScanSessions.mockResolvedValue([
      { id: 1, uid: 'u1', startedAt: 't', operatorId: 5, eventId: 'ev-1', location: 'Gate A', deviceInfo: {} }
    ]);

    const res = await scanService.getActiveScanSessions({ eventId: 'ev-1' });
    expect(res.success).toBe(true);
    expect(res.sessions).toHaveLength(1);
    expect(res.sessions[0].status).toBe('active');
  });
});

describe('ScanService — historique & stats', () => {
  test('getTicketScanHistory : renvoie scans + pagination', async () => {
    scanRepository.getTicketScanHistory.mockResolvedValue({
      ticketId: 'tk-1',
      scans: [{ id: 1, result: 'valid' }],
      pagination: { limit: 50, offset: 0, total: 1, hasMore: false }
    });

    const res = await scanService.getTicketScanHistory('tk-1', {});
    expect(res.success).toBe(true);
    expect(res.scans).toHaveLength(1);
    expect(res.pagination.total).toBe(1);
  });

  test('getTicketScanHistory : échec -> code HISTORY_RETRIEVAL_FAILED', async () => {
    scanRepository.getTicketScanHistory.mockRejectedValue(new Error('db'));
    const res = await scanService.getTicketScanHistory('tk-1', {});
    expect(res.success).toBe(false);
    expect(res.code).toBe('HISTORY_RETRIEVAL_FAILED');
  });

  test('getEventScanStats : renvoie les agrégats', async () => {
    scanRepository.getEventScanStats.mockResolvedValue({
      eventId: 'ev-1', totalScans: 10, uniqueTickets: 8, successfulScans: 9,
      failedScans: 1, fraudAttempts: 0, locations: ['Gate A'], successRate: '90.00%'
    });

    const res = await scanService.getEventScanStats('ev-1', {});
    expect(res.success).toBe(true);
    expect(res.totalScans).toBe(10);
    expect(res.successRate).toBe('90.00%');
  });

  test('getEventScanStats : échec -> code STATS_RETRIEVAL_FAILED', async () => {
    scanRepository.getEventScanStats.mockRejectedValue(new Error('db'));
    const res = await scanService.getEventScanStats('ev-1', {});
    expect(res.success).toBe(false);
    expect(res.code).toBe('STATS_RETRIEVAL_FAILED');
  });
});

describe('ScansController — sessions endpoints', () => {
  test('startScanSession : 201 quand le service réussit', async () => {
    scanRepository.createScanSession.mockResolvedValue({
      id: 20, uid: 'u20', started_at: 't', event_id: null, location: 'Gate A', device_info: {}
    });

    const req = { body: { operatorId: 5, deviceId: 'dev-1', location: 'Gate A' } };
    const res = mockRes();
    await scansController.startScanSession(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('startScanSession : 400 + MISSING_SESSION_CONTEXT si contexte incomplet', async () => {
    const req = { body: { operatorId: 5 } }; // pas de deviceId/location
    const res = mockRes();
    await scansController.startScanSession(req, res);

    expect(res.statusCode).toBe(400);
    // ticketValidationErrorResponse place le code métier dans error.validationCode
    expect(res.body.error.validationCode).toBe('MISSING_SESSION_CONTEXT');
  });

  test('endScanSession : 400 + MISSING_SESSION_ID si sessionId absent', async () => {
    const req = { body: {} };
    const res = mockRes();
    await scansController.endScanSession(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.validationCode).toBe('MISSING_SESSION_ID');
  });

  test('getActiveScanSessions : 200 avec liste des sessions', async () => {
    scanRepository.getActiveScanSessions.mockResolvedValue([
      { id: 1, uid: 'u1', startedAt: 't', operatorId: 5, eventId: null, location: 'Gate A', deviceInfo: {} }
    ]);

    const req = { query: {} };
    const res = mockRes();
    await scansController.getActiveScanSessions(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.sessions).toHaveLength(1);
  });
});
