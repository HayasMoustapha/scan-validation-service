const crypto = require('crypto');
const logger = require('../../utils/logger');

/**
 * Service de support offline pour la validation de tickets
 * Permet la validation sans connexion internet avec synchronisation
 */
class OfflineService {
  constructor() {
    this.syncInterval = parseInt(process.env.OFFLINE_SYNC_INTERVAL) || 60000; // 1 minute
    this.cacheTTL = parseInt(process.env.OFFLINE_CACHE_TTL) || 86400000; // 24 heures
    this.batchSize = parseInt(process.env.OFFLINE_BATCH_SIZE) || 1000;
    this.backupInterval = parseInt(process.env.OFFLINE_BACKUP_INTERVAL) || 3600000; // 1 heure
    this.offlineData = new Map(); // Cache en mémoire pour les données offline
    this.pendingSync = new Map(); // Données en attente de synchronisation
    this.lastSyncTime = null;
    this.syncInProgress = false;
  }

  /**
   * Initialise le service offline
   */
  async initialize() {
    try {
      // Charger les données offline depuis le stockage local
      await this.loadOfflineData();
      
      // Démarrer la synchronisation périodique
      this.startPeriodicSync();
      
      // Démarrer la sauvegarde périodique
      this.startPeriodicBackup();
      
      logger.info('Offline service initialized successfully', {
        offlineDataSize: this.offlineData.size,
        syncInterval: this.syncInterval,
        cacheTTL: this.cacheTTL
      });
    } catch (error) {
      logger.error('Failed to initialize offline service', {
        error: error.message
      });
    }
  }

  /**
   * Stocke les données d'un ticket pour validation offline
   * @param {Object} ticketData - Données du ticket
   * @param {Object} validationData - Données de validation
   * @returns {Promise<Object>} Résultat du stockage
   */
  async storeTicketData(ticketData, validationData = {}) {
    try {
      const ticketId = ticketData.id;
      const offlineEntry = {
        ticketId,
        ticketData,
        validationData,
        storedAt: new Date().toISOString(),
        expiresAt: ticketData.expiresAt,
        lastValidated: new Date().toISOString(),
        validationCount: 0,
        status: 'active'
      };

      // Stocker en cache
      this.offlineData.set(ticketId, offlineEntry);
      
      // Ajouter à la file de synchronisation
      this.pendingSync.set(ticketId, {
        action: 'store',
        data: offlineEntry,
        timestamp: new Date().toISOString()
      });

      logger.offline('Ticket data stored for offline validation', {
        ticketId,
        eventId: ticketData.eventId,
        expiresAt: offlineEntry.expiresAt
      });

      return {
        success: true,
        ticketId,
        storedAt: offlineEntry.storedAt
      };
    } catch (error) {
      logger.error('Failed to store ticket data offline', {
        error: error.message,
        ticketId: ticketData.id
      });

      return {
        success: false,
        error: 'Échec du stockage offline des données',
        code: 'OFFLINE_STORAGE_FAILED'
      };
    }
  }

  /**
   * Valide un ticket en mode offline
   * @param {string} ticketId - ID du ticket
   * @param {Object} scanContext - Contexte du scan
   * @returns {Promise<Object>} Résultat de la validation
   */
  async validateTicketOffline(ticketId, scanContext = {}) {
    try {
      // Vérifier si les données existent en cache
      const offlineEntry = this.offlineData.get(ticketId);
      
      if (!offlineEntry) {
        return {
          success: false,
          error: 'Ticket non trouvé en cache offline',
          code: 'TICKET_NOT_FOUND_OFFLINE'
        };
      }

      // Vérifier l'expiration
      if (this.isTicketExpired(offlineEntry)) {
        return {
          success: false,
          error: 'Ticket expiré',
          code: 'TICKET_EXPIRED_OFFLINE'
        };
      }

      // Vérifier le statut
      if (offlineEntry.status !== 'active') {
        return {
          success: false,
          error: `Ticket statut: ${offlineEntry.status}`,
          code: 'TICKET_INACTIVE_OFFLINE'
        };
      }

      // Mettre à jour les informations de scan
      const scanInfo = {
        scanId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        location: scanContext.location,
        deviceId: scanContext.deviceId,
        offline: true
      };

      // Ajouter à l'historique des scans
      if (!offlineEntry.scanHistory) {
        offlineEntry.scanHistory = [];
      }
      offlineEntry.scanHistory.push(scanInfo);
      offlineEntry.lastValidated = scanInfo.timestamp;
      offlineEntry.validationCount++;

      // Vérifier le nombre maximum de scans
      if (offlineEntry.validationCount > 5) {
        return {
          success: false,
          error: 'Nombre maximum de scans atteint',
          code: 'MAX_SCANS_EXCEEDED_OFFLINE'
        };
      }

      // Mettre à jour le cache
      this.offlineData.set(ticketId, offlineEntry);

      // Ajouter à la file de synchronisation
      this.pendingSync.set(ticketId, {
        action: 'validate',
        data: {
          ticketId,
          scanInfo,
          validationCount: offlineEntry.validationCount
        },
        timestamp: new Date().toISOString()
      });

      logger.offline('Ticket validated offline successfully', {
        ticketId,
        validationCount: offlineEntry.validationCount,
        scanLocation: scanContext.location
      });

      return {
        success: true,
        ticket: {
          id: offlineEntry.ticketId,
          eventId: offlineEntry.ticketData.eventId,
          ticketType: offlineEntry.ticketData.type,
          status: 'valid',
          scannedAt: scanInfo.timestamp,
          offline: true,
          validationCount: offlineEntry.validationCount
        },
        scanInfo
      };
    } catch (error) {
      logger.error('Failed to validate ticket offline', {
        error: error.message,
        ticketId
      });

      return {
        success: false,
        error: 'Échec de la validation offline',
        code: 'OFFLINE_VALIDATION_FAILED'
      };
    }
  }

