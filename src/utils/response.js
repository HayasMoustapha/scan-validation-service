/**
 * Utilitaires pour les réponses API standardisées
 */

/**
 * Réponse de succès
 * @param {string} message - Message de succès
 * @param {Object} data - Données à retourner
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function successResponse(message, data = null, meta = {}) {
  return {
    success: true,
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse de création
 * @param {string} message - Message de succès
 * @param {Object} data - Données créées
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function createdResponse(message, data = null, meta = {}) {
  return {
    success: true,
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      created: true,
      ...meta
    }
  };
}

/**
 * Réponse d'erreur
 * @param {string} message - Message d'erreur
 * @param {Object} data - Données d'erreur
 * @param {string} code - Code d'erreur
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function errorResponse(message, data = null, code = null, meta = {}) {
  return {
    success: false,
    message,
    error: {
      code,
      data
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse d'erreur de validation
 * @param {Array} errors - Liste des erreurs de validation
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function validationErrorResponse(errors, meta = {}) {
  return {
    success: false,
    message: 'Erreur de validation',
    error: {
      code: 'VALIDATION_ERROR',
      data: errors
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse d'erreur non trouvée
 * @param {string} resource - Type de ressource
 * @param {string} id - ID de la ressource
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function notFoundResponse(resource, id = null, meta = {}) {
  const message = id ? `${resource} avec ID ${id} non trouvé` : `${resource} non trouvé`;
  
  return {
    success: false,
    message,
    error: {
      code: 'NOT_FOUND',
      data: {
        resource,
        id
      }
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse d'accès interdit
 * @param {string} message - Message d'erreur
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function forbiddenResponse(message = 'Accès interdit', meta = {}) {
  return {
    success: false,
    message,
    error: {
      code: 'FORBIDDEN'
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse d'erreur serveur
 * @param {string} message - Message d'erreur
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function serverErrorResponse(message = 'Erreur interne du serveur', meta = {}) {
  return {
    success: false,
    message,
    error: {
      code: 'INTERNAL_SERVER_ERROR'
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse paginée
 * @param {Array} data - Données paginées
 * @param {Object} pagination - Informations de pagination
 * @param {string} message - Message de succès
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function paginatedResponse(data, pagination, message = 'Données récupérées avec succès', meta = {}) {
  return {
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
      hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
      hasPrev: pagination.page > 1
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse pour la validation de ticket
 * @param {Object} validationData - Données de validation
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function validationResponse(validationData, meta = {}) {
  return {
    success: true,
    message: 'Ticket validé avec succès',
    data: {
      ticketId: validationData.ticket.id,
      eventId: validationData.ticket.eventId,
      ticketType: validationData.ticket.type,
      status: validationData.ticket.status,
      scannedAt: validationData.ticket.scannedAt,
      validationTime: validationData.validationTime,
      offline: validationData.ticket.offline || false
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse pour le scan de ticket
 * @param {Object} scanData - Données du scan
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function scanResponse(scanData, meta = {}) {
  return {
    success: true,
    message: 'Scan effectué avec succès',
    data: {
      scanId: scanData.scanInfo.scanId,
      ticketId: scanData.ticket.id,
      eventId: scanData.ticket.eventId,
      status: scanData.ticket.status,
      timestamp: scanData.scanInfo.timestamp,
      location: scanData.scanInfo.location,
      deviceId: scanData.scanInfo.deviceId,
      offline: scanData.ticket.offline || false
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse pour les statistiques de scan
 * @param {Object} statsData - Données statistiques
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function statsResponse(statsData, meta = {}) {
  return {
    success: true,
    message: 'Statistiques de scan récupérées',
    data: statsData,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse pour les données offline
 * @param {Object} offlineData - Données offline
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function offlineResponse(offlineData, meta = {}) {
  return {
    success: true,
    message: 'Données offline récupérées',
    data: offlineData,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse pour les données de checkpoint
 * @param {Object} checkpointData - Données du checkpoint
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function checkpointResponse(checkpointData, meta = {}) {
  return {
    success: true,
    message: 'Données de checkpoint récupérées',
    data: checkpointData,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse pour l'historique des scans
 * @param {Object} historyData - Données d'historique
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function historyResponse(historyData, meta = {}) {
  return {
    success: true,
    message: 'Historique des scans récupéré',
    data: historyData,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse pour les erreurs de validation
 * @param {string} message - Message d'erreur
 * @param {string} validationCode - Code d'erreur de validation
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function validationErrorResponse(message, validationCode, meta = {}) {
  return {
    success: false,
    message,
    error: {
      code: 'VALIDATION_ERROR',
      validationCode,
      data: null
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse pour les erreurs de QR code
 * @param {string} message - Message d'erreur
 * @param {string} qrCodeError - Code d'erreur QR code
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function qrErrorResponse(message, qrCodeError, meta = {}) {
  return {
    success: false,
    message,
    error: {
      code: 'QR_CODE_ERROR',
      qrCodeError,
      data: null
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse pour les erreurs offline
 * @param {string} message - Message d'erreur
 * @param {string} offlineError - Code d'erreur offline
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function offlineErrorResponse(message, offlineError, meta = {}) {
  return {
    success: false,
    message,
    error: {
      code: 'OFFLINE_ERROR',
      offlineError,
      data: null
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Réponse pour les erreurs de synchronisation
 * @param {string} message - Message d'erreur
 * @param {string} syncError - Code d'erreur de synchronisation
 * @param {Object} meta - Métadonnées additionnelles
 * @returns {Object} Réponse formatée
 */
function syncErrorResponse(message, syncError, meta = {}) {
  return {
    success: false,
    message,
    error: {
      code: 'SYNC_ERROR',
      syncError,
      data: null
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

module.exports = {
  successResponse,
  createdResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  forbiddenResponse,
  serverErrorResponse,
  paginatedResponse,
  validationResponse,
  scanResponse,
  statsResponse,
  offlineResponse,
  checkpointResponse,
  historyResponse,
  validationErrorResponse,
  qrErrorResponse,
  offlineErrorResponse,
  syncErrorResponse
};
