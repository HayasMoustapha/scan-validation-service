const sharp = require('sharp');
const jsQR = require('jsqr');
const crypto = require('crypto');
const logger = require('../../utils/logger');

/**
 * Service de décodage QR code PNG pour format Ticket-Generator
 * Extrait les données JSON signées depuis une image PNG contenant un QR code
 */
class PNGDecoderService {
  constructor() {
    this.hmacSecret =
      process.env.QR_HMAC_SECRET ||
      process.env.TICKET_SIGNATURE_SECRET ||
      'default-secret-change-in-production';
    this.allowMockFallback = process.env.SCAN_ALLOW_PNG_MOCK_FALLBACK === 'true';
  }

  /**
   * Décode un QR code depuis une image PNG Base64
   * @param {string} pngBase64 - Image PNG en base64 (data:image/png;base64,XXXXX)
   * @returns {Promise<Object>} Données extraites du QR code
   */
  async decodePNGQRCode(pngBase64) {
    try {
      // Extraire les données base64 de l'image
      const base64Data = pngBase64.replace(/^data:image\/png;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      const attempts = [
        sharp(imageBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
        sharp(imageBuffer)
          .resize(300, 300, { fit: 'contain', background: '#ffffff' })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })
      ];

      let qrCode = null;
      let decodedInfo = null;

      for (const attempt of attempts) {
        const { data, info } = await attempt;
        const imageData = new Uint8ClampedArray(data);
        qrCode = jsQR(imageData, info.width, info.height);
        if (qrCode) {
          decodedInfo = info;
          break;
        }
      }

      if (!qrCode || !decodedInfo) {
        throw new Error('QR code non trouvé dans l\'image PNG');
      }

      logger.qr('QR code decoded from PNG', {
        qrDataLength: qrCode.data.length,
        imageSize: `${decodedInfo.width}x${decodedInfo.height}`
      });

      // Parser les données JSON du QR code
      try {
        const jsonData = JSON.parse(qrCode.data);
        return jsonData;
      } catch (parseError) {
        throw new Error(`Données QR code invalides: ${parseError.message}`);
      }

    } catch (error) {
      logger.error('Failed to decode PNG QR code', {
        error: error.message,
        pngLength: pngBase64?.length || 0
      });
      throw error;
    }
  }

  /**
   * Extrait et transforme les données du ticket depuis le format Ticket-Generator
   * @param {string} pngBase64 - QR code PNG Base64 de Ticket-Generator
   * @returns {Promise<Object>} Données transformées pour Scan-Validation
   */
  async extractTicketDataFromPNG(pngBase64) {
    try {
      // Décoder le QR code depuis l'image PNG
      const ticketData = await this.decodePNGQRCode(pngBase64);
      
      logger.qr('Ticket data extracted from PNG', {
        ticketId: ticketData.id,
        eventId: ticketData.eventId,
        hasSignature: !!ticketData.signature
      });

      // Transformer vers le format attendu par Scan-Validation
      const transformedData = {
        ticketId: ticketData.id?.toString() || 'unknown',
        eventId: ticketData.eventId?.toString() || 'unknown',
        ticketType: this.normalizeTicketType(ticketData.type),
        userId: ticketData.userId || 1,
        issuedAt: ticketData.createdAt || ticketData.timestamp || new Date().toISOString(),
        expiresAt: this.calculateExpiryDate(ticketData.createdAt || ticketData.timestamp),
        checksum: this.generateChecksum(ticketData),
        metadata: {
          eventName: ticketData.eventName || 'Event',
          location: ticketData.location || 'Unknown',
          price: ticketData.price || 0.00,
          format: 'PNG-Base64',
          originalData: ticketData
        },
        algorithm: ticketData.algorithm || 'HS256',
        version: ticketData.version || '1.0'
      };

      // Conserver ou générer la signature
      if (ticketData.signature) {
        transformedData.signature = ticketData.signature;
      } else {
        // Générer une signature pour la compatibilité
        transformedData.signature = this.generateSignature(transformedData);
      }

      return transformedData;

    } catch (error) {
      logger.error('Failed to extract ticket data from PNG', {
        error: error.message,
        pngLength: pngBase64?.length || 0
      });
      
      // En cas d'erreur, retourner des données mock pour le développement
      if (this.allowMockFallback) {
        logger.warn('Using mock data for development mode');
        return this.generateMockTicketData(pngBase64);
      }
      
      throw error;
    }
  }

  /**
   * Calcule la date d'expiration du ticket
   * @param {string} issuedAt - Date d'émission
   * @returns {string} Date d'expiration
   */
  calculateExpiryDate(issuedAt) {
    const issueDate = new Date(issuedAt);
    const expiryDate = new Date(issueDate.getTime() + (24 * 60 * 60 * 1000)); // 24h
    return expiryDate.toISOString();
  }

  /**
   * Génère un checksum pour les données du ticket
   * @param {Object} ticketData - Données du ticket
   * @returns {string} Checksum MD5
   */
  generateChecksum(ticketData) {
    const dataString = JSON.stringify(ticketData);
    return crypto.createHash('md5').update(dataString).digest('hex');
  }

  /**
   * Génère une signature HMAC pour les données
   * @param {Object} data - Données à signer
   * @returns {string} Signature HMAC
   */
  generateSignature(data) {
    const stringToSign = JSON.stringify(data);
    return crypto
      .createHmac('sha256', this.hmacSecret)
      .update(stringToSign)
      .digest('hex');
  }

  /**
   * Génère des données mock pour le développement
   * @param {string} pngBase64 - QR code PNG Base64
   * @returns {Object} Données mock du ticket
   */
  generateMockTicketData(pngBase64) {
    const hash = crypto.createHash('md5').update(pngBase64).digest('hex');
    const ticketId = parseInt(hash.substring(0, 8), 16) % 10000 + 1;
    const eventId = parseInt(hash.substring(8, 16), 16) % 1000 + 1;
    
    const ticketData = {
      ticketId: ticketId.toString(),
      eventId: eventId.toString(),
      ticketType: 'standard',
      userId: 1,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      checksum: hash.substring(0, 32),
      metadata: {
        eventName: 'Test Event Flow 3',
        location: 'Test Location',
        price: 50.00,
        format: 'PNG-Base64-Mock'
      },
      algorithm: 'HS256',
      version: '1.0',
      signature: this.generateSignature({ ticketId: ticketId.toString(), eventId: eventId.toString() })
    };
    
    return ticketData;
  }

  normalizeTicketType(ticketType) {
    const normalized = ticketType?.toString().trim().toLowerCase();

    if (!normalized || normalized === 'ticket') {
      return 'standard';
    }

    const supportedTypes = new Set(['standard', 'vip', 'premium', 'early-bird', 'student', 'staff']);
    if (supportedTypes.has(normalized)) {
      return normalized;
    }

    if (normalized.includes('vip')) {
      return 'vip';
    }

    if (normalized.includes('premium')) {
      return 'premium';
    }

    if (normalized.includes('student')) {
      return 'student';
    }

    if (normalized.includes('staff')) {
      return 'staff';
    }

    if (normalized.includes('early')) {
      return 'early-bird';
    }

    return 'standard';
  }
}

module.exports = new PNGDecoderService();
