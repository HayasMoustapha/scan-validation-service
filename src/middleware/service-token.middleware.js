/**
 * E5.3 — Garde service-token OPTIONNEL pour les endpoints de scan.
 *
 * Le service de scan est technique (pas d'auth utilisateur). Ce garde permet,
 * en production, d'exiger un jeton de service inter-services sans casser le flux
 * actuel : il est DÉSACTIVÉ par défaut et ne s'active qu'avec
 * SCAN_REQUIRE_SERVICE_TOKEN=true (+ SCAN_SERVICE_TOKEN). Une fois activé, il exige
 * l'en-tête X-Service-Token correspondant.
 */
function serviceTokenGuard(req, res, next) {
  if (process.env.SCAN_REQUIRE_SERVICE_TOKEN !== 'true') {
    return next(); // désactivé par défaut -> non-bloquant
  }

  const expected = process.env.SCAN_SERVICE_TOKEN;
  if (!expected) {
    return res.status(500).json({
      success: false,
      error: 'Scan service token required but not configured (SCAN_SERVICE_TOKEN missing)',
      code: 'SERVICE_TOKEN_NOT_CONFIGURED',
    });
  }

  const provided = req.headers && req.headers['x-service-token'];
  if (!provided || provided !== expected) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing service token',
      code: 'SERVICE_TOKEN_REQUIRED',
    });
  }

  return next();
}

module.exports = { serviceTokenGuard };
