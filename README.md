# 📱 Event Planner - Service de Scan Validation

## 📋 Description

Le service de Scan Validation gère toutes les opérations de validation des billets sur site: scan QR codes, check-in temps réel, statistiques d'assistance, et mode hors-ligne.

## 🏗️ Architecture Technique

```
┌─────────────────────────────────────────────────────────────┐
│            SCAN VALIDATION SERVICE (Port 3005)             │
├─────────────────────────────────────────────────────────────┤
│  📦 Modules Principaux:                                      │
│  ├── scanner/        (Scan QR codes)                        │
│  ├── validator/      (Validation billets)                   │
│  ├── checkin/        (Gestion check-in)                     │
│  ├── offline/        (Mode hors-ligne)                       │
│  └── analytics/      (Statistiques temps réel)               │
│                                                             │
│  🔧 Technologies:                                            │
│  ├── Node.js + Express                                      │
│  ├── PostgreSQL (Logs validation)                           │
│  ├── QRCode (Lecture QR codes)                              │
│  ├── Socket.io (Temps réel)                                 │
│  ├── Redis (Cache, mode offline)                            │
│  └── SQLite (Backup local)                                  │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Démarrage Rapide

### Installation
```bash
cd event-planner-backend/scan-validation-service
npm install
cp .env.example .env
npm run db:up && npm run db:migrate
npm run dev
```

### Vérification
```bash
curl http://localhost:3005/health
# Retourne: {"status": "healthy", "service": "scan-validation-service"}
```

## 📡 API Endpoints

### 📱 Scan & Validation
```http
POST /api/scan/validate             (Scanner QR code)
POST /api/scan/checkin              (Check-in participant)
GET  /api/scan/status/:ticketId     (Statut billet)
POST /api/scan/manual               (Validation manuelle)
```

### 📊 Statistiques Temps Réel
```http
GET  /api/analytics/event/:id        (Stats événement)
GET  /api/analytics/realtime        (Stats temps réel)
GET  /api/analytics/hours           (Stats par heure)
GET  /api/analytics/peak            (Heures de pointe)
```

### 🔄 Mode Hors-Ligne
```http
POST /api/offline/sync              (Synchroniser données)
GET  /api/offline/status            (Statut sync)
POST /api/offline/upload            (Uploader logs offline)
```

### 📋 Gestion Événements
```http
GET  /api/events/active             (Événements actifs)
POST /api/events/:id/start          (Démarrer validation)
POST /api/events/:id/stop           (Arrêter validation)
```

## 🔧 Configuration Essentielle

```bash
# Base de données
DATABASE_URL=postgresql://user:pass@localhost:5432/event_planner_scan

# Redis (cache + temps réel)
REDIS_URL=redis://localhost:6379

# Authentification
SHARED_SERVICE_TOKEN=shared-service-token-abcdef12345678901234567890
AUTH_SERVICE_URL=http://localhost:3000

# Services externes
TICKET_SERVICE_URL=http://localhost:3004
CORE_SERVICE_URL=http://localhost:3001

# Scan
QR_SCAN_TIMEOUT=5000
MAX_SCAN_ATTEMPTS=3
SCAN_RETRY_DELAY=1000

# Mode offline
OFFLINE_MODE=true
OFFLINE_DB_PATH=./offline.db
SYNC_INTERVAL=30000

# Temps réel
SOCKET_IO_ENABLED=true
REALTIME_UPDATES=true

# Serveur
PORT=3005
NODE_ENV=development
```

## 📱 Flux de Scan

### 1. Scan QR Code
```mermaid
sequenceDiagram
    participant Scanner
    participant ScanAPI
    participant TicketService
    participant Database
    participant SocketIO

    Scanner->>ScanAPI: POST /api/scan/validate + QR data
    ScanAPI->>TicketService: Valider billet
    TicketService-->>ScanAPI: Billet valide
    ScanAPI->>Database: Enregistrer scan
    ScanAPI->>SocketIO: Notifier temps réel
    ScanAPI-->>Scanner: Validation OK
