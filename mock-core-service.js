const express = require('express');
const cors = require('cors');

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Mock data
const mockEvents = {
  'EVENT_1234567890': {
    id: 'EVENT_1234567890',
    title: 'Test Event',
    status: 'active',
    startDate: '2026-01-28T10:00:00.000Z',
    endDate: '2026-12-31T23:59:59.999Z'
  },
  'EVENT_CLOSED': {
    id: 'EVENT_CLOSED',
    title: 'Closed Event',
    status: 'ended',
    startDate: '2026-01-01T10:00:00.000Z',
    endDate: '2026-01-27T23:59:59.999Z'
  }
};

const mockTickets = {
  'TICKET_1234567890': {
    id: 'TICKET_1234567890',
    eventId: 'EVENT_1234567890',
    type: 'standard',
    userId: 'USER_1234567890',
    status: 'valid',
    issuedAt: '2026-01-28T10:00:00.000Z',
    expiresAt: '2026-12-31T23:59:59.999Z'
  },
  'TICKET_EXPIRED': {
    id: 'TICKET_EXPIRED',
    eventId: 'EVENT_1234567890',
    type: 'standard',
    userId: 'USER_1234567890',
    status: 'expired',
    issuedAt: '2026-01-01T10:00:00.000Z',
    expiresAt: '2026-01-27T23:59:59.999Z'
  }
};

// Routes
app.post('/api/tickets/validate', (req, res) => {
  const { ticketId, eventId, ticketType, userId } = req.body;
  
  console.log('Mock Core - Ticket validation request:', { ticketId, eventId, ticketType, userId });
  
  // Simuler différents cas de test
  if (ticketId === 'TICKET_NOT_FOUND') {
    return res.status(404).json({
      success: false,
      error: 'Ticket not found',
      code: 'TICKET_NOT_FOUND'
    });
  }
  
  if (eventId === 'EVENT_NOT_FOUND') {
    return res.status(404).json({
      success: false,
      error: 'Event not found',
      code: 'EVENT_NOT_FOUND'
    });
  }
  
  if (eventId === 'EVENT_CLOSED') {
    return res.status(400).json({
      success: false,
      error: 'Event ended',
      code: 'EVENT_ENDED'
    });
  }
  
  if (ticketId === 'TICKET_EXPIRED') {
    return res.status(400).json({
      success: false,
      error: 'Ticket expired',
      code: 'TICKET_EXPIRED'
    });
  }
  
  // Cas normal - ticket valide
  const ticket = mockTickets[ticketId] || {
    id: ticketId,
    eventId: eventId,
    type: ticketType || 'standard',
    userId: userId || 'USER_DEFAULT',
    status: 'valid',
    issuedAt: '2026-01-28T10:00:00.000Z',
    expiresAt: '2026-12-31T23:59:59.999Z'
  };
  
  const event = mockEvents[eventId] || {
    id: eventId,
    title: 'Default Event',
    status: 'active',
    startDate: '2026-01-28T10:00:00.000Z',
    endDate: '2026-12-31T23:59:59.999Z'
  };
  
  res.json({
    success: true,
    data: {
      status: 'VALID',
      ticket: {
        id: ticket.id,
        type: ticket.type,
        userId: ticket.userId,
        eventId: ticket.eventId
      },
      event: {
        id: event.id,
        title: event.title,
        status: event.status
      }
    }
  });
});

app.post('/api/events/validate', (req, res) => {
  const { eventId } = req.body;
  
  console.log('Mock Core - Event validation request:', { eventId });
  
  const event = mockEvents[eventId];
  
  if (!event) {
    return res.status(404).json({
      success: false,
      error: 'Event not found',
      code: 'EVENT_NOT_FOUND'
    });
  }
  
  if (event.status === 'ended') {
    return res.status(400).json({
      success: false,
      error: 'Event ended',
      code: 'EVENT_ENDED'
    });
  }
  
  res.json({
    success: true,
    data: {
      event: {
        id: event.id,
        title: event.title,
        status: event.status
      }
    }
  });
});

app.post('/api/tickets/scan', (req, res) => {
  const { ticketId, eventId, scanResult, scanContext } = req.body;
  
  console.log('Mock Core - Record scan request:', { ticketId, eventId, scanResult, scanContext });
  
  res.json({
    success: true,
    data: {
      scanId: `SCAN_${Date.now()}`,
      recordedAt: new Date().toISOString()
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'event-planner-core-mock',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    service: 'event-planner-core-mock',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`🎭 Mock Event Core Service démarré sur le port ${port}`);
  console.log(`📡 Endpoints disponibles:`);
  console.log(`   POST /api/tickets/validate - Validation de ticket`);
  console.log(`   POST /api/events/validate - Validation d'événement`);
  console.log(`   POST /api/tickets/scan - Enregistrement de scan`);
  console.log(`   GET /api/health - Health check`);
  console.log(`   GET /api/status - Status du service`);
});

module.exports = app;