  /**
   * Synchronise les données offline avec le serveur
   * @returns {Promise<Object>} Résultat de la synchronisation
   */
  async syncOfflineData() {
    try {
      if (this.syncInProgress) {
        return {
          success: false,
          error: 'Synchronisation déjà en cours',
          code: 'SYNC_IN_PROGRESS'
        };
      }

      this.syncInProgress = true;
      const syncStartTime = Date.now();

      const pendingItems = Array.from(this.pendingSync.entries());
      const batchSize = Math.min(this.batchSize, pendingItems.length);
      const batch = pendingItems.slice(0, batchSize);

      let successCount = 0;
      let errorCount = 0;

      for (const [ticketId, syncItem] of batch) {
        try {
          const result = await this.processSyncItem(syncItem);
          
          if (result.success) {
            successCount++;
            // Retirer de la file de synchronisation
            this.pendingSync.delete(ticketId);
          } else {
            errorCount++;
          }
        } catch (error) {
          logger.error('Failed to process sync item', {
            error: error.message,
            ticketId,
            action: syncItem.action
          });
          errorCount++;
        }
      }

      this.lastSyncTime = new Date().toISOString();
      const syncDuration = Date.now() - syncStartTime;

      logger.offline('Offline sync completed', {
        totalItems: batch.length,
        successCount,
        errorCount,
        syncDuration,
        pendingItems: this.pendingSync.size
      });

      this.syncInProgress = false;

      return {
        success: successCount > 0,
        synced: successCount,
        failed: errorCount,
        pending: this.pendingSync.size,
        syncDuration
      };
    } catch (error) {
      logger.error('Failed to sync offline data', {
        error: error.message
      });

      this.syncInProgress = false;

      return {
        success: false,
        error: 'Échec de la synchronisation offline',
        code: 'OFFLINE_SYNC_FAILED'
      };
    }
  }

  /**
   * Traite un élément de synchronisation
   * @param {Object} syncItem - Élément à synchroniser
   * @returns {Promise<Object>} Résultat du traitement
   */
  async processSyncItem(syncItem) {
    try {
      switch (syncItem.action) {
        case 'store':
          return await this.syncStoreAction(syncItem.data);
        case 'validate':
          return await this.syncValidateAction(syncItem.data);
        case 'update':
          return await this.syncUpdateAction(syncItem.data);
        default:
          return {
            success: false,
            error: `Action de synchronisation inconnue: ${syncItem.action}`
          };
      }
    } catch (error) {
      logger.error('Failed to process sync item', {
        error: error.message,
        action: syncItem.action
      });
      throw error;
    }
  }

  /**
   * Synchronise l'action de stockage
   * @param {Object} data - Données à synchroniser
   * @returns {Promise<Object>} Résultat
   */
  async syncStoreAction(data) {
    // Placeholder pour synchronisation avec le serveur
    logger.offline('Syncing store action', {
      ticketId: data.ticketId
    });
    
    return {
      success: true,
      action: 'store',
      ticketId: data.ticketId
    };
  }

  /**
   * Synchronise l'action de validation
   * @param {Object} data - Données à synchroniser
   * @returns {Promise<Object>} Résultat
   */
  async syncValidateAction(data) {
    // Placeholder pour synchronisation avec le serveur
    logger.offline('Syncing validate action', {
      ticketId: data.ticketId,
      validationCount: data.validationCount
    });
    
    return {
      success: true,
      action: 'validate',
      ticketId: data.ticketId
    };
  }

