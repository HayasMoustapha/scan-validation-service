const crypto = require('crypto');
const base64url = require('base64url');
const logger = require('../../utils/logger');

/**
 * Service de décodage et validation cryptographique des QR codes
 * Responsabilité : DÉCODAGE et VALIDATION SÉCURISÉE uniquement
 */
class QRDecoderService {
  constructor() {
    // Clés partagées avec ticket-generator pour la validation
    this.hmacSecret = process.env.QR_HMAC_SECRET || 'default-hmac-secret-change-in-production';
    this.rsaPublicKey = this.loadRSAPublicKey();
    
    // Versions supportées des QR codes
    this.supportedVersions = ['1.0', '1.1'];
    
    // Algorithmes de signature supportés
    this.supportedAlgorithms = ['HS256', 'RS256'];
    
    // Temps maximum de validité d'un QR code (en secondes)
    this.maxQRValidity = parseInt(process.env.QR_MAX_VALIDITY) || 86400; // 24h
    
    // Taille maximale du payload QR (en bytes)
    this.maxQRSize = parseInt(process.env.QR_MAX_SIZE) || 4096;
  }

  /**
   * Charge la clé publique RSA depuis les variables d'environnement ou un fichier
   * @returns {string|null} Clé publique RSA ou null si non configurée
   */
  loadRSAPublicKey() {
    try {
      const publicKey = process.env.QR_RSA_PUBLIC_KEY;
      if (publicKey) {
        return publicKey;
      }
      
      // Essayer de charger depuis un fichier
      const fs = require('fs');
      const path = require('path');
      const keyPath = path.join(__dirname, '../../../config/rsa-public.pem');
      
      if (fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath, 'utf8');
      }
      
      logger.warn('RSA public key not configured, using HMAC only');
      return null;
    } catch (error) {
      logger.error('Failed to load RSA public key', { error: error.message });
      return null;
    }
  }

  /**
   * Décode un QR code et valide son intégrité cryptographique
   * @param {string} qrCode - QR code sous forme de string (Base64, JSON, JWT-like)
   * @returns {Promise<Object>} Résultat du décodage avec données validées
   */
  async decodeAndValidateQR(qrCode) {
    try {
      logger.qr('Starting QR code decoding and validation', {
        qrCodeLength: qrCode?.length || 0,
        qrCodeType: this.detectQRType(qrCode)
      });

      // Validation basique du format
      if (!qrCode || typeof qrCode !== 'string') {
        return {
          success: false,
          error: 'QR code invalide ou manquant',
          code: 'MISSING_OR_INVALID_QR'
        };
      }

      if (qrCode.length > this.maxQRSize) {
        return {
          success: false,
          error: 'QR code trop volumineux',
          code: 'QR_CODE_TOO_LARGE'
        };
      }

      // Détecter et décoder selon le format
      let decodedData;
      let formatType;

      if (this.isJWTFormat(qrCode)) {
        const result = await this.decodeJWTFormat(qrCode);
        if (!result.success) return result;
        decodedData = result.data;
        formatType = 'JWT';
      } else if (this.isBase64Format(qrCode)) {
        const result = await this.decodeBase64Format(qrCode);
        if (!result.success) return result;
        decodedData = result.data;
        formatType = 'Base64';
      } else if (this.isJSONFormat(qrCode)) {
        const result = await this.decodeJSONFormat(qrCode);
        if (!result.success) return result;
        decodedData = result.data;
        formatType = 'JSON';
      } else {
        return {
          success: false,
          error: 'Format QR code non reconnu',
          code: 'UNSUPPORTED_QR_FORMAT'
        };
      }

      // Validation cryptographique
      const cryptoValidation = await this.validateCryptographicSignature(decodedData);
      if (!cryptoValidation.valid) {
        return {
          success: false,
          error: cryptoValidation.error,
          code: 'INVALID_CRYPTOGRAPHIC_SIGNATURE',
          fraudFlags: {
            type: 'FORGED_QR',
            severity: 'HIGH',
            details: cryptoValidation.details
          }
        };
      }

      // Validation de la structure et des métadonnées
      const structureValidation = this.validateQRStructure(decodedData);
      if (!structureValidation.valid) {
        return {
          success: false,
          error: structureValidation.error,
          code: 'INVALID_QR_STRUCTURE'
        };
      }

      // Validation de la version
      if (!this.supportedVersions.includes(decodedData.version)) {
        return {
          success: false,
          error: `Version QR non supportée: ${decodedData.version}`,
          code: 'UNSUPPORTED_QR_VERSION'
        };
      }

      // Validation de l'expiration
      const expirationValidation = this.validateQRExpiration(decodedData);
      if (!expirationValidation.valid) {
        return {
          success: false,
          error: expirationValidation.error,
          code: 'QR_CODE_EXPIRED'
        };
      }

      logger.qr('QR code decoded and validated successfully', {
        ticketId: decodedData.ticketId,
        eventId: decodedData.eventId,
        formatType,
        algorithm: decodedData.algorithm,
        version: decodedData.version
      });

      return {
        success: true,
        data: {
          ticketId: decodedData.ticketId,
          eventId: decodedData.eventId,
          ticketType: decodedData.ticketType,
          userId: decodedData.userId,
          issuedAt: decodedData.issuedAt,
          expiresAt: decodedData.expiresAt,
          checksum: decodedData.checksum,
          metadata: decodedData.metadata || {},
          formatType,
          algorithm: decodedData.algorithm,
          version: decodedData.version
        },
        validationInfo: {
          formatType,
          algorithm: decodedData.algorithm,
          version: decodedData.version,
          validatedAt: new Date().toISOString(),
          cryptographicMethod: cryptoValidation.method
        }
      };

    } catch (error) {
      logger.error('QR code decoding failed', {
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: 'Erreur lors du décodage du QR code',
        code: 'QR_DECODING_ERROR',
        technicalDetails: error.message
      };
    }
  }

  /**
   * Détecte le type de QR code
   * @param {string} qrCode - QR code à analyser
   * @returns {string} Type détecté
   */
  detectQRType(qrCode) {
    if (this.isJWTFormat(qrCode)) return 'JWT';
    if (this.isBase64Format(qrCode)) return 'Base64';
    if (this.isJSONFormat(qrCode)) return 'JSON';
    return 'Unknown';
  }

  /**
   * Vérifie si le QR code est au format JWT
   * @param {string} qrCode - QR code à vérifier
   * @returns {boolean} True si format JWT
   */
  isJWTFormat(qrCode) {
    const parts = qrCode.split('.');
    return parts.length === 3 && parts.every(part => part.length > 0);
  }

  /**
   * Vérifie si le QR code est au format Base64
   * @param {string} qrCode - QR code à vérifier
   * @returns {boolean} True si format Base64
   */
  isBase64Format(qrCode) {
    try {
      const decoded = base64url.decode(qrCode);
      JSON.parse(decoded);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Vérifie si le QR code est au format JSON direct
   * @param {string} qrCode - QR code à vérifier
   * @returns {boolean} True si format JSON
   */
  isJSONFormat(qrCode) {
    try {
      JSON.parse(qrCode);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Décode un QR code au format JWT
   * @param {string} qrCode - QR code JWT
   * @returns {Promise<Object>} Résultat du décodage
   */
  async decodeJWTFormat(qrCode) {
    try {
      const parts = qrCode.split('.');
      
      // Décoder le header
      const header = JSON.parse(base64url.decode(parts[0]));
      
      // Décoder le payload
      const payload = JSON.parse(base64url.decode(parts[1]));
      
      // Valider l'algorithme
      if (!this.supportedAlgorithms.includes(header.alg)) {
        return {
          success: false,
          error: `Algorithme JWT non supporté: ${header.alg}`,
          code: 'UNSUPPORTED_JWT_ALGORITHM'
        };
      }

      // Combiner header et payload pour la validation
      const dataToValidate = {
        ...payload,
        algorithm: header.alg,
        version: header.version || '1.0',
        signature: parts[2]
      };

      return {
        success: true,
        data: dataToValidate
      };
    } catch (error) {
      return {
        success: false,
        error: 'Format JWT invalide',
        code: 'INVALID_JWT_FORMAT'
      };
    }
  }

  /**
   * Décode un QR code au format Base64
   * @param {string} qrCode - QR code Base64
   * @returns {Promise<Object>} Résultat du décodage
   */
  async decodeBase64Format(qrCode) {
    try {
      const decoded = base64url.decode(qrCode);
      const data = JSON.parse(decoded);
      
      // Ajouter des métadonnées si manquantes
      if (!data.algorithm) data.algorithm = 'HS256';
      if (!data.version) data.version = '1.0';

      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: 'Format Base64 invalide',
        code: 'INVALID_BASE64_FORMAT'
      };
    }
  }

  /**
   * Décode un QR code au format JSON
   * @param {string} qrCode - QR code JSON
   * @returns {Promise<Object>} Résultat du décodage
   */
  async decodeJSONFormat(qrCode) {
    try {
      const data = JSON.parse(qrCode);
      
      // Ajouter des métadonnées si manquantes
      if (!data.algorithm) data.algorithm = 'HS256';
      if (!data.version) data.version = '1.0';

      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: 'Format JSON invalide',
        code: 'INVALID_JSON_FORMAT'
      };
    }
  }

  /**
   * Valide la signature cryptographique des données du QR code
   * @param {Object} data - Données à valider
   * @returns {Promise<Object>} Résultat de la validation
   */
  async validateCryptographicSignature(data) {
    try {
      const algorithm = data.algorithm || 'HS256';
      
      if (algorithm === 'HS256') {
        return await this.validateHMACSignature(data);
      } else if (algorithm === 'RS256') {
        return await this.validateRSASignature(data);
      } else {
        return {
          valid: false,
          error: `Algorithme non supporté: ${algorithm}`,
          details: { algorithm }
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: 'Erreur lors de la validation cryptographique',
        details: { technical: error.message }
      };
    }
  }

  /**
   * Valide une signature HMAC
   * @param {Object} data - Données avec signature HMAC
   * @returns {Object} Résultat de la validation
   */
  async validateHMACSignature(data) {
    if (!data.signature) {
      return {
        valid: false,
        error: 'Signature HMAC manquante',
        details: { reason: 'missing_signature' }
      };
    }

    // Créer la chaîne à signer
    const stringToSign = this.createSignatureString(data);
    
    // Calculer la signature attendue
    const expectedSignature = crypto
      .createHmac('sha256', this.hmacSecret)
      .update(stringToSign)
      .digest('hex');

    // Comparaison sécurisée des signatures
    const isValid = crypto.timingSafeEqual(
      Buffer.from(data.signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    return {
      valid: isValid,
      error: isValid ? null : 'Signature HMAC invalide',
      method: 'HMAC-SHA256',
      details: isValid ? null : { 
        reason: 'signature_mismatch',
        expected: expectedSignature.substring(0, 16) + '...',
        received: data.signature.substring(0, 16) + '...'
      }
    };
  }

  /**
   * Valide une signature RSA
   * @param {Object} data - Données avec signature RSA
   * @returns {Object} Résultat de la validation
   */
  async validateRSASignature(data) {
    if (!this.rsaPublicKey) {
      return {
        valid: false,
        error: 'Clé RSA publique non configurée',
        details: { reason: 'rsa_key_not_configured' }
      };
    }

    if (!data.signature) {
      return {
        valid: false,
        error: 'Signature RSA manquante',
        details: { reason: 'missing_signature' }
      };
    }

    try {
      const stringToSign = this.createSignatureString(data);
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(stringToSign);
      
      const isValid = verify.verify(this.rsaPublicKey, data.signature, 'hex');

      return {
        valid: isValid,
        error: isValid ? null : 'Signature RSA invalide',
        method: 'RSA-SHA256',
        details: isValid ? null : { reason: 'signature_mismatch' }
      };
    } catch (error) {
      return {
        valid: false,
        error: 'Erreur lors de la validation RSA',
        details: { technical: error.message }
      };
    }
  }

  /**
   * Crée la chaîne de caractères utilisée pour la signature
   * @param {Object} data - Données du QR code (sans la signature)
   * @returns {string} Chaîne à signer
   */
  createSignatureString(data) {
    const { signature, ...dataToSign } = data;
    
    // Ordre strict des champs pour la cohérence
    const fields = [
      'ticketId',
      'eventId',
      'ticketType',
      'userId',
      'issuedAt',
      'expiresAt',
      'version',
      'algorithm'
    ];

    const values = fields.map(field => dataToSign[field] || '');
    return values.join('|');
  }

  /**
   * Valide la structure des données du QR code
   * @param {Object} data - Données à valider
   * @returns {Object} Résultat de la validation
   */
  validateQRStructure(data) {
    const requiredFields = ['ticketId', 'eventId', 'ticketType', 'issuedAt', 'expiresAt'];
    
    for (const field of requiredFields) {
      if (!data[field]) {
        return {
          valid: false,
          error: `Champ obligatoire manquant: ${field}`
        };
      }
    }

    // Validation des formats
    if (typeof data.ticketId !== 'string' || data.ticketId.length < 1) {
      return {
        valid: false,
        error: 'ticketId invalide'
      };
    }

    if (typeof data.eventId !== 'string' || data.eventId.length < 1) {
      return {
        valid: false,
        error: 'eventId invalide'
      };
    }

    const validTicketTypes = ['standard', 'vip', 'premium', 'early-bird', 'student', 'staff'];
    if (!validTicketTypes.includes(data.ticketType)) {
      return {
        valid: false,
        error: `ticketType invalide: ${data.ticketType}`
      };
    }

    // Validation des dates
    const issuedAt = new Date(data.issuedAt);
    const expiresAt = new Date(data.expiresAt);
    
    if (isNaN(issuedAt.getTime()) || isNaN(expiresAt.getTime())) {
      return {
        valid: false,
        error: 'Format de date invalide'
      };
    }

    if (expiresAt <= issuedAt) {
      return {
        valid: false,
        error: 'La date d\'expiration doit être postérieure à la date d\'émission'
      };
    }

    return { valid: true };
  }

  /**
   * Valide l'expiration du QR code
   * @param {Object} data - Données du QR code
   * @returns {Object} Résultat de la validation
   */
  validateQRExpiration(data) {
    const now = new Date();
    const expiresAt = new Date(data.expiresAt);
    const issuedAt = new Date(data.issuedAt);

    // Vérifier si le QR code est expiré
    if (now > expiresAt) {
      return {
        valid: false,
        error: 'QR code expiré'
      };
    }

    // Vérifier si le QR code est trop vieux (sécurité)
    const maxAge = this.maxQRValidity * 1000; // Convertir en millisecondes
    if (now.getTime() - issuedAt.getTime() > maxAge) {
      return {
        valid: false,
        error: 'QR code trop ancien'
      };
    }

    return { valid: true };
  }

  /**
   * Vérifie l'état de santé du service
   * @returns {Promise<Object>} État de santé
   */
  async healthCheck() {
    return {
      success: true,
      healthy: true,
      config: {
        supportedVersions: this.supportedVersions,
        supportedAlgorithms: this.supportedAlgorithms,
        maxQRValidity: this.maxQRValidity,
        maxQRSize: this.maxQRSize,
        hasRSAKey: !!this.rsaPublicKey,
        hasHMACSecret: !!this.hmacSecret && this.hmacSecret !== 'default-hmac-secret-change-in-production'
      }
    };
  }

  /**
   * Retourne les statistiques du service
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      config: {
        supportedVersions: this.supportedVersions,
        supportedAlgorithms: this.supportedAlgorithms,
        maxQRValidity: this.maxQRValidity,
        maxQRSize: this.maxQRSize,
        hasRSAKey: !!this.rsaPublicKey
      }
    };
  }
}

module.exports = new QRDecoderService();
