# Scan Validation Service API Routes Documentation

## Overview

This document provides a comprehensive overview of all available API routes in the Scan Validation Service. The service runs on port **3005** and provides complete ticket validation functionality with real-time and offline scanning, QR code generation, fraud detection, session management, and device tracking.

## Base URL

```
http://localhost:3005/api
```

## Authentication

All routes (except health endpoints) require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Modules

### 1. Ticket Validation Module

#### Validation Operations
- `POST /api/scans/validate` - Validate a ticket in real-time
- `POST /api/scans/validate-offline` - Validate a ticket in offline mode

#### Request Body (Real-time Validation)
```json
{
  "qrCode": "QR_CODE_DATA_HERE",
  "scanContext": {
    "location": "Main Entrance",
    "deviceId": "scanner_001",
    "checkpointId": "checkpoint_main",
    "timestamp": "2026-01-27T09:30:00Z"
  }
}
```

#### Request Body (Offline Validation)
```json
{
  "qrCode": "QR_CODE_DATA_HERE",
  "scanContext": {
    "location": "Main Entrance",
    "deviceId": "scanner_001",
    "checkpointId": "checkpoint_main",
    "timestamp": "2026-01-27T09:30:00Z",
    "offlineMode": true
  },
  "offlineData": {
    "cachedTickets": [],
    "lastSync": "2026-01-27T08:00:00Z"
  }
}
```

---

### 2. QR Code Management Module

#### QR Code Operations
- `POST /api/scans/qr/generate` - Generate QR code for a ticket
- `POST /api/scans/qr/batch` - Generate QR codes in batch
- `POST /api/scans/qr/test` - Generate a test QR code

#### Request Body (Generate QR Code)
```json
{
  "ticketId": "ticket-1234567890abcdef",
  "eventId": "event-1234567890abcdef",
  "ticketType": "standard",
  "format": "base64",
  "size": "medium"
}
```

#### Request Body (Batch Generation)
```json
{
  "tickets": [
    {
      "ticketId": "ticket-1234567890abcdef_1",
      "eventId": "event-1234567890abcdef",
      "ticketType": "standard"
    }
  ],
  "format": "base64",
  "size": "medium"
}
```

---

### 3. Statistics & Analytics Module

#### Statistics Operations
- `GET /api/scans/stats` - Get scan statistics
- `POST /api/scans/fraud/analyze` - Analyze fraud detection patterns
- `GET /api/scans/fraud/stats` - Get fraud detection statistics

#### Query Parameters (Scan Statistics)
- `eventId` - Filter by event ID (optional)
- `period` - Period: hour, day, week, month

#### Request Body (Fraud Analysis)
```json
{
  "scanData": {
    "ticketId": "ticket-1234567890abcdef",
    "scanCount": 5,
    "timeBetweenScans": 300,
    "locations": ["Main Entrance", "Side Entrance"],
    "devices": ["scanner_001", "scanner_002"]
  },
  "context": {
    "eventId": "event-1234567890abcdef",
    "currentTime": "2026-01-27T10:00:00Z"
  }
}
```

---

### 4. History & Sync Module

#### History Operations
- `GET /api/scans/history/ticket/:ticketId` - Get scan history for a specific ticket
- `POST /api/scans/sync` - Synchronize offline scan data
- `GET /api/scans/offline/data` - Get offline data for synchronization

#### Query Parameters (Ticket History)
- `limit` - Maximum number of records to return

#### Request Body (Sync Data)
```json
{
  "deviceId": "scanner_001",
  "offlineScans": [
    {
      "ticketId": "ticket-1234567890abcdef",
      "scanTime": "2026-01-27T09:30:00Z",
      "location": "Main Entrance",
      "status": "valid"
    }
  ],
  "lastSyncTime": "2026-01-27T08:00:00Z"
}
```

---

### 5. Session Management Module

#### Session Operations
- `POST /api/scans/sessions/start` - Start a scan session
- `POST /api/scans/sessions/end` - End a scan session
- `GET /api/scans/sessions/active` - Get active scan sessions
- `GET /api/scans/sessions/:sessionId` - Get scan session details

