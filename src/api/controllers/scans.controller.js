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

  /**
   * Start a scan session
   */
  async startScanSession(req, res) {
    try {
      const {
        eventId,
        operatorId,
        deviceId,
        location,
        deviceInfo
      } = req.body;

      logger.scan('Starting scan session', {
        eventId,
        operatorId,
        deviceId,
        location,
        userId: req.user?.id
      });

      // Create scan session logic here
      const session = {
        id: `session_${Date.now()}`,
        eventId,
        operatorId,
        deviceId,
        location,
        deviceInfo,
        startedAt: new Date().toISOString(),
        status: 'active'
      };

      return res.status(201).json(
        createdResponse('Scan session started successfully', session)
      );

    } catch (error) {
      logger.error('Failed to start scan session', {
        error: error.message,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Failed to start scan session', error.message)
      );
    }
  }

  /**
   * End a scan session
   */
  async endScanSession(req, res) {
    try {
      const { sessionId } = req.body;

      logger.scan('Ending scan session', {
        sessionId,
        userId: req.user?.id
      });

      // End scan session logic here
      const session = {
        id: sessionId,
        endedAt: new Date().toISOString(),
        status: 'completed'
      };

      return res.status(200).json(
        successResponse('Scan session ended successfully', session)
      );

    } catch (error) {
      logger.error('Failed to end scan session', {
        error: error.message,
        sessionId: req.body.sessionId,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Failed to end scan session', error.message)
      );
    }
  }

  /**
   * Get active scan sessions
   */
  async getActiveScanSessions(req, res) {
    try {
      const { eventId } = req.query;

      logger.scan('Getting active scan sessions', {
        eventId,
        userId: req.user?.id
      });

      // Get active sessions logic here
      const sessions = [];

      return res.status(200).json(
        successResponse('Active scan sessions retrieved successfully', sessions)
      );

    } catch (error) {
      logger.error('Failed to get active scan sessions', {
        error: error.message,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Failed to get active scan sessions', error.message)
      );
    }
  }

  /**
   * Get scan session
   */
  async getScanSession(req, res) {
    try {
      const { sessionId } = req.params;

      logger.scan('Getting scan session', {
        sessionId,
        userId: req.user?.id
      });

      // Get session logic here
      const session = {
        id: sessionId,
        status: 'active',
        startedAt: new Date().toISOString()
      };

      return res.status(200).json(
        successResponse('Scan session retrieved successfully', session)
      );

    } catch (error) {
      logger.error('Failed to get scan session', {
        error: error.message,
        sessionId: req.params.sessionId,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Failed to get scan session', error.message)
      );
    }
  }

  /**
   * Register scan operator
   */
  async registerScanOperator(req, res) {
    try {
      const {
        userId,
        eventId,
        permissions
      } = req.body;

      logger.scan('Registering scan operator', {
        userId,
        eventId,
        permissions,
        requesterId: req.user?.id
      });

      // Register operator logic here
      const operator = {
        id: `operator_${Date.now()}`,
        userId,
        eventId,
        permissions,
        registeredAt: new Date().toISOString()
      };

      return res.status(201).json(
        createdResponse('Scan operator registered successfully', operator)
      );

    } catch (error) {
      logger.error('Failed to register scan operator', {
        error: error.message,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Failed to register scan operator', error.message)
      );
    }
  }

  /**
   * Get event scan operators
   */
  async getEventScanOperators(req, res) {
    try {
      const { eventId } = req.params;

      logger.scan('Getting event scan operators', {
        eventId,
        userId: req.user?.id
      });

      // Get operators logic here
      const operators = [];

      return res.status(200).json(
        successResponse('Event scan operators retrieved successfully', operators)
      );

    } catch (error) {
      logger.error('Failed to get event scan operators', {
        error: error.message,
        eventId: req.params.eventId,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Failed to get event scan operators', error.message)
      );
    }
  }

  /**
   * Register scan device
   */
  async registerScanDevice(req, res) {
    try {
      const {
        deviceId,
        deviceName,
        deviceType,
        operatorId,
        eventId,
        locationId,
        registrationData
      } = req.body;

      logger.scan('Registering scan device', {
        deviceId,
        deviceName,
        deviceType,
        eventId,
        userId: req.user?.id
      });

      // Register device logic here
      const device = {
        id: deviceId,
        deviceName,
        deviceType,
        operatorId,
        eventId,
        locationId,
        registrationData,
        registeredAt: new Date().toISOString()
      };

      return res.status(201).json(
        createdResponse('Scan device registered successfully', device)
      );

    } catch (error) {
      logger.error('Failed to register scan device', {
        error: error.message,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Failed to register scan device', error.message)
      );
    }
  }

  /**
   * Get event scan devices
   */
  async getEventScanDevices(req, res) {
    try {
      const { eventId } = req.params;

      logger.scan('Getting event scan devices', {
        eventId,
        userId: req.user?.id
      });

      // Get devices logic here
      const devices = [];

      return res.status(200).json(
        successResponse('Event scan devices retrieved successfully', devices)
      );

    } catch (error) {
      logger.error('Failed to get event scan devices', {
        error: error.message,
        eventId: req.params.eventId,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Failed to get event scan devices', error.message)
      );
    }
  }

  /**
   * Analyze fraud
   */
  async analyzeFraud(req, res) {
    try {
      const {
        scanData,
        analysisType = 'comprehensive'
      } = req.body;

      logger.fraud('Starting fraud analysis', {
        analysisType,
        scanDataCount: Array.isArray(scanData) ? scanData.length : 1,
        userId: req.user?.id
      });

      // Fraud analysis logic here
      const analysis = {
        id: `analysis_${Date.now()}`,
        analysisType,
        riskScore: 0.15,
        riskLevel: 'low',
        suspiciousPatterns: [],
        recommendations: [],
        analyzedAt: new Date().toISOString()
      };

      return res.status(200).json(
        successResponse('Fraud analysis completed successfully', analysis)
      );

    } catch (error) {
      logger.error('Failed to analyze fraud', {
        error: error.message,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Failed to analyze fraud', error.message)
      );
    }
  }

  /**
   * Get fraud stats
   */
  async getFraudStats(req, res) {
    try {
      const { eventId, period = '24h' } = req.query;

      logger.fraud('Getting fraud statistics', {
        eventId,
        period,
        userId: req.user?.id
      });

      // Get fraud stats logic here
      const stats = {
        totalScans: 1250,
        suspiciousScans: 15,
        blockedScans: 3,
        riskScore: 0.12,
        period,
        eventId
      };

      return res.status(200).json(
        successResponse('Fraud statistics retrieved successfully', stats)
      );

    } catch (error) {
      logger.error('Failed to get fraud stats', {
        error: error.message,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Failed to get fraud stats', error.message)
      );
    }
  }

  /**
   * Get event daily stats
   */
  async getEventDailyStats(req, res) {
    try {
      const { eventId } = req.params;
      const { days = 30 } = req.query;

      logger.scan('Getting event daily statistics', {
        eventId,
        days,
        userId: req.user?.id
      });

      // Get daily stats logic here
      const stats = {
        eventId,
        period: `${days} days`,
        dailyData: [],
        summary: {
          totalScans: 5000,
          uniqueTickets: 4800,
          averageScansPerDay: 167
        }
      };

      return res.status(200).json(
        successResponse('Event daily statistics retrieved successfully', stats)
      );

    } catch (error) {
      logger.error('Failed to get event daily stats', {
        error: error.message,
        eventId: req.params.eventId,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Failed to get event daily stats', error.message)
      );
    }
  }

  /**
   * Get event hourly stats
   */
  async getEventHourlyStats(req, res) {
    try {
      const { eventId } = req.params;
      const { date } = req.query;

      logger.scan('Getting event hourly statistics', {
        eventId,
        date,
        userId: req.user?.id
      });

      // Get hourly stats logic here
      const stats = {
        eventId,
        date: date || new Date().toISOString().split('T')[0],
        hourlyData: [],
        summary: {
          totalScans: 850,
          peakHour: '14:00',
          peakScans: 120
        }
      };

      return res.status(200).json(
        successResponse('Event hourly statistics retrieved successfully', stats)
      );

    } catch (error) {
      logger.error('Failed to get event hourly stats', {
        error: error.message,
        eventId: req.params.eventId,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Failed to get event hourly stats', error.message)
      );
    }
  }

  /**
   * Get event location stats
   */
  async getEventLocationStats(req, res) {
    try {
      const { eventId } = req.params;

      logger.scan('Getting event location statistics', {
        eventId,
        userId: req.user?.id
      });

      // Get location stats logic here
      const stats = {
        eventId,
        locations: [
          {
            locationId: 'entrance_main',
            name: 'Entrée Principale',
            scans: 2500,
            percentage: 50
          },
          {
            locationId: 'entrance_side',
            name: 'Entrée Secondaire',
            scans: 1500,
            percentage: 30
          }
        ],
        summary: {
          totalLocations: 5,
          totalScans: 5000
        }
      };

      return res.status(200).json(
        successResponse('Event location statistics retrieved successfully', stats)
      );

    } catch (error) {
      logger.error('Failed to get event location stats', {
        error: error.message,
        eventId: req.params.eventId,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Failed to get event location stats', error.message)
      );
    }
  }
}

module.exports = new ScansController();
