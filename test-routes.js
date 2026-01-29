const axios = require('axios');
require('dotenv').config({ path: '.env' });

// Configuration du test
const BASE_URL = 'http://localhost:3005';

// Données de test simulées
const testData = {
  validQR: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0aWNrZXRJZCI6IlRJQ0tFVF8xMjM0NTY3ODkwIiwiZXZlbnRJZCI6IkVWRU5UXzEyMzQ1Njc4OTAiLCJ0aWNrZXRUeXBlIjoic3RhbmRhcmQiLCJ1c2VySWQiOiJVU0VSXzEyMzQ1Njc4OTAiLCJpc3N1ZWRBdCI6IjIwMjYtMDEtMjhUMjM6NDI6MDkuNjY2WiIsImV4cGlyZXNBdCI6IjIwMjYtMDEtMjlUMjM6NDI6MDkuNjY3WiIsInZlcnNpb24iOiIxLjAiLCJhbGdvcml0aG0iOiJIUzI1NiIsImlhdCI6MTc2OTY0MzcyOX0.hN0l4Fs0iBctb-tqFlewTgLN4w1vmZyggG0fIUJKsP0",
  expiredQR: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0aWNrZXRJZCI6IlRJQ0tFVF9FWFBJUkVEIiwiZXZlbnRJZCI6IkVWRU5UXzEyMzQ1Njc4OTAiLCJ0aWNrZXRUeXBlIjoic3RhbmRhcmQiLCJ1c2VySWQiOiJVU0VSX0VYUElSRUQiLCJpc3N1ZWRBdCI6IjIwMjYtMDEtMjZUMjM6NDI6MDkuNjczWiIsImV4cGlyZXNBdCI6IjIwMjYtMDEtMjdUMjM6NDI6MDkuNjczWiIsInZlcnNpb24iOiIxLjAiLCJhbGdvcml0aG0iOiJIUzI1NiIsImlhdCI6MTc2OTY0MzcyOX0.s6emQvNh7niflYexQ-5dbYUjNn9zMTOMkfBcL_gKs6w",
  invalidQR: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0aWNrZXRJZCI6IlRJQ0tFVF9JTlZBTElEIiwiZXZlbnRJZCI6IkVWRU5UX0lOVkFMSUQiLCJ0aWNrZXRUeXBlIjoic3RhbmRhcmQiLCJ1c2VySWQiOiJVU0VSX0lOVkFMSUQiLCJpc3N1ZWRBdCI6IjIwMjYtMDEtMjhUMjM6NDI6MDkuNjczWiIsImV4cGlyZXNBdCI6IjIwMjYtMDEtMjlUMjM6NDI6MDkuNjczWiIsInZlcnNpb24iOiIxLjAiLCJhbGdvcml0aG0iOiJIUzI1NiIsImlhdCI6MTc2OTY0MzcyOX0.fSzfmIeDzx0So1KMQoo1Ky1Fmi8wqiRwixxCgNybKFM",
  base64QR: "eyJ0aWNrZXRJZCI6IlRJQ0tFVF8xMjM0NTY3ODkwIiwiZXZlbnRJZCI6IkVWRU5UXzEyMzQ1Njc4OTAiLCJ0aWNrZXRUeXBlIjoic3RhbmRhcmQiLCJ1c2VySWQiOiJVU0VSXzEyMzQ1Njc4OTAifQ",
  
  scanContext: {
    location: 'Entrée Principale',
    deviceId: 'scanner_001',
    operatorId: 'operator_123'
  },

  ticketId: 'TICKET_1234567890',
  eventId: 'EVENT_1234567890'
};

// Fonction utilitaire pour les tests
async function testRoute(method, url, data = null, description = '') {
  try {
    console.log(`\n🧪 ${description}`);
    console.log(`   ${method.toUpperCase()} ${url}`);
    
    let response;
    if (method === 'GET') {
      response = await axios.get(`${BASE_URL}${url}`);
    } else if (method === 'POST') {
      response = await axios.post(`${BASE_URL}${url}`, data);
    }

    console.log(`   ✅ Status: ${response.status}`);
    console.log(`   📄 Response:`, JSON.stringify(response.data, null, 2));
    return { success: true, status: response.status, data: response.data };
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    if (error.response) {
      console.log(`   📄 Status: ${error.response.status}`);
      console.log(`   📄 Response:`, JSON.stringify(error.response.data, null, 2));
      return { success: false, status: error.response.status, data: error.response.data };
    }
    return { success: false, error: error.message };
  }
}

