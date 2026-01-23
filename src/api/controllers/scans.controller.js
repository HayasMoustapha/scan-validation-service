const validationService = require('../../core/validation/validation.service');
const qrService = require('../../core/qr/qr.service');
const offlineService = require('../../core/offline/offline.service');
const { 
  successResponse, 
  createdResponse, 
  validationResponse,
  scanResponse,
  statsResponse,
  offlineResponse,
  notFoundResponse,
  errorResponse,
  validationErrorResponse,
  qrErrorResponse,
  offlineErrorResponse
} = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Contrôleur pour la validation de tickets
 * Gère la validation en temps réel et offline des tickets
 */
class ScansController {
  /**
   * Valide un ticket à partir de données QR code
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

      // Décoder le QR code
      const decodeResult = await qrService.decodeQRCode(qrCode);
      
      if (!decodeResult.success) {
        return res.status(400).json(
          qrErrorResponse(decodeResult.error, decodeResult.code)
        );
      }

      // Valider le ticket
      const validationResult = await validationService.validateTicket(
        decodeResult.data,
        {
          ...scanContext,
          userId: req.user?.id,
          timestamp: new Date().toISOString()
        }
      );

      if (!validationResult.success) {
        return res.status(400).json(
          validationErrorResponse(validationResult.error, validationResult.code)
        );
      }

      return res.status(200).json(
        validationResponse(validationResult)
      );
    } catch (error) {
      logger.error('Failed to validate ticket', {
        error: error.message,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Échec de la validation du ticket', null, 'TICKET_VALIDATION_FAILED')
      );
    }
  }

  /**
   * Valide un ticket en mode offline
   */
  async validateTicketOffline(req, res) {
    try {
      const { ticketId, scanContext = {} } = req.body;
      
      if (!ticketId) {
        return res.status(400).json(
          validationErrorResponse('ID du ticket requis', 'MISSING_TICKET_ID')
        );
      }

      logger.scan('Starting offline ticket validation', {
        ticketId,
        scanLocation: scanContext.location,
        deviceId: scanContext.deviceId
      });

      const validationResult = await offlineService.validateTicketOffline(
        ticketId,
        {
          ...scanContext,
          userId: req.user?.id,
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
        ticketId: req.body.ticketId,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Échec de la validation offline du ticket', null, 'OFFLINE_VALIDATION_FAILED')
      );
    }
  }

  /**
   * Génère un QR code pour un ticket
   */
  async generateQRCode(req, res) {
    try {
      const { ticketData, options = {} } = req.body;
      
      if (!ticketData || !ticketData.id) {
        return res.status(400).json(
          validationErrorResponse('Données du ticket requises', 'MISSING_TICKET_DATA')
        );
      }

      logger.qr('Generating QR code for ticket', {
        ticketId: ticketData.id,
        eventId: ticketData.eventId,
        type: ticketData.type
      });

      const qrResult = await qrService.generateSecureQRCode(ticketData, options);

      if (!qrResult.success) {
        return res.status(400).json(
          qrErrorResponse(qrResult.error, qrResult.code)
        );
      }

      // Stocker pour validation offline
      await offlineService.storeTicketData(ticketData, {
        qrGenerated: true,
        generatedAt: new Date().toISOString()
      });

      return res.status(201).json(
        createdResponse('QR code généré avec succès', {
          ticketId: ticketData.id,
          qrCode: qrResult.qrCode,
          generatedAt: new Date().toISOString()
        })
      );
    } catch (error) {
      logger.error('Failed to generate QR code', {
        error: error.message,
        ticketId: req.body.ticketData?.id
      });

      return res.status(500).json(
        errorResponse('Échec de la génération du QR code', null, 'QR_GENERATION_FAILED')
      );
    }
  }

  /**
   * Génère des QR codes en lot
   */
  async generateBatchQRCodes(req, res) {
    try {
      const { tickets, options = {} } = req.body;
      
      if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
        return res.status(400).json(
          validationErrorResponse('Liste de tickets requise', 'MISSING_TICKETS_LIST')
        );
      }

      logger.qr('Generating batch QR codes', {
        ticketCount: tickets.length,
        batchSize: options.batchSize
      });

      const batchResult = await qrService.generateBatchQRCodes(tickets, options);

      if (!batchResult.success) {
        return res.status(400).json(
          errorResponse('Échec de la génération en lot des QR codes', null, 'BATCH_QR_GENERATION_FAILED')
        );
      }

      // Stocker tous les tickets pour validation offline
      const storePromises = batchResult.results
        .filter(result => result.success)
        .map(result => 
          offlineService.storeTicketData(
            tickets.find(t => t.id === result.ticketId),
            { qrGenerated: true, generatedAt: new Date().toISOString() }
          )
        );

      await Promise.allSettled(storePromises);

      return res.status(201).json(
        createdResponse('QR codes générés en lot', {
          summary: batchResult.summary,
          results: batchResult.results
        })
      );
    } catch (error) {
      logger.error('Failed to generate batch QR codes', {
        error: error.message,
        ticketCount: req.body.tickets?.length
      });

      return res.status(500).json(
        errorResponse('Échec de la génération en lot des QR codes', null, 'BATCH_QR_GENERATION_FAILED')
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

      logger.scan('Retrieving ticket scan history', {
        ticketId
      });

      const historyData = await validationService.getTicketScanHistory(ticketId);

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

      logger.stats('Retrieving event scan statistics', {
        eventId,
        startDate,
        endDate
      });

      const statsData = await validationService.getEventScanStats(eventId, {
        startDate,
        endDate
      });

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
   * Génère un rapport de validation
   */
  async generateValidationReport(req, res) {
    try {
      const { eventId, startDate, endDate } = req.body;
      
      if (!eventId) {
        return res.status(400).json(
          validationErrorResponse('ID de l\'événement requis', 'MISSING_EVENT_ID')
        );
      }

      logger.stats('Generating validation report', {
        eventId,
        startDate,
        endDate
      });

      const reportData = await validationService.generateValidationReport(eventId, startDate, endDate);

      return res.status(200).json(
        successResponse('Rapport de validation généré', reportData)
      );
    } catch (error) {
      logger.error('Failed to generate validation report', {
        error: error.message,
        eventId: req.body.eventId
      });

      return res.status(500).json(
        errorResponse('Échec de la génération du rapport de validation', null, 'VALIDATION_REPORT_FAILED')
      );
    }
  }

  /**
   * Synchronise les données offline
   */
  async syncOfflineData(req, res) {
    try {
      logger.offline('Starting offline data synchronization');

      const syncResult = await offlineService.syncOfflineData();

      return res.status(200).json(
        successResponse('Synchronisation offline terminée', syncResult)
      );
    } catch (error) {
      logger.error('Failed to sync offline data', {
        error: error.message
      });

      return res.status(500).json(
        syncErrorResponse('Échec de la synchronisation offline', 'SYNC_FAILED')
      );
    }
  }

  /**
   * Récupère les données offline
   */
  async getOfflineData(req, res) {
    try {
      const { ticketId } = req.query;
      
      let offlineData;
      
      if (ticketId) {
        // Données d'un ticket spécifique
        const entry = offlineService.offlineData.get(ticketId);
        if (entry) {
          offlineData = {
            ticketId,
            ...entry
          };
        } else {
          return res.status(404).json(
            notFoundResponse('Données offline', ticketId)
          );
        }
      } else {
        // Toutes les données offline
        const stats = offlineService.getStats();
        offlineData = {
          cache: stats.cache,
          sync: stats.sync,
          data: Array.from(offlineService.offlineData.entries()).map(([id, data]) => ({
            ticketId: id,
            ...data
          }))
        };
      }

      return res.status(200).json(
        offlineResponse(offlineData)
      );
    } catch (error) {
      logger.error('Failed to get offline data', {
        error: error.message,
        ticketId: req.query.ticketId
      });

      return res.status(500).json(
        offlineErrorResponse('Échec de la récupération des données offline', 'OFFLINE_DATA_FAILED')
      );
    }
  }

  /**
   * Nettoie les données expirées
   */
  async cleanupExpiredData(req, res) {
    try {
      logger.offline('Starting cleanup of expired offline data');

      const cleanupResult = await offlineService.cleanupExpiredData();

      return res.status(200).json(
        successResponse('Nettoyage des données expirées terminé', cleanupResult)
      );
    } catch (error) {
      logger.error('Failed to cleanup expired data', {
        error: error.message
      });

      return res.status(500).json(
        offlineErrorResponse('Échec du nettoyage des données expirées', 'CLEANUP_FAILED')
      );
    }
  }

  /**
   * Vérifie la santé du service de scan
   */
  async healthCheck(req, res) {
    try {
      const [validationHealth, qrHealth, offlineHealth] = await Promise.all([
        validationService.healthCheck(),
        qrService.healthCheck(),
        offlineService.healthCheck()
      ]);

      const overallHealthy = validationHealth.healthy && qrHealth.healthy;

      return res.status(200).json(
        successResponse('Service de validation opérationnel', {
          validation: validationHealth,
          qr: qrHealth,
          offline: offlineHealth,
          overall: {
            healthy: overallHealthy,
            services: {
              validation: validationHealth.healthy,
              qr: qrHealth.healthy,
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
      const [validationStats, qrStats, offlineStats] = await Promise.all([
        validationService.getStats(),
        qrService.getStats(),
        offlineService.getStats()
      ]);

      return res.status(200).json(
        successResponse('Statistiques du service de validation', {
          validation: validationStats,
          qr: qrStats,
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

  /**
   * Génère un QR code de test
   */
  async generateTestQRCode(req, res) {
    try {
      const { testData = {} } = req.body;
      
      logger.qr('Generating test QR code');

      const testResult = await qrService.generateTestQRCode(testData);

      if (!testResult.success) {
        return res.status(400).json(
          qrErrorResponse(testResult.error, testResult.code)
        );
      }

      return res.status(201).json(
        createdResponse('QR code de test généré', {
          qrCode: testResult.qrCode
        })
      );
    } catch (error) {
      logger.error('Failed to generate test QR code', {
        error: error.message
      });

      return res.status(500).json(
        errorResponse('Échec de la génération du QR code de test', null, 'TEST_QR_GENERATION_FAILED')
      );
    }
  }

  /**
   * Décode et valide un QR code
   */
  async decodeAndValidateQRCode(req, res) {
    try {
      const { qrCode } = req.body;
      
      if (!qrCode) {
        return res.status(400).json(
          validationErrorResponse('QR code requis', 'MISSING_QR_CODE')
        );
      }

      logger.qr('Decoding and validating QR code');

      // Décoder le QR code
      const decodeResult = await qrService.decodeQRCode(qrCode);
      
      if (!decodeResult.success) {
        return res.status(400).json(
          qrErrorResponse(decodeResult.error, decodeResult.code)
        );
      }

      // Valider le format
      const formatValidation = await qrService.validateQRCodeFormat(qrCode);
      
      if (!formatValidation.success) {
        return res.status(400).json(
          validationErrorResponse(formatValidation.error, formatValidation.code)
        );
      }

      // Valider le ticket
      const validationResult = await validationService.validateTicket(
        decodeResult.data,
        {
          userId: req.user?.id,
          timestamp: new Date().toISOString(),
          testMode: true
        }
      );

      if (!validationResult.success) {
        return res.status(400).json(
          validationErrorResponse(validationResult.error, validationResult.code)
        );
      }

      return res.status(200).json(
        validationResponse(validationResult)
      );
    } catch (error) {
      logger.error('Failed to decode and validate QR code', {
        error: error.message
      });

      return res.status(500).json(
        errorResponse('Échec du décodage et de la validation du QR code', null, 'QR_DECODE_VALIDATION_FAILED')
      );
    }
  }
}

module.exports = new ScansController();
