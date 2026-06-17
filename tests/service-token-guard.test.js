const { serviceTokenGuard } = require('../src/middleware/service-token.middleware');

// E5.3 — Garde service-token optionnel des endpoints de scan.
describe('serviceTokenGuard (E5.3)', () => {
  const OLD_ENV = process.env;
  const makeRes = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  };

  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  test('désactivé par défaut : laisse passer (non-bloquant)', () => {
    delete process.env.SCAN_REQUIRE_SERVICE_TOKEN;
    const next = jest.fn();
    const res = makeRes();
    serviceTokenGuard({ headers: {} }, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('activé sans en-tête : 401', () => {
    process.env.SCAN_REQUIRE_SERVICE_TOKEN = 'true';
    process.env.SCAN_SERVICE_TOKEN = 'secret-token';
    const next = jest.fn();
    const res = makeRes();
    serviceTokenGuard({ headers: {} }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('activé avec bon en-tête : laisse passer', () => {
    process.env.SCAN_REQUIRE_SERVICE_TOKEN = 'true';
    process.env.SCAN_SERVICE_TOKEN = 'secret-token';
    const next = jest.fn();
    const res = makeRes();
    serviceTokenGuard({ headers: { 'x-service-token': 'secret-token' } }, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('activé mais non configuré : 500 (fail-safe)', () => {
    process.env.SCAN_REQUIRE_SERVICE_TOKEN = 'true';
    delete process.env.SCAN_SERVICE_TOKEN;
    const next = jest.fn();
    const res = makeRes();
    serviceTokenGuard({ headers: { 'x-service-token': 'whatever' } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
