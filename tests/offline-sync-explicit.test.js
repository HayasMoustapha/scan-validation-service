// W1.7 — La synchronisation offline ne feint plus le succès : sans client
// branché elle renvoie un statut "non synchronisé" explicite et conserve les
// éléments en file ; avec un client elle pousse réellement vers le serveur.

describe('OfflineService explicit sync status (W1.7)', () => {
  const OLD_ENV = process.env;
  let offlineService;

  beforeEach(() => {
    jest.resetModules();
    // Désactiver les intervalles périodiques pour des tests déterministes.
    process.env = { ...OLD_ENV, NODE_ENV: 'test', OFFLINE_SYNC_INTERVAL: '0', OFFLINE_BACKUP_INTERVAL: '0' };
    offlineService = require('../src/core/offline/offline.service');
    offlineService.offlineData.clear();
    offlineService.pendingSync.clear();
    offlineService.syncClient = null;
    offlineService.syncInProgress = false;
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  function queueStore(ticketId = 'tk-1') {
    offlineService.pendingSync.set(ticketId, {
      action: 'store',
      data: { ticketId },
      timestamp: new Date().toISOString()
    });
  }

  test('sans client : sync renvoie un statut non-synchronisé explicite (pas de faux succès)', async () => {
    queueStore('tk-1');
    const result = await offlineService.syncOfflineData();

    expect(result.success).toBe(false);
    expect(result.synced).toBe(0);
    expect(result.failed).toBe(1);
    // L'élément RESTE dans la file (aucune suppression sur faux succès).
    expect(offlineService.pendingSync.size).toBe(1);
  });

  test('processSyncItem sans client : code SYNC_CLIENT_NOT_CONFIGURED', async () => {
    const res = await offlineService.processSyncItem({ action: 'store', data: { ticketId: 'tk-9' } });
    expect(res.success).toBe(false);
    expect(res.code).toBe('SYNC_CLIENT_NOT_CONFIGURED');
  });

  test('avec client : pousse réellement et vide la file en cas de succès', async () => {
    const storeScan = jest.fn().mockResolvedValue({ success: true });
    offlineService.setSyncClient({ storeScan });
    queueStore('tk-2');

    const result = await offlineService.syncOfflineData();

    expect(storeScan).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.synced).toBe(1);
    expect(offlineService.pendingSync.size).toBe(0);
  });

  test('avec client qui rejette : statut serveur rejeté, élément conservé', async () => {
    const storeScan = jest.fn().mockResolvedValue({ success: false, error: 'boom' });
    offlineService.setSyncClient({ storeScan });
    queueStore('tk-3');

    const result = await offlineService.syncOfflineData();

    expect(result.success).toBe(false);
    expect(result.failed).toBe(1);
    expect(offlineService.pendingSync.size).toBe(1);
  });

  test('avec client qui jette (réseau) : code SYNC_NETWORK_ERROR, élément conservé', async () => {
    const storeScan = jest.fn().mockRejectedValue(new Error('network down'));
    offlineService.setSyncClient({ storeScan });

    const res = await offlineService.syncStoreAction({ ticketId: 'tk-4' });
    expect(res.success).toBe(false);
    expect(res.code).toBe('SYNC_NETWORK_ERROR');
  });
});
