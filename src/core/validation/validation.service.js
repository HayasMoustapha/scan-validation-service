const crypto = require('crypto');
const logger = require('../../utils/logger');

/**
 * Service de validation des QR codes
 */
class ValidationService {
  constructor() {
    this.secretKey = process.env.QR_CODE_SECRET_KEY || 'default-secret';
    this.nonceExpiry = parseInt(process.env.QR_CODE_NONCE_EXPIRY) || 300;
    this.signatureExpiry = parseInt(process.env.QR_CODE_SIGNATURE_EXPIRY) || 3600;
    this.maxScansPerTicket = parseInt(process.env.QR_CODE_MAX_SCANS_PER_TICKET) || 5;
  }

  async validateTicket(qrCodeData, scanContext = {}) {
    try {
      let ticketData;
      try {
        ticketData = JSON.parse(qrCodeData);
      } catch (error) {
        return { success: false, error: 'Format QR invalide', code: 'INVALID_QR_FORMAT' };
      }

      const structureValidation = this.validateTicketStructure(ticketData);
      if (!structureValidation.valid) {
        return { success: false, error: structureValidation.error, code: 'INVALID_TICKET_STRUCTURE' };
      }

      const signatureValidation = await this.verifySignature(ticketData);
      if (!signatureValidation.valid) {
        return { success: false, error: signatureValidation.error, code: 'INVALID_SIGNATURE' };
      }

      const nonceValidation = await this.validateNonce(ticketData.nonce);
      if (!nonceValidation.valid) {
        return { success: false, error: nonceValidation.error, code: 'INVALID_NONCE' };
      }

      const expirationValidation = this.validateExpiration(ticketData);
      if (!expirationValidation.valid) {
        return { success: false, error: expirationValidation.error, code: 'TICKET_EXPIRED' };
      }

      const eventValidation = await this.validateEvent(ticketData.eventId);
      if (!eventValidation.valid) {
        return { success: false, error: eventValidation.error, code: 'INVALID_EVENT' };
      }

      const statusValidation = await this.validateTicketStatus(ticketData.id);
      if (!statusValidation.valid) {
        return { success: false, error: statusValidation.error, code: statusValidation.code };
      }

      await this.recordScan(ticketData, scanContext);

      return {
        success: true,
        ticket: {
          id: ticketData.id,
          eventId: ticketData.eventId,
          ticketType: ticketData.type,
          status: 'valid',
          scannedAt: new Date().toISOString()
        },
        event: eventValidation.event,
        scanInfo: {
          scanId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          location: scanContext.location
        }
      };
    } catch (error) {
      logger.error('Validation failed', { error: error.message });
      return { success: false, error: 'Erreur validation', code: 'VALIDATION_ERROR' };
    }
  }

  validateTicketStructure(ticketData) {
    const requiredFields = ['id', 'eventId', 'type', 'nonce', 'signature', 'createdAt', 'expiresAt'];
    
    for (const field of requiredFields) {
      if (!ticketData[field]) {
        return { valid: false, error: `Champ manquant: ${field}` };
      }
    }

    const validTypes = ['standard', 'vip', 'premium', 'early-bird', 'student'];
    if (!validTypes.includes(ticketData.type)) {
      return { valid: false, error: `Type invalide: ${ticketData.type}` };
    }

    return { valid: true };
  }

  async verifySignature(ticketData) {
    try {
      const { signature, ...dataToVerify } = ticketData;
      const signatureString = this.createSignatureString(dataToVerify);
      
      const expectedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(signatureString)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

      return { valid: isValid, error: isValid ? null : 'Signature invalide' };
    } catch (error) {
      return { valid: false, error: 'Erreur vérification signature' };
    }
  }

  createSignatureString(data) {
    return `${data.id}|${data.eventId}|${data.type}|${data.nonce}|${data.createdAt}|${data.expiresAt}`;
  }

  async validateNonce(nonce) {
    // Placeholder pour validation Redis
    return { valid: true };
  }

  validateExpiration(ticketData) {
    const now = Date.now();
    const expiresAt = new Date(ticketData.expiresAt).getTime();
    
    if (now > expiresAt) {
      return { valid: false, error: 'Ticket expiré' };
    }
    
    return { valid: true };
  }

  async validateEvent(eventId) {
    // Placeholder pour validation événement
    return { 
      valid: true, 
      event: {
        id: eventId,
        title: 'Test Event',
        status: 'active'
      }
    };
  }

  async validateTicketStatus(ticketId) {
    // Placeholder pour validation statut
    return { valid: true };
  }

  async recordScan(ticketData, scanContext) {
    logger.validation('Scan recorded', {
      ticketId: ticketData.id,
      eventId: ticketData.eventId,
      location: scanContext.location
    });
  }

  async generateValidationReport(eventId, startDate, endDate) {
    return {
      totalScans: 0,
      uniqueTickets: 0,
      scanFrequency: {},
      topLocations: [],
      timeDistribution: {}
    };
  }

  async getTicketScanHistory(ticketId) {
    return {
      ticketId,
      scans: [],
      totalScans: 0,
      lastScan: null
    };
  }

  async getEventScanStats(eventId) {
    return {
      eventId,
      totalScans: 0,
      uniqueTickets: 0,
      scanRate: 0,
      peakHours: [],
      averageScansPerHour: 0
    };
  }

  async healthCheck() {
    return {
      success: true,
      healthy: true,
      config: {
        nonceExpiry: this.nonceExpiry,
        signatureExpiry: this.signatureExpiry,
        maxScansPerTicket: this.maxScansPerTicket
      }
    };
  }

  getStats() {
    return {
      config: {
        nonceExpiry: this.nonceExpiry,
        signatureExpiry: this.signatureExpiry,
        maxScansPerTicket: this.maxScansPerTicket
      }
    };
  }
}

module.exports = new ValidationService();
