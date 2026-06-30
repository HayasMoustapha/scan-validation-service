// W1.7 — Vérification de signature HMAC au décodage du QR (sécurité) et échec
// explicite du décodage d'image (pas de faux succès).

describe('QRService signature verification on decode (W1.7)', () => {
  const OLD_ENV = process.env;
  let qrService;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, NODE_ENV: 'test', QR_CODE_SECRET_KEY: 'test-secret-w17' };
    qrService = require('../src/core/qr/qr.service');
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  async function buildSignedPayload(overrides = {}) {
    const data = {
      id: 'ticket-1',
      eventId: 'event-1',
      type: 'standard',
      nonce: 'abc123',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      metadata: {},
      ...overrides
    };
    data.signature = await qrService.generateSignature(data);
    return data;
  }

  test('QR valide (signature correcte) : décodage accepté', async () => {
    const payload = await buildSignedPayload();
    const result = await qrService.decodeQRCode(JSON.stringify(payload));
    expect(result.success).toBe(true);
    expect(result.data.id).toBe('ticket-1');
  });

  test('QR altéré (champ modifié après signature) : REJETÉ', async () => {
    const payload = await buildSignedPayload();
    payload.id = 'ticket-TAMPERED'; // altération après signature
    const result = await qrService.decodeQRCode(JSON.stringify(payload));
    expect(result.success).toBe(false);
    expect(result.code).toBe('QR_SIGNATURE_INVALID');
  });

  test('QR forgé (signature bidon) : REJETÉ', async () => {
    const payload = await buildSignedPayload();
    payload.signature = 'deadbeef'.repeat(8); // signature forgée
    const result = await qrService.decodeQRCode(JSON.stringify(payload));
    expect(result.success).toBe(false);
    expect(result.code).toBe('QR_SIGNATURE_INVALID');
  });

  test('QR sans signature : REJETÉ explicitement', async () => {
    const payload = await buildSignedPayload();
    delete payload.signature;
    const result = await qrService.decodeQRCode(JSON.stringify(payload));
    expect(result.success).toBe(false);
    expect(result.code).toBe('QR_SIGNATURE_MISSING');
  });

  test('QR signé avec une autre clé : REJETÉ (secret différent)', async () => {
    const payload = await buildSignedPayload();
    // Recharger le service avec un secret différent => la signature ne matche plus
    jest.resetModules();
    process.env.QR_CODE_SECRET_KEY = 'a-completely-different-secret';
    const otherService = require('../src/core/qr/qr.service');
    const result = await otherService.decodeQRCode(JSON.stringify(payload));
    expect(result.success).toBe(false);
    expect(result.code).toBe('QR_SIGNATURE_INVALID');
  });

  test('verifySignature : comparaison constante OK pour signature valide', async () => {
    const payload = await buildSignedPayload();
    const check = await qrService.verifySignature(payload);
    expect(check.valid).toBe(true);
  });

  test('decodeQRImage sur une image sans QR : ÉCHEC explicite (pas de mock)', async () => {
    // Petite image PNG 2x2 valide mais sans QR code.
    const sharp = require('sharp');
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 255, g: 255, b: 255 } }
    }).png().toBuffer();

    await expect(qrService.decodeQRImage(png)).rejects.toMatchObject({
      code: 'QR_IMAGE_NO_CODE_FOUND'
    });
  });

  test('decodeQRCode sur un buffer image sans QR : échoue, ne renvoie pas de données factices', async () => {
    const sharp = require('sharp');
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 0, g: 0, b: 0 } }
    }).png().toBuffer();

    const result = await qrService.decodeQRCode(png);
    expect(result.success).toBe(false);
    // L'ancien comportement renvoyait { id: 'placeholder' } en succès : interdit.
    expect(result.data).toBeUndefined();
  });

  test('Round-trip generate -> decode d\'un QR sécurisé réel', async () => {
    const gen = await qrService.generateSecureQRCode({
      id: 'rt-1',
      eventId: 'rt-event',
      type: 'vip'
    });
    expect(gen.success).toBe(true);
    // Le payload signé est dans gen.qrCode.data
    const result = await qrService.decodeQRCode(JSON.stringify(gen.qrCode.data));
    expect(result.success).toBe(true);
    expect(result.data.id).toBe('rt-1');
  });
});
