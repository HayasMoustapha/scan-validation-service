const express = require('express');
const router = express.Router();
const scansController = require('../controllers/scans.controller');
const { authenticateJWT, validateApiKey } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const logger = require('../../utils/logger');
const validationService = require('../../core/validation/validation.service');
const offlineService = require('../../core/offline/offline.service');

/**
 * Routes pour la validation de tickets
 */

// Middleware d'authentification pour la plupart des routes
router.use(authenticateJWT);

// POST /api/scans/validate - Valider un ticket (temps réel)
router.post('/validate',
  requirePermission('scans.validate'),
  scansController.validateTicket
);

// POST /api/scans/validate-offline - Valider un ticket (mode offline)
router.post('/validate-offline',
  requirePermission('scans.validate.offline'),
  scansController.validateTicketOffline
);

// POST /api/scans/qr/generate - Générer un QR code
router.post('/qr/generate',
  requirePermission('scans.qr.generate'),
  scansController.generateQRCode
);

// POST /api/scans/qr/batch - Générer des QR codes en lot
router.post('/qr/batch',
  requirePermission('scans.qr.batch'),
  scansController.generateBatchQRCodes
);

// POST /api/scans/qr/test - Générer un QR code de test
router.post('/qr/test',
  requirePermission('scans.qr.test'),
  scansController.generateTestQRCode
);

// POST /api/scans/qr/decode - Décoder et valider un QR code
router.post('/qr/decode',
  requirePermission('scans.qr.decode'),
  scansController.decodeAndValidateQRCode
);

// GET /api/scans/:ticketId/history - Récupérer l'historique des scans
router.get('/:ticketId/history',
  requirePermission('scans.history.read'),
  scansController.getTicketScanHistory
);

// GET /api/scans/events/:eventId/stats - Statistiques de scan d'un événement
router.get('/events/:eventId/stats',
  requirePermission('scans.stats.read'),
  scansController.getEventScanStats
);

// POST /api/scans/reports - Générer un rapport de validation
router.post('/reports',
  requirePermission('scans.reports.generate'),
  scansController.generateValidationReport
);

// Routes de gestion des données offline

// POST /api/scans/offline/sync - Synchroniser les données offline
router.post('/offline/sync',
  requirePermission('scans.offline.sync'),
  scansController.syncOfflineData
);

// GET /api/scans/offline/data - Récupérer les données offline
router.get('/offline/data',
  requirePermission('scans.offline.read'),
  scansController.getOfflineData
);

// POST /api/scans/offline/cleanup - Nettoyer les données expirées
router.post('/offline/cleanup',
  requirePermission('scans.offline.cleanup'),
  scansController.cleanupExpiredData
);

// Routes de santé et statistiques

// GET /api/scans/health - Vérifier la santé du service
router.get('/health',
  scansController.healthCheck
);

// GET /api/scans/stats - Récupérer les statistiques du service
router.get('/stats',
  requirePermission('scans.stats.read'),
  scansController.getStats
);

// Routes de webhook pour les intégrations externes

// POST /api/scans/webhooks/validate - Webhook de validation externe
router.post('/webhooks/validate',
  validateApiKey,
  async (req, res) => {
  try {
    const { ticketData, scanContext, webhookId } = req.body;
    
    logger.webhook('External validation webhook received', {
      webhookId,
      ticketId: ticketData?.id,
      hasScanContext: !!scanContext
    });

    // Valider le ticket en utilisant le service de validation
    const validationResult = await validationService.validateTicket(
      ticketData,
      {
        ...scanContext,
        external: true,
        webhookId,
        timestamp: new Date().toISOString()
      }
    );

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: validationResult.error,
        code: validationResult.code,
        webhookId
      });
    }

    // Envoyer une réponse au webhook
    if (req.body.responseUrl) {
      try {
        const axios = require('axios');
        await axios.post(req.body.responseUrl, {
          success: true,
          validation: validationResult,
          webhookId,
          processedAt: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Failed to send webhook response', {
          error: error.message,
          responseUrl: req.body.responseUrl,
          webhookId
        });
      }
    }

    return res.status(200).json({
      success: true,
      validation: validationResult,
      webhookId,
      processedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('External validation webhook failed', {
      error: error.message,
      webhookId: req.body.webhookId
    });

    return res.status(500).json({
      success: false,
      error: 'Erreur lors du traitement du webhook de validation',
      code: 'WEBHOOK_PROCESSING_FAILED'
    });
  }
});

