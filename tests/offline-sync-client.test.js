// Tests de l'adaptateur de synchronisation offline (production wiring).
// Vérifie que l'adaptateur mappe correctement les actions offline
// (store/validate/update) sur le client core (recordScan) et qu'il propage
// fidèlement succès/échecs SANS feindre de succès. Aucun réseau réel : le
// client core est entièrement moqué.

const { createOfflineSyncClient } = require('../src/core/offline/offline-sync-client');

describe('OfflineSyncClient adapter (offline -> event-core)', () => {
  function makeCoreClient(impl) {
    return { recordScan: jest.fn(impl) };
  }

  test('storeScan appelle recordScan avec un payload normalisé (offline:true, action store)', async () => {
    const coreClient = makeCoreClient(async () => ({ success: true, data: { ok: 1 } }));
    const client = createOfflineSyncClient({ coreClient });

    const res = await client.storeScan({
      ticketId: 'tk-1',
      ticketData: { eventId: 'ev-9' },
      storedAt: '2026-06-21T10:00:00.000Z'
    });

    expect(res.success).toBe(true);
    expect(coreClient.recordScan).toHaveBeenCalledTimes(1);
    const payload = coreClient.recordScan.mock.calls[0][0];
    expect(payload.ticketId).toBe('tk-1');
    expect(payload.eventId).toBe('ev-9');
    expect(payload.offline).toBe(true);
    expect(payload.syncAction).toBe('store');
    expect(payload.scanContext.offline).toBe(true);
  });

  test('validateScan propage scanInfo (location/deviceId) dans scanContext', async () => {
    const coreClient = makeCoreClient(async () => ({ success: true }));
    const client = createOfflineSyncClient({ coreClient });

    await client.validateScan({
      ticketId: 'tk-2',
      scanInfo: { location: 'Gate A', deviceId: 'dev-7', timestamp: '2026-06-21T11:00:00.000Z' },
      validationCount: 3
    });

    const payload = coreClient.recordScan.mock.calls[0][0];
    expect(payload.syncAction).toBe('validate');
    expect(payload.result).toBe('valid');
    expect(payload.validationCount).toBe(3);
    expect(payload.scanContext.location).toBe('Gate A');
    expect(payload.scanContext.deviceId).toBe('dev-7');
  });

  test('updateScan utilise l\'action update', async () => {
    const coreClient = makeCoreClient(async () => ({ success: true }));
    const client = createOfflineSyncClient({ coreClient });

    await client.updateScan({ ticketId: 'tk-3' });
    expect(coreClient.recordScan.mock.calls[0][0].syncAction).toBe('update');
  });

  test('core injoignable (recordScan success:false, nonBlocking) : adaptateur renvoie success:false (pas de faux succès)', async () => {
    const coreClient = makeCoreClient(async () => ({
      success: false,
      error: 'Erreur d\'enregistrement du scan (non bloquant)',
      code: 'SCAN_RECORDING_FAILED',
      nonBlocking: true
    }));
    const client = createOfflineSyncClient({ coreClient });

    const res = await client.storeScan({ ticketId: 'tk-4' });
    expect(res.success).toBe(false);
    expect(res.code).toBe('SCAN_RECORDING_FAILED');
  });

  test('intégration avec OfflineService : un client branché vide la file en cas de succès', async () => {
    jest.resetModules();
    const prevEnv = process.env;
    process.env = { ...prevEnv, NODE_ENV: 'test', OFFLINE_SYNC_INTERVAL: '0', OFFLINE_BACKUP_INTERVAL: '0' };

    const offlineService = require('../src/core/offline/offline.service');
    offlineService.offlineData.clear();
    offlineService.pendingSync.clear();
    offlineService.syncInProgress = false;

    const coreClient = makeCoreClient(async () => ({ success: true }));
    const { createOfflineSyncClient: factory } = require('../src/core/offline/offline-sync-client');
    offlineService.setSyncClient(factory({ coreClient }));

    offlineService.pendingSync.set('tk-5', {
      action: 'validate',
      data: { ticketId: 'tk-5', scanInfo: { location: 'Gate B' } },
      timestamp: new Date().toISOString()
    });

    const result = await offlineService.syncOfflineData();
    expect(result.success).toBe(true);
    expect(result.synced).toBe(1);
    expect(offlineService.pendingSync.size).toBe(0);
    expect(coreClient.recordScan).toHaveBeenCalledTimes(1);

    offlineService.syncClient = null;
    process.env = prevEnv;
  });
});