```

### 2. Mode Hors-Ligne
```mermaid
sequenceDiagram
    participant Scanner
    participant ScanAPI
    participant LocalDB
    participant Redis

    Scanner->>ScanAPI: POST /api/scan/validate
    alt Online OK
        ScanAPI->>Redis: Validation online
    else Offline
        ScanAPI->>LocalDB: Validation locale
        ScanAPI->>Redis: Queue pour sync
    end
    ScanAPI-->>Scanner: Résultat
```

## 📊 Statistiques en Temps Réel

### Métriques Disponibles
- **Participants scannés** : Total et par heure
- **Taux de validation** : Succès/échec
- **Temps moyen scan** : Performance scanner
- **Heures de pointe** : Pics d'assistance
- **Billets dupliqués** : Tentatives fraude

### Dashboard Temps Réel
```javascript
// WebSocket updates
socket.on('scan_update', (data) => {
  console.log('Nouveau scan:', {
    ticketId: data.ticketId,
    timestamp: data.timestamp,
    status: data.status,
    eventType: data.eventType
  });
});
```

## 📱 Interface Scanner

### Mode Paysage (Tablette)
```html
<!-- Interface optimisée pour scan rapide -->
<div class="scanner-interface">
  <div class="camera-view">
    <video id="qr-scanner"></video>
    <div class="scan-overlay"></div>
  </div>
  <div class="ticket-info">
    <h3 id="ticket-name">-</h3>
    <p id="ticket-type">-</p>
    <span id="validation-status">En attente...</span>
  </div>
  <div class="stats-bar">
    <span>Total: <strong id="total-scanned">0</strong></span>
    <span>Validés: <strong id="valid-scanned">0</strong></span>
  </div>
</div>
```

### Mode Manuel
- **Recherche par numéro billet**
- **Validation par nom participant**
- **Recherche par email**

## 📊 Base de Données

### Tables Principales
```sql
scan_logs        -- Logs de tous les scans
checkin_records  -- Records de check-in
offline_scans    -- Scans en mode offline
sync_queue       -- File d'attente sync
event_stats      -- Statistiques événements
```

## 🧪 Tests Rapides

```bash
# Scanner QR code
curl -X POST http://localhost:3005/api/scan/validate \
  -H "Content-Type: application/json" \
  -d '{
    "qrData": "encrypted_qr_data_here",
    "eventId": 123,
    "scannerId": "scanner_001"
  }'

# Stats temps réel
curl http://localhost:3005/api/analytics/event/123

# Mode offline
curl -X POST http://localhost:3005/api/offline/sync \
  -H "Content-Type: application/json" \
  -d '{"scans": [{"ticketId": "123", "timestamp": "..."}]}'
```

## 🚨 Erreurs Communes

### 1. "Invalid QR code"
- QR code endommagé
- Format non supporté

### 2. "Ticket already scanned"
- Billet déjà validé
- Vérifier logs précédents

### 3. "Network error"
- Mode offline activé
- Données localement sauvegardées

## 📈 Monitoring

```bash
# Scans réussis
grep "scan.*success" logs/scan.log

# Erreurs validation
grep "validation.*error" logs/scan.log

# Sync offline
grep "sync.*completed" logs/scan.log
```

## 📱 Applications Mobiles

### React Native App
- **Scan caméra** natif
- **Mode offline** automatique
- **Notifications temps réel**
- **Dashboard statistiques**

### Progressive Web App
- **Installable** sur mobile
- **Accès caméra** web
- **Cache intelligente**
- **Responsive design**

## 💡 Tips Importants

- **Toujours** avoir un mode offline fiable
- **Utiliser** des timeouts pour les scans
- **Sauvegarder** tous les logs localement
- **Implémenter** un retry automatique

---

**📱 Ce service garantit que chaque billet scanné est une expérience fluide !**
