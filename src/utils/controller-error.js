/**
 * Mapper d'erreurs pour les contrôleurs (scan-validation-service).
 *
 * Objectif ERROR-UX : une erreur client (mauvaise entrée, ressource non
 * trouvée, conflit, dépendance non configurée) ne doit jamais retomber dans un
 * 500 générique. Si l'erreur capturée porte un statut/code explicite (typée),
 * on l'honore ; sinon on retombe sur le code/500 fourni par le contrôleur
 * (comportement historique préservé).
 *
 * Ne change PAS la forme de réponse : s'appuie sur
 * `errorResponse(message, data, code)`.
 */

const { errorResponse } = require('./response');

function resolveError(error, { fallbackCode = 'INTERNAL_SERVER_ERROR', fallbackStatus = 500 } = {}) {
  const status =
    Number(error?.statusCode) ||
    Number(error?.status) ||
    Number(error?.httpStatus) ||
    fallbackStatus;

  const code =
    (typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) && error.code) ||
    fallbackCode;

  const isExplicit = status < 500 && (error?.statusCode || error?.status || error?.httpStatus);

  return { status, code, isExplicit, message: error?.message };
}

function sendControllerError(res, error, fallbackMessage, fallbackCode, fallbackStatus = 500) {
  const { status, code, isExplicit, message } = resolveError(error, { fallbackCode, fallbackStatus });
  const responseMessage = isExplicit && message ? message : fallbackMessage;
  const data = error?.details || null;
  return res.status(status).json(errorResponse(responseMessage, data, code));
}

module.exports = { resolveError, sendControllerError };
