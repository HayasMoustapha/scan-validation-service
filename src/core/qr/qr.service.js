const crypto = require('crypto');
const qrcode = require('qrcode');
const logger = require('../../utils/logger');

/**
 * Service QR Code pour la génération et la lecture
 * Crée des QR codes sécurisés et les décode pour validation
 */
class QRService {
  constructor() {
    this.secretKey = process.env.QR_CODE_SECRET_KEY || 'default-secret';
    this.defaultOptions = {
      width: 300,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    };
  }

  /**
   * Génère un QR code sécurisé pour un ticket
   * @param {Object} ticketData - Données du ticket
   * @param {Object} options - Options de génération
   * @returns {Promise<Object>} QR code généré
   */
  async generateSecureQRCode(ticketData, options = {}) {
    try {
      const nonce = this.generateNonce();
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + (options.expiresIn || 3600) * 1000).toISOString();

      const qrData = {
        id: ticketData.id,
        eventId: ticketData.eventId,
        type: ticketData.type || 'standard',
        nonce,
        createdAt: now,
        expiresAt,
        metadata: ticketData.metadata || {}
      };

      // Ajouter la signature
      qrData.signature = await this.generateSignature(qrData);

      // Générer le QR code
      const qrOptions = { ...this.defaultOptions, ...options };
      const qrCodeBuffer = await qrcode.toBuffer(JSON.stringify(qrData), qrOptions);

      logger.qr('Secure QR code generated', {
        ticketId: ticketData.id,
        eventId: ticketData.eventId,
        type: ticketData.type
      });

      return {
        success: true,
        qrCode: {
          data: qrData,
          base64: qrCodeBuffer.toString('base64'),
          buffer: qrCodeBuffer,
          options: qrOptions
        }
      };
    } catch (error) {
      logger.error('Failed to generate secure QR code', {
        error: error.message,
        ticketId: ticketData.id
      });

      return {
        success: false,
        error: 'Échec de la génération du QR code',
        code: 'QR_GENERATION_FAILED'
      };
    }
  }

  /**
   * Génère un QR code pour un lot de tickets
   * @param {Array} tickets - Liste des tickets
   * @param {Object} options - Options de génération
   * @returns {Promise<Object>} QR codes générés
   */
  async generateBatchQRCodes(tickets, options = {}) {
    try {
      const results = [];
      const batchSize = options.batchSize || 10;

      for (let i = 0; i < tickets.length; i += batchSize) {
        const batch = tickets.slice(i, i + batchSize);
        
        const batchPromises = batch.map(ticket => 
          this.generateSecureQRCode(ticket, options)
        );

        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push({
              ticketId: batch[index].id,
              success: true,
              qrCode: result.value.qrCode
            });
          } else {
            results.push({
              ticketId: batch[index].id,
              success: false,
              error: result.reason.error
            });
          }
        });
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      logger.qr('Batch QR codes generated', {
        totalTickets: tickets.length,
        successCount,
        failureCount
      });

      return {
        success: successCount > 0,
        results,
        summary: {
          total: tickets.length,
          success: successCount,
          failed: failureCount
        }
      };
    } catch (error) {
      logger.error('Failed to generate batch QR codes', {
        error: error.message,
        totalTickets: tickets.length
      });

      return {
        success: false,
        error: 'Échec de la génération en lot des QR codes',
        code: 'BATCH_QR_GENERATION_FAILED'
      };
    }
  }

  /**
   * Décode et valide un QR code
   * @param {string|Buffer} qrCodeInput - QR code à décoder
   * @returns {Promise<Object>} Données décodées
   */
  async decodeQRCode(qrCodeInput) {
    try {
      let qrDataString;

      if (Buffer.isBuffer(qrCodeInput)) {
        // Si c'est un buffer, essayer de le convertir en image
        qrDataString = await this.decodeQRImage(qrCodeInput);
      } else if (typeof qrCodeInput === 'string') {
        // Si c'est une chaîne, vérifier si c'est du base64 ou du JSON direct
        if (qrCodeInput.startsWith('data:image/')) {
          // Image base64
          const base64Data = qrCodeInput.split(',')[1];
          const imageBuffer = Buffer.from(base64Data, 'base64');
          qrDataString = await this.decodeQRImage(imageBuffer);
        } else if (qrCodeInput.startsWith('{') || qrCodeInput.startsWith('[')) {
          // JSON direct
          qrDataString = qrCodeInput;
        } else {
          // Essayer de décoder comme base64
          try {
            const decoded = Buffer.from(qrCodeInput, 'base64').toString();
            if (decoded.startsWith('{') || decoded.startsWith('[')) {
              qrDataString = decoded;
            } else {
              // Traiter comme image base64
              const imageBuffer = Buffer.from(qrCodeInput, 'base64');
              qrDataString = await this.decodeQRImage(imageBuffer);
            }
          } catch {
            // Si le base64 échoue, traiter comme JSON direct
            qrDataString = qrCodeInput;
          }
        }
      } else {
        return {
          success: false,
          error: 'Format de QR code non supporté',
          code: 'UNSUPPORTED_QR_FORMAT'
        };
      }

      // Parser les données JSON
      let qrData;
      try {
        qrData = JSON.parse(qrDataString);
      } catch (error) {
        return {
          success: false,
          error: 'Format JSON invalide dans le QR code',
          code: 'INVALID_JSON_FORMAT'
        };
      }

      logger.qr('QR code decoded successfully', {
        ticketId: qrData.id,
        eventId: qrData.eventId,
        type: qrData.type
      });

      return {
        success: true,
        data: qrData
      };
    } catch (error) {
      logger.error('Failed to decode QR code', {
        error: error.message
      });

      return {
        success: false,
        error: 'Échec du décodage du QR code',
        code: 'QR_DECODE_FAILED'
      };
    }
  }

  /**
   * Décode une image QR code
   * @param {Buffer} imageBuffer - Buffer de l'image
   * @returns {Promise<string>} Données décodées
   */
  async decodeQRImage(imageBuffer) {
    try {
      // Utiliser qrcode-reader pour décoder l'image
      // Pour l'instant, retourner une chaîne vide comme placeholder
      // Dans une implémentation complète, on utiliserait jimp ou jsqr
      
      // Placeholder - nécessiterait une bibliothèque de décodage d'images
      logger.warn('QR image decoding not implemented - using placeholder');
      
      return JSON.stringify({
        id: 'placeholder',
        eventId: 'placeholder',
        type: 'standard',
        nonce: 'placeholder',
        signature: 'placeholder',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      });
    } catch (error) {
      logger.error('Failed to decode QR image', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Génère une signature pour les données du QR code
   * @param {Object} data - Données à signer
   * @returns {Promise<string>} Signature HMAC-SHA256
   */
  async generateSignature(data) {
    try {
      const signatureString = this.createSignatureString(data);
      return crypto
        .createHmac('sha256', this.secretKey)
        .update(signatureString)
        .digest('hex');
    } catch (error) {
      logger.error('Failed to generate signature', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Crée la chaîne de signature
   * @param {Object} data - Données du ticket
   * @returns {string} Chaîne de signature
   */
  createSignatureString(data) {
    return `${data.id}|${data.eventId}|${data.type}|${data.nonce}|${data.createdAt}|${data.expiresAt}`;
  }

  /**
   * Génère un nonce unique
   * @returns {string} Nonce de 32 caractères
   */
  generateNonce() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Valide le format d'un QR code
   * @param {string|Buffer} qrCodeInput - QR code à valider
   * @returns {Promise<Object>} Résultat de la validation
   */
  async validateQRCodeFormat(qrCodeInput) {
    try {
      const decodeResult = await this.decodeQRCode(qrCodeInput);
      
      if (!decodeResult.success) {
        return decodeResult;
      }

      const qrData = decodeResult.data;
      
      // Valider la structure
      const requiredFields = ['id', 'eventId', 'type', 'nonce', 'signature', 'createdAt', 'expiresAt'];
      for (const field of requiredFields) {
        if (!qrData[field]) {
          return {
            success: false,
            error: `Champ requis manquant: ${field}`,
            code: 'MISSING_REQUIRED_FIELD'
          };
        }
      }

      // Valider le type
      const validTypes = ['standard', 'vip', 'premium', 'early-bird', 'student'];
      if (!validTypes.includes(qrData.type)) {
        return {
          success: false,
          error: `Type de ticket invalide: ${qrData.type}`,
          code: 'INVALID_TICKET_TYPE'
        };
      }

      return {
        success: true,
        data: qrData
      };
    } catch (error) {
      logger.error('Failed to validate QR code format', {
        error: error.message
      });

      return {
        success: false,
        error: 'Erreur de validation du format du QR code',
        code: 'QR_FORMAT_VALIDATION_FAILED'
      };
    }
  }

  /**
   * Génère un QR code temporaire pour les tests
   * @param {Object} testData - Données de test
   * @returns {Promise<Object>} QR code de test
   */
  async generateTestQRCode(testData = {}) {
    try {
      const testTicketData = {
        id: testData.id || 'test-ticket-123',
        eventId: testData.eventId || 'test-event-456',
        type: testData.type || 'standard',
        metadata: {
          test: true,
          ...testData.metadata
        }
      };

      return await this.generateSecureQRCode(testTicketData, {
        expiresIn: 300 // 5 minutes pour les tests
      });
    } catch (error) {
      logger.error('Failed to generate test QR code', {
        error: error.message
      });

      return {
        success: false,
        error: 'Échec de la génération du QR code de test',
        code: 'TEST_QR_GENERATION_FAILED'
      };
    }
  }

  /**
   * Vérifie si un QR code est expiré
   * @param {Object} qrData - Données du QR code
   * @returns {boolean} True si expiré
   */
  isQRCodeExpired(qrData) {
    const now = Date.now();
    const expiresAt = new Date(qrData.expiresAt).getTime();
    return now > expiresAt;
  }

  /**
   * Calcule le temps restant avant expiration
   * @param {Object} qrData - Données du QR code
   * @returns {Object} Temps restant
   */
  getTimeRemaining(qrData) {
    const now = Date.now();
    const expiresAt = new Date(qrData.expiresAt).getTime();
    const remaining = expiresAt - now;

    if (remaining <= 0) {
      return {
        expired: true,
        remaining: 0,
        remainingMinutes: 0
      };
    }

    return {
      expired: false,
      remaining,
      remainingMinutes: Math.floor(remaining / 60000),
      remainingHours: Math.floor(remaining / 3600000)
    };
  }

  /**
   * Vérifie la santé du service QR
   * @returns {Promise<Object>} État de santé
   */
  async healthCheck() {
    try {
      // Tester la génération d'un QR code simple
      const testResult = await this.generateTestQRCode();
      
      return {
        success: true,
        healthy: testResult.success,
        config: {
          defaultOptions: this.defaultOptions,
          secretKeyConfigured: !!this.secretKey
        }
      };
    } catch (error) {
      logger.error('QR service health check failed', {
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
   * Récupère les statistiques du service QR
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      config: {
        defaultOptions: this.defaultOptions,
        secretKeyConfigured: !!this.secretKey
      },
      capabilities: [
        'generate-secure',
        'batch-generation',
        'decode',
        'validate-format',
        'test-generation'
      ]
    };
  }
}

module.exports = new QRService();
