const { Pool } = require('pg');
const logger = require('../../utils/logger');

/**
 * Repository pour les opérations de base de données des scans
 * Responsabilité : Persistance des données de scan et statistiques
 */
class ScanRepository {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.DB_POOL_MAX) || 20,
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
    });

    // Gérer les erreurs de pool
    this.pool.on('error', (err) => {
      logger.error('Database pool error', {
        error: err.message,
        stack: err.stack
      });
    });

    logger.info('Scan repository initialized', {
      maxConnections: this.pool.options.max,
      idleTimeout: this.pool.options.idleTimeoutMillis
    });
  }

  /**
   * Crée une nouvelle session de scan
   * @param {Object} sessionData - Données de la session
   * @returns {Promise<Object>} Session créée
   */
  async createScanSession(sessionData) {
    try {
      const query = `
        INSERT INTO scan_sessions (
          uid, scan_operator_id, event_id, location, device_info, created_by
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5
        ) RETURNING id, uid, started_at, device_info, location, event_id
      `;

      const values = [
        sessionData.operatorId,
        sessionData.eventId || null,
        sessionData.location,
        JSON.stringify(sessionData.deviceInfo || {}),
        sessionData.createdBy
      ];

      const result = await this.pool.query(query, values);
      const session = result.rows[0];

      logger.database('Scan session created', {
        sessionId: session.id,
        uid: session.uid,
        operatorId: sessionData.operatorId,
        eventId: sessionData.eventId || null
      });

      return session;
    } catch (error) {
      logger.error('Failed to create scan session', {
        error: error.message,
        operatorId: sessionData.operatorId
      });
      throw new Error('Échec de la création de la session de scan');
    }
  }

  /**
   * Termine une session de scan
   * @param {number} sessionId - ID de la session
   * @param {Object} endData - Données de fin
   * @returns {Promise<Object>} Session mise à jour
   */
  async endScanSession(sessionId, endData = {}) {
    try {
      const query = `
        UPDATE scan_sessions 
        SET ended_at = NOW(), updated_by = $2
        WHERE id = $1 AND ended_at IS NULL
        RETURNING id, uid, started_at, ended_at
      `;

      const result = await this.pool.query(query, [sessionId, endData.updatedBy]);
      
      if (result.rows.length === 0) {
        throw new Error('Session non trouvée ou déjà terminée');
      }

      logger.database('Scan session ended', {
        sessionId,
        uid: result.rows[0].uid
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to end scan session', {
        error: error.message,
        sessionId
      });
      throw new Error('Échec de la fin de la session de scan');
    }
  }

  /**
   * Enregistre un log de scan
   * @param {Object} scanLogData - Données du log de scan
   * @returns {Promise<Object>} Log de scan créé
   */
  async createScanLog(scanLogData) {
    try {
      const query = `
        INSERT INTO scan_logs (
          uid, scan_session_id, scanned_at, result, location, device_id,
          ticket_id, ticket_data, validation_details, fraud_flags, created_by
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) RETURNING id, uid, scanned_at, result, ticket_id
      `;

      const values = [
        scanLogData.sessionId, // CORRIGÉ: Peut être null
        scanLogData.scannedAt || new Date(),
        scanLogData.result,
        scanLogData.location,
        scanLogData.deviceId,
        scanLogData.ticketId,
        JSON.stringify(scanLogData.ticketData || {}),
        JSON.stringify(scanLogData.validationDetails || {}),
        JSON.stringify(scanLogData.fraudFlags || {}),
        scanLogData.createdBy
      ];

      const result = await this.pool.query(query, values);
      const scanLog = result.rows[0];

      logger.database('Scan log created', {
        scanLogId: scanLog.id,
        uid: scanLog.uid,
        ticketId: scanLogData.ticketId,
        result: scanLogData.result
      });

      return scanLog;
    } catch (error) {
      logger.error('Failed to create scan log', {
        error: error.message,
        ticketId: scanLogData.ticketId
      });
      throw new Error('Échec de l\'enregistrement du log de scan');
    }
  }

  /**
   * Alias pour createScanLog - utilisé par le service de scan
   * @param {Object} scanData - Données du scan
   * @returns {Promise<Object>} Log de scan créé
   */
  async recordScan(scanData) {
    return await this.createScanLog(scanData);
  }

  /**
   * Met à jour le cache des tickets scannés
   * @param {Object} cacheData - Données du cache
   * @returns {Promise<Object>} Cache mis à jour
   */
  async updateScannedTicketCache(cacheData) {
    try {
      const query = `
        INSERT INTO scanned_tickets_cache (
          ticket_id, first_scan_at, last_scan_at, scan_count, scan_locations, is_blocked, block_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (ticket_id) 
        DO UPDATE SET
          last_scan_at = EXCLUDED.last_scan_at,
          scan_count = scanned_tickets_cache.scan_count + EXCLUDED.scan_count,
          scan_locations = EXCLUDED.scan_locations,
          is_blocked = EXCLUDED.is_blocked,
          block_reason = EXCLUDED.block_reason,
          updated_at = NOW()
        RETURNING ticket_id, scan_count, is_blocked, block_reason
      `;

      const values = [
        cacheData.ticketId,
        cacheData.firstScanAt || new Date(),
        cacheData.lastScanAt || new Date(),
        cacheData.scanCount || 1,
        JSON.stringify(cacheData.scanLocations || []),
        cacheData.isBlocked || false,
        cacheData.blockReason || null
      ];

      const result = await this.pool.query(query, values);
      const cache = result.rows[0];

      logger.database('Scanned ticket cache updated', {
        ticketId: cacheData.ticketId,
        scanCount: cache.scan_count,
        isBlocked: cache.is_blocked
      });

      return cache;
    } catch (error) {
      logger.error('Failed to update scanned ticket cache', {
        error: error.message,
        ticketId: cacheData.ticketId
      });
      throw new Error('Échec de la mise à jour du cache des tickets scannés');
    }
  }

  /**
   * Vérifie si un ticket est bloqué dans le cache
   * @param {number} ticketId - ID du ticket
   * @returns {Promise<Object|null>} Informations du cache ou null
   */
  async getTicketCache(ticketId) {
    try {
      const query = `
        SELECT ticket_id, first_scan_at, last_scan_at, scan_count, 
               scan_locations, is_blocked, block_reason
        FROM scanned_tickets_cache
        WHERE ticket_id = $1
      `;

      const result = await this.pool.query(query, [ticketId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return {
        ticketId: result.rows[0].ticket_id,
        firstScanAt: result.rows[0].first_scan_at,
        lastScanAt: result.rows[0].last_scan_at,
        scanCount: result.rows[0].scan_count,
        scanLocations: result.rows[0].scan_locations,
        isBlocked: result.rows[0].is_blocked,
        blockReason: result.rows[0].block_reason
      };
    } catch (error) {
      logger.error('Failed to get ticket cache', {
        error: error.message,
        ticketId
      });
      throw new Error('Échec de la récupération du cache du ticket');
    }
  }

  /**
   * Enregistre une tentative de fraude
   * @param {Object} fraudData - Données de la tentative de fraude
   * @returns {Promise<Object>} Fraude enregistrée
   */
  async createFraudAttempt(fraudData) {
    try {
      const query = `
        INSERT INTO fraud_attempts (
          uid, scan_log_id, fraud_type, severity, details, ip_address, user_agent, blocked, created_by
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8
        ) RETURNING id, uid, fraud_type, severity, blocked
      `;

      const values = [
        fraudData.scanLogId,
        fraudData.fraudType,
        fraudData.severity || 'medium',
        JSON.stringify(fraudData.details || {}),
        fraudData.ipAddress,
        fraudData.userAgent,
        fraudData.blocked || false,
        fraudData.createdBy
      ];

      const result = await this.pool.query(query, values);
      const fraudAttempt = result.rows[0];

      logger.warn('Fraud attempt recorded', {
        fraudAttemptId: fraudAttempt.id,
        uid: fraudAttempt.uid,
        fraudType: fraudData.fraudType,
        severity: fraudAttempt.severity,
        blocked: fraudAttempt.blocked
      });

      return fraudAttempt;
    } catch (error) {
      logger.error('Failed to create fraud attempt', {
        error: error.message,
        fraudType: fraudData.fraudType
      });
      throw new Error('Échec de l\'enregistrement de la tentative de fraude');
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
      const limit = Math.min(options.limit || 50, 100);
      const offset = options.offset || 0;

      const query = `
        SELECT sl.id, sl.uid, sl.scanned_at, sl.result, sl.location, 
               sl.device_id, sl.validation_details, sl.fraud_flags,
               ss.uid as session_uid, ss.device_info as session_device_info
        FROM scan_logs sl
        LEFT JOIN scan_sessions ss ON sl.scan_session_id = ss.id
        WHERE sl.ticket_id = $1
        ORDER BY sl.scanned_at DESC
        LIMIT $2 OFFSET $3
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM scan_logs
        WHERE ticket_id = $1
      `;

      const [result, countResult] = await Promise.all([
        this.pool.query(query, [ticketId, limit, offset]),
        this.pool.query(countQuery, [ticketId])
      ]);

      const scans = result.rows.map(row => ({
        id: row.id,
        uid: row.uid,
        scannedAt: row.scanned_at,
        result: row.result,
        location: row.location,
        deviceId: row.device_id,
        validationDetails: row.validation_details,
        fraudFlags: row.fraud_flags,
        session: {
          uid: row.session_uid,
          deviceInfo: row.session_device_info
        }
      }));

      const total = parseInt(countResult.rows[0].total);

      logger.database('Ticket scan history retrieved', {
        ticketId,
        scanCount: scans.length,
        total
      });

      return {
        ticketId,
        scans,
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + scans.length < total
        }
      };
    } catch (error) {
      logger.error('Failed to get ticket scan history', {
        error: error.message,
        ticketId
      });
      throw new Error('Échec de la récupération de l\'historique des scans');
    }
  }

  /**
   * Récupère les statistiques de scan pour un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} filters - Filtres temporels
   * @returns {Promise<Object>} Statistiques de scan
   */
  async getEventScanStats(eventId, filters = {}) {
    try {
      const startDate = filters.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h par défaut
      const endDate = filters.endDate || new Date();

      const query = `
        SELECT 
          COUNT(*) as total_scans,
          COUNT(DISTINCT sl.ticket_id) as unique_tickets,
          COUNT(CASE WHEN sl.result = 'valid' THEN 1 END) as successful_scans,
          COUNT(CASE WHEN sl.result != 'valid' THEN 1 END) as failed_scans,
          COUNT(CASE WHEN fa.id IS NOT NULL THEN 1 END) as fraud_attempts,
          array_agg(DISTINCT sl.location) as locations
        FROM scan_logs sl
        LEFT JOIN fraud_attempts fa ON sl.id = fa.scan_log_id
        WHERE sl.scanned_at BETWEEN $1 AND $2
        AND sl.ticket_data::text LIKE $3
      `;

      const result = await this.pool.query(query, [startDate, endDate, `%${eventId}%`]);

      const stats = result.rows[0];

      logger.database('Event scan stats retrieved', {
        eventId,
        totalScans: stats.total_scans,
        uniqueTickets: stats.unique_tickets
      });

      const totalScans = parseInt(stats.total_scans || 0);
      const uniqueTickets = parseInt(stats.unique_tickets || 0);
      const successfulScans = parseInt(stats.successful_scans || 0);
      const failedScans = parseInt(stats.failed_scans || 0);
      const fraudAttempts = parseInt(stats.fraud_attempts || 0);
      const locations = Array.isArray(stats.locations) ? stats.locations.filter(loc => loc !== null) : [];

      return {
        eventId,
        period: { startDate, endDate },
        totalScans,
        uniqueTickets,
        successfulScans,
        failedScans,
        fraudAttempts,
        locations,
        successRate: totalScans > 0 
          ? ((successfulScans / totalScans) * 100).toFixed(2) + '%'
          : '0%'
      };
    } catch (error) {
      logger.error('Failed to get event scan stats', {
        error: error.message,
        eventId
      });
      throw new Error('Échec de la récupération des statistiques de scan');
    }
  }

  /**
   * Récupère les sessions de scan actives
   * @param {Object} filters - Filtres
   * @returns {Promise<Array>} Sessions actives
   */
  async getActiveScanSessions(filters = {}) {
    try {
      let query = `
        SELECT id, uid, started_at, scan_operator_id, event_id, location, device_info
        FROM scan_sessions
        WHERE ended_at IS NULL
      `;

      const values = [];
      let paramIndex = 1;

      if (filters.operatorId) {
        query += ` AND scan_operator_id = $${paramIndex++}`;
        values.push(filters.operatorId);
      }

      if (filters.location) {
        query += ` AND location = $${paramIndex++}`;
        values.push(filters.location);
      }

      query += ` ORDER BY started_at DESC`;

      if (filters.limit) {
        query += ` LIMIT $${paramIndex}`;
        values.push(Math.min(filters.limit, 100));
      }

      const result = await this.pool.query(query, values);

      const sessions = result.rows.map(row => ({
        id: row.id,
        uid: row.uid,
        startedAt: row.started_at,
        operatorId: row.scan_operator_id,
        eventId: row.event_id,
        location: row.location,
        deviceInfo: row.device_info
      }));

      logger.database('Active scan sessions retrieved', {
        sessionCount: sessions.length,
        filters
      });

      return sessions;
    } catch (error) {
      logger.error('Failed to get active scan sessions', {
        error: error.message,
        filters
      });
      throw new Error('Échec de la récupération des sessions actives');
    }
  }

  /**
   * Nettoie les anciennes données de scan
   * @param {Object} cleanupOptions - Options de nettoyage
   * @returns {Promise<Object>} Résultat du nettoyage
   */
  async cleanupOldScans(cleanupOptions = {}) {
    try {
      const retentionDays = cleanupOptions.retentionDays || 90;
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      const queries = [
        // Nettoyer les anciens logs de scan
        {
          name: 'scan_logs',
          query: 'DELETE FROM scan_logs WHERE scanned_at < $1 RETURNING COUNT(*)'
        },
        // Nettoyer les anciennes sessions terminées
        {
          name: 'scan_sessions',
          query: 'DELETE FROM scan_sessions WHERE ended_at < $1 RETURNING COUNT(*)'
        },
        // Nettoyer les anciennes tentatives de fraude
        {
          name: 'fraud_attempts',
          query: 'DELETE FROM fraud_attempts WHERE created_at < $1 RETURNING COUNT(*)'
        }
      ];

      const results = {};

      for (const { name, query } of queries) {
        const result = await this.pool.query(query, [cutoffDate]);
        results[name] = parseInt(result.rows[0].count);
      }

      const totalCleaned = Object.values(results).reduce((sum, count) => sum + count, 0);

      logger.database('Old scans cleaned up', {
        retentionDays,
        cutoffDate,
        results,
        totalCleaned
      });

      return {
        retentionDays,
        cutoffDate,
        cleaned: results,
        totalCleaned
      };
    } catch (error) {
      logger.error('Failed to cleanup old scans', {
        error: error.message,
        retentionDays: cleanupOptions.retentionDays
      });
      throw new Error('Échec du nettoyage des anciens scans');
    }
  }

  /**
   * Teste la connexion à la base de données
   * @returns {Promise<Object>} État de santé
   */
  async healthCheck() {
    try {
      const result = await this.pool.query('SELECT 1 as health_check');
      
      return {
        success: true,
        healthy: true,
        pool: {
          totalCount: this.pool.totalCount,
          idleCount: this.pool.idleCount,
          waitingCount: this.pool.waitingCount
        }
      };
    } catch (error) {
      logger.error('Database health check failed', {
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
   * Récupère les logs de scan pour un ticket (endpoint interne pour Event-Planner-Core)
   * @param {number} ticketId - ID du ticket
   * @returns {Promise<Array>} Logs de scan
   */
  async getTicketLogs(ticketId) {
    try {
      // REQUÊTE CORRIGÉE: Uniquement les colonnes existantes dans scan_logs
      const query = `
        SELECT 
          sl.id,
          sl.uid,
          sl.scan_session_id,
          sl.ticket_id,
          sl.result,
          sl.scanned_at,
          sl.ticket_data,
          sl.validation_details,
          sl.fraud_flags,
          sl.location,
          sl.device_id,
          sl.created_by,
          sl.created_at,
          ss.uid as session_uid
        FROM scan_logs sl
        LEFT JOIN scan_sessions ss ON sl.scan_session_id = ss.id
        WHERE sl.ticket_id = $1
        ORDER BY sl.scanned_at DESC
        LIMIT 100
      `;

      const result = await this.pool.query(query, [ticketId]);
      
      logger.debug('Retrieved scan logs from database', {
        ticketId,
        logCount: result.rows.length
      });

      // MAPPING CORRIGÉ: Uniquement les champs existants
      return result.rows.map(row => ({
        id: row.id,
        uid: row.uid,
        sessionId: row.scan_session_id,
        sessionUid: row.session_uid,
        ticketId: row.ticket_id,
        scanResult: row.result,
        scanTime: row.scanned_at,
        ticketData: row.ticket_data,
        validationDetails: row.validation_details,
        fraudFlags: row.fraud_flags,
        location: row.location,
        deviceId: row.device_id,
        createdBy: row.created_by,
        createdAt: row.created_at
      }));
    } catch (error) {
      logger.error('Failed to get ticket logs from database', {
        ticketId,
        error: error.message
      });
      throw new Error('Échec de la récupération des logs de scan');
    }
  }

  /**
   * Ferme proprement le pool de connexions
   */
  async close() {
    try {
      await this.pool.end();
      logger.info('Database pool closed');
    } catch (error) {
      logger.error('Failed to close database pool', {
        error: error.message
      });
    }
  }
}

module.exports = new ScanRepository();
