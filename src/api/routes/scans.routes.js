const express = require('express');
const Joi = require('joi');
const scansController = require('../controllers/scans.controller');
const ValidationMiddleware = require('../../middleware/validation.middleware');

const router = express.Router();

/**
 * 📸 ROUTES TECHNIQUES POUR LA VALIDATION DE TICKETS
 * Ce service fait de la validation technique de QR codes sans logique métier
 */

// POST /api/scans/validate - Valider un ticket en temps réel
// NOTE : Service technique - pas d'authentification utilisateur requise
router.post('/validate',
  ValidationMiddleware.validate({
    qrCode: Joi.string().required(),
    scanContext: Joi.object({
      location: Joi.string().optional(),
      deviceId: Joi.string().optional(),
      operatorId: Joi.string().optional()
      // NOTE : operatorId est un identifiant technique, pas un utilisateur métier
    }).optional()
  }),
  scansController.validateTicket
);

// POST /api/scans/validate-offline - Valider un ticket en mode offline
// NOTE : Service technique - validation sans connexion réseau
router.post('/validate-offline',
  ValidationMiddleware.validate({
    ticketId: Joi.string().required(),
    scanContext: Joi.object({
      location: Joi.string().optional(),
      deviceId: Joi.string().optional(),
      operatorId: Joi.string().optional(),
      offlineMode: Joi.boolean().default(true)
    }).optional()
  }),
  scansController.validateTicketOffline
);

// GET /api/scans/history/ticket/:ticketId - Historique technique des scans
// NOTE : Lecture seule des données techniques de scan
router.get('/history/ticket/:ticketId',
  ValidationMiddleware.validateParams({
    ticketId: Joi.string().required()
  }),
  ValidationMiddleware.validateQuery({
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0)
  }),
  scansController.getTicketScanHistory
);

// GET /api/scans/ticket/:ticketId/logs - Logs de scan pour un ticket (pour Event-Planner-Core)
// NOTE : Endpoint interne pour consultation cross-service
router.get('/ticket/:ticketId/logs',
  ValidationMiddleware.validateParams({
    ticketId: Joi.string().required()
  }),
  scansController.getTicketScanLogs
);

// GET /api/scans/stats/event/:eventId - Statistiques techniques de scan
// NOTE : Données techniques uniquement, pas d'analytics métier
router.get('/stats/event/:eventId',
  ValidationMiddleware.validateParams({
    eventId: Joi.string().required()
  }),
  ValidationMiddleware.validateQuery({
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional()
  }),
  scansController.getEventScanStats
);

// GET /api/scans/health - Santé du service de validation
// NOTE : Endpoint technique de monitoring
router.get('/health',
  scansController.healthCheck
);

// GET /api/scans/stats - Statistiques générales du service
// NOTE : Métriques techniques du service
router.get('/stats',
  scansController.getStats
);

module.exports = router;
