// E5.3 — Durcissement des secrets QR : en production, le secret par défaut PUBLIC
// (connu de tous) est refusé pour la validation HMAC, et le service échoue à
// démarrer si aucun secret sûr n'est configuré (fail-closed).

describe('QRDecoderService HMAC secret hardening (E5.3)', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  test('production sans secret configuré : refuse de démarrer (fail-closed)', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.QR_HMAC_SECRET;
    delete process.env.TICKET_SIGNATURE_SECRET;
    expect(() => require('../src/core/qr/qr-decoder.service')).toThrow(/QR HMAC secret manquant/);
  });

  test('production avec QR_HMAC_SECRET : n’utilise pas le secret par défaut public', () => {
    process.env.NODE_ENV = 'production';
    process.env.QR_HMAC_SECRET = 'real-strong-secret';
    delete process.env.TICKET_SIGNATURE_SECRET;
    const svc = require('../src/core/qr/qr-decoder.service');
    expect(svc.hmacSecrets).toContain('real-strong-secret');
    expect(svc.hmacSecrets).not.toContain('default-secret-change-in-production');
  });

  test('hors production : le secret par défaut reste disponible (ergonomie dev/test)', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.QR_HMAC_SECRET;
    delete process.env.TICKET_SIGNATURE_SECRET;
    const svc = require('../src/core/qr/qr-decoder.service');
    expect(svc.hmacSecrets).toContain('default-secret-change-in-production');
  });
});
