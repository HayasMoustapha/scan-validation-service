/**
 * Routes pour le service de validation de scan
 * Définit les endpoints HTTP pour la validation en temps réel des tickets
 * 
 * Routes :
 * POST /api/validate - Valider un ticket scanné
 * GET /health - Health check du service
 * GET /ping - Ping pour disponibilité
 */

const express = require('express');
const router = express.Router();
const { 
  validateTicket, 
  healthCheck, 
  ping 
} = require('../controllers/scan-validation-controller');

/**
 * @route POST /api/validate
 * @desc Valider un ticket scanné en temps réel
 * @access Public (technique - pas d'authentification)
 * @body {
 *   ticket_code: string,
 *   event_id: number,
 *   operator_id: number,
 *   scan_time: string (ISO),
 *   ticket_data: {
 *     ticket_id: number,
 *     qr_code_data: string,
 *     guest_name: string,
 *     event_title: string
 *   }
 * }
 */
router.post('/validate', validateTicket);

/**
 * @route GET /health
 * @desc Health check du service de validation
 * @access Public
 */
router.get('/health', healthCheck);

/**
 * @route GET /ping
 * @desc Ping pour vérifier la disponibilité du service
 * @access Public
 */
router.get('/ping', ping);

module.exports = router;
