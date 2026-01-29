/**
 * TEST DE LA ROUTE QR CODE DEPUIS SCAN-VALIDATION-SERVICE
 * Test la communication avec la nouvelle route /api/tickets/validate-qr
 */

const axios = require('axios');

const CORE_URL = 'http://localhost:3001';

async function testQRValidationFromScanService() {
  console.log('🧪 TEST DE VALIDATION QR CODE (DEPUIS SCAN SERVICE)');
  console.log('==================================================');

  const testCases = [
    {
      name: 'QR Code JSON complet',
      qr_code: JSON.stringify({
        ticketId: 'ticket_test_123',
        eventId: 'event_test_456',
        userId: 'user_test_789',
        exp: 1704067200,
        signature: 'test_signature'
      }),
      scan_context: {
        event_id: 'event_test_456',
        location: 'main_entrance',
        device_id: 'scanner_001',
        timestamp: new Date().toISOString(),
        operator_id: 'operator_123',
        checkpoint_id: 'checkpoint_main'
      },
      validation_options: {
        strict_mode: false,
        check_fraud: false, // Désactivé pour éviter l'appel au service externe
        allow_used: false
      }
    },
    {
      name: 'QR Code format simple',
      qr_code: 'ticket_test_456:event_test_123:user_test_789',
      scan_context: {
        location: 'side_entrance',
        device_id: 'scanner_002',
        timestamp: new Date().toISOString()
      }
    },
    {
      name: 'QR Code UUID',
      qr_code: '550e8400-e29b-41d4-a716-446655440000',
      scan_context: {
        location: 'vip_entrance',
        device_id: 'scanner_003'
      }
    },
    {
      name: 'QR Code invalide (test middleware)',
      qr_code: '',
      scan_context: {
        location: 'test'
      }
    }
  ];

  let successCount = 0;
  let totalCount = testCases.length;

  for (const testCase of testCases) {
    try {
      console.log(`\n📍 Test: ${testCase.name}`);
      
      const payload = {
        qr_code: testCase.qr_code,
        scan_context: testCase.scan_context,
        validation_options: testCase.validation_options || {}
      };

      const startTime = Date.now();
      
      const response = await axios.post(`${CORE_URL}/api/tickets/validate-qr`, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test_token', // Token de test pour bypass auth
          'X-Service-Name': 'scan-validation-service' // Identifier le service appelant
        }
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.status >= 200 && response.status < 300) {
        console.log(`   ✅ Succès (${response.status} - ${responseTime}ms)`);
        console.log(`   📋 Message: ${response.data.message || 'Validation processed'}`);
        
        if (response.data.data?.validation) {
          console.log(`   🔍 Validation: ${response.data.data.validation.valid ? 'Valide' : 'Invalide'}`);
          console.log(`   📍 Service: ${response.data.data.validation.service}`);
        }
        
        if (response.data.data?.ticket) {
          console.log(`   🎫 Ticket ID: ${response.data.data.ticket.id}`);
        }
        
        successCount++;
      } else {
        console.log(`   ⚠️  Réponse inattendue (${response.status})`);
      }
      
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.error || error.response.data?.message || 'Unknown error';
        
        // Certains codes d'erreur sont attendus pour les tests négatifs
        if (testCase.name.includes('invalide') || testCase.name.includes('vide')) {
          console.log(`   ✅ Erreur attendue (${status}): ${message}`);
          successCount++;
        } else {
          console.log(`   ❌ Erreur inattendue (${status}): ${message}`);
        }
        
        if (error.response.data?.details) {
          console.log(`   📋 Détails: ${error.response.data.details}`);
        }
      } else {
        console.log(`   ❌ Erreur réseau: ${error.message}`);
        console.log(`   💡 Le service Core est probablement arrêté`);
      }
    }
  }

  console.log('\n📊 RÉSULTATS FINAUX');
  console.log('==================');
  console.log(`✅ Tests réussis: ${successCount}/${totalCount}`);
  console.log(`📈 Taux de succès: ${((successCount / totalCount) * 100).toFixed(1)}%`);
  
  if (successCount === totalCount) {
    console.log('\n🎉 ROUTE QR CODE PLEINEMENT FONCTIONNELLE !');
    console.log('📋 Le scan-validation-service peut communiquer avec le Core');
  } else if (successCount > 0) {
    console.log('\n⚠️ CERTAINS TESTS RÉUSSIS - Vérifier les erreurs');
  } else {
    console.log('\n❌ AUCUN TEST RÉUSSI - Core service probablement arrêté');
  }

  // Test spécifique du middleware de validation
  console.log('\n🔍 TEST SPÉCIFIQUE DU MIDDLEWARE');
  console.log('================================');

  try {
    const invalidPayload = {
      // qr_code manquant pour tester le middleware
      scan_context: {
        location: 'test'
      }
    };

    const response = await axios.post(`${CORE_URL}/api/tickets/validate-qr`, invalidPayload, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test_token'
      }
    });

    console.log('❌ Le middleware n\'a pas bloqué la requête invalide');
    
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Middleware de validation QR code fonctionnel');
      console.log(`   📋 Erreur: ${error.response.data.error}`);
      
      if (error.response.data.details && Array.isArray(error.response.data.details)) {
        error.response.data.details.forEach(detail => {
          console.log(`   • ${detail.field}: ${detail.message}`);
        });
      }
    } else {
      console.log('❌ Erreur inattendue lors du test du middleware');
    }
  }
}

// Exécuter les tests
testQRValidationFromScanService().catch(console.error);
