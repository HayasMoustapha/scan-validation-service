const express = require('express');
const Joi = require('joi');
const router = express.Router();
const scansController = require('../controllers/scans.controller');
const { SecurityMiddleware, ValidationMiddleware, ContextInjector } = require('../../../../shared');
const scanValidationErrorHandler = require('../../error/scan-validation.errorHandler');
const logger = require('../../utils/logger');

/**
 * Routes pour la validation de tickets
 */

// Apply authentication to all routes
router.use(SecurityMiddleware.authenticated());

// Apply context injection for all authenticated routes
router.use(ContextInjector.injectUserContext());

// Apply error handler for all routes
router.use(scanValidationErrorHandler);

// Validation schemas
const validateTicketSchema = Joi.object({
  qrCode: Joi.string().required(),
  scanContext: Joi.object({
    location: Joi.string().optional(),
    deviceId: Joi.string().optional(),
    checkpointId: Joi.string().optional(),
    timestamp: Joi.date().optional()
  }).optional()
});

const validateTicketOfflineSchema = Joi.object({
  qrCode: Joi.string().required(),
  scanContext: Joi.object({
    location: Joi.string().required(),
    deviceId: Joi.string().required(),
    checkpointId: Joi.string().required(),
    timestamp: Joi.date().required(),
    offlineMode: Joi.boolean().default(true)
  }).required(),
  offlineData: Joi.object({
    cachedTickets: Joi.array().optional(),
    lastSync: Joi.date().optional()
  }).optional()
});

const generateQRCodeSchema = Joi.object({
  ticketId: Joi.string().required(),
  eventId: Joi.string().required(),
  ticketType: Joi.string().valid('standard', 'vip', 'premium', 'staff').required(),
  attendeeInfo: Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    phone: Joi.string().optional()
  }).required(),
  metadata: Joi.object().optional()
});

const batchQRCodeSchema = Joi.object({
  tickets: Joi.array().items(
    Joi.object({
      ticketId: Joi.string().required(),
      eventId: Joi.string().required(),
      ticketType: Joi.string().valid('standard', 'vip', 'premium', 'staff').required(),
      attendeeInfo: Joi.object({
        name: Joi.string().required(),
        email: Joi.string().email().required(),
        phone: Joi.string().optional()
      }).required()
    })
  ).min(1).max(100).required()
});

const testQRCodeSchema = Joi.object({
  ticketType: Joi.string().valid('standard', 'vip', 'premium', 'staff').default('standard'),
  eventId: Joi.string().optional(),
  testData: Joi.boolean().default(true)
});

// POST /api/scans/validate - Valider un ticket (temps réel)
router.post('/validate',
  SecurityMiddleware.withPermissions('scans.validate'),
  ValidationMiddleware.validate({ body: validateTicketSchema }),
  scansController.validateTicket
);

// POST /api/scans/validate-offline - Valider un ticket (mode offline)
router.post('/validate-offline',
  SecurityMiddleware.withPermissions('scans.validate.offline'),
  ValidationMiddleware.validate({ body: validateTicketOfflineSchema }),
  scansController.validateTicketOffline
);

// POST /api/scans/qr/generate - Générer un QR code
router.post('/qr/generate',
  SecurityMiddleware.withPermissions('scans.qr.generate'),
  ValidationMiddleware.validate({ body: generateQRCodeSchema }),
  scansController.generateQRCode
);

// POST /api/scans/qr/batch - Générer des QR codes en lot
router.post('/qr/batch',
  SecurityMiddleware.withPermissions('scans.qr.batch'),
  ValidationMiddleware.validate({ body: batchQRCodeSchema }),
  scansController.generateBatchQRCodes
);

// POST /api/scans/qr/test - Générer un QR code de test
router.post('/qr/test',
  SecurityMiddleware.withPermissions('scans.qr.test'),
  ValidationMiddleware.validate({ body: testQRCodeSchema }),
  scansController.generateTestQRCode
);

// GET /api/scans/stats - Obtenir les statistiques de scans
router.get('/stats',
  SecurityMiddleware.withPermissions('scans.stats.read'),
  scansController.getStats
);

// POST /api/scans/fraud/analyze - Analyser la détection de fraude
router.post('/fraud/analyze',
  SecurityMiddleware.withPermissions('scans.fraud.analyze'),
  ValidationMiddleware.validate({
    body: Joi.object({
      scanData: Joi.object({
        qrCode: Joi.string().required(),
        scanContext: Joi.object({
          location: Joi.string().required(),
          deviceId: Joi.string().required(),
          timestamp: Joi.date().required()
        }).required()
      }).required()
    })
  }),
  scansController.analyzeFraud
);

