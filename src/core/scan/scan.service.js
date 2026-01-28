const crypto = require('crypto');
const scanRepository = require('../database/scan.repository');
const logger = require('../../utils/logger');

/**
 * Service de gestion des scans
 * Responsabilité : Gestion des sessions, logs, cache et détection de fraude
 */
class ScanService {
  constructor() {
    // Configuration
    this.maxScansPerTicket = parseInt(process.env.MAX_SCANS_PER_TICKET) || 5;
    this.fraudDetectionEnabled = process.env.FRAUD_DETECTION_ENABLED === 'true';
    this.blockOnFraud = process.env.BLOCK_ON_FRAUD === 'true';
    
    // Cache en mémoire pour les vérifications rapides
    this.ticketCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    
    // Statistiques
    this.stats = {
      totalSessions: 0,
      activeSessions: 0,
      totalScans: 0,
      fraudAttempts: 0,
      blockedTickets: 0
    };

    // Nettoyage périodique du cache
    this.startCacheCleanup();
  }

  /**
   * Démarre une nouvelle session de scan
   * @param {Object} sessionData - Données de la session
   * @returns {Promise<Object>} Session créée
   */
  async startScanSession(sessionData) {
    try {
      logger.scan('Starting scan session', {
        operatorId: sessionData.operatorId,
        location: sessionData.location,
        deviceId: sessionData.deviceInfo?.deviceId
      });

      const session = await scanRepository.createScanSession({
        operatorId: sessionData.operatorId,
        location: sessionData.location,
        deviceInfo: sessionData.deviceInfo,
        createdBy: sessionData.createdBy
      });

      this.stats.totalSessions++;
      this.stats.activeSessions++;

      logger.scan('Scan session started successfully', {
        sessionId: session.id,
        uid: session.uid
      });

      return {
        success: true,
        session: {
          id: session.id,
          uid: session.uid,
          startedAt: session.started_at,
          location: session.location,
          deviceInfo: session.device_info
        }
      };
    } catch (error) {
      logger.error('Failed to start scan session', {
        error: error.message,
        operatorId: sessionData.operatorId
      });

      return {
        success: false,
        error: 'Échec du démarrage de la session de scan',
        code: 'SESSION_START_FAILED'
      };
    }
  }

  /**
   * Termine une session de scan
   * @param {number} sessionId - ID de la session
   * @param {Object} endData - Données de fin
   * @returns {Promise<Object>} Session terminée
   */
  async endScanSession(sessionId, endData = {}) {
    try {
      logger.scan('Ending scan session', { sessionId });

      const session = await scanRepository.endScanSession(sessionId, {
        updatedBy: endData.updatedBy
      });

      this.stats.activeSessions = Math.max(0, this.stats.activeSessions - 1);

      logger.scan('Scan session ended successfully', {
        sessionId,
        uid: session.uid,
        duration: session.ended_at - session.started_at
      });

      return {
        success: true,
        session: {
          id: session.id,
          uid: session.uid,
          startedAt: session.started_at,
          endedAt: session.ended_at
        }
      };
    } catch (error) {
      logger.error('Failed to end scan session', {
        error: error.message,
        sessionId
      });

      return {
        success: false,
        error: 'Échec de la fin de la session de scan',
        code: 'SESSION_END_FAILED'
      };
    }
  }

