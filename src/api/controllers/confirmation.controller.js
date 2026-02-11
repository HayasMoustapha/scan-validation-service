/**
 * Controller pour recevoir les confirmations de validation d'Event-Planner-Core
 * 
 * Ce controller permet à Event-Planner-Core d'envoyer des confirmations
 * pour que Scan-Validation Service puisse mettre à jour ses propres tables
 */

const { Pool } = require('pg');

// Configuration de la base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Reçoit une confirmation de validation d'Event-Planner-Core
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function receiveScanConfirmation(req, res) {
  const startTime = Date.now();
  
  try {
    const { ticketId, validationResult, scanMetadata } = req.body;
    
    console.log(`[SCAN_CONFIRMATION] Réception confirmation pour ticket ${ticketId} de Event-Planner-Core`);
    
    // Validation des données d'entrée
    if (!ticketId || !validationResult) {
      return res.status(400).json({
        success: false,
        error: 'ticketId et validationResult sont obligatoires',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }
    
    // 1. Mettre à jour le cache des tickets scannés
    await updateScannedTicketsCache(ticketId, validationResult);
    
    // 2. Enregistrer le log de scan
    await recordScanLog(ticketId, validationResult, scanMetadata);
    
    // 3. Gérer les tentatives de fraude si nécessaire
    if (validationResult.fraud_flags) {
      await recordFraudAttempt(ticketId, validationResult, scanMetadata);
    }
    
    const processingTime = Date.now() - startTime;
    
    console.log(`[SCAN_CONFIRMATION] Confirmation traitée en ${processingTime}ms pour ticket ${ticketId}`);
    
    res.status(200).json({
      success: true,
      data: {
        ticketId: ticketId,
        processed_at: new Date().toISOString(),
        processing_time_ms: processingTime,
        updates_applied: [
          'scanned_tickets_cache',
          'scan_logs',
          'fraud_attempts (if needed)'
        ]
      },
      message: 'Confirmation de validation traitée avec succès'
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('[SCAN_CONFIRMATION] Erreur traitement confirmation:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors du traitement de la confirmation',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      processing_time_ms: processingTime
    });
  }
}

/**
 * Met à jour le cache des tickets scannés
 * @param {number} ticketId - ID du ticket
 * @param {Object} validationResult - Résultat de validation
 */
async function updateScannedTicketsCache(ticketId, validationResult) {
  const client = await pool.connect();
  
  try {
    // Vérifier si le ticket existe déjà dans le cache
    const checkQuery = `
      SELECT scan_count, scan_locations FROM scanned_tickets_cache 
      WHERE ticket_id = $1
    `;
    
    const checkResult = await client.query(checkQuery, [ticketId]);
    
    if (checkResult.rows.length > 0) {
      // Mettre à jour l'entrée existante
      const existing = checkResult.rows[0];
      const scanLocations = existing.scan_locations || [];
      
      // Ajouter la nouvelle location si elle n'existe pas déjà
      if (validationResult.location && !scanLocations.includes(validationResult.location)) {
        scanLocations.push(validationResult.location);
      }
      
      const updateQuery = `
        UPDATE scanned_tickets_cache 
        SET 
          last_scan_at = NOW(),
          scan_count = scan_count + 1,
          scan_locations = $2,
          is_blocked = $3,
          block_reason = $4,
          updated_at = NOW()
        WHERE ticket_id = $1
      `;
      
      await client.query(updateQuery, [
        ticketId,
        JSON.stringify(scanLocations),
        validationResult.blocked || false,
        validationResult.block_reason || null
      ]);
      
    } else {
      // Créer une nouvelle entrée
      const insertQuery = `
        INSERT INTO scanned_tickets_cache 
        (ticket_id, first_scan_at, last_scan_at, scan_count, scan_locations, is_blocked, block_reason)
        VALUES ($1, NOW(), NOW(), 1, $2, $3, $4)
      `;
      
      await client.query(insertQuery, [
        ticketId,
        JSON.stringify(validationResult.location ? [validationResult.location] : []),
        validationResult.blocked || false,
        validationResult.block_reason || null
      ]);
    }
    
    console.log(`[SCAN_CONFIRMATION] Cache mis à jour pour ticket ${ticketId}`);
    
  } finally {
    client.release();
  }
}

/**
 * Enregistre le log de scan
 * @param {number} ticketId - ID du ticket
 * @param {Object} validationResult - Résultat de validation
 * @param {Object} scanMetadata - Métadonnées du scan
 */
async function recordScanLog(ticketId, validationResult, scanMetadata) {
  const client = await pool.connect();
  
  try {
    // Pour l'instant, nous utilisons scan_session_id = NULL
    // Dans une version future, on pourrait gérer les sessions de scan
    const insertQuery = `
      INSERT INTO scan_logs 
      (scan_session_id, scanned_at, result, location, device_id, ticket_id, ticket_data, validation_details, fraud_flags, created_at)
      VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, NOW())
    `;
    
    await client.query(insertQuery, [
      null, // scan_session_id (à implémenter plus tard)
      validationResult.success ? 'valid' : 'invalid',
      validationResult.location,
      validationResult.device_id,
      ticketId,
      JSON.stringify({
        ticket_id: ticketId,
        validated_at: validationResult.validated_at,
        operator_id: validationResult.operator_id
      }),
      JSON.stringify({
        validation_source: scanMetadata?.validation_source || 'UNKNOWN',
        validation_type: scanMetadata?.validation_type || 'UNKNOWN',
        processing_time_ms: scanMetadata?.processing_time_ms
      }),
      JSON.stringify(validationResult.fraud_flags || null)
    ]);
    
    console.log(`[SCAN_CONFIRMATION] Log de scan enregistré pour ticket ${ticketId}`);
    
  } finally {
    client.release();
  }
}

/**
 * Enregistre une tentative de fraude si détectée
 * @param {number} ticketId - ID du ticket
 * @param {Object} validationResult - Résultat de validation
 * @param {Object} scanMetadata - Métadonnées du scan
 */
async function recordFraudAttempt(ticketId, validationResult, scanMetadata) {
  if (!validationResult.fraud_flags) {
    return;
  }
  
  const client = await pool.connect();
  
  try {
    // D'abord, enregistrer le log de scan pour avoir scan_log_id
    const scanLogQuery = `
      INSERT INTO scan_logs 
      (scan_session_id, scanned_at, result, location, device_id, ticket_id, ticket_data, validation_details, fraud_flags, created_at)
      VALUES ($1, NOW(), 'fraud_detected', $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id
    `;
    
    const scanLogResult = await client.query(scanLogQuery, [
      null, // scan_session_id
      validationResult.location,
      validationResult.device_id,
      ticketId,
      JSON.stringify({ ticket_id: ticketId }),
      JSON.stringify(scanMetadata || {}),
      JSON.stringify(validationResult.fraud_flags)
    ]);
    
    const scanLogId = scanLogResult.rows[0].id;
    
    // Ensuite, enregistrer la tentative de fraude
    const fraudQuery = `
      INSERT INTO fraud_attempts 
      (scan_log_id, fraud_type, severity, details, ip_address, user_agent, blocked, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `;
    
    await client.query(fraudQuery, [
      scanLogId,
      validationResult.fraud_flags.type || 'UNKNOWN',
      validationResult.fraud_flags.severity || 'medium',
      JSON.stringify(validationResult.fraud_flags.details || {}),
      scanMetadata?.ip_address || null,
      scanMetadata?.user_agent || null,
      validationResult.fraud_flags.blocked || false
    ]);
    
    console.log(`[SCAN_CONFIRMATION] Tentative de fraude enregistrée pour ticket ${ticketId}`);
    
  } finally {
    client.release();
  }
}

module.exports = {
  receiveScanConfirmation
};
