/**
 * TEST DES ENDPOINTS INTERNES DU CORE SERVICE
 * Utilise le scan-validation-service pour tester les nouveaux endpoints
 */

const axios = require('axios');

const CORE_URL = 'http://localhost:3001';

async function testCoreInternalEndpoints() {
  console.log('🧪 TEST DES ENDPOINTS INTERNES DU CORE SERVICE');
  console.log('==========================================');

  const tests = [
    {
      name: 'Health Check Core',
      method: 'GET',
      url: `${CORE_URL}/health`
    },
    {
      name: 'Validation Endpoint',
      method: 'POST',
      url: `${CORE_URL}/api/internal/validation/validate-ticket`,
      data: {
        ticketId: 'test_ticket_123',
        eventId: 'test_event_456',
        ticketType: 'standard',
        userId: 'test_user_789',
        scanContext: {
          location: 'main_entrance',
          deviceId: 'scanner_001',
          timestamp: new Date().toISOString(),
          operatorId: 'operator_123'
        }
      }
    },
    {
      name: 'Events Validation',
      method: 'GET',
      url: `${CORE_URL}/api/internal/events/test_event_456/validate`
    },
    {
      name: 'Tickets Status',
      method: 'GET',
      url: `${CORE_URL}/api/internal/tickets/test_ticket_123/status`
    },
    {
      name: 'Scans Record',
      method: 'POST',
      url: `${CORE_URL}/api/internal/scans/record`,
      data: {
        ticketId: 'test_ticket_123',
        eventId: 'test_event_456',
        userId: 'test_user_789',
        scanType: 'validation',
        scanContext: {
          location: 'main_entrance',
          deviceId: 'scanner_001',
          timestamp: new Date().toISOString()
        },
        validationResult: {
          valid: true,
          status: 'validated'
        }
      }
    }
  ];

  let successCount = 0;
  let totalCount = tests.length;

  for (const test of tests) {
    try {
      console.log(`\n📍 Test: ${test.name}`);
      
      let response;
      const startTime = Date.now();
      
      if (test.method === 'GET') {
        response = await axios.get(test.url, { timeout: 5000 });
      } else if (test.method === 'POST') {
        response = await axios.post(test.url, test.data, { timeout: 5000 });
      }
      
      const responseTime = Date.now() - startTime;
      
      if (response.status >= 200 && response.status < 300) {
        console.log(`   ✅ Succès (${response.status} - ${responseTime}ms)`);
        successCount++;
      } else {
        console.log(`   ⚠️  Réponse inattendue (${response.status})`);
      }
      
      console.log(`   📋 Réponse:`, JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
      
    } catch (error) {
      console.log(`   ❌ Échec: ${error.message}`);
      if (error.response) {
        console.log(`   📋 Erreur ${error.response.status}:`, JSON.stringify(error.response.data, null, 2).substring(0, 200) + '...');
      }
    }
  }

  console.log('\n📊 RÉSULTATS FINAUX');
  console.log('==================');
  console.log(`✅ Tests réussis: ${successCount}/${totalCount}`);
  console.log(`📈 Taux de succès: ${((successCount / totalCount) * 100).toFixed(1)}%`);
  
  if (successCount === totalCount) {
    console.log('\n🎉 TOUS LES ENDPOINTS INTERNES FONCTIONNELS !');
  } else if (successCount > 0) {
    console.log('\n⚠️ CERTAINS ENDPOINTS FONCTIONNELS - Vérifier les erreurs');
  } else {
    console.log('\n❌ AUCUN ENDPOINT FONCTIONNEL - Core service probablement arrêté');
  }
}

// Exécuter les tests
testCoreInternalEndpoints().catch(console.error);