  /**
   * Synchronise l'action de mise à jour
   * @param {Object} data - Données à synchroniser
   * @returns {Promise<Object>} Résultat
   */
  async syncUpdateAction(data) {
    // Placeholder pour synchronisation avec le serveur
    logger.offline('Syncing update action', {
      ticketId: data.ticketId
    });
    
    return {
      success: true,
      action: 'update',
      ticketId: data.ticketId
    };
  }

  /**
   * Charge les données offline depuis le stockage local
   * @returns {Promise<Object>} Résultat du chargement
   */
  async loadOfflineData() {
    try {
      // Placeholder pour charger depuis le stockage local
      // Dans une implémentation complète, cela chargerait depuis Redis ou un fichier
      
      logger.offline('Loading offline data from local storage');
      
      return {
        success: true,
        loaded: 0,
        message: 'Offline data loaded (placeholder)'
      };
    } catch (error) {
      logger.error('Failed to load offline data', {
        error: error.message
      });

      return {
        success: false,
        error: 'Échec du chargement des données offline',
        code: 'OFFLINE_LOAD_FAILED'
      };
    }
  }

  /**
   * Sauvegarde les données offline
   * @returns {Promise<Object>} Résultat de la sauvegarde
   */
  async backupOfflineData() {
    try {
      const backupData = {
        timestamp: new Date().toISOString(),
        offlineData: Array.from(this.offlineData.entries()),
        pendingSync: Array.from(this.pendingSync.entries()),
        lastSyncTime: this.lastSyncTime
      };

      // Placeholder pour sauvegarder dans un fichier ou Redis
      logger.offline('Creating offline data backup', {
        offlineDataSize: this.offlineData.size,
        pendingSyncSize: this.pendingSync.size
      });

      return {
        success: true,
        backupSize: backupData.offlineData.length,
        timestamp: backupData.timestamp
      };
    } catch (error) {
      logger.error('Failed to backup offline data', {
        error: error.message
      });

      return {
        success: false,
        error: 'Échec de la sauvegarde des données offline',
        code: 'OFFLINE_BACKUP_FAILED'
      };
    }
  }

  /**
   * Nettoie les données expirées
   * @returns {Promise<Object>} Résultat du nettoyage
   */
  async cleanupExpiredData() {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [ticketId, entry] of this.offlineData.entries()) {
        if (this.isTicketExpired(entry)) {
          this.offlineData.delete(ticketId);
          this.pendingSync.delete(ticketId);
          cleanedCount++;
        }
      }

      logger.offline('Cleaned up expired offline data', {
        cleanedCount,
        remainingData: this.offlineData.size
      });

      return {
        success: true,
        cleanedCount,
        remainingData: this.offlineData.size
      };
    } catch (error) {
      logger.error('Failed to cleanup expired data', {
        error: error.message
      });

      return {
        success: false,
        error: 'Échec du nettoyage des données expirées',
        code: 'OFFLINE_CLEANUP_FAILED'
      };
    }
  }

  /**
   * Vérifie si un ticket est expiré
   * @param {Object} entry - Entrée du ticket
   * @returns {boolean} True si expiré
   */
  isTicketExpired(entry) {
    const now = Date.now();
    const expiresAt = new Date(entry.expiresAt).getTime();
    return now > expiresAt;
  }

  /**
   * Démarre la synchronisation périodique
   */
  startPeriodicSync() {
    if (this.syncInterval > 0) {
      setInterval(async () => {
        if (this.pendingSync.size > 0) {
          await this.syncOfflineData();
        }
      }, this.syncInterval);
      
      logger.info('Periodic sync started', {
        interval: this.syncInterval
      });
    }
  }

  /**
   * Démarre la sauvegarde périodique
   */
  startPeriodicBackup() {
    if (this.backupInterval > 0) {
      setInterval(async () => {
        await this.backupOfflineData();
      }, this.backupInterval);
      
      logger.info('Periodic backup started', {
        interval: this.backupInterval
      });
    }
  }

  /**
   * Récupère les statistiques du service offline
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      cache: {
        size: this.offlineData.size,
        ttl: this.cacheTTL
      },
      sync: {
        pending: this.pendingSync.size,
        lastSyncTime: this.lastSyncTime,
        inProgress: this.syncInProgress
      },
      config: {
        syncInterval: this.syncInterval,
        batchSize: this.batchSize,
        backupInterval: this.backupInterval
      }
    };
  }

  /**
   * Vérifie la santé du service offline
   * @returns {Promise<Object>} État de santé
   */
  async healthCheck() {
    try {
      const stats = this.getStats();
      
      return {
        success: true,
        healthy: true,
        stats
      };
    } catch (error) {
      logger.error('Offline service health check failed', {
        error: error.message
      });

      return {
        success: false,
        healthy: false,
        error: error.message
      };
    }
  }
}

module.exports = new OfflineService();