// Tests complets
async function runAllTests() {
  console.log('🚀 Démarrage des tests du Scan Validation Service');
  console.log('='.repeat(60));

  // Test 1: Health check principal
  await testRoute('GET', '/health', null, 'Health Check Principal');

  // Test 2: Health check détaillé
  await testRoute('GET', '/health/detailed', null, 'Health Check Détaillé');

  // Test 3: Health check readiness
  await testRoute('GET', '/health/ready', null, 'Health Check Readiness');

  // Test 4: Health check liveness
  await testRoute('GET', '/health/live', null, 'Health Check Liveness');

  // Test 5: Composants - Validation
  await testRoute('GET', '/health/components/validation', null, 'Health Check Composant Validation');

  // Test 6: Composants - QR
  await testRoute('GET', '/health/components/qr', null, 'Health Check Composant QR');

  // Test 7: Composants - Offline
  await testRoute('GET', '/health/components/offline', null, 'Health Check Composant Offline');

  // Test 8: Providers status
  await testRoute('GET', '/health/providers', null, 'Health Check Providers');

  // Test 9: Configuration
  await testRoute('GET', '/health/config', null, 'Health Check Configuration');

  // Test 10: Route racine
  await testRoute('GET', '/', null, 'Route Racine');

  // Test 11: API racine
  await testRoute('GET', '/api', null, 'API Racine');

  // Test 12: Validation QR code (avec données simulées)
  await testRoute('POST', '/api/scans/validate', {
    qrCode: testData.validQR,
    scanContext: testData.scanContext
  }, 'Validation QR Code Valide');

  await testRoute('POST', '/api/scans/validate', {
    qrCode: testData.expiredQR,
    scanContext: testData.scanContext
  }, 'Validation QR Code Expiré');

  await testRoute('POST', '/api/scans/validate', {
    qrCode: testData.invalidQR,
    scanContext: testData.scanContext
  }, 'Validation QR Code Invalide');

  await testRoute('POST', '/api/scans/validate', {
    qrCode: testData.base64QR,
    scanContext: testData.scanContext
  }, 'Validation QR Code Base64');

  // Test 15: Validation offline
  await testRoute('POST', '/api/scans/validate-offline', {
    ticketId: testData.ticketId,
    scanContext: testData.scanContext
  }, 'Validation Offline');

  // Test 16: Validation offline sans ticketId
  await testRoute('POST', '/api/scans/validate-offline', {
    scanContext: testData.scanContext
  }, 'Validation Offline Sans TicketId');

  // Test 17: Historique des scans
  await testRoute('GET', `/api/scans/history/ticket/${testData.ticketId}`, null, 'Historique des Scans');

  // Test 18: Historique des scans avec pagination
  await testRoute('GET', `/api/scans/history/ticket/${testData.ticketId}?limit=10&offset=0`, null, 'Historique des Scans avec Pagination');

  // Test 19: Statistiques événement
  await testRoute('GET', `/api/scans/stats/event/${testData.eventId}`, null, 'Statistiques Événement');

  // Test 20: Statistiques événement avec filtres
  await testRoute('GET', `/api/scans/stats/event/${testData.eventId}?startDate=2026-01-01&endDate=2026-12-31`, null, 'Statistiques Événement avec Filtres');

  // Test 21: Health check du service de scan
  await testRoute('GET', '/api/scans/health', null, 'Health Check Service de Scan');

  // Test 22: Statistiques du service
  await testRoute('GET', '/api/scans/stats', null, 'Statistiques du Service');

  // Test 23: Route inexistante (404)
  await testRoute('GET', '/api/nonexistent', null, 'Route Inexistante (404)');

  // Test 24: Méthode non autorisée
  await testRoute('DELETE', '/api/scans/validate', null, 'Méthode Non Autorisée');

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Tests terminés');
}

// Vérifier si le serveur est disponible
async function checkServer() {
  try {
    await axios.get(`${BASE_URL}/health`);
    console.log('✅ Serveur de validation disponible');
    return true;
  } catch (error) {
    console.log('❌ Serveur de validation non disponible');
    console.log('   Tentative de connexion à:', BASE_URL);
    console.log('   Erreur:', error.message);
    return false;
  }
}

// Exécuter les tests
async function main() {
  const serverAvailable = await checkServer();
  if (serverAvailable) {
    await runAllTests();
  }
}

// Gérer les erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
  console.log('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

main().catch(console.error);
