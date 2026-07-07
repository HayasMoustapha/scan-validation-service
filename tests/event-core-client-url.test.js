// E5.2 — Résolution de l'URL du service core : le client doit accepter
// EVENT_CORE_SERVICE_URL (prioritaire) ET CORE_SERVICE_URL (fallback), pour
// éliminer le mismatch qui rendait la validation métier (anti-double-entrée)
// injoignable.

describe('EventCoreClient base URL resolution (E5.2)', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  test('EVENT_CORE_SERVICE_URL est prioritaire', () => {
    process.env.EVENT_CORE_SERVICE_URL = 'http://core-a:3001';
    process.env.CORE_SERVICE_URL = 'http://core-b:3001';
    const client = require('../src/core/clients/event-core.client');
    expect(client.baseURL).toBe('http://core-a:3001');
  });

  test('fallback sur CORE_SERVICE_URL quand EVENT_CORE_SERVICE_URL absent', () => {
    delete process.env.EVENT_CORE_SERVICE_URL;
    process.env.CORE_SERVICE_URL = 'http://core-b:3001';
    const client = require('../src/core/clients/event-core.client');
    expect(client.baseURL).toBe('http://core-b:3001');
  });
});