// POST /api/scans/webhooks/validate-batch - Webhook de validation en lot
router.post('/webhooks/validate-batch',
  validateApiKey,
  async (req, res) => {
  try {
    const { tickets, scanContext, webhookId } = req.body;
    
    if (!tickets || !Array.isArray(tickets)) {
      return res.status(400).json({
        success: false,
        error: 'Liste de tickets requise',
        code: 'MISSING_TICKETS_LIST'
      });
    }

    logger.webhook('External batch validation webhook received', {
      webhookId,
      ticketCount: tickets.length,
      hasScanContext: !!scanContext
    });

    const results = [];
    
    for (const ticketData of tickets) {
      try {
        const validationResult = await validationService.validateTicket(
          ticketData,
          {
            ...scanContext,
            external: true,
            webhookId,
            timestamp: new Date().toISOString()
          }
        );

        results.push({
          ticketId: ticketData.id,
          success: validationResult.success,
          error: validationResult.success ? null : validationResult.error,
          code: validationResult.success ? null : validationResult.code
        });
      } catch (error) {
        logger.error('Failed to validate ticket in batch webhook', {
          error: error.message,
          ticketId: ticketData.id
        });

        results.push({
          ticketId: ticketData.id,
          success: false,
          error: error.message,
          code: 'BATCH_VALIDATION_ERROR'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    // Envoyer une réponse au webhook
    if (req.body.responseUrl) {
      try {
        const axios = require('axios');
        await axios.post(req.body.responseUrl, {
          success: true,
          summary: {
            total: results.length,
            success: successCount,
            failed: failureCount
          },
          results,
          webhookId,
          processedAt: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Failed to send batch webhook response', {
          error: error.message,
          responseUrl: req.body.responseUrl,
          webhookId
        });
      }
    }

    return res.status(200).json({
      success: successCount > 0,
      summary: {
        total: results.length,
        success: successCount,
        failed: failureCount
      },
      results,
      webhookId
    });
  } catch (error) {
    logger.error('External batch validation webhook failed', {
      error: error.message,
      webhookId: req.body.webhookId
    });

    return res.status(500).json({
      success: false,
      error: 'Erreur lors du traitement du webhook de validation en lot',
      code: 'BATCH_WEBHOOK_PROCESSING_FAILED'
    });
  }
});

// POST /api/scans/webhooks/sync - Webhook de synchronisation
router.post('/webhooks/sync',
  validateApiKey,
  async (req, res) => {
  try {
    const { syncType, data, webhookId } = req.body;
    
    logger.webhook('External sync webhook received', {
      syncType,
      webhookId,
      hasData: !!data
    });

    let result;
    
    switch (syncType) {
      case 'validate':
        if (data.ticketId) {
          result = await validationService.validateTicket(
            data.ticketData,
            {
              external: true,
              webhookId,
              timestamp: new Date().toISOString()
            }
          );
        }
        break;
      case 'store':
        if (data.ticketData) {
          result = await offlineService.storeTicketData(
            data.ticketData,
            {
              external: true,
              webhookId,
              timestamp: new Date().toISOString()
            }
          );
        }
        break;
      case 'sync':
        result = await offlineService.syncOfflineData();
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Type de synchronisation non supporté: ${syncType}`,
          code: 'UNSUPPORTED_SYNC_TYPE'
        });
    }

    // Envoyer une réponse au webhook
    if (req.body.responseUrl) {
      try {
        const axios = require('axios');
        await axios.post(req.body.responseUrl, {
          success: result.success,
          syncType,
          data: result.data || null,
          webhookId,
          processedAt: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Failed to send sync webhook response', {
          error: error.message,
          responseUrl: req.body.responseUrl,
          webhookId
        });
      }
    }

    return res.status(200).json({
      success: result.success,
      syncType,
      data: result.data || null,
      webhookId,
      processedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('External sync webhook failed', {
      error: error.message,
      syncType: req.body.syncType,
      webhookId: req.body.webhookId
    });

    return res.status(500).json({
      success: false,
      error: 'Erreur lors du traitement du webhook de synchronisation',
      code: 'SYNC_WEBHOOK_PROCESSING_FAILED'
    });
  }
});

// POST /api/scans/webhooks/offline - Webhook pour les données offline
router.post('/webhooks/offline',
  validateApiKey,
  async (req, res) => {
  try {
    const { action, data, webhookId } = req.body;
    
    logger.webhook('External offline webhook received', {
      action,
      webhookId,
      hasData: !!data
    });

    let result;
    
    switch (action) {
      case 'store':
        if (data.ticketData) {
          result = await offlineService.storeTicketData(
            data.ticketData,
            {
              external: true,
              webhookId,
              timestamp: new Date().toISOString()
            }
          );
        }
        break;
      case 'validate':
        if (data.ticketId) {
          result = await offlineService.validateTicketOffline(
            data.ticketId,
            {
              external: true,
              webhookId,
              timestamp: new Date().toISOString()
            }
          );
        }
        break;
      case 'sync':
        result = await offlineService.syncOfflineData();
        break;
      case 'cleanup':
        result = await offlineService.cleanupExpiredData();
        break;
      case 'backup':
        result = await offlineService.backupOfflineData();
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Action offline non supportée: ${action}`,
          code: 'UNSUPPORTED_OFFLINE_ACTION'
        });
    }

    // Envoyer une réponse au webhook
    if (req.body.responseUrl) {
      try {
        const axios = require('axios');
        await axios.post(req.body.responseUrl, {
          success: result.success,
          action,
          data: result.data || null,
          webhookId,
          processedAt: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Failed to send offline webhook response', {
          error: error.message,
          responseUrl: req.body.responseUrl,
          webhookId
        });
      }
    }

    return res.status(200).json({
      success: result.success,
      action,
      data: result.data || null,
      webhookId,
      processedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('External offline webhook failed', {
      error: error.message,
      action: req.body.action,
      webhookId: req.body.webhookId
    });

    return res.status(500).json({
      success: false,
      error: 'Erreur lors du traitement du webhook offline',
      code: 'OFFLINE_WEBHOOK_PROCESSING_FAILED'
    });
  }
});

module.exports = router;
