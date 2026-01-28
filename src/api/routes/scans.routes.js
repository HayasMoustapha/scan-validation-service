const express = require('express');
const Joi = require('joi');
const scansController = require('../controllers/scans.controller');
const ValidationMiddleware = require('../../../../shared/middleware/validation.middleware');

const router = express.Router();

// POST /api/scans/validate - Valider un ticket
router.post('/validate',
  ValidationMiddleware.validate({
    body: Joi.object({
      qrCode: Joi.string().required(),
      scanContext: Joi.object({
        location: Joi.string(),
        deviceId: Joi.string(),
        operatorId: Joi.string()
      })
    })
  }),
  scansController.validateTicket
);

// POST /api/scans/validate-offline - Valider un ticket en mode offline
router.post('/validate-offline',
  ValidationMiddleware.validate({
    body: Joi.object({
      ticketId: Joi.string().required(),
      scanContext: Joi.object({
        location: Joi.string(),
        deviceId: Joi.string(),
        operatorId: Joi.string()
      })
    })
  }),
  scansController.validateTicketOffline
);

// GET /api/scans/history/ticket/:ticketId - Obtenir l'historique des scans d'un ticket
router.get('/history/ticket/:ticketId',
  ValidationMiddleware.validate({
    params: Joi.object({
      ticketId: Joi.string().required()
    }),
    query: Joi.object({
      limit: Joi.number().integer().min(1).max(100),
      offset: Joi.number().integer().min(0)
    })
  }),
  scansController.getTicketScanHistory
);

// GET /api/scans/stats/event/:eventId - Obtenir les statistiques de scan d'un événement
router.get('/stats/event/:eventId',
  ValidationMiddleware.validate({
    params: Joi.object({
      eventId: Joi.string().required()
    }),
    query: Joi.object({
      startDate: Joi.date(),
      endDate: Joi.date()
    })
  }),
  scansController.getEventScanStats
);

// GET /api/scans/health - Vérifier la santé du service
router.get('/health',
  scansController.healthCheck
);

// GET /api/scans/stats - Obtenir les statistiques du service
router.get('/stats',
  scansController.getStats
);


module.exports = router;