  /**
   * Enregistre un scan complet avec toutes ses validations
   * @param {Object} scanData - Données complètes du scan
   * @returns {Promise<Object>} Résultat de l'enregistrement
   */
  async recordScan(scanData) {
    try {
      logger.scan('Recording scan', {
        validationId: scanData.validationId,
        ticketId: scanData.ticketId,
        result: scanData.result
      });

      this.stats.totalScans++;

      // Étape 1: Enregistrer le log de scan
      const scanLog = await scanRepository.createScanLog({
        sessionId: scanData.sessionId,
        scannedAt: scanData.timestamp,
        result: scanData.result.toUpperCase(),
        location: scanData.scanContext?.location,
        deviceId: scanData.scanContext?.deviceId,
        ticketId: scanData.ticketId,
        ticketData: scanData.qrMetadata,
        validationDetails: {
          validationId: scanData.validationId,
          validationTime: scanData.validationTime,
          businessValidation: scanData.businessValidation
        },
        fraudFlags: scanData.fraudFlags,
        createdBy: scanData.scanContext?.userId
      });

      // Étape 2: Mettre à jour le cache des tickets scannés
      await this.updateTicketCache(scanData);

      // Étape 3: Gérer la détection de fraude si nécessaire
      if (scanData.fraudFlags && this.fraudDetectionEnabled) {
        await this.handleFraudDetection(scanLog.id, scanData.fraudFlags, scanData);
      }

      logger.scan('Scan recorded successfully', {
        scanLogId: scanLog.id,
        uid: scanLog.uid,
        ticketId: scanData.ticketId,
        result: scanData.result
      });

      return {
        success: true,
        scanLog: {
          id: scanLog.id,
          uid: scanLog.uid,
          scannedAt: scanLog.scanned_at,
          result: scanLog.result
        }
      };
    } catch (error) {
      logger.error('Failed to record scan', {
        error: error.message,
        validationId: scanData.validationId,
        ticketId: scanData.ticketId
      });

      return {
        success: false,
        error: 'Échec de l\'enregistrement du scan',
        code: 'SCAN_RECORD_FAILED'
      };
    }
  }

  /**
   * Met à jour le cache des tickets scannés
   * @param {Object} scanData - Données du scan
   * @returns {Promise<void>}
   */
  async updateTicketCache(scanData) {
    try {
      // Vérifier d'abord dans le cache mémoire
      const cacheKey = scanData.ticketId.toString();
      const cached = this.ticketCache.get(cacheKey);

      let scanCount = 1;
      let scanLocations = [scanData.scanContext?.location].filter(Boolean);

      if (cached) {
        scanCount = cached.scanCount + 1;
        scanLocations = [...new Set([...cached.scanLocations, ...scanLocations])];
      }

      // Mettre à jour le cache mémoire
      this.ticketCache.set(cacheKey, {
        ticketId: scanData.ticketId,
        scanCount,
        scanLocations,
        lastScan: new Date(),
        isBlocked: cached?.isBlocked || false
      });

      // Mettre à jour la base de données
      const isBlocked = scanCount > this.maxScansPerTicket;
      
      await scanRepository.updateScannedTicketCache({
        ticketId: scanData.ticketId,
        firstScanAt: cached?.firstScan || scanData.timestamp,
        lastScanAt: scanData.timestamp,
        scanCount: 1, // La DB gère l'incrémentation
        scanLocations,
        isBlocked,
        blockReason: isBlocked ? 'Trop de scans' : null
      });

      if (isBlocked && !cached?.isBlocked) {
        this.stats.blockedTickets++;
        logger.warn('Ticket blocked due to excessive scans', {
          ticketId: scanData.ticketId,
          scanCount,
          maxAllowed: this.maxScansPerTicket
        });
      }
    } catch (error) {
      logger.error('Failed to update ticket cache', {
        error: error.message,
        ticketId: scanData.ticketId
      });
    }
  }

  /**
   * Gère la détection de fraude
   * @param {number} scanLogId - ID du log de scan
   * @param {Object} fraudFlags - Indicateurs de fraude
   * @param {Object} scanData - Données du scan
   * @returns {Promise<void>}
   */
  async handleFraudDetection(scanLogId, fraudFlags, scanData) {
    try {
      this.stats.fraudAttempts++;

      const fraudAttempt = await scanRepository.createFraudAttempt({
        scanLogId,
        fraudType: fraudFlags.type,
        severity: fraudFlags.severity || 'MEDIUM',
        details: {
          ...fraudFlags.details,
          ticketId: scanData.ticketId,
          eventId: scanData.eventId,
          scanContext: scanData.scanContext
        },
        ipAddress: scanData.scanContext?.ipAddress,
        userAgent: scanData.scanContext?.userAgent,
        blocked: this.blockOnFraud && fraudFlags.severity === 'HIGH',
        createdBy: scanData.scanContext?.userId
      });

      logger.warn('Fraud attempt detected and recorded', {
        fraudAttemptId: fraudAttempt.id,
        fraudType: fraudFlags.type,
        severity: fraudFlags.severity,
        ticketId: scanData.ticketId,
        blocked: fraudAttempt.blocked
      });

      // Bloquer le ticket si la fraude est sévère
      if (this.blockOnFraud && fraudFlags.severity === 'HIGH') {
        await this.blockTicket(scanData.ticketId, 'Fraude détectée');
      }
    } catch (error) {
      logger.error('Failed to handle fraud detection', {
        error: error.message,
        scanLogId,
        fraudType: fraudFlags.type
      });
    }
  }

