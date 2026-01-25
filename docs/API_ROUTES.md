# Scan Validation Service - API Routes Documentation

## Overview

Le Scan Validation Service gère la validation de tickets en temps réel et offline, l'analyse anti-fraude, et la gestion des sessions de scan pour Event Planner.

## Base URL
```
http://localhost:3005/api/scans
```

## Authentication

Toutes les routes (sauf health checks et webhooks) nécessitent une authentification JWT:
```
Authorization: Bearer <token>
```

## Permissions

Les permissions requises pour chaque route sont spécifiées ci-dessous.

---

## 🏠 **Health Routes**

### Health Check
```
GET /api/scans/health
```
- **Description**: Vérification de santé du service
- **Authentification**: Non requise
- **Permissions**: Aucune
- **Response**:
```json
{
  "success": true,
  "message": "Service is healthy",
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-25T15:30:00.000Z",
    "version": "1.0.0"
  }
}
```

### Service Stats
```
GET /api/scans/stats
```
- **Description**: Statistiques générales du service
- **Authentification**: Requise
- **Permissions**: `scans.stats.read`
- **Response**:
```json
{
  "success": true,
  "message": "Service statistics retrieved successfully",
  "data": {
    "totalScans": 15000,
    "activeSessions": 25,
    "registeredDevices": 150,
    "fraudDetection": {
      "totalAnalyses": 500,
      "blockedAttempts": 12
    }
  }
}
```

---

## 🎫 **Ticket Validation Routes**

### Validate Ticket
```
POST /api/scans/validate
```
- **Description**: Valider un ticket via QR code
- **Authentification**: Requise
- **Permissions**: `scans.validate`
- **Request Body**:
```json
{
  "qrCode": "{\"id\":\"ticket_123456\",\"eventId\":\"event_123456\",\"type\":\"standard\",\"timestamp\":1706034800,\"nonce\":\"abc123\",\"signature\":\"signature123\"}",
  "scanContext": {
    "location": "Entrée principale",
    "deviceId": "scanner-001",
    "operatorId": "operator_123456"
  }
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Ticket validated successfully",
  "data": {
    "ticket": {
      "id": "TICKET-123",
      "eventId": "EVENT-456",
      "ticketType": "standard",
      "status": "valid",
      "scannedAt": "2024-01-25T15:30:00.000Z"
    },
    "event": {
      "id": "EVENT-456",
      "name": "Annual Tech Conference"
    },
    "scanInfo": {
      "scanId": "scan-abc123",
      "timestamp": "2024-01-25T15:30:00.000Z",
      "location": "Entrée principale"
    }
  }
}
```

### Validate Ticket (Offline)
```
POST /api/scans/validate-offline
```
- **Description**: Valide un ticket en mode offline
- **Authentification**: Requise
- **Permissions**: `scans.validate.offline`
- **Request Body**:
```json
{
  "ticketId": "TICKET-123",
  "scanContext": {
    "location": "Entrée principale",
    "deviceId": "scanner-001",
    "operatorId": "operator-123"
  }
}
```

### Get Ticket Scan History
```
GET /api/scans/:ticketId/history
```
- **Description**: Récupère l'historique des scans d'un ticket
- **Authentification**: Requise
- **Permissions**: `scans.history.read`
- **Response**:
```json
{
  "success": true,
  "message": "Ticket scan history retrieved successfully",
  "data": {
    "ticketId": "TICKET-123",
    "totalScans": 3,
    "scans": [
      {
        "scanId": "scan-abc123",
        "timestamp": "2024-01-25T15:30:00.000Z",
        "location": "Entrée principale",
        "operatorId": "operator-123",
        "deviceId": "scanner-001"
      }
    ]
  }
}
```

---

## 📊 **Statistics Routes**

### Get Event Scan Stats
```
GET /api/scans/events/:eventId/stats
```
- **Description**: Statistiques de scan d'un événement
- **Authentification**: Requise
- **Permissions**: `scans.stats.read`
- **Response**:
```json
{
  "success": true,
  "message": "Event scan statistics retrieved successfully",
  "data": {
    "eventId": "EVENT-456",
    "totalScans": 2500,
    "uniqueTickets": 2300,
    "duplicateScans": 200,
    "averageScansPerHour": 104,
    "peakHour": "14:00"
  }
}
```

### Get Event Daily Stats
```
GET /api/scans/events/:eventId/stats/daily
```
- **Description**: Statistiques journalières d'un événement
- **Authentification**: Requise
- **Permissions**: `scans.stats.read`
- **Query Parameters**:
- `days`: Nombre de jours (défaut: 30)
- **Response**:
```json
{
  "success": true,
  "message": "Event daily statistics retrieved successfully",
  "data": {
    "eventId": "EVENT-456",
    "period": "30 days",
    "dailyData": [
      {
        "date": "2024-01-25",
        "scans": 150,
        "uniqueTickets": 145,
        "peakHour": "14:00"
      }
    ],
    "summary": {
      "totalScans": 5000,
      "uniqueTickets": 4800,
      "averageScansPerDay": 167
    }
  }
}
```

