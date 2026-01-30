const axios = require('axios');
const CircuitBreaker = require('opossum');
const logger = require('../../utils/logger');

/**
 * Client HTTP pour communiquer avec event-planner-core
 * Responsabilité : Interface unique et sécurisée avec le service core
 */
class EventCoreClient {
  constructor() {
    // Configuration de base
    this.baseURL = process.env.EVENT_CORE_SERVICE_URL || 'http://localhost:3001';
    this.timeout = parseInt(process.env.EVENT_CORE_TIMEOUT) || 10000; // 10s
    this.retries = parseInt(process.env.EVENT_CORE_RETRIES) || 2;
    
    // Configuration du circuit breaker
    this.circuitBreakerOptions = {
      timeout: this.timeout,
      errorThresholdPercentage: 50,
      resetTimeout: 30000, // 30s
      rollingCountTimeout: 60000, // 1min
      rollingCountBuckets: 10
    };

    // Créer le client HTTP
    this.httpClient = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'scan-validation-service/1.0'
      }
    });

    // Configurer le circuit breaker pour chaque endpoint
    this.setupCircuitBreakers();
    
    // Configurer les intercepteurs
    this.setupInterceptors();

    logger.info('EventCore client initialized', {
      baseURL: this.baseURL,
      timeout: this.timeout,
      retries: this.retries
    });
  }

  /**
   * Configure les circuit breakers pour les différents endpoints
   */
  setupCircuitBreakers() {
    // Circuit breaker pour la validation de tickets
    this.validateTicketBreaker = new CircuitBreaker(
      this.validateTicketRequest.bind(this),
      this.circuitBreakerOptions
    );

    // Circuit breaker pour la validation d'événements
    this.validateEventBreaker = new CircuitBreaker(
      this.validateEventRequest.bind(this),
      this.circuitBreakerOptions
    );

    // Circuit breaker pour la vérification de statut de ticket
    this.checkTicketStatusBreaker = new CircuitBreaker(
      this.checkTicketStatusRequest.bind(this),
      this.circuitBreakerOptions
    );

    // Circuit breaker pour l'enregistrement de scans
    this.recordScanBreaker = new CircuitBreaker(
      this.recordScanRequest.bind(this),
      this.circuitBreakerOptions
    );

    // Configurer les événements du circuit breaker
    Object.values([
      this.validateTicketBreaker,
      this.validateEventBreaker,
      this.checkTicketStatusBreaker,
      this.recordScanBreaker
    ]).forEach(breaker => {
      breaker.on('open', () => {
        logger.warn('Circuit breaker opened for EventCore client');
      });

      breaker.on('halfOpen', () => {
        logger.info('Circuit breaker half-open for EventCore client');
      });

      breaker.on('close', () => {
        logger.info('Circuit breaker closed for EventCore client');
      });

      breaker.on('fallback', (result) => {
        logger.warn('Circuit breaker fallback triggered', { result });
      });
    });
  }

  /**
   * Configure les intercepteurs HTTP
   */
  setupInterceptors() {
    // Intercepteur de requête
    this.httpClient.interceptors.request.use(
      (config) => {
        logger.http('EventCore request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: config.headers
        });

        // Ajouter des métadonnées de service
        config.headers['X-Service-Name'] = 'scan-validation-service';
        config.headers['X-Request-ID'] = this.generateRequestId();
        config.headers['X-Timestamp'] = new Date().toISOString();

        return config;
      },
      (error) => {
        logger.error('EventCore request interceptor error', {
          error: error.message
        });
        return Promise.reject(error);
      }
    );

    // Intercepteur de réponse
    this.httpClient.interceptors.response.use(
      (response) => {
        logger.http('EventCore response', {
          status: response.status,
          url: response.config.url,
          duration: Date.now() - response.config.metadata?.startTime
        });

        return response;
      },
      (error) => {
        logger.error('EventCore response error', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message,
          duration: Date.now() - error.config?.metadata?.startTime
        });

        return Promise.reject(error);
      }
    );
  }

  /**
   * Génère un ID de requête unique
   * @returns {string} ID de requête
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
 * Valide un ticket via event-planner-core (ARCHITECTURE CORRIGÉE)
 * 
 * IMPORTANT : Ce client appelle les routes INTERNES d'Event-Planner-Core
 * pour éviter les appels circulaires. Event-Planner-Core effectue la validation
 * métier LOCALE et retourne le résultat sans appeler en retour.
 * 
 * @param {Object} ticketData - Données du ticket validées par QR decoder
 * @param {Object} scanContext - Contexte du scan
 * @returns {Promise<Object>} Résultat de la validation
 */
