# 🔍 SCAN VALIDATION SERVICE - DOCUMENTATION

## 🎯 Présentation

Le **Scan Validation Service** gère la validation des tickets en temps réel lors des événements.

### Rôle principal
- 🔍 **Validation** : Scan QR codes et validation de tickets
- 📊 **Statistiques** : Données temps réel sur les entrées
- 📱 **Mode offline** : Fonctionnement sans connexion internet
- 🔄 **Synchronisation** : Sync des données quand connexion rétablie

### Caractéristiques techniques
```
🚀 Port : 3005
📱 Mobile-first : Interface optimisée pour mobile
📊 Temps réel : Statistiques instantanées
🔒 Sécurité : Validation anti-fraude
📊 Analytics : Tableaux de bord en direct
```

## 🏗️ Architecture

### Stack Technique
```
┌─────────────────────────────────────────┐
│        SCAN VALIDATION SERVICE          │
├─────────────────────────────────────────┤
│ 📦 Node.js + Express.js                  │
│ 🗄️ PostgreSQL (validations)              │
│ 📱 QR Code scanner                       │
│ 📊 Real-time stats                       │
│ 📱 PWA (Progressive Web App)             │
│ 📊 Winston (logs)                        │
└─────────────────────────────────────────┘
```

## ⚡ Fonctionnalités

### 🔍 Validation de tickets

#### Scan QR code
```javascript
POST /api/scan/validate
{
  "qrCodeData": "TC-2024-123456-signature",
  "scannerId": "scanner-123",
  "location": "Entrance A",
  "timestamp": "2024-01-01T18:30:00Z"
}
```

#### Réponse validation
```javascript
{
  "success": true,
  "data": {
    "valid": true,
    "ticket": {
      "id": 789,
      "ticketCode": "TC-2024-123456",
      "guest": {
        "firstName": "John",
        "lastName": "Doe"
      },
      "event": {
        "title": "Tech Conference 2024",
        "ticketType": "VIP"
      }
    },
    "validatedAt": "2024-01-01T18:30:00Z"
  }
}
```

### 📊 Statistiques temps réel

#### GET /api/stats/live
```javascript
{
  "success": true,
  "data": {
    "eventId": 456,
    "totalGuests": 500,
    "checkedIn": 245,
    "checkInRate": 0.49,
    "byTicketType": {
      "VIP": { total: 50, checkedIn: 45 },
      "Standard": { total: 450, checkedIn: 200 }
    },
    "byTime": {
      "18:00": 10,
      "18:15": 25,
      "18:30": 30
    }
  }
}
```

### 📱 Mode offline

#### Synchronisation
```javascript
POST /api/sync/upload
{
  "validations": [
    {
      "ticketCode": "TC-2024-123456",
      "validatedAt": "2024-01-01T18:30:00Z",
      "scannerId": "scanner-123"
    }
  ]
}
```

## 🚀 Guide de déploiement

### Configuration
```bash
# .env
NODE_ENV=production
PORT=3005

# Base de données
DB_HOST=localhost
DB_NAME=event_planner_scan

# Offline mode
OFFLINE_STORAGE_PATH=./offline-data
SYNC_BATCH_SIZE=100
```

---

**Version** : 1.0.0  
**Port** : 3005
