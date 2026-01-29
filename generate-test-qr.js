const jwt = require('jsonwebtoken');
const base64url = require('base64url');

/**
 * Générateur de QR codes de test pour le scan-validation-service
 */
class QRCodeGenerator {
  constructor() {
    this.secret = 'test_hmac_secret_for_testing_only';
    this.testTickets = [
      {
        ticketId: 'TICKET_1234567890',
        eventId: 'EVENT_1234567890',
        ticketType: 'standard',
        userId: 'USER_1234567890'
      },
      {
        ticketId: 'TICKET_2345678901',
        eventId: 'EVENT_1234567890',
        ticketType: 'vip',
        userId: 'USER_2345678901'
      },
      {
        ticketId: 'TICKET_EXPIRED',
        eventId: 'EVENT_1234567890',
        ticketType: 'standard',
        userId: 'USER_EXPIRED'
      },
      {
        ticketId: 'TICKET_INVALID',
        eventId: 'EVENT_INVALID',
        ticketType: 'standard',
        userId: 'USER_INVALID'
      }
    ];
  }

  /**
   * Générer un QR code JWT valide
   */
  generateValidQR(ticketData) {
    const payload = {
      ticketId: ticketData.ticketId,
      eventId: ticketData.eventId,
      ticketType: ticketData.ticketType,
      userId: ticketData.userId,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
      version: '1.0',
      algorithm: 'HS256'
    };

    return jwt.sign(payload, this.secret, { algorithm: 'HS256' });
  }

  /**
   * Générer un QR code expiré
   */
  generateExpiredQR() {
    const payload = {
      ticketId: 'TICKET_EXPIRED',
      eventId: 'EVENT_1234567890',
      ticketType: 'standard',
      userId: 'USER_EXPIRED',
      issuedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48h ago
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24h ago (expired)
      version: '1.0',
      algorithm: 'HS256'
    };

    return jwt.sign(payload, this.secret, { algorithm: 'HS256' });
  }

  /**
   * Générer un QR code invalide (signature falsifiée)
   */
  generateInvalidQR() {
    const payload = {
      ticketId: 'TICKET_INVALID',
      eventId: 'EVENT_INVALID',
      ticketType: 'standard',
      userId: 'USER_INVALID',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      version: '1.0',
      algorithm: 'HS256'
    };

    // Signature avec une mauvaise clé
    return jwt.sign(payload, 'wrong_secret', { algorithm: 'HS256' });
  }

  /**
   * Générer un QR code au format Base64 simple
   */
  generateBase64QR(ticketData) {
    const data = JSON.stringify(ticketData);
    return base64url.encode(data);
  }

  /**
   * Générer tous les QR codes de test
   */
  generateAllTestQRs() {
    const qrCodes = {
      valid: [],
      expired: [],
      invalid: [],
      base64: []
    };

    // QR codes valides
    this.testTickets.forEach(ticket => {
      qrCodes.valid.push({
        ticketId: ticket.ticketId,
        qrCode: this.generateValidQR(ticket),
        type: 'JWT',
        description: `QR code valide pour ${ticket.ticketId}`
      });
    });

    // QR code expiré
    qrCodes.expired.push({
      ticketId: 'TICKET_EXPIRED',
      qrCode: this.generateExpiredQR(),
      type: 'JWT',
      description: 'QR code expiré'
    });

    // QR code invalide
    qrCodes.invalid.push({
      ticketId: 'TICKET_INVALID',
      qrCode: this.generateInvalidQR(),
      type: 'JWT',
      description: 'QR code avec signature invalide'
    });

    // QR codes Base64
    this.testTickets.slice(0, 2).forEach(ticket => {
      qrCodes.base64.push({
        ticketId: ticket.ticketId,
        qrCode: this.generateBase64QR(ticket),
        type: 'Base64',
        description: `QR code Base64 pour ${ticket.ticketId}`
      });
    });

    return qrCodes;
  }

  /**
   * Afficher les QR codes générés
   */
  displayQRs() {
    const qrCodes = this.generateAllTestQRs();
    
    console.log('🎫 QR CODES DE TEST GÉNÉRÉS');
    console.log('='.repeat(50));
    
    console.log('\n✅ QR CODES VALIDES:');
    qrCodes.valid.forEach((qr, index) => {
      console.log(`   ${index + 1}. ${qr.description}`);
      console.log(`      Ticket ID: ${qr.ticketId}`);
      console.log(`      QR Code: ${qr.qrCode.substring(0, 50)}...`);
      console.log('');
    });

    console.log('⏰ QR CODE EXPIRÉ:');
    qrCodes.expired.forEach((qr, index) => {
      console.log(`   ${index + 1}. ${qr.description}`);
      console.log(`      Ticket ID: ${qr.ticketId}`);
      console.log(`      QR Code: ${qr.qrCode.substring(0, 50)}...`);
      console.log('');
    });

    console.log('❌ QR CODE INVALIDE:');
    qrCodes.invalid.forEach((qr, index) => {
      console.log(`   ${index + 1}. ${qr.description}`);
      console.log(`      Ticket ID: ${qr.ticketId}`);
      console.log(`      QR Code: ${qr.qrCode.substring(0, 50)}...`);
      console.log('');
    });

    console.log('📦 QR CODES BASE64:');
    qrCodes.base64.forEach((qr, index) => {
      console.log(`   ${index + 1}. ${qr.description}`);
      console.log(`      Ticket ID: ${qr.ticketId}`);
      console.log(`      QR Code: ${qr.qrCode.substring(0, 50)}...`);
      console.log('');
    });

    return qrCodes;
  }
}

// Exécution
if (require.main === module) {
  const generator = new QRCodeGenerator();
  const qrCodes = generator.displayQRs();
  
  // Exporter pour les tests
  console.log('\n📋 DONNÉES DE TEST POUR LES ROUTES:');
  console.log('='.repeat(50));
  
  const testData = {
    validQR: qrCodes.valid[0].qrCode,
    expiredQR: qrCodes.expired[0].qrCode,
    invalidQR: qrCodes.invalid[0].qrCode,
    base64QR: qrCodes.base64[0].qrCode,
    scanContext: {
      location: 'Entrée Principale',
      deviceId: 'device_001',
      operatorId: 'operator_001'
    }
  };
  
  console.log('✅ Données pour test-routes.js:');
  console.log(JSON.stringify(testData, null, 2));
}

module.exports = QRCodeGenerator;