  /**
   * Bloque un ticket dans le cache
   * @param {number} ticketId - ID du ticket
   * @param {string} reason - Raison du blocage
   * @returns {Promise<void>}
   */
  async blockTicket(ticketId, reason) {
    try {
      await scanRepository.updateScannedTicketCache({
        ticketId,
        isBlocked: true,
        blockReason: reason,
        scanCount: 0, // Ne pas incrémenter
        scanLocations: [],
        lastScanAt: new Date()
      });

      // Mettre à jour le cache mémoire
      const cacheKey = ticketId.toString();
      const cached = this.ticketCache.get(cacheKey);
      if (cached) {
        cached.isBlocked = true;
        cached.blockReason = reason;
      }

      logger.warn('Ticket blocked', {
        ticketId,
        reason
      });
    } catch (error) {
      logger.error('Failed to block ticket', {
        error: error.message,
        ticketId,
        reason
      });
    }
  }

  /**
   * Vérifie si un ticket est bloqué
   * @param {number} ticketId - ID du ticket
   * @returns {Promise<Object>} État du ticket
   */
  async checkTicketStatus(ticketId) {
    try {
      // Vérifier d'abord dans le cache mémoire
      const cacheKey = ticketId.toString();
      const cached = this.ticketCache.get(cacheKey);

      if (cached && (Date.now() - cached.lastScan.getTime() < this.cacheTimeout)) {
        return {
          isBlocked: cached.isBlocked,
          scanCount: cached.scanCount,
          blockReason: cached.blockReason,
          source: 'memory_cache'
        };
      }

      // Vérifier dans la base de données
      const dbCache = await scanRepository.getTicketCache(ticketId);

      if (dbCache) {
        // Mettre à jour le cache mémoire
        this.ticketCache.set(cacheKey, {
          ticketId: dbCache.ticketId,
          scanCount: dbCache.scanCount,
          scanLocations: dbCache.scanLocations,
          lastScan: new Date(),
          isBlocked: dbCache.isBlocked,
          blockReason: dbCache.blockReason
        });

        return {
          isBlocked: dbCache.isBlocked,
          scanCount: dbCache.scanCount,
          blockReason: dbCache.blockReason,
          source: 'database'
        };
      }

      // Ticket jamais scanné
      return {
        isBlocked: false,
        scanCount: 0,
        blockReason: null,
        source: 'not_found'
      };
    } catch (error) {
      logger.error('Failed to check ticket status', {
        error: error.message,
        ticketId
      });

      return {
        isBlocked: false,
        scanCount: 0,
        blockReason: null,
        source: 'error',
        error: error.message
      };
    }
  }

  /**
   * Récupère l'historique des scans pour un ticket
   * @param {number} ticketId - ID du ticket
   * @param {Object} options - Options de pagination
   * @returns {Promise<Object>} Historique des scans
   */
  async getTicketScanHistory(ticketId, options = {}) {
    try {
      const history = await scanRepository.getTicketScanHistory(ticketId, options);

      logger.scan('Ticket scan history retrieved', {
        ticketId,
        scanCount: history.scans.length,
        total: history.pagination.total
      });

      return {
        success: true,
        ...history
      };
    } catch (error) {
      logger.error('Failed to get ticket scan history', {
        error: error.message,
        ticketId
      });

      return {
        success: false,
        error: 'Échec de la récupération de l\'historique des scans',
        code: 'HISTORY_RETRIEVAL_FAILED'
      };
    }
  }