async validateTicket(ticketData, scanContext) {
  try {
    logger.core('Validating ticket via EventCore (INTERNAL ROUTE)', {
      ticketId: ticketData.ticketId,
      eventId: ticketData.eventId,
      scanLocation: scanContext.location
    });

    const payload = {
      ticketId: ticketData.ticketId,
      eventId: ticketData.eventId,
      ticketType: ticketData.ticketType,
      userId: ticketData.userId,
      scanContext: {
        location: scanContext.location,
        deviceId: scanContext.deviceId,
        timestamp: scanContext.timestamp || new Date().toISOString(),
        operatorId: scanContext.operatorId,
        checkpointId: scanContext.checkpointId
      },
      validationMetadata: {
        qrVersion: ticketData.version,
        qrAlgorithm: ticketData.algorithm,
        validatedAt: ticketData.validationInfo?.validatedAt
      }
    };

    // CORRIGÉ : Appel aux routes INTERNES d'Event-Planner-Core
    const result = await this.validateTicketBreaker.fire(payload);

    logger.core('Ticket validation successful via INTERNAL route', {
      ticketId: ticketData.ticketId,
      result: result.data?.success,
      processingTime: result.responseTime
    });

    // Normalisation du résultat pour compatibilité avec Scan-Validation Service
    return {
      success: true,
      data: result.data?.data || result.data, // Gérer les deux formats de réponse possibles
      metadata: {
        responseTime: result.responseTime,
        requestId: result.requestId,
        validationType: 'INTERNAL_BUSINESS_VALIDATION'
      }
    };

  } catch (error) {
      logger.error('Ticket validation failed via EventCore', {
        ticketId: ticketData.ticketId,
        error: error.message,
        circuitBreakerState: this.validateTicketBreaker.stats?.state
      });

      // Gérer les erreurs selon le type
      if (error.response) {
        // Erreur HTTP du service
        return {
          success: false,
          error: 'Erreur de validation du ticket',
          code: this.mapHttpErrorToValidationCode(error.response.status),
          details: error.response.data,
          httpStatus: error.response.status
        };
      } else if (error.code === 'EOPENBREAKER') {
        // Circuit breaker ouvert
        return {
          success: false,
          error: 'Service de validation indisponible',
          code: 'CORE_SERVICE_UNAVAILABLE',
          details: { reason: 'circuit_breaker_open' }
        };
      } else {
        // Erreur réseau ou autre
        return {
          success: false,
          error: 'Erreur de communication avec le service core',
          code: 'CORE_COMMUNICATION_ERROR',
          details: { technical: error.message }
        };
      }
    }
  }

  /**
   * Valide un événement via event-planner-core
   * @param {string} eventId - ID de l'événement
   * @returns {Promise<Object>} Résultat de la validation
   */
  async validateEvent(eventId) {
    try {
      logger.core('Validating event via EventCore', { eventId });

      const result = await this.validateEventBreaker.fire(eventId);

      logger.core('Event validation successful', {
        eventId,
        status: result.data?.status
      });

      return {
        success: true,
        data: result.data
      };

    } catch (error) {
      logger.error('Event validation failed via EventCore', {
        eventId,
        error: error.message
      });

      if (error.response) {
        return {
          success: false,
          error: 'Erreur de validation de l\'événement',
          code: this.mapHttpErrorToValidationCode(error.response.status),
          details: error.response.data
        };
      } else if (error.code === 'EOPENBREAKER') {
        return {
          success: false,
          error: 'Service de validation indisponible',
          code: 'CORE_SERVICE_UNAVAILABLE'
        };
      } else {
        return {
          success: false,
          error: 'Erreur de communication avec le service core',
          code: 'CORE_COMMUNICATION_ERROR'
        };
      }
    }
  }

  /**
   * Vérifie le statut d'un ticket via event-planner-core
   * @param {string} ticketId - ID du ticket
   * @returns {Promise<Object>} Statut du ticket
   */
  async checkTicketStatus(ticketId) {
    try {
      logger.core('Checking ticket status via EventCore', { ticketId });

      const result = await this.checkTicketStatusBreaker.fire(ticketId);

      return {
        success: true,
        data: result.data
      };

    } catch (error) {
      logger.error('Ticket status check failed via EventCore', {
        ticketId,
        error: error.message
      });

      if (error.response) {
        return {
          success: false,
          error: 'Erreur de vérification du statut du ticket',
          code: this.mapHttpErrorToValidationCode(error.response.status),
          details: error.response.data
        };
      } else {
        return {
          success: false,
          error: 'Erreur de communication avec le service core',
          code: 'CORE_COMMUNICATION_ERROR'
        };
      }
    }
  }

  /**
   * Enregistre un scan via event-planner-core
   * @param {Object} scanData - Données du scan à enregistrer
   * @returns {Promise<Object>} Résultat de l'enregistrement
   */
  async recordScan(scanData) {
    try {
      logger.core('Recording scan via EventCore', {
        ticketId: scanData.ticketId,
        scanResult: scanData.result
      });

      const result = await this.recordScanBreaker.fire(scanData);

      return {
        success: true,
        data: result.data
      };

    } catch (error) {
      logger.error('Scan recording failed via EventCore', {
        ticketId: scanData.ticketId,
        error: error.message
      });

      // L'échec d'enregistrement ne doit pas bloquer la validation
      logger.warn('Scan recording failed but validation continues', {
        ticketId: scanData.ticketId
      });

      return {
        success: false,
        error: 'Erreur d\'enregistrement du scan (non bloquant)',
        code: 'SCAN_RECORDING_FAILED',
        nonBlocking: true
      };
    }
  }

  /**
   * Implémentation de la requête de validation de ticket
   * @param {Object} payload - Données de la requête
   * @returns {Promise<Object>} Réponse du service
   */
  async validateTicketRequest(payload) {
    const startTime = Date.now();
    
    try {
      const response = await this.httpClient.post('/api/internal/validation/validate-ticket', payload);
      
      return {
        data: response.data,
        responseTime: Date.now() - startTime,
        requestId: response.config.headers['X-Request-ID']
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Implémentation de la requête de validation d'événement
   * @param {string} eventId - ID de l'événement
   * @returns {Promise<Object>} Réponse du service
   */
  async validateEventRequest(eventId) {
    const startTime = Date.now();
    
    try {
      const response = await this.httpClient.get(`/api/internal/events/${eventId}/validate`);
      
      return {
        data: response.data,
        responseTime: Date.now() - startTime,
        requestId: response.config.headers['X-Request-ID']
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Implémentation de la requête de vérification de statut de ticket
   * @param {string} ticketId - ID du ticket
   * @returns {Promise<Object>} Réponse du service
   */
  async checkTicketStatusRequest(ticketId) {
    const startTime = Date.now();
    
    try {
      const response = await this.httpClient.get(`/api/internal/tickets/${ticketId}/status`);
      
      return {
        data: response.data,
        responseTime: Date.now() - startTime,
        requestId: response.config.headers['X-Request-ID']
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Implémentation de la requête d'enregistrement de scan
   * @param {Object} scanData - Données du scan
   * @returns {Promise<Object>} Réponse du service
   */
  async recordScanRequest(scanData) {
    const startTime = Date.now();
    
    try {
      const response = await this.httpClient.post('/api/internal/scans/record', scanData);
      
      return {
        data: response.data,
        responseTime: Date.now() - startTime,
        requestId: response.config.headers['X-Request-ID']
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mappe les codes d'erreur HTTP vers les codes de validation
   * @param {number} httpStatus - Code d'erreur HTTP
   * @returns {string} Code de validation correspondant
   */
  mapHttpErrorToValidationCode(httpStatus) {
    const errorMapping = {
      400: 'INVALID_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
      504: 'TIMEOUT'
    };

    return errorMapping[httpStatus] || 'UNKNOWN_ERROR';
  }

  /**
   * Vérifie l'état de santé du client et du service distant
   * @returns {Promise<Object>} État de santé
   */
  async healthCheck() {
    try {
      const startTime = Date.now();
      
      // Vérifier l'état des circuit breakers
      const circuitBreakerStats = {
        validateTicket: {
          state: this.validateTicketBreaker.stats?.state,
          failures: this.validateTicketBreaker.stats?.failures,
          successes: this.validateTicketBreaker.stats?.successes
        },
        validateEvent: {
          state: this.validateEventBreaker.stats?.state,
          failures: this.validateEventBreaker.stats?.failures,
          successes: this.validateEventBreaker.stats?.successes
        },
        checkTicketStatus: {
          state: this.checkTicketStatusBreaker.stats?.state,
          failures: this.checkTicketStatusBreaker.stats?.failures,
          successes: this.checkTicketStatusBreaker.stats?.successes
        },
        recordScan: {
          state: this.recordScanBreaker.stats?.state,
          failures: this.recordScanBreaker.stats?.failures,
          successes: this.recordScanBreaker.stats?.successes
        }
      };

      // Tester la connectivité avec le service core
      const response = await this.httpClient.get('/api/health', {
        timeout: 5000
      });

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        healthy: true,
        config: {
          baseURL: this.baseURL,
          timeout: this.timeout,
          retries: this.retries
        },
        connectivity: {
          reachable: true,
          responseTime,
          status: response.status
        },
        circuitBreakers: circuitBreakerStats
      };

    } catch (error) {
      logger.error('EventCore client health check failed', {
        error: error.message
      });

      return {
        success: false,
        healthy: false,
        error: error.message,
        config: {
          baseURL: this.baseURL,
          timeout: this.timeout,
          retries: this.retries
        }
      };
    }
  }

  /**
   * Retourne les statistiques du client
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      config: {
        baseURL: this.baseURL,
        timeout: this.timeout,
        retries: this.retries
      },
      circuitBreakers: {
        validateTicket: this.validateTicketBreaker.stats,
        validateEvent: this.validateEventBreaker.stats,
        checkTicketStatus: this.checkTicketStatusBreaker.stats,
        recordScan: this.recordScanBreaker.stats
      }
    };
  }
}

module.exports = new EventCoreClient();
