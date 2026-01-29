# Scan Validation Service API Routes Documentation

## Overview

This document provides a comprehensive overview of all available API routes in the Scan Validation Service. The service runs on port **3005** and provides **technical ticket validation functionality** with real-time and offline scanning, fraud detection, and scan history tracking.

**⚠️ IMPORTANT**: This is a **technical service only**. It handles QR code validation and scan logging without business logic or user management. All business operations are delegated to `event-planner-core`.

## Base URL

```
http://localhost:3005/api
```

## Service Architecture

### Scan Validation Service Responsibilities ✅
- **QR Code Validation**: Technical QR code validation
- **Fraud Detection**: Duplicate scan detection
- **Offline Mode**: Offline validation with sync
- **Scan History**: Technical scan logging
- **Statistics**: Basic scan statistics

### Delegated to Other Services 🔄
- **QR Code Generation**: `ticket-generator-service` (port 3004)
- **User Management**: `event-planner-auth` (port 3000)
- **Business Logic**: `event-planner-core` (port 3001)
- **Operator Management**: `event-planner-core` (port 3001)
- **Device Management**: `event-planner-core` (port 3001)

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
    "operatorId": "operator_123"
  }
}
```

**Note**: Only technical scan context. No user authentication required.

#### Request Body (Offline Validation)
```json
{
  "ticketId": "ticket-1234567890abcdef",
  "scanContext": {
    "location": "Main Entrance",
    "deviceId": "scanner_001",
    "operatorId": "operator_123",
    "offlineMode": true
  }
}
```

**Note**: Technical offline validation without user context.

---

### 2. Scan History Module

#### History Operations
- `GET /api/scans/history/ticket/:ticketId` - Get scan history for a specific ticket

#### Query Parameters (Ticket History)
- `limit` - Maximum number of records to return (default: 50, max: 100)
- `offset` - Number of records to skip (default: 0)

**Note**: Technical scan history without user context.

---

### 3. Statistics Module

#### Statistics Operations
- `GET /api/scans/stats` - Get general scan statistics
- `GET /api/scans/stats/event/:eventId` - Get scan statistics for an event

#### Query Parameters (Event Statistics)
- `startDate` - Filter by start date (optional)
- `endDate` - Filter by end date (optional)

**Note**: Basic technical statistics only. No business analytics.

---

### 4. Health & Monitoring Module

#### Health Operations
- `GET /health` - Basic health check (no authentication required)
- `GET /api/scans/health` - Service health check

---

## 🎯 Service Communication

### Input Data (Technical Only)
- **QR Validation**: QR code data + scan context
- **Offline Validation**: Ticket ID + scan context
- **History Queries**: Technical filters (limit, offset)

### Output Data (Validation Results)
- **Validation Status**: Valid/Invalid with technical reasons
- **Scan History**: Technical scan records
- **Statistics**: Basic counts and metrics

### No Business Logic
- ❌ No user authentication
- ❌ No permission checking
- ❌ No business validation
- ❌ No user context storage

---

## ❌ DELEGATED OPERATIONS

### QR Code Generation (Not Available)
**QR code generation is handled by `ticket-generator-service` (port 3004)**
- `POST /api/tickets/qr/generate` - Generate QR code
- `POST /api/tickets/batch` - Batch generation

### User/Operator Management (Not Available)
**User and operator management is handled by `event-planner-core` (port 3001)**
- User registration and authentication
- Operator permissions and roles

### Device Management (Not Available)
**Device management is handled by `event-planner-core` (port 3001)**
- Device registration and tracking
- Device assignment to operators

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
    "location": "Main Entrance"
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

---

## Fraud Detection

The service provides basic fraud detection:
- Multiple scans of the same ticket
- Unusual scan frequency
- Technical validation patterns

**Note**: Advanced fraud analytics are delegated to business intelligence services.

---

## Offline Mode

Offline mode allows validation when network connectivity is unavailable:
- Basic ticket validation with cached data
- Simple sync when connection restored
- Technical conflict resolution

---

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

API endpoints have technical rate limiting for protection:
- Scan endpoints: 20 requests per minute per IP
- Other endpoints: Standard rate limiting

## Postman Collection

A complete Postman collection with all 6 routes is available in:
- `postman/scan-validation-service.postman_collection.json`

## Environment Variables

Required environment variables are defined in:
- `postman/Scan-Validation-Service.postman_environment.json`

---

**Last Updated:** January 29, 2026  
**Version:** 3.1.0  
**Total Routes:** 6 (aligned with actual implementation)

## 🎯 Refactoring Summary

### Documentation Alignment
- **Previous**: 25 documented routes (many non-existent)
- **Current**: 6 actual routes (aligned with implementation)
- **Removed**: 19 non-existent routes from documentation

### Service Clarification
- ✅ **Technical Only**: QR validation and scan logging
- ✅ **No Authentication**: Service works without user context
- ✅ **Clear Boundaries**: Delegated operations documented
- ✅ **Simplified API**: Focus on core validation functionality

### Architecture Benefits
- ✅ **Accurate Documentation**: Docs match reality
- ✅ **Clear Responsibilities**: Technical validation only
- ✅ **Better Integration**: Core service knows exactly what to expect
- ✅ **Maintainable**: Smaller, focused service