### Get Event Hourly Stats
```
GET /api/scans/events/:eventId/stats/hourly
```
- **Description**: Statistiques horaires d'un événement
- **Authentification**: Requise
- **Permissions**: `scans.stats.read`
- **Query Parameters**:
- `date`: Date spécifique (défaut: aujourd'hui)
- **Response**:
```json
{
  "success": true,
  "message": "Event hourly statistics retrieved successfully",
  "data": {
    "eventId": "EVENT-456",
    "date": "2024-01-25",
    "hourlyData": [
      {
        "hour": "14:00",
        "scans": 120,
        "uniqueTickets": 118
      }
    ],
    "summary": {
      "totalScans": 850,
      "peakHour": "14:00",
      "peakScans": 120
    }
  }
}
```

### Get Event Location Stats
```
GET /api/scans/events/:eventId/stats/locations
```
- **Description**: Statistiques par localisation d'un événement
- **Authentification**: Requise
- **Permissions**: `scans.stats.read`
- **Response**:
```json
{
  "success": true,
  "message": "Event location statistics retrieved successfully",
  "data": {
    "eventId": "EVENT-456",
    "locations": [
      {
        "locationId": "entrance_main",
        "name": "Entrée Principale",
        "scans": 2500,
        "percentage": 50
      },
      {
        "locationId": "entrance_side",
        "name": "Entrée Secondaire",
        "scans": 1500,
        "percentage": 30
      }
    ],
    "summary": {
      "totalLocations": 5,
      "totalScans": 5000
    }
  }
}
```

---

## 🔄 **Session Management Routes**

### Start Scan Session
```
POST /api/scans/sessions/start
```
- **Description**: Démarre une session de scan
- **Authentification**: Requise
- **Permissions**: `scans.sessions.create`
- **Request Body**:
```json
{
  "eventId": "EVENT-456",
  "operatorId": "operator-123",
  "deviceId": "scanner-001",
  "location": "Entrée principale",
  "deviceInfo": {
    "model": "Zebra DS2208",
    "firmware": "v1.2.3"
  }
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Scan session started successfully",
  "data": {
    "id": "session_1643123456789",
    "eventId": "EVENT-456",
    "operatorId": "operator-123",
    "deviceId": "scanner-001",
    "location": "Entrée principale",
    "startedAt": "2024-01-25T15:30:00.000Z",
    "status": "active"
  }
}
```

### End Scan Session
```
POST /api/scans/sessions/end
```
- **Description**: Termine une session de scan
- **Authentification**: Requise
- **Permissions**: `scans.sessions.update`
- **Request Body**:
```json
{
  "sessionId": "session_1643123456789"
}
```

### Get Active Scan Sessions
```
GET /api/scans/sessions/active
```
- **Description**: Récupère les sessions de scan actives
- **Authentification**: Requise
- **Permissions**: `scans.sessions.read`
- **Query Parameters**:
- `eventId`: Filtre par événement
- **Response**:
```json
{
  "success": true,
  "message": "Active scan sessions retrieved successfully",
  "data": [
    {
      "id": "session_1643123456789",
      "eventId": "EVENT-456",
      "operatorId": "operator-123",
      "startedAt": "2024-01-25T15:30:00.000Z",
      "status": "active"
    }
  ]
}
```

### Get Scan Session
```
GET /api/scans/sessions/:sessionId
```
- **Description**: Récupère une session de scan spécifique
- **Authentification**: Requise
- **Permissions**: `scans.sessions.read`

---

## 👥 **Operator Management Routes**

### Register Scan Operator
```
POST /api/scans/operators/register
```
- **Description**: Enregistre un opérateur de scan
- **Authentification**: Requise
- **Permissions**: `scans.operators.create`
- **Request Body**:
```json
{
  "userId": "user-123",
  "eventId": "EVENT-456",
  "permissions": {
    "validate": true,
    "view_stats": true,
    "manage_sessions": false
  }
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Scan operator registered successfully",
  "data": {
    "id": "operator_1643123456789",
    "userId": "user-123",
    "eventId": "EVENT-456",
    "permissions": {
      "validate": true,
      "view_stats": true,
      "manage_sessions": false
    },
    "registeredAt": "2024-01-25T15:30:00.000Z"
  }
}
```

### Get Event Scan Operators
```
GET /api/scans/operators/event/:eventId
```
- **Description**: Récupère les opérateurs de scan d'un événement
- **Authentification**: Requise
- **Permissions**: `scans.operators.read`
- **Response**:
```json
{
  "success": true,
  "message": "Event scan operators retrieved successfully",
  "data": [
    {
      "id": "operator_1643123456789",
      "userId": "user-123",
      "eventId": "EVENT-456",
      "permissions": {
        "validate": true,
        "view_stats": true
      },
      "registeredAt": "2024-01-25T15:30:00.000Z"
    }
  ]
}
```

---

## 📱 **Device Management Routes**

### Register Scan Device
```
POST /api/scans/devices/register
```
- **Description**: Enregistre un appareil de scan
- **Authentification**: Requise
- **Permissions**: `scans.devices.create`
- **Request Body**:
```json
{
  "deviceId": "scanner-001",
  "deviceName": "Main Entrance Scanner",
  "deviceType": "handheld",
  "operatorId": "operator-123",
  "eventId": "EVENT-456",
  "locationId": "location-123",
  "registrationData": {
    "model": "Zebra DS2208",
    "firmware": "v1.2.3",
    "serial": "SN123456789"
  }
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Scan device registered successfully",
  "data": {
    "id": "scanner-001",
    "deviceName": "Main Entrance Scanner",
    "deviceType": "handheld",
    "operatorId": "operator-123",
    "eventId": "EVENT-456",
    "registeredAt": "2024-01-25T15:30:00.000Z"
  }
}
```

### Get Event Scan Devices
```
GET /api/scans/devices/event/:eventId
```
- **Description**: Récupère les appareils de scan d'un événement
- **Authentification**: Requise
- **Permissions**: `scans.devices.read`
- **Response**:
```json
{
  "success": true,
  "message": "Event scan devices retrieved successfully",
  "data": [
    {
      "id": "scanner-001",
      "deviceName": "Main Entrance Scanner",
      "deviceType": "handheld",
      "operatorId": "operator-123",
      "registeredAt": "2024-01-25T15:30:00.000Z"
    }
  ]
}
```

---

## 🛡️ **Fraud Detection Routes**

### Analyze Fraud
```
POST /api/scans/fraud/analyze
```
- **Description**: Analyse une activité suspecte
- **Authentification**: Requise
- **Permissions**: `scans.fraud.analyze`
- **Request Body**:
```json
{
  "scanData": [
    {
      "ticketId": "TICKET-123",
      "timestamp": "2024-01-25T15:30:00.000Z",
      "location": "Entrée principale"
    }
  ],
  "analysisType": "comprehensive"
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Fraud analysis completed successfully",
  "data": {
    "id": "analysis_1643123456789",
    "analysisType": "comprehensive",
    "riskScore": 0.15,
    "riskLevel": "low",
    "suspiciousPatterns": [],
    "recommendations": [
      "Continue monitoring this location"
    ],
    "analyzedAt": "2024-01-25T15:30:00.000Z"
  }
}
```

### Get Fraud Stats
```
GET /api/scans/fraud/stats
```
- **Description**: Statistiques de fraude
- **Authentification**: Requise
- **Permissions**: `scans.fraud.read`
- **Query Parameters**:
- `eventId`: Filtre par événement
- `period`: Période d'analyse (défaut: 24h)
- **Response**:
```json
{
  "success": true,
  "message": "Fraud statistics retrieved successfully",
  "data": {
    "totalScans": 1250,
    "suspiciousScans": 15,
    "blockedScans": 3,
    "riskScore": 0.12,
    "period": "24h",
    "eventId": "EVENT-456"
  }
}
```

---

## 📄 **Reports Routes**

### Generate Validation Report
```
POST /api/scans/reports
```
- **Description**: Génère un rapport de validation
- **Authentification**: Requise
- **Permissions**: `scans.reports.generate`
- **Request Body**:
```json
{
  "eventId": "EVENT-456",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "format": "json",
  "includeDetails": true
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Validation report generated successfully",
  "data": {
    "reportId": "report_1643123456789",
    "eventId": "EVENT-456",
    "period": "2024-01-01 to 2024-12-31",
    "format": "json",
    "generatedAt": "2024-01-25T15:30:00.000Z",
    "downloadUrl": "/api/scans/reports/report_1643123456789/download"
  }
}
```

---

## 📱 **QR Code Routes**

### Generate QR Code
```
POST /api/scans/qr/generate
```
- **Description**: Génère un QR code pour un ticket
- **Authentification**: Requise
- **Permissions**: `scans.qr.generate`
- **Request Body**:
```json
{
  "ticketData": {
    "id": "TICKET-123",
    "eventId": "EVENT-456",
    "type": "standard",
    "metadata": {
      "test": true
    }
  },
  "options": {
    "width": 300,
    "margin": 2,
    "color": {
      "dark": "#000000",
      "light": "#FFFFFF"
    }
  }
}
```

### Generate Batch QR Codes
```
POST /api/scans/qr/batch
```
- **Description**: Génère des QR codes en lot
- **Authentification**: Requise
- **Permissions**: `scans.qr.batch`

### Generate Test QR Code
```
POST /api/scans/qr/test
```
- **Description**: Génère un QR code de test
- **Authentification**: Requise
- **Permissions**: `scans.qr.test`

### Decode QR Code
```
POST /api/scans/qr/decode
```
- **Description**: Décode et valide un QR code
- **Authentification**: Requise
- **Permissions**: `scans.qr.decode`

---

## 📴 **Offline Data Routes**

### Sync Offline Data
```
POST /api/scans/offline/sync
```
- **Description**: Synchronise les données offline
- **Authentification**: Requise
- **Permissions**: `scans.offline.sync`
- **Request Body**:
```json
{
  "force": false,
  "batchSize": 100
}
```

### Get Offline Data
```
GET /api/scans/offline/data
```
- **Description**: Récupère les données offline
- **Authentification**: Requise
- **Permissions**: `scans.offline.read`
- **Query Parameters**:
- `ticketId`: Filtre par ticket ID
- `eventId`: Filtre par événement

### Cleanup Expired Data
```
POST /api/scans/offline/cleanup
```
- **Description**: Nettoie les données expirées
- **Authentification**: Requise
- **Permissions**: `scans.offline.cleanup`
- **Request Body**:
```json
{
  "olderThan": "7d"
}
```

---

## 🪝 **Webhook Routes**

### Validate Webhook
```
POST /api/scans/webhooks/validate
```
- **Description**: Webhook de validation externe
- **Authentification**: API Key (validateApiKey)
- **Permissions**: Aucune
- **Request Body**:
```json
{
  "ticketData": {
    "id": "TICKET-123",
    "eventId": "EVENT-456"
  },
  "scanContext": {
    "location": "Entrée principale",
    "deviceId": "scanner-001"
  },
  "webhookId": "webhook-123",
  "responseUrl": "https://external-app.com/webhook-response"
}
```

### Validate Batch Webhook
```
POST /api/scans/webhooks/validate-batch
```
- **Description**: Webhook de validation en lot
- **Authentification**: API Key (validateApiKey)
- **Permissions**: Aucune

### Sync Webhook
```
POST /api/scans/webhooks/sync
```
- **Description**: Webhook de synchronisation
- **Authentification**: API Key (validateApiKey)
- **Permissions**: Aucune

### Offline Webhook
```
POST /api/scans/webhooks/offline
```
- **Description**: Webhook pour les données offline
- **Authentification**: API Key (validateApiKey)
- **Permissions**: Aucune

---

## 📊 **Error Responses**

Toutes les erreurs suivent ce format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Description de l'erreur",
    "details": [
      {
        "field": "qrCode",
        "message": "QR code is required"
      }
    ]
  }
}
```

### Codes d'erreur communs:
- `VALIDATION_ERROR`: Erreur de validation des données
- `TICKET_NOT_FOUND`: Ticket non trouvé
- `TICKET_ALREADY_USED`: Ticket déjà utilisé
- `TICKET_EXPIRED`: Ticket expiré
- `INVALID_QR_FORMAT`: Format QR invalide
- `INSUFFICIENT_PERMISSIONS`: Permissions insuffisantes
- `SESSION_NOT_FOUND`: Session non trouvée
- `DEVICE_NOT_REGISTERED`: Appareil non enregistré
- `OPERATOR_NOT_AUTHORIZED`: Opérateur non autorisé
- `FRAUD_DETECTED`: Activité frauduleuse détectée

---

## 🚀 **Rate Limiting**

- **Limite générale**: 200 requêtes par 15 minutes par IP
- **Limite validation**: 50 validations par minute par IP
- **Limite fraud analysis**: 10 analyses par minute par IP

---

## 📝 **Notes**

- Tous les timestamps sont en format ISO 8601
- Les IDs sont sensibles à la casse
- Les sessions de scan expirent automatiquement après 24 heures
- Les données offline sont conservées 7 jours par défaut
- L'analyse anti-fraude utilise des algorithmes de machine learning

---

## 🔗 **Liens Utiles**

- [Documentation Validation Service](../core/validation/)
- [Documentation QR Service](../core/qr/)
- [Documentation Offline Service](../core/offline/)
- [Documentation Fraud Detection](../core/fraud/)
- [Postman Collection](../postman/Scan-Validation-Service.postman_collection.json)