// GET /api/scans/fraud/stats - Obtenir les statistiques de fraude
router.get('/fraud/stats',
  SecurityMiddleware.withPermissions('scans.fraud.stats'),
  ValidationMiddleware.validateQuery({
    eventId: Joi.string().optional(),
    period: Joi.string().valid('1h', '24h', '7d', '30d').default('24h')
  }),
  scansController.getFraudStats
);

// GET /api/scans/history/ticket/:ticketId - Obtenir l'historique des scans d'un ticket
router.get('/history/ticket/:ticketId',
  SecurityMiddleware.withPermissions('scans.history.read'),
  ValidationMiddleware.validateParams({
    ticketId: Joi.string().required()
  }),
  scansController.getTicketScanHistory
);

// POST /api/scans/sync - Synchroniser les données offline
router.post('/sync',
  SecurityMiddleware.withPermissions('scans.sync'),
  ValidationMiddleware.validate({
    body: Joi.object({
      offlineData: Joi.array().items(
        Joi.object({
          qrCode: Joi.string().required(),
          scanResult: Joi.object().required(),
          timestamp: Joi.date().required(),
          deviceId: Joi.string().required()
        })
      ).required(),
      deviceId: Joi.string().required()
    })
  }),
  scansController.syncOfflineData
);

// GET /api/scans/offline/data - Obtenir les données offline
router.get('/offline/data',
  SecurityMiddleware.withPermissions('scans.offline.read'),
  ValidationMiddleware.validateQuery({
    ticketId: Joi.string().optional()
  }),
  scansController.getOfflineData
);

// POST /api/scans/sessions/start - Démarrer une session de scan
router.post('/sessions/start',
  SecurityMiddleware.withPermissions('scans.sessions.create'),
  ValidationMiddleware.validate({
    body: Joi.object({
      eventId: Joi.string().required(),
      operatorId: Joi.string().required(),
      deviceId: Joi.string().required(),
      checkpointId: Joi.string().required()
    })
  }),
  scansController.startScanSession
);

// POST /api/scans/sessions/end - Terminer une session de scan
router.post('/sessions/end',
  SecurityMiddleware.withPermissions('scans.sessions.update'),
  ValidationMiddleware.validate({
    body: Joi.object({
      sessionId: Joi.string().required()
    })
  }),
  scansController.endScanSession
);

// GET /api/scans/sessions/active - Obtenir les sessions actives
router.get('/sessions/active',
  SecurityMiddleware.withPermissions('scans.sessions.read'),
  ValidationMiddleware.validateQuery({
    eventId: Joi.string().optional()
  }),
  scansController.getActiveScanSessions
);

// GET /api/scans/sessions/:sessionId - Obtenir une session de scan
router.get('/sessions/:sessionId',
  SecurityMiddleware.withPermissions('scans.sessions.read'),
  ValidationMiddleware.validateParams({
    sessionId: Joi.string().required()
  }),
  scansController.getScanSession
);

// POST /api/scans/operators/register - Enregistrer un opérateur de scan
router.post('/operators/register',
  SecurityMiddleware.withPermissions('scans.operators.create'),
  ValidationMiddleware.validate({
    body: Joi.object({
      userId: Joi.string().required(),
      eventId: Joi.string().required(),
      role: Joi.string().valid('operator', 'supervisor', 'admin').required(),
      permissions: Joi.array().items(Joi.string()).required()
    })
  }),
  scansController.registerScanOperator
);

// GET /api/scans/operators/event/:eventId - Obtenir les opérateurs d'un événement
router.get('/operators/event/:eventId',
  SecurityMiddleware.withPermissions('scans.operators.read'),
  ValidationMiddleware.validateParams({
    eventId: Joi.string().required()
  }),
  scansController.getEventScanOperators
);

// POST /api/scans/devices/register - Enregistrer un appareil de scan
router.post('/devices/register',
  SecurityMiddleware.withPermissions('scans.devices.create'),
  ValidationMiddleware.validate({
    body: Joi.object({
      deviceId: Joi.string().required(),
      eventId: Joi.string().required(),
      deviceType: Joi.string().valid('mobile', 'tablet', 'scanner', 'kiosk').required(),
      location: Joi.string().required(),
      capabilities: Joi.array().items(Joi.string()).required()
    })
  }),
  scansController.registerScanDevice
);

// GET /api/scans/devices/event/:eventId - Obtenir les appareils d'un événement
router.get('/devices/event/:eventId',
  SecurityMiddleware.withPermissions('scans.devices.read'),
  ValidationMiddleware.validateParams({
    eventId: Joi.string().required()
  }),
  scansController.getEventScanDevices
);

module.exports = router;
