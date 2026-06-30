// Persistance durable de l'historique de fraude (P2).
// Avant : FraudDetectionService gardait l'historique UNIQUEMENT en mémoire
// (perdu au redémarrage). Ces tests prouvent que les fraudes détectées sont
// désormais écrites dans un stockage durable via le repository (table
// fraud_attempts), avec dégradation gracieuse si la persistance échoue.
// Le repository est injecté (fake), donc AUCUNE base réelle n'est touchée.

describe('FraudDetectionService — persistance durable (P2)', () => {
  let fraudService;

  beforeEach(() => {
    jest.resetModules();
    fraudService = require('../src/core/fraud/fraud-detection.service');
    fraudService.scanHistory.clear();
    fraudService.blockedIPs.clear();
  });

  function makeRepo(impl) {
    return {
      createFraudAttempt: jest.fn(impl || (async (d) => ({ id: 1, ...d })))
    };
  }

  test('persistFraudAttempts écrit chaque drapeau dans le repository durable', async () => {
    const repo = makeRepo();
    fraudService.setRepository(repo);

    const analysis = {
      riskScore: 60,
      fraudFlags: [
        { type: 'rapid_scans', flagged: true, score: 40, severity: 'high', action: 'block_temporary', details: { scanCount: 6 } },
        { type: 'volume_anomaly', flagged: true, score: 50, severity: 'high', action: 'block_ip', details: { scanCount: 120 } }
      ]
    };

    const res = await fraudService.persistFraudAttempts(
      { ticketId: 'tk-1', eventId: 'ev-1', scanLogId: 99 },
      { ipAddress: '10.0.0.1', userAgent: 'bot/1.0', userId: 7 },
      analysis
    );

    expect(res.persisted).toBe(2);
    expect(res.failed).toBe(0);
    expect(repo.createFraudAttempt).toHaveBeenCalledTimes(2);

    const firstCall = repo.createFraudAttempt.mock.calls[0][0];
    expect(firstCall.fraudType).toBe('rapid_scans');
    expect(firstCall.scanLogId).toBe(99);
    expect(firstCall.ipAddress).toBe('10.0.0.1');
    expect(firstCall.blocked).toBe(true); // block_temporary => bloqué
    expect(firstCall.details.ticketId).toBe('tk-1');
    expect(firstCall.details.riskScore).toBe(60);
  });

  test('aucun drapeau de fraude : rien n\'est persisté', async () => {
    const repo = makeRepo();
    fraudService.setRepository(repo);

    const res = await fraudService.persistFraudAttempts(
      { ticketId: 'tk-2' },
      {},
      { riskScore: 0, fraudFlags: [] }
    );

    expect(res.persisted).toBe(0);
    expect(repo.createFraudAttempt).not.toHaveBeenCalled();
  });

  test('dégradation gracieuse : une panne de persistance ne jette pas', async () => {
    const repo = makeRepo(async () => { throw new Error('db down'); });
    fraudService.setRepository(repo);

    const res = await fraudService.persistFraudAttempts(
      { ticketId: 'tk-3' },
      {},
      { riskScore: 50, fraudFlags: [{ type: 'rapid_scans', severity: 'high', action: 'block_temporary' }] }
    );

    expect(res.persisted).toBe(0);
    expect(res.failed).toBe(1);
    expect(res.errors).toContain('db down');
  });

  test('analyzeScan avec options.persist écrit l\'historique de fraude durablement', async () => {
    const repo = makeRepo();
    fraudService.setRepository(repo);

    // Déclencher rapid_scans : 5 scans du même ticket/IP en < 10s.
    const scanData = { ticketId: 'tk-4', eventId: 'ev-4' };
    const context = { ipAddress: '10.0.0.2', location: 'Gate A' };

    let analysis;
    for (let i = 0; i < 5; i++) {
      analysis = await fraudService.analyzeScan(scanData, context, { persist: true });
    }

    expect(analysis.isSuspicious).toBe(true);
    expect(analysis.fraudFlags.some(f => f.type === 'rapid_scans')).toBe(true);
    // La dernière analyse (qui a franchi le seuil) a persisté au moins 1 fraude.
    expect(repo.createFraudAttempt).toHaveBeenCalled();
    expect(analysis.persisted).toBeGreaterThanOrEqual(1);
  });

  test('analyzeScan sans options.persist NE persiste PAS (comportement par défaut inchangé)', async () => {
    const repo = makeRepo();
    fraudService.setRepository(repo);

    const scanData = { ticketId: 'tk-5' };
    const context = { ipAddress: '10.0.0.3' };
    for (let i = 0; i < 5; i++) {
      await fraudService.analyzeScan(scanData, context);
    }

    expect(repo.createFraudAttempt).not.toHaveBeenCalled();
  });
});
