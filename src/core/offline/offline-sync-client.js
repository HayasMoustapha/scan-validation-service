const eventCoreClient = require('../clients/event-core.client');
const logger = require('../../utils/logger');

/**
 * Client de synchronisation offline (adaptateur de production).
 *
 * RÔLE : faire le pont entre la file de synchronisation offline
 * (OfflineService.pushToServer) et le client HTTP réel vers
 * event-planner-core (EventCoreClient).
 *
 * OfflineService attend un client exposant storeScan / validateScan /
 * updateScan ; EventCoreClient expose recordScan (POST interne
 * /api/internal/scans/validate). Cet adaptateur normalise les payloads
 * offline en charge utile attendue par le core et fait remonter
 * fidèlement les succès/échecs (aucun faux succès : si le core rejette,
 * on renvoie success:false et l'élément reste en file).
 *
 * @param {Object} [deps] - Dépendances injectables (tests).
 * @param {Object} [deps.coreClient] - Client core (défaut : EventCoreClient).
 * @returns {{storeScan: Function, validateScan: Function, updateScan: Function}}
 */
function createOfflineSyncClient(deps = {}) {
  const coreClient = deps.coreClient || eventCoreClient;

  /**
   * Construit la charge utile d'enregistrement de scan attendue par le core
   * à partir d'un élément de la file offline.
   * @param {string} action - store/validate/update
   * @param {Object} data - Données de l'élément offline
   * @returns {Object} Payload normalisé
   */
  function toScanPayload(action, data) {
    const scanInfo = data.scanInfo || {};
    const ticketData = data.ticketData || {};

    return {
      ticketId: data.ticketId,
      eventId: ticketData.eventId || data.eventId || null,
      result: action === 'store' ? 'stored' : 'valid',
      offline: true,
      syncAction: action,
      validationCount: data.validationCount,
      scanContext: {
        location: scanInfo.location,
        deviceId: scanInfo.deviceId,
        timestamp: scanInfo.timestamp || data.storedAt || new Date().toISOString(),
        offline: true
      }
    };
  }

  /**
   * Pousse un élément vers le core et normalise la réponse.
   * @param {string} action - store/validate/update
   * @param {Object} data - Données de l'élément offline
   * @returns {Promise<Object>} { success, ... }
   */
  async function push(action, data) {
    const payload = toScanPayload(action, data);
    const result = await coreClient.recordScan(payload);

    // recordScan renvoie {success:false, nonBlocking:true} quand le core est
    // injoignable : on propage l'échec pour conserver l'élément en file.
    if (!result || result.success === false) {
      return {
        success: false,
        error: (result && result.error) || 'Échec de la synchronisation vers le core',
        code: (result && result.code) || 'SYNC_CORE_REJECTED'
      };
    }

    logger.offline('Offline scan synced to core', {
      action,
      ticketId: data.ticketId
    });

    return { success: true, data: result.data };
  }

  return {
    storeScan: (data) => push('store', data),
    validateScan: (data) => push('validate', data),
    updateScan: (data) => push('update', data)
  };
}

module.exports = { createOfflineSyncClient };
