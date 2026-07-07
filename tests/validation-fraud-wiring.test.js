// Wiring anti-fraude dans le flux LIVE de validation.
// Avant : FraudDetectionService savait persister (persistFraudAttempts /
// analyzeScan({persist:true})) mais n'était JAMAIS appelé par le vrai chemin
// de validation. Ces tests prouvent que validationService.validateTicket
// déclenche l'analyse anti-fraude avec persistance, de façon strictement non
// bloquante. Le repository et le service sont mockés : AUCUNE base réelle.

const validationService = require('../src/core/validation/validation.service');
const qrDecoderService = require('../src/core/qr/qr-decoder.service');
const eventCoreClient = require('../src/core/clients/event-core.client');
const fraudDetectionService = require('../src/core/fraud/fraud-detection.service');

describe('Flux LIVE de validation -> analyse anti-fraude + persistance', () => {
  let origDecode;
  let origValidate;

  beforeEach(() => {
    validationService.resetStats();
    fraudDetectionService.scanHistory.clear();
    fraudDetectionService.blockedIPs.clear();
    // Repository de persistance factice : aucune base réelle n'est touchée.
    fraudDetectionService.setRepository({
      createFraudAttempt: jest.fn(async (d) => ({ id: 1, ...d }))
    });

    origDecode = qrDecoderService.decodeAndValidateQR;
    origValidate = eventCoreClient.validateTicket;

    qrDecoderService.decodeAndValidateQR = async () => ({
      success: true,
      data: { ticketId: 'TK-LIVE', eventId: 'EV-LIVE', ticketType: 'standard' },
      validationInfo: { formatType: 'JWT' }
    });
    eventCoreClient.validateTicket = async () => ({
      success: true,
      data: {
        ticket: { id: 'TK-LIVE', eventId: 'EV-LIVE', status: 'VALID' },
        event: { id: 'EV-LIVE', name: 'Live Event' }
      },
      metadata: {}
    });
  });

  afterEach(() => {
    qrDecoderService.decodeAndValidateQR = origDecode;
    eventCoreClient.validateTicket = origValidate;
    jest.restoreAllMocks();
  });

  test('une validation réussie déclenche analyzeScan avec persist:true', async () => {
    const spy = jest.spyOn(fraudDetectionService, 'analyzeScan');

    const res = await validationService.validateTicket('QR-LIVE-1', {
      ipAddress: '203.0.113.5',
      location: 'Gate A',
      deviceId: 'd1'
    });

    expect(res.success).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    const [scanData, ctx, options] = spy.mock.calls[0];
    expect(scanData.ticketId).toBe('TK-LIVE');
    expect(scanData.eventId).toBe('EV-LIVE');
    expect(ctx.ipAddress).toBe('203.0.113.5');
    expect(options).toEqual(expect.objectContaining({ persist: true }));
  });

  test('une fraude détectée est persistée via le repository (chemin LIVE)', async () => {
    const repo = { createFraudAttempt: jest.fn(async (d) => ({ id: 1, ...d })) };
    fraudDetectionService.setRepository(repo);

    // 5 scans rapides du même ticket/IP -> déclenche le pattern rapid_scans.
    for (let i = 0; i < 5; i++) {
      const res = await validationService.validateTicket(`QR-LIVE-${i}`, {
        ipAddress: '203.0.113.9',
        location: 'Gate A',
        deviceId: 'd1'
      });
      expect(res.success).toBe(true);
    }

    // La persistance durable a bien été sollicitée par le flux LIVE.
    expect(repo.createFraudAttempt).toHaveBeenCalled();
    const persisted = repo.createFraudAttempt.mock.calls.map((c) => c[0].fraudType);
    expect(persisted).toContain('rapid_scans');
  });

  test('un échec de l\'analyse anti-fraude ne casse jamais un scan légitime', async () => {
    jest.spyOn(fraudDetectionService, 'analyzeScan').mockRejectedValue(new Error('boom'));

    const res = await validationService.validateTicket('QR-LIVE-X', {
      ipAddress: '203.0.113.7',
      location: 'Gate A'
    });

    expect(res.success).toBe(true);
    expect(res.ticket.id).toBe('TK-LIVE');
  });
});