#### Request Body (Start Session)
```json
{
  "eventId": "event-1234567890abcdef",
  "operatorId": "operator-1234567890abcdef",
  "deviceId": "scanner_001",
  "location": "Main Entrance",
  "checkpointId": "checkpoint_main"
}
```

#### Request Body (End Session)
```json
{
  "sessionId": "session-1234567890abcdef",
  "endTime": "2026-01-27T18:00:00Z",
  "summary": {
    "totalScans": 150,
    "validScans": 145,
    "invalidScans": 5
  }
}
```

---

### 6. Operator Management Module

#### Operator Operations
- `POST /api/scans/operators/register` - Register a scan operator
- `GET /api/scans/operators/event/:eventId` - Get operators for an event

#### Request Body (Register Operator)
```json
{
  "operatorId": "operator-1234567890abcdef",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "phone": "+33612345678",
  "eventId": "event-1234567890abcdef",
  "permissions": ["scans.validate", "scans.stats.read"]
}
```

---

### 7. Device Management Module

#### Device Operations
- `POST /api/scans/devices/register` - Register a scan device
- `GET /api/scans/devices/event/:eventId` - Get devices for an event

#### Request Body (Register Device)
```json
{
  "deviceId": "scanner_001",
  "name": "Main Entrance Scanner",
  "type": "handheld",
  "model": "Zebra MC33",
  "eventId": "event-1234567890abcdef",
  "location": "Main Entrance",
  "capabilities": ["qr_scan", "nfc_read"]
}
```

---

### 8. Health & Monitoring Module

#### Health Operations
- `GET /health` - Basic health check (no authentication required)
- `GET /api/system/status` - Get system status and performance metrics

---

## Validation Response Format

### Successful Validation
```json
{
  "success": true,
  "data": {
    "ticketId": "ticket-1234567890abcdef",
    "eventId": "event-1234567890abcdef",
    "valid": true,
    "scanTime": "2026-01-27T09:30:00Z",
    "location": "Main Entrance",
    "operatorId": "operator-1234567890abcdef"
  },
  "message": "Ticket validated successfully"
}
```

### Failed Validation
```json
{
  "success": false,
  "error": {
    "code": "TICKET_INVALID",
    "message": "Ticket has already been used",
    "details": {
      "ticketId": "ticket-1234567890abcdef",
      "lastScanTime": "2026-01-27T08:45:00Z"
    }
  }
}
```

## QR Code Formats

- `base64` - Base64 encoded image data
- `svg` - SVG vector format
- `png` - PNG image data
- `jpg` - JPEG image data

## QR Code Sizes

- `small` - 128x128 pixels
- `medium` - 256x256 pixels
- `large` - 512x512 pixels

## Fraud Detection Patterns

The service detects various fraud patterns:
- Multiple scans of the same ticket
- Unusual scan frequency
- Scans from multiple locations simultaneously
- Device switching patterns
- Time-based anomalies

## Offline Mode

Offline mode allows validation when network connectivity is unavailable:
- Cached ticket data stored locally
- Batch synchronization when connection restored
- Conflict resolution for duplicate scans

## Session Management

Sessions track operator activities:
- Start/end time tracking
- Scan statistics per session
- Device and location assignment
- Performance metrics

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
```

## Rate Limiting

API endpoints may be rate limited. Check response headers for rate limit information.

## Permissions

All endpoints require specific permissions. Permission format: `module.action` (e.g., `scans.validate`, `scans.stats.read`).

## Webhooks

The service supports webhooks for:
- Real-time scan events
- Fraud detection alerts
- Session status changes
- Device status updates

Configure webhooks in the service configuration.

## Postman Collection

A complete Postman collection with all 25 routes is available in:
- `postman/scan-validation-service.postman_collection.json`

## Environment Variables

Required environment variables are defined in:
- `postman/Scan-Validation-Service.postman_environment.json`

---

**Last Updated:** January 27, 2026  
**Version:** 3.0.0  
**Total Routes:** 25
