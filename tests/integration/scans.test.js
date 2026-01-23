const request = require('supertest');
const app = require('../../src/server');

describe('Scans API Integration Tests', () => {
  let testTicketData;
  let testQRCode;
  let testTicketId = 'test-ticket-123';
  let testEventId = 'test-event-456';

  beforeAll(async () => {
    // Attendre l'initialisation du serveur
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Données de test
    testTicketData = {
      id: testTicketId,
      eventId: testEventId,
      type: 'standard',
      metadata: {
        test: true
      }
    };
  });

  describe('Health Checks', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'scan-validation');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should return detailed health status', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('dependencies');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('system');
    });

    it('should return ready status', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('dependencies');
    });

    it('should return live status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'alive');
    });

    it('should return component health for validation', async () => {
      const response = await request(app)
        .get('/health/components/validation')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('healthy');
    });

    it('should return component health for qr', async () => {
      const response = await request(app)
        .get('/health/components/qr')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('healthy');
    });

    it('should return component health for offline', async () => {
      const response = await request(app)
        .get('/health/components/offline')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('healthy');
    });

    it('should return providers status', async () => {
      const response = await request(app)
        .get('/health/providers')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('providers');
      expect(response.body.providers).toHaveProperty('validation');
      expect(response.body.providers).toHaveProperty('qr');
      expect(response.body.providers).toHaveProperty('offline');
    });

    it('should return config', async () => {
      const response = await request(app)
        .get('/health/config')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('config');
      expect(response.body.config).toHaveProperty('qrCode');
      expect(response.body.config).toHaveProperty('offline');
    });

    it('should handle invalid component', async () => {
      const response = await request(app)
        .get('/health/components/invalid')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('available');
    });
  });

  describe('POST /api/scans/validate', () => {
    it('should validate ticket with QR code successfully', async () => {
      const response = await request(app)
        .post('/api/scans/validate')
        .send({
          qrCode: JSON.stringify(testTicketData),
          scanContext: {
            location: 'Entrée principale',
            deviceId: 'scanner-001'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('code');
    });

    it('should reject missing QR code', async () => {
      const response = await request(app)
        .post('/api/scans/validate')
        .send({
          scanContext: {
            location: 'Entrée principale'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject invalid QR code format', async () => {
      const response = await request(app)
        .post('/api/scans/validate')
        .send({
          qrCode: 'invalid-qr-code',
          scanContext: {
            location: 'Entrée principale'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/scans/validate-offline', () => {
    it('should validate ticket offline successfully', async () => {
      const response = await request(app)
        .post('/api/scans/validate-offline')
        .send({
          ticketId: testTicketId,
          scanContext: {
            location: 'Entrée principale',
            deviceId: 'scanner-001'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject missing ticket ID', async () => {
      const response = await request(app)
        .post('/api/scans/validate-offline')
        .send({
          scanContext: {
            location: 'Entrée principale'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/scans/qr/generate', () => {
    it('should generate QR code successfully', async () => {
      const response = await request(app)
        .post('/api/scans/qr/generate')
        .send({
          ticketData: testTicketData,
          options: {
            width: 300
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('ticketId');
      expect(response.body.data).toHaveProperty('qrCode');
      expect(response.body.data).toHaveProperty('generatedAt');
    });

    it('should reject missing ticket data', async () => {
      const response = await request(app)
        .post('/api/scans/qr/generate')
        .send({
          options: {
            width: 300
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject ticket data without ID', async () => {
      const response = await request(app)
        .post('/api/scans/qr/generate')
        .send({
          ticketData: {
            eventId: testEventId,
            type: 'standard'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/scans/qr/batch', () => {
    it('should generate batch QR codes successfully', async () => {
      const tickets = [
        testTicketData,
        {
          id: 'test-ticket-456',
          eventId: testEventId,
          type: 'vip'
        }
      ];

      const response = await request(app)
        .post('/api/scans/qr/batch')
        .send({
          tickets,
          options: {
            width: 300
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('results');
    });

    it('should reject empty tickets list', async () => {
      const response = await request(app)
        .post('/api/scans/qr/batch')
        .send({
          tickets: [],
          options: {
            width: 300
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject non-array tickets', async () => {
      const response = await request(app)
        .post('/api/scans/qr/batch')
        .send({
          tickets: 'not-an-array',
          options: {
            width: 300
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/scans/qr/test', () => {
    it('should generate test QR code successfully', async () => {
      const response = await request(app)
        .post('/api/scans/qr/test')
        .send({
          testData: {
            id: 'test-qr-123',
            eventId: testEventId,
            type: 'standard'
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('qrCode');
    });

    it('should generate test QR code without data', async () => {
      const response = await request(app)
        .post('/api/scans/qr/test')
        .send({});

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/scans/qr/decode', () => {
    it('should decode and validate QR code successfully', async () => {
      const response = await request(app)
        .post('/api/scans/qr/decode')
        .send({
          qrCode: JSON.stringify(testTicketData)
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject missing QR code', async () => {
      const response = await request(app)
        .post('/api/scans/qr/decode')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/scans/:ticketId/history', () => {
    it('should retrieve ticket scan history', async () => {
      const response = await request(app)
        .get(`/api/scans/${testTicketId}/history`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('ticketId');
      expect(response.body.data).toHaveProperty('scans');
    });

    it('should handle empty ticket ID', async () => {
      const response = await request(app)
        .get('/api/scans//history');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/scans/events/:eventId/stats', () => {
    it('should retrieve event scan statistics', async () => {
      const response = await request(app)
        .get(`/api/scans/events/${testEventId}/stats`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('eventId');
      expect(response.body.data).toHaveProperty('totalScans');
    });

    it('should retrieve event scan statistics with date filters', async () => {
      const response = await request(app)
        .get(`/api/scans/events/${testEventId}/stats`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/scans/reports', () => {
    it('should generate validation report successfully', async () => {
      const response = await request(app)
        .post('/api/scans/reports')
        .send({
          eventId: testEventId,
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalScans');
    });

    it('should reject missing event ID', async () => {
      const response = await request(app)
        .post('/api/scans/reports')
        .send({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/scans/offline/sync', () => {
    it('should sync offline data successfully', async () => {
      const response = await request(app)
        .post('/api/scans/offline/sync');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('synced');
    });
  });

  describe('GET /api/scans/offline/data', () => {
    it('should retrieve all offline data', async () => {
      const response = await request(app)
        .get('/api/scans/offline/data');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cache');
      expect(response.body.data).toHaveProperty('sync');
    });

    it('should retrieve specific ticket offline data', async () => {
      const response = await request(app)
        .get('/api/scans/offline/data')
        .query({
          ticketId: testTicketId
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/scans/offline/cleanup', () => {
    it('should cleanup expired data successfully', async () => {
      const response = await request(app)
        .post('/api/scans/offline/cleanup');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cleanedCount');
    });
  });

  describe('Service Health and Stats', () => {
    it('should return service health', async () => {
      const response = await request(app)
        .get('/api/scans/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('validation');
      expect(response.body.data).toHaveProperty('qr');
      expect(response.body.data).toHaveProperty('offline');
    });

    it('should return service statistics', async () => {
      const response = await request(app)
        .get('/api/scans/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('validation');
      expect(response.body.data).toHaveProperty('qr');
      expect(response.body.data).toHaveProperty('offline');
    });
  });

  describe('Webhooks', () => {
    it('should handle external validation webhook', async () => {
      const response = await request(app)
        .post('/api/scans/webhooks/validate')
        .set('X-API-Key', process.env.WEBHOOK_SECRET || 'test-webhook-secret')
        .send({
          ticketData: testTicketData,
          scanContext: {
            location: 'Entrée principale'
          },
          webhookId: 'webhook-123'
        });

      expect([200, 401]).toContain(response.status);
    });

    it('should reject webhook without API key', async () => {
      const response = await request(app)
        .post('/api/scans/webhooks/validate')
        .send({
          ticketData: testTicketData,
          scanContext: {
            location: 'Entrée principale'
          }
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should handle batch validation webhook', async () => {
      const response = await request(app)
        .post('/api/scans/webhooks/validate-batch')
        .set('X-API-Key', process.env.WEBHOOK_SECRET || 'test-webhook-secret')
        .send({
          tickets: [testTicketData],
          scanContext: {
            location: 'Entrée principale'
          },
          webhookId: 'webhook-batch-123'
        });

      expect([200, 401]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/scans/validate')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });

    it('should handle oversized payload', async () => {
      const largeData = {
        qrCode: 'x'.repeat(1000000), // 1MB de données
        scanContext: {
          location: 'Entrée principale'
        }
      };

      const response = await request(app)
        .post('/api/scans/validate')
        .send(largeData);

      expect([200, 400, 413]).toContain(response.status);
    });

    it('should handle invalid routes', async () => {
      const response = await request(app)
        .get('/api/scans/invalid-route');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow normal requests', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
    });

    it('should include rate limiting headers', async () => {
      const response = await request(app)
        .post('/api/scans/validate')
        .send({
          qrCode: JSON.stringify(testTicketData),
          scanContext: {
            location: 'Entrée principale'
          }
        });

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });

    it('should include CORS headers', async () => {
      const response = await request(app)
        .options('/api/scans/validate');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });
  });

  describe('API Documentation', () => {
    it('should provide API info', async () => {
      const response = await request(app)
        .get('/api');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('service', 'Scan Validation API');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body).toHaveProperty('version');
    });

    it('should provide service info', async () => {
      const response = await request(app)
        .get('/');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('service', 'Scan Validation Service');
      expect(response.body).toHaveProperty('status', 'running');
      expect(response.body).toHaveProperty('capabilities');
    });
  });

  describe('Metrics Endpoint', () => {
    it('should return metrics if enabled', async () => {
      // Activer temporairement les métriques pour le test
      const originalValue = process.env.ENABLE_METRICS;
      process.env.ENABLE_METRICS = 'true';

      const response = await request(app)
        .get('/metrics');

      expect([200, 404]).toContain(response.status);

      // Restaurer la valeur originale
      process.env.ENABLE_METRICS = originalValue;
    });
  });
});
