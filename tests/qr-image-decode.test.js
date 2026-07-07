// Décodage RÉEL d'un QR à partir d'une image raster (P0).
// Prouve le chemin complet image -> pixels (sharp) -> lecture QR (jsQR) :
// on génère une vraie image PNG de QR code via la lib de génération installée,
// puis on la décode à partir de ses OCTETS d'image (pas du JSON). Aucun mock,
// aucune dépendance réseau : sharp + jsqr + qrcode sont déjà présents.

describe('QRService — décodage image raster réel (P0)', () => {
  const OLD_ENV = process.env;
  let qrService;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, NODE_ENV: 'test', QR_CODE_SECRET_KEY: 'test-secret-img' };
    qrService = require('../src/core/qr/qr.service');
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  test('decodeQRImage lit le payload depuis une vraie image PNG de QR', async () => {
    const gen = await qrService.generateSecureQRCode({
      id: 'img-ticket-1',
      eventId: 'img-event-1',
      type: 'standard'
    });
    expect(gen.success).toBe(true);
    // gen.qrCode.buffer est une vraie image PNG du QR encodant le JSON signé.
    expect(Buffer.isBuffer(gen.qrCode.buffer)).toBe(true);

    const decodedString = await qrService.decodeQRImage(gen.qrCode.buffer);
    const decoded = JSON.parse(decodedString);
    expect(decoded.id).toBe('img-ticket-1');
    expect(decoded.eventId).toBe('img-event-1');
    expect(decoded.signature).toBeDefined();
  });

  test('decodeQRCode(buffer image) : round-trip complet avec vérification de signature', async () => {
    const gen = await qrService.generateSecureQRCode({
      id: 'img-ticket-2',
      eventId: 'img-event-2',
      type: 'vip'
    });
    expect(gen.success).toBe(true);

    // On passe directement les OCTETS de l'image : décodage raster + signature.
    const result = await qrService.decodeQRCode(gen.qrCode.buffer);
    expect(result.success).toBe(true);
    expect(result.data.id).toBe('img-ticket-2');
    expect(result.data.type).toBe('vip');
  });

  test('decodeQRCode(data:image base64) : décode une image QR encodée en data URL', async () => {
    const gen = await qrService.generateSecureQRCode({
      id: 'img-ticket-3',
      eventId: 'img-event-3',
      type: 'premium'
    });
    expect(gen.success).toBe(true);

    const dataUrl = `data:image/png;base64,${gen.qrCode.base64}`;
    const result = await qrService.decodeQRCode(dataUrl);
    expect(result.success).toBe(true);
    expect(result.data.id).toBe('img-ticket-3');
  });
});
