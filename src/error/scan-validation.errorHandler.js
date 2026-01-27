const { ErrorHandlerFactory } = require('../../../shared');

/**
 * Error Handler personnalisé pour Scan Validation Service
 * Gère les erreurs spécifiques à la validation de tickets, QR codes, et détection de fraude
 */

const scanValidationErrorHandler = ErrorHandlerFactory.create('Scan Validation Service', {
  logLevel: 'error',
  includeStackTrace: process.env.NODE_ENV === 'development',
  customErrorTypes: {
    // Erreurs de validation de tickets
    'TicketValidationError': {
      category: 'business',
      statusCode: 400,
      severity: 'medium',
      retryable: false
    },
    'InvalidQRCode': {
      category: 'validation',
      statusCode: 400,
      severity: 'low',
      retryable: false
    },
    'MalformedQRCode': {
      category: 'validation',
      statusCode: 400,
      severity: 'low',
      retryable: false
    },
    'ExpiredTicket': {
      category: 'business',
      statusCode: 410,
      severity: 'medium',
      retryable: false
    },
    'AlreadyUsedTicket': {
      category: 'business',
      statusCode: 409,
      severity: 'high',
      retryable: false
    },
    'InvalidTicketType': {
      category: 'validation',
      statusCode: 400,
      severity: 'medium',
      retryable: false
    },
    
    // Erreurs de QR code
    'QRCodeDecodingError': {
      category: 'technical',
      statusCode: 400,
      severity: 'medium',
      retryable: false
    },
    'QRCodeChecksumError': {
      category: 'security',
      statusCode: 401,
      severity: 'high',
      retryable: false
    },
    'QRCodeTampered': {
      category: 'security',
      statusCode: 401,
      severity: 'high',
      retryable: false
    },
    'QRCodeExpired': {
      category: 'business',
      statusCode: 410,
      severity: 'medium',
      retryable: false
    },
    
    // Erreurs de détection de fraude
    'FraudDetectionError': {
      category: 'security',
      statusCode: 403,
      severity: 'high',
      retryable: false
    },
    'SuspiciousActivity': {
      category: 'security',
      statusCode: 403,
      severity: 'high',
      retryable: false
    },
    'DuplicateScan': {
      category: 'security',
      statusCode: 409,
      severity: 'medium',
      retryable: false
    },
    'RapidScanning': {
      category: 'security',
      statusCode: 429,
      severity: 'medium',
      retryable: false
    },
    'UnusualLocation': {
      category: 'security',
      statusCode: 403,
      severity: 'medium',
      retryable: false
    },
    
    // Erreurs de validation offline
    'OfflineValidationError': {
      category: 'business',
      statusCode: 400,
      severity: 'medium',
      retryable: false
    },
    'OfflineSyncError': {
      category: 'technical',
      statusCode: 503,
      severity: 'high',
      retryable: true
    },
    'OfflineDataCorrupted': {
      category: 'technical',
      statusCode: 500,
      severity: 'high',
      retryable: false
    },
    
    // Erreurs de points de contrôle
    'CheckpointNotFoundError': {
      category: 'not_found',
      statusCode: 404,
      severity: 'medium',
      retryable: false
    },
    'CheckpointInactive': {
      category: 'business',
      statusCode: 503,
      severity: 'medium',
      retryable: false
    },
    'UnauthorizedCheckpoint': {
      category: 'security',
      statusCode: 403,
      severity: 'high',
      retryable: false
    },
    
    // Erreurs de statistiques temps réel
    'RealTimeStatsError': {
      category: 'technical',
      statusCode: 503,
      severity: 'medium',
      retryable: true
    },
    'StatsAggregationError': {
      category: 'technical',
      statusCode: 500,
      severity: 'medium',
      retryable: true
    },
    'MetricsCollectionError': {
      category: 'technical',
      statusCode: 500,
      severity: 'low',
      retryable: true
    },
    
    // Erreurs techniques communes
    'DatabaseConnectionError': {
      category: 'technical',
      statusCode: 503,
      severity: 'high',
      retryable: true
    },
    'CacheConnectionError': {
      category: 'technical',
      statusCode: 503,
      severity: 'medium',
      retryable: true
    },
    'ExternalServiceError': {
      category: 'technical',
      statusCode: 502,
      severity: 'medium',
      retryable: true
    },
    'ConfigurationError': {
      category: 'technical',
      statusCode: 500,
      severity: 'medium',
      retryable: false
    },
    'TimeoutError': {
      category: 'technical',
      statusCode: 408,
      severity: 'medium',
      retryable: true
    },
    'RateLimitError': {
      category: 'security',
      statusCode: 429,
      severity: 'medium',
      retryable: false
    }
  }
});

module.exports = scanValidationErrorHandler;
