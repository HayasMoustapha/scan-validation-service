/**
 * Routes pour recevoir les confirmations de validation d'Event-Planner-Core
 * 
 * Ces routes permettent à Event-Planner-Core d'envoyer des confirmations
 * pour que Scan-Validation Service puisse mettre à jour ses propres tables
 */

const express = require('express');
const router = express.Router();

// Import du controller
const confirmationController = require('../controllers/confirmation.controller');

/**
 * POST /api/internal/scan-confirmation
 * Reçoit une confirmation de validation d'Event-Planner-Core
 * 
 * Corps de la requête :
 * {
 *   "ticketId": "number",
 *   "validationResult": {
 *     "success": true,
 *     "validated_at": "ISO string",
 *     "operator_id": "number",
 *     "location": "string",
 *     "device_id": "string",
 *     "checkpoint_id": "string",
 *     "blocked": false,
 *     "block_reason": null,
 *     "fraud_flags": {
 *       "type": "CONCURRENT_SCAN_ATTEMPT",
 *       "severity": "MEDIUM",
 *       "details": {}
 *     }
 *   },
 *   "scanMetadata": {
 *     "validation_source": "EVENT_PLANNER_CORE",
 *     "validation_type": "BUSINESS_VALIDATION",
 *     "processing_time_ms": 150
 *   }
 * }
 */
router.post('/scan-confirmation', confirmationController.receiveScanConfirmation);

module.exports = router;
