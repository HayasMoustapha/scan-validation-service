const winston = require('winston');
const path = require('path');

/**
 * Service de logging Winston configuré pour le Scan Validation Service
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'scan-validation',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    // Console transport pour le développement
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          return `${timestamp} [${service}] ${level}: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          }`;
        })
      )
    }),

    // File transport pour les logs d'erreur
    new winston.transports.File({
      filename: path.join(process.env.LOG_FILE_PATH || './logs', 'error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),

    // File transport pour les logs combinés
    new winston.transports.File({
      filename: path.join(process.env.LOG_FILE_PATH || './logs', 'combined.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),

    // File transport pour les logs de scans
    new winston.transports.File({
      filename: path.join(process.env.LOG_FILE_PATH || './logs', 'scans.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),

    // File transport pour les logs de validation
    new winston.transports.File({
      filename: path.join(process.env.LOG_FILE_PATH || './logs', 'validation.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  ],

  // Gestion des exceptions non capturées
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.env.LOG_FILE_PATH || './logs', 'exceptions.log')
    })
  ],

  // Gestion des rejets de promesses non capturés
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(process.env.LOG_FILE_PATH || './logs', 'rejections.log')
    })
  ]
});

// Méthodes spécialisées pour différents types de logs
logger.auth = (message, meta = {}) => {
  logger.info(`[AUTH] ${message}`, { ...meta, category: 'auth' });
};

logger.security = (message, meta = {}) => {
  logger.warn(`[SECURITY] ${message}`, { ...meta, category: 'security' });
};

logger.scan = (message, meta = {}) => {
  logger.info(`[SCAN] ${message}`, { ...meta, category: 'scan' });
};

logger.validation = (message, meta = {}) => {
  logger.info(`[VALIDATION] ${message}`, { ...meta, category: 'validation' });
};

logger.qr = (message, meta = {}) => {
  logger.info(`[QR] ${message}`, { ...meta, category: 'qr' });
};

logger.offline = (message, meta = {}) => {
  logger.info(`[OFFLINE] ${message}`, { ...meta, category: 'offline' });
};

logger.checkpoint = (message, meta = {}) => {
  logger.info(`[CHECKPOINT] ${message}`, { ...meta, category: 'checkpoint' });
};

logger.stats = (message, meta = {}) => {
  logger.info(`[STATS] ${message}`, { ...meta, category: 'stats' });
};

logger.performance = (message, meta = {}) => {
  logger.info(`[PERF] ${message}`, { ...meta, category: 'performance' });
};


logger.external = (message, meta = {}) => {
  logger.info(`[EXTERNAL] ${message}`, { ...meta, category: 'external' });
};

logger.fraud = (message, meta = {}) => {
  logger.warn(`[FRAUD] ${message}`, { ...meta, category: 'fraud' });
};

logger.audit = (message, meta = {}) => {
  logger.info(`[AUDIT] ${message}`, { ...meta, category: 'audit' });
};

logger.sync = (message, meta = {}) => {
  logger.info(`[SYNC] ${message}`, { ...meta, category: 'sync' });
};

logger.rateLimit = (message, meta = {}) => {
  logger.warn(`[RATE_LIMIT] ${message}`, { ...meta, category: 'rate_limit' });
};

module.exports = logger;