  /**
   * Récupère les statistiques de scan pour un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} filters - Filtres temporels
   * @returns {Promise<Object>} Statistiques
   */
  async getEventScanStats(eventId, filters = {}) {
    try {
      const stats = await scanRepository.getEventScanStats(eventId, filters);

      logger.scan('Event scan stats retrieved', {
        eventId,
        totalScans: stats.totalScans,
        uniqueTickets: stats.uniqueTickets
      });

      return {
        success: true,
        ...stats
      };
    } catch (error) {
      logger.error('Failed to get event scan stats', {
        error: error.message,
        eventId
      });

      return {
        success: false,
        error: 'Échec de la récupération des statistiques de scan',
        code: 'STATS_RETRIEVAL_FAILED'
      };
    }
  }

  /**
   * Récupère les sessions de scan actives
   * @param {Object} filters - Filtres
   * @returns {Promise<Object>} Sessions actives
   */
  async getActiveScanSessions(filters = {}) {
    try {
      const sessions = await scanRepository.getActiveScanSessions(filters);

      logger.scan('Active scan sessions retrieved', {
        sessionCount: sessions.length,
        filters
      });

      return {
        success: true,
        sessions: sessions.map(session => ({
          id: session.id,
          uid: session.uid,
          startedAt: session.startedAt,
          operatorId: session.operatorId,
          location: session.location,
          deviceInfo: session.deviceInfo
        }))
      };
    } catch (error) {
      logger.error('Failed to get active scan sessions', {
        error: error.message,
        filters
      });

      return {
        success: false,
        error: 'Échec de la récupération des sessions actives',
        code: 'ACTIVE_SESSIONS_RETRIEVAL_FAILED'
      };
    }
  }

  /**
   * Nettoie les anciennes données de scan
   * @param {Object} cleanupOptions - Options de nettoyage
   * @returns {Promise<Object>} Résultat du nettoyage
   */
  async cleanupOldScans(cleanupOptions = {}) {
    try {
      const result = await scanRepository.cleanupOldScans(cleanupOptions);

      logger.scan('Old scans cleaned up', {
        retentionDays: cleanupOptions.retentionDays,
        totalCleaned: result.totalCleaned
      });

      return {
        success: true,
        ...result
      };
    } catch (error) {
      logger.error('Failed to cleanup old scans', {
        error: error.message,
        retentionDays: cleanupOptions.retentionDays
      });

      return {
        success: false,
        error: 'Échec du nettoyage des anciens scans',
        code: 'CLEANUP_FAILED'
      };
    }
  }

  /**
   * Démarre le nettoyage périodique du cache
   */
  startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [key, value] of this.ticketCache.entries()) {
        if (now - value.lastScan.getTime() > this.cacheTimeout) {
          this.ticketCache.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.scan('Cache cleanup completed', {
          cleanedCount,
          remainingEntries: this.ticketCache.size
        });
      }
    }, this.cacheTimeout);
  }

  /**
   * Vérifie l'état de santé du service de scan
   * @returns {Promise<Object>} État de santé
   */
  async healthCheck() {
    try {
      const dbHealth = await scanRepository.healthCheck();

      return {
        success: true,
        healthy: dbHealth.healthy,
        components: {
          database: dbHealth,
          cache: {
            size: this.ticketCache.size,
            timeout: this.cacheTimeout
          }
        },
        stats: this.stats,
        config: {
          maxScansPerTicket: this.maxScansPerTicket,
          fraudDetectionEnabled: this.fraudDetectionEnabled,
          blockOnFraud: this.blockOnFraud
        }
      };
    } catch (error) {
      logger.error('Scan service health check failed', {
        error: error.message
      });

      return {
        success: false,
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Retourne les statistiques du service de scan
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      stats: this.stats,
      cache: {
        size: this.ticketCache.size,
        timeout: this.cacheTimeout
      },
      config: {
        maxScansPerTicket: this.maxScansPerTicket,
        fraudDetectionEnabled: this.fraudDetectionEnabled,
        blockOnFraud: this.blockOnFraud
      }
    };
  }

  /**
   * Réinitialise les statistiques (pour les tests)
   */
  resetStats() {
    this.stats = {
      totalSessions: 0,
      activeSessions: 0,
      totalScans: 0,
      fraudAttempts: 0,
      blockedTickets: 0
    };

    logger.info('Scan service stats reset');
  }
}

module.exports = new ScanService();
