process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'event_planner_scan';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'admin';

const request = require('supertest');
const { app } = require('../../src/server');
const scanService = require('../../src/core/scan/scan.service');

describe('Scans operator canonical routes', () => {
  const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const eventId = String(900000 + Math.floor(Math.random() * 9999));
  const emptyTicketId = String(990000 + Math.floor(Math.random() * 999));
  const scannedTicketId = String(980000 + Math.floor(Math.random() * 999));
  const operatorId = `operator-${runId}`;
  const location = 'North gate';
  const deviceId = `scanner-${runId}`;
  let sessionId = null;

  it('starts an operator scan session on the canonical route', async () => {
    const response = await request(app)
      .post('/api/scans/sessions/start')
      .send({
        eventId,
        operatorId,
        deviceId,
        location,
        deviceInfo: {
          surface: 'jest-canonical',
        },
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data).toHaveProperty('uid');
    expect(response.body.data).toHaveProperty('status', 'active');
    expect(String(response.body.data.eventId)).toBe(eventId);
    expect(response.body.data.location).toBe(location);

    sessionId = response.body.data.id;
  });

  it('returns the started session from the active sessions canonical route', async () => {
    const response = await request(app)
      .get(`/api/scans/sessions/active?eventId=${encodeURIComponent(eventId)}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.sessions)).toBe(true);

    const session = response.body.data.sessions.find(
      (row) => String(row.id) === String(sessionId),
    );

    expect(session).toBeTruthy();
    expect(String(session.eventId)).toBe(eventId);
    expect(session.location).toBe(location);
  });

  it('returns canonical history shape for a ticket even when no scans exist yet', async () => {
    const response = await request(app)
      .get(`/api/scans/history/ticket/${emptyTicketId}?limit=5&offset=0`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(String(response.body.data.ticketId)).toBe(emptyTicketId);
    expect(response.body.data).toHaveProperty('scans');
    expect(Array.isArray(response.body.data.scans)).toBe(true);
    expect(response.body.data).toHaveProperty('pagination');
  });

  it('returns canonical event stats shape for an event', async () => {
    const response = await request(app)
      .get(`/api/scans/stats/event/${encodeURIComponent(eventId)}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(String(response.body.data.eventId)).toBe(eventId);
    expect(response.body.data).toHaveProperty('totalScans');
    expect(response.body.data).toHaveProperty('uniqueTickets');
  });

  it('counts a recorded canonical scan in ticket history and event stats', async () => {
    const recordResult = await scanService.recordScan({
      validationId: `validation-${runId}`,
      sessionId,
      ticketId: scannedTicketId,
      eventId,
      result: 'valid',
      scanContext: {
        location,
        deviceId,
        userId: null,
      },
      qrMetadata: {
        ticketId: scannedTicketId,
        eventId,
      },
      businessValidation: {
        event: { id: eventId },
        ticket: { id: scannedTicketId, eventId },
      },
      timestamp: new Date().toISOString(),
      validationTime: 12,
      fraudFlags: null,
    });

    expect(recordResult.success).toBe(true);

    const historyResponse = await request(app)
      .get(`/api/scans/history/ticket/${scannedTicketId}?limit=5&offset=0`)
      .expect(200);

    expect(historyResponse.body.success).toBe(true);
    expect(String(historyResponse.body.data.ticketId)).toBe(scannedTicketId);
    expect(historyResponse.body.data.pagination.total).toBeGreaterThanOrEqual(1);
    expect(historyResponse.body.data.scans[0]).toMatchObject({
      result: 'valid',
      location,
      deviceId,
    });

    const statsResponse = await request(app)
      .get(`/api/scans/stats/event/${encodeURIComponent(eventId)}`)
      .expect(200);

    expect(statsResponse.body.success).toBe(true);
    expect(String(statsResponse.body.data.eventId)).toBe(eventId);
    expect(statsResponse.body.data.totalScans).toBeGreaterThanOrEqual(1);
    expect(statsResponse.body.data.uniqueTickets).toBeGreaterThanOrEqual(1);
    expect(statsResponse.body.data.successfulScans).toBeGreaterThanOrEqual(1);
    expect(statsResponse.body.data.locations).toContain(location);
  });

  it('ends the operator scan session on the canonical route', async () => {
    const response = await request(app)
      .post('/api/scans/sessions/end')
      .send({
        sessionId,
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(String(response.body.data.id)).toBe(String(sessionId));
    expect(response.body.data).toHaveProperty('endedAt');
  });

  it('no longer returns the session after it is ended', async () => {
    const response = await request(app)
      .get(`/api/scans/sessions/active?eventId=${encodeURIComponent(eventId)}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.sessions)).toBe(true);

    const session = response.body.data.sessions.find(
      (row) => String(row.id) === String(sessionId),
    );

    expect(session).toBeUndefined();
  });
});
