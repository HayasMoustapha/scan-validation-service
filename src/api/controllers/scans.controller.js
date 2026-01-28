const validationService = require('../../core/validation/validation.service');
const scanService = require('../../core/scan/scan.service');
const offlineService = require('../../core/offline/offline.service');
const { 
  successResponse, 
  validationResponse,
  scanResponse,
  statsResponse,
  errorResponse,
  validationErrorResponse,
  offlineErrorResponse
} = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Contrôleur pour la validation de tickets
 * Responsabilité : Interface API pour la validation de tickets uniquement
 * NE GÉNÈRE PAS de QR codes - utilise le service QR decoder pour la validation
 */
class ScansController {
  /**
   * Valide un ticket à partir d'un QR code scanné
   * Point d'entrée principal pour la validation des tickets
   */
  async validateTicket(req, res) {
    try {
      const { qrCode, scanContext = {} } = req.body;
      
      if (!qrCode) {
        return res.status(400).json(
          validationErrorResponse('QR code requis', 'MISSING_QR_CODE')
        );
      }

      logger.scan('Starting ticket validation', {
        hasScanContext: !!scanContext,
        scanLocation: scanContext.location,
        deviceId: scanContext.deviceId
      });

      // Utiliser le service de validation orchestré
      const validationResult = await validationService.validateTicket(
        qrCode,
        {
          ...scanContext,
          timestamp: new Date().toISOString()
        }
      );

      if (!validationResult.success) {
        // Enregistrer la tentative de scan échouée
        if (validationResult.validationId) {
          await scanService.recordScan({
            validationId: validationResult.validationId,
            ticketId: 'UNKNOWN',
            eventId: 'UNKNOWN',
            result: validationResult.code,
            scanContext,
            timestamp: new Date().toISOString(),
            validationTime: validationResult.validationTime,
          }).catch(err => {
            logger.error('Failed to record failed scan', {
              error: err.message,
              validationId: validationResult.validationId
            });
          });
        }

        return res.status(400).json(
          validationErrorResponse(validationResult.error, validationResult.code)
        );
      }

      // Enregistrer le scan réussi
      await scanService.recordScan({
        validationId: validationResult.validationId,
        ticketId: validationResult.ticket.id,
        eventId: validationResult.ticket.eventId,
        result: 'VALID',
        scanContext,
        timestamp: new Date().toISOString(),
        validationTime: validationResult.validationTime,
        qrMetadata: validationResult.metadata?.qrValidation,
        businessValidation: validationResult.metadata?.businessValidation
      }).catch(err => {
        logger.error('Failed to record successful scan', {
          error: err.message,
          validationId: validationResult.validationId,
          ticketId: validationResult.ticket.id
        });
      });

      return res.status(200).json(
        validationResponse(validationResult)
      );
    } catch (error) {
      logger.error('Failed to validate ticket', {
        error: error.message
      });

      return res.status(500).json(
        errorResponse('Échec de la validation du ticket', null, 'TICKET_VALIDATION_FAILED')
      );
    }
  }

  /**
   * Valide un ticket en mode offline
   * Utilise le cache local pour la validation sans connexion
   */
  async validateTicketOffline(req, res) {
    try {
      const { ticketId, scanContext = {} } = req.body;
      
      if (!ticketId) {
        return res.status(400).json(
          validationErrorResponse('ID du ticket requis', 'MISSING_TICKET_ID')
        );
      }

      const validationResult = await offlineService.validateTicketOffline(
        ticketId,
        {
          ...scanContext,
          timestamp: new Date().toISOString()
        }
      );

      if (!validationResult.success) {
        return res.status(400).json(
          offlineErrorResponse(validationResult.error, validationResult.code)
        );
      }

      return res.status(200).json(
        scanResponse(validationResult)
      );
    } catch (error) {
      logger.error('Failed to validate ticket offline', {
        error: error.message,
        ticketId: req.body.ticketId
      });

      return res.status(500).json(
        errorResponse('Échec de la validation offline du ticket', null, 'OFFLINE_VALIDATION_FAILED')
      );
    }
  }

  /**
   * Récupère l'historique des scans d'un ticket
   */
  async getTicketScanHistory(req, res) {
    try {
      const { ticketId } = req.params;
      
      if (!ticketId) {
        return res.status(400).json(
          validationErrorResponse('ID du ticket requis', 'MISSING_TICKET_ID')
        );
      }

      const historyData = await scanService.getTicketScanHistory(ticketId, req.query);

      if (!historyData.success) {
        return res.status(400).json(
          errorResponse(historyData.error, null, historyData.code)
        );
      }

      return res.status(200).json(
        successResponse('Historique des scans récupéré', historyData)
      );
    } catch (error) {
      logger.error('Failed to get ticket scan history', {
        error: error.message,
        ticketId: req.params.ticketId
      });

      return res.status(500).json(
        errorResponse('Échec de la récupération de l\'historique des scans', null, 'SCAN_HISTORY_FAILED')
      );
    }
  }

  /**
   * Récupère les statistiques de scan d'un événement
   */
  async getEventScanStats(req, res) {
    try {
      const { eventId } = req.params;
      const { startDate, endDate } = req.query;
      
      if (!eventId) {
        return res.status(400).json(
          validationErrorResponse('ID de l\'événement requis', 'MISSING_EVENT_ID')
        );
      }

      const statsData = await scanService.getEventScanStats(eventId, {
        startDate,
        endDate
      });

      if (!statsData.success) {
        return res.status(400).json(
          errorResponse(statsData.error, null, statsData.code)
        );
      }

      return res.status(200).json(
        statsResponse(statsData)
      );
    } catch (error) {
      logger.error('Failed to get event scan stats', {
        error: error.message,
        eventId: req.params.eventId
      });

      return res.status(500).json(
        errorResponse('Échec de la récupération des statistiques de scan', null, 'SCAN_STATS_FAILED')
      );
    }
  }

  /**
   * Vérifie la santé du service de scan
   */
  async healthCheck(req, res) {
    try {
      const [validationHealth, scanHealth, offlineHealth] = await Promise.all([
        validationService.healthCheck(),
        scanService.healthCheck(),
        offlineService.healthCheck()
      ]);

      const overallHealthy = validationHealth.healthy && scanHealth.healthy && offlineHealth.healthy;

      return res.status(200).json(
        successResponse('Service de validation opérationnel', {
          validation: validationHealth,
          scan: scanHealth,
          offline: offlineHealth,
          overall: {
            healthy: overallHealthy,
            services: {
              validation: validationHealth.healthy,
              scan: scanHealth.healthy,
              offline: offlineHealth.healthy
            }
          }
        })
      );
    } catch (error) {
      logger.error('Health check failed', {
        error: error.message
      });

      return res.status(503).json(
        errorResponse('Service de validation indisponible', null, 'HEALTH_CHECK_FAILED')
      );
    }
  }

  /**
   * Récupère les statistiques du service
   */
  async getStats(req, res) {
    try {
      const [validationStats, scanStats, offlineStats] = await Promise.all([
        validationService.getStats(),
        scanService.getStats(),
        offlineService.getStats()
      ]);

      return res.status(200).json(
        successResponse('Statistiques du service de validation', {
          validation: validationStats,
          scan: scanStats,
          offline: offlineStats
        })
      );
    } catch (error) {
      logger.error('Failed to get service stats', {
        error: error.message
      });

      return res.status(500).json(
        errorResponse('Échec de la récupération des statistiques', null, 'STATS_FAILED')
      );
    }
  }
}

module.exports = new ScansController();
