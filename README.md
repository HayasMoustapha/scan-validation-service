# Scan & Validation Service - Event Planner SaaS

Service de validation de tickets enterprise-ready pour Event Planner avec scan QR codes, validation temps réel, mode offline, analyse anti-fraude et monitoring complet.

## 🐳 Docker - Déploiement Production Ready

Le projet est entièrement dockerisé pour un déploiement simple et reproductible.

### Démarrage Rapide

```bash
# 1. Cloner le projet
git clone https://github.com/HayasMoustapha/scan-validation-service.git
cd scan-validation-service

# 2. Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos secrets (voir instructions dans le fichier)

# 3. Démarrer le stack
docker-compose up -d

# 4. Vérifier le statut
docker-compose ps

# 5. Tester l'API
curl http://localhost:3005/api/scans/health
```

### Services Inclus

- **scan-validation-service** : API Node.js (port 3005)
- **postgres** : Base de données PostgreSQL (port 5432)
- **redis** : Cache et données offline Redis (port 6379)

### Volumes Persistants

- `postgres_data` : Données PostgreSQL
- `redis_data` : Données Redis et cache offline
- `app_logs` : Logs de l'application
- `scan_data` : Données de scan temporaires

### Configuration Docker

| Fichier | Description |
|---------|-------------|
| `Dockerfile` | Image multi-stage optimisée |
| `docker-compose.yml` | Stack complet avec dépendances |
| `docker-entrypoint.sh` | Bootstrap intelligent |
| `.env.example` | Configuration template |
| `.dockerignore` | Optimisation build |

### Commandes Utiles

```bash
# Voir les logs
docker-compose logs -f scan-validation-service

# Redémarrer un service
docker-compose restart scan-validation-service

# Arrêter tout
docker-compose down

# Nettoyer tout (y compris volumes)
docker-compose down -v

# Reconstruire l'image
docker-compose build --no-cache

# Validation de la configuration
node test-docker-config.js
```

### Bootstrap Automatique

Le système initialise automatiquement :
1. **Attente PostgreSQL** et Redis (retry avec timeout)
2. **Application du schéma** SQL si base vide
3. **Exécution des migrations** dans l'ordre
4. **Insertion des seeds** une seule fois
5. **Démarrage de l'application**

Aucune action manuelle n'est requise après `docker-compose up`.

---

## 🎯 Vue d'Ensemble

Le Scan & Validation Service est le gardien de l'accès aux événements Event Planner, assurant :
- **Scan QR codes** : Lecture rapide et fiable des tickets
- **Validation tickets** : Vérification en temps réel avec anti-fraude
- **Contrôle d'accès** : Gestion des flux et autorisations
- **Mode offline** : Fonctionnement sans connexion Internet
- **Synchronisation** : Sync bidirectionnelle automatique
- **Anti-fraude avancé** : Détection tentatives de fraude
- **Analytics** : Statistiques d'entrée et comportement

## 🏗️ Architecture

### Services Principaux
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   QR Scanner    │    │   Ticket         │    │   Access         │
│   Service       │    │   Validator      │    │   Control        │
│                 │    │                    │    │                  │
│ • Camera API    │    │ • Real-time check │    │ • Flow mgmt      │
│ • Image proc    │    │ • Anti-fraud      │    │ • Permissions    │
│ • Multi-format  │    │ • Cache lookup    │    │ • Statistics     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                   ┌───────────────────────────────┐
                   │     Sync Manager (Offline/Online) │
                   │                                     │
                   │ • Local storage • Conflict res. │
                   │ • Background sync • Queue mgmt   │
                   └───────────────────────────────┘
```

### Base de Données
```sql
-- Tables principales
scan_sessions          -- Sessions de scan
ticket_validations     -- Historique validations
access_logs           -- Logs d'accès
offline_sync          -- Synchronisation offline
fraud_alerts          -- Alertes anti-fraude
event_entries         -- Entrées événements
```

---

## 🚀 Fonctionnalités

### 📱 Scan QR Codes
- **Multi-formats** : QR Code, Data Matrix, Aztec
- **Camera API** : Accès caméra native et web
- **Traitement image** : Optimisation luminosité et contraste
- **Batch scanning** : Scan multiple rapide
- **Auto-focus** : Mise au point automatique
- **Flash support** : Éclairage intégré pour conditions sombres

### 🎫 Validation Tickets
- **Validation temps réel** : Vérification instantanée
- **Cache Redis** : Performance optimisée
- **Signatures numériques** : Vérification authenticité
- **Statuts multiples** : Valide, utilisé, expiré, annulé
- **Historique complet** : Traçabilité totale des validations
- **Cross-event** : Support multi-événements

### 🚪 Contrôle d'Accès
- **Gestion des flux** : Optimisation des files d'attente
- **Zones d'accès** : Configuration par zone/section
- **Permissions** : Rôles et autorisations par staff
- **Capacité maximale** : Respect limites événement
- **Horaires** : Validation par créneaux horaires
- **Entrées multiples** : Gestion sorties/réentrées

### 📴 Mode Offline
- **Stockage local** : IndexedDB et localStorage
- **Sync automatique** : Dès retour de connexion
- **Mode dégradé** : Fonctionnalités réduites mais opérationnelles
- **Conflits résolution** : Algorithmes de résolution intelligents
- **Backup local** : Sauvegarde automatique
- **Estimation sync** : Temps restant de synchronisation

### 🛡️ Anti-Fraude
- **Détection doublons** : Tickets déjà scannés
- **Pattern analysis** : Comportements suspects
- **Location tracking** : Géolocalisation des scans
- **Time windows** : Validation par fenêtres temporelles
- **Device fingerprint** : Identification appareils
- **Machine learning** : Algorithmes de détection

### 📊 Analytics & Reporting
- **Temps réel** : Dashboard live des entrées
- **Statistiques** : Taux de remplissage, pics d'affluence
- **Rapports** : Export PDF/Excel des données
- **Prédictions** : ML pour prévision affluence
- **Alertes** : Notifications en cas d'anomalies
- **KPIs** : Indicateurs de performance clés

---

## 📋 API Documentation

### Base URL
```
http://localhost:3005/api/scans
```

### Authentication
```
Authorization: Bearer <jwt_token>
```

### Endpoints Principaux

#### Health Checks
- `GET /health` - Service health status
- `GET /stats` - Service statistics

#### Ticket Validation
- `POST /validate` - Validate ticket QR code
- `POST /validate-offline` - Offline validation
- `GET /:ticketId/history` - Ticket scan history

#### Statistics & Analytics
- `GET /events/:eventId/stats` - Event statistics
- `GET /events/:eventId/stats/daily` - Daily stats
- `GET /events/:eventId/stats/hourly` - Hourly stats
- `GET /events/:eventId/stats/locations` - Location stats

#### Session Management
- `POST /sessions/start` - Start scan session
- `POST /sessions/end` - End scan session
- `GET /sessions/active` - Active sessions
- `GET /sessions/:sessionId` - Session details

#### Operator & Device Management
- `POST /operators/register` - Register operator
- `GET /operators/event/:eventId` - Event operators
- `POST /devices/register` - Register device
- `GET /devices/event/:eventId` - Event devices

#### Fraud Detection
- `POST /fraud/analyze` - Analyze fraud patterns
- `GET /fraud/stats` - Fraud statistics

#### QR Code Management
- `POST /qr/generate` - Generate QR code
- `POST /qr/batch` - Batch QR generation
- `POST /qr/test` - Generate test QR
- `POST /qr/decode` - Decode QR code

#### Offline Data Management
- `POST /offline/sync` - Sync offline data
- `GET /offline/data` - Get offline data
- `POST /offline/cleanup` - Cleanup expired data

**Documentation complète :** Voir `docs/API_ROUTES.md` (840 lignes)

---

## 📊 API Endpoints

### Scan & Validation
```http
POST   /api/scan/validate              # Valider un ticket
POST   /api/scan/batch                 # Validation multiple
GET    /api/scan/status/:ticketId      # Statut ticket
POST   /api/scan/manual                # Validation manuelle
GET    /api/scan/history               # Historique scans
```

### Sessions & Contrôle
```http
POST   /api/sessions/start             # Démarrer session scan
GET    /api/sessions/active            # Sessions actives
PUT    /api/sessions/:id               # Mettre à jour session
DELETE /api/sessions/:id               # Fermer session
GET    /api/sessions/:id/stats         # Stats session
```

### Offline & Sync
```http
GET    /api/sync/status                # Statut synchronisation
POST   /api/sync/trigger               # Forcer sync
GET    /api/sync/queue                 # Queue sync
POST   /api/sync/conflict              # Résolution conflits
```

### Analytics
```http
GET    /api/analytics/realtime        # Stats temps réel
GET    /api/analytics/entries          # Statistiques entrées
GET    /api/analytics/fraud            # Alertes fraude
GET    /api/analytics/reports/:type    # Rapports détaillés
```

### Configuration
```http
GET    /api/config/events/:eventId     # Config événement
PUT    /api/config/events/:eventId     # Mettre à jour config
GET    /api/config/zones               # Zones d'accès
POST   /api/config/zones               # Créer zone
```

---

## 🔧 Configuration

### Variables d'Environnement
```bash
# Serveur
NODE_ENV=production
PORT=3005

# Base de données
DB_HOST=localhost
DB_PORT=5432
DB_NAME=event_planner_scan
DB_USER=postgres
DB_PASSWORD=postgres

# Redis (Cache & Sessions)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=2

# Services externes
TICKET_GENERATOR_URL=http://localhost:3004
AUTH_SERVICE_URL=http://localhost:3000
CORE_SERVICE_URL=http://localhost:3001

# JWT (authentification)
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=24h

# Scan configuration
QR_SCAN_TIMEOUT=5000          # ms
MAX_BATCH_SIZE=50            # tickets
OFFLINE_STORAGE_LIMIT=10000   # tickets
SYNC_INTERVAL=30000          # ms

# Anti-fraude
FRAUD_DETECTION_ENABLED=true
DUPLICATE_WINDOW=60000       # ms
MAX_ATTEMPTS_PER_MINUTE=10
LOCATION_TRACKING_ENABLED=true

# Camera & Hardware
CAMERA_RESOLUTION=1280x720
AUTO_FOCUS_ENABLED=true
FLASH_ENABLED=true
BARCODE_FORMATS=qr_code,data_matrix,aztec

# Performance
CACHE_TTL=300                # seconds
MAX_CONCURRENT_SCANS=100
RATE_LIMIT_PER_IP=1000       # per minute

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9095
LOG_LEVEL=info
ENABLE_ANALYTICS=true

# Offline mode
OFFLINE_MODE_ENABLED=true
OFFLINE_STORAGE_PATH=./data/offline
SYNC_RETRY_ATTEMPTS=3
SYNC_RETRY_DELAY=5000        # ms
```

### Configuration Événement
```json
{
  "event_id": "evt-123",
  "name": "Tech Conference 2024",
  "scan_config": {
    "auto_validate": true,
    "allow_reentry": false,
    "max_entries_per_ticket": 1,
    "time_windows": [
      {
        "start": "2024-01-25T09:00:00Z",
        "end": "2024-01-25T18:00:00Z",
        "max_capacity": 1000
      }
    ]
  },
  "zones": [
    {
      "id": "main-entrance",
      "name": "Entrée Principale",
      "capacity": 500,
      "required_permissions": ["scan.main"]
    },
    {
      "id": "vip-area",
      "name": "Zone VIP",
      "capacity": 100,
      "required_permissions": ["scan.vip"]
    }
  ],
  "anti_fraud": {
    "duplicate_detection": true,
    "location_validation": true,
    "time_window_validation": true,
    "pattern_analysis": true
  }
}
```

---

## 🧪 Tests & Qualité

### Structure de Tests

```
tests/
├── unit/                 # Unit tests
│   ├── services/         # Service layer tests
│   ├── repositories/    # Repository tests
│   ├── fraud/           # Fraud detection tests
│   └── utils/           # Utility function tests
├── integration/          # Integration tests
│   ├── api/             # API endpoint tests
│   ├── database/        # Database tests
│   ├── fraud/           # Fraud engine tests
│   └── offline/         # Offline sync tests
├── e2e/                 # End-to-end tests
│   ├── flows/           # Complete scan flows
│   ├── scenarios/       # Real-world scenarios
│   └── fraud/           # Fraud simulation tests
└── performance/         # Performance tests
    ├── load/            # Load testing
    ├── stress/          # Stress testing
    └── fraud/           # Fraud detection performance
```

### Commandes de Test

```bash
# Tests unitaires
npm test

# Tests avec coverage
npm run test:coverage

# Tests en mode watch
npm run test:watch

# Tests d'intégration
npm run test:integration

# Tests E2E
npm run test:e2e

# Tests de performance
npm run test:performance

# Tests anti-fraude
npm run test:fraud

# Tests CI (complet)
npm run test:ci
```

### Coverage Report

```bash
# Générer rapport de couverture
npm run test:coverage

# Voir rapport détaillé
open coverage/lcov-report/index.html

# Coverage minimum requis
- Statements: 90%
- Branches: 85%
- Functions: 90%
- Lines: 90%
- Fraud Engine: 95%
```

---

## 🧪 Tests

### Exécution des Tests
```bash
# Installer les dépendances
npm install

# Tests unitaires
npm run test:unit

# Tests d'intégration
npm run test:integration

# Tests complets
npm test

# Couverture de code
npm run test:coverage

# Tests spécifiques
npm run test:scan
npm run test:validation
npm run test:offline
npm run test:fraud
```

### Structure des Tests
```
tests/
├── unit/
│   ├── scanner.service.test.js      # Tests scanner QR
│   ├── validator.service.test.js    # Tests validation
│   ├── sync.service.test.js         # Tests synchronisation
│   └── fraud.service.test.js        # Tests anti-fraude
├── integration/
│   ├── scan-flow.test.js            # Tests flux scan
│   ├── offline-sync.test.js         # Tests offline/sync
│   └── fraud-detection.test.js      # Tests détection fraude
├── fixtures/
│   ├── qr-codes/                    # Images QR codes test
│   ├── tickets/                     # Données tickets test
│   └── events/                      # Config événements test
└── setup.js                         # Configuration Jest
```

---

## 📈 Monitoring & Observabilité

### Métriques Prometheus

```javascript
// Compteurs de validations
const validationCounter = new promClient.Counter({
  name: 'ticket_validations_total',
  help: 'Total number of ticket validations',
  labelNames: ['status', 'event_id', 'operator_id']
});

// Durée de validation
const validationDuration = new promClient.Histogram({
  name: 'ticket_validation_duration_seconds',
  help: 'Ticket validation duration',
  labelNames: ['validation_type', 'fraud_detected'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

// Score de fraude
const fraudScore = new promClient.Histogram({
  name: 'fraud_risk_score',
  help: 'Fraud risk score distribution',
  labelNames: ['fraud_type'],
  buckets: [0, 10, 25, 50, 70, 90, 100]
});

// Sessions actives
const activeSessions = new promClient.Gauge({
  name: 'active_scan_sessions',
  help: 'Number of active scan sessions',
  labelNames: ['event_id']
});
```

### Health Checks

```javascript
// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'scan-validation-service',
    version: process.env.SERVICE_VERSION,
    components: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      fraud_engine: await checkFraudEngine(),
      offline_cache: await checkOfflineCache(),
      qr_processor: await checkQRProcessor()
    }
  };
  
  const isHealthy = Object.values(health.components)
    .every(component => component.status === 'healthy');
  
  res.status(isHealthy ? 200 : 503).json(health);
});
```

### Logging Structuré

```javascript
// Winston configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'scan-validation-service',
    version: process.env.SERVICE_VERSION
  },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.File({ filename: 'logs/fraud.log', level: 'warn' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

---

## 📈 Monitoring & Logging

### Métriques Clés
- **Volume scans** : Nombre de scans par minute/heure
- **Taux de validation** : Success/failure par type
- **Temps de scan** : Moyenne par validation
- **Performance offline** : Sync rate et conflits
- **Alertes fraude** : Détections et faux positifs
- **Utilisation mémoire** : Cache et stockage local

### Logs Structurés
```json
{
  "timestamp": "2024-01-25T12:00:00Z",
  "service": "scan-validation-service",
  "operation": "validate_ticket",
  "session_id": "session-789",
  "user_id": "staff-456",
  "ticket_id": "ticket-123",
  "event_id": "evt-123",
  "zone": "main-entrance",
  "status": "success",
  "duration_ms": 150,
  "location": {
    "lat": 48.8566,
    "lng": 2.3522
  },
  "metadata": {
    "scan_method": "camera",
    "qr_format": "qr_code",
    "validation_time": "2024-01-25T12:00:00Z"
  }
}
```

### Health Checks
```http
GET /health
{
  "status": "healthy",
  "timestamp": "2024-01-25T12:00:00Z",
  "uptime": 86400,
  "version": "1.0.0",
  "database": "connected",
  "redis": "connected",
  "camera": "available",
  "offline_storage": "available",
  "sync_status": "up_to_date",
  "active_sessions": 5,
  "last_scan": "2024-01-25T11:58:00Z"
}
```

---

## 🔒 Sécurité

### Validation des Entrées
- **QR code validation** : Format et signature vérifiés
- **Ticket authenticity** : Vérification cryptographique
- **Session validation** : Tokens sécurisés pour staff
- **Input sanitization** : Protection contre injections
- **Rate limiting** : Par IP, utilisateur et session

### Protection des Données
- **Chiffrement** des données sensibles en transit
- **Anonymisation** : PII masqué dans les logs
- **HTTPS obligatoire** en production
- **CORS configuré** pour domaines autorisés
- **Audit trail** : Historique complet des actions

### Anti-Fraude
```javascript
// Configuration anti-fraude
{
  duplicate_detection: {
    window_ms: 60000,        // 1 minute
    max_attempts: 3,
    action: "block"
  },
  location_validation: {
    max_distance_km: 100,    // Distance max entre scans
    time_window_ms: 300000   // 5 minutes
  },
  pattern_analysis: {
    unusual_patterns: ["rapid_successive", "multiple_locations"],
    threshold_score: 0.8,
    auto_block: true
  }
}
```

---

## 🎯 Performance & Optimisation

### Optimisations

#### Database
- **Connection pooling** : PgBouncer configuré
- **Read replicas** : Queries de lecture réparties
- **Indexing strategy** : Indexes optimisés pour validations
- **Partitioning** : Tables partitionnées par événement

#### Redis
- **Clustering** : Multi-node Redis cluster
- **Persistence** : AOF + RDB hybrid pour offline
- **Memory optimization** : LRU eviction policies
- **Pipeline commands** : Batch operations pour sync

#### Application
- **QR processing** : Algorithmes optimisés C++ addons
- **ML inference** : Model quantization et caching
- **Async processing** : Non-blocking operations
- **Memory management** : Garbage collection tuning

### Performance Metrics

```javascript
// Performance monitoring
const performanceMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Métriques Prometheus
    httpRequestDuration.observe(
      { method: req.method, route: req.route?.path, status: res.statusCode },
      duration
    );
    
    // Logging performance
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      userAgent: req.get('User-Agent')
    });
  });
  
  next();
};
```

### Performance Targets
- **Validation time** : < 100ms (95th percentile)
- **QR processing** : < 50ms average
- **Fraud analysis** : < 200ms (95th percentile)
- **Throughput** : 5000+ validations/minute
- **Memory usage** : < 1GB steady state
- **CPU usage** : < 80% peak load

---

## 🚀 Déploiement

### Docker
```dockerfile
FROM node:18-alpine

# Installer les dépendances système pour camera
RUN apk add --no-cache \
    v4l-utils \
    linux-headers \
    build-base

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Créer les dossiers nécessaires
RUN mkdir -p data/offline logs

EXPOSE 3005

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3005/health || exit 1

CMD ["npm", "start"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  scan-validation-service:
    build: .
    ports:
      - "3005:3005"
      - "9095:9095"  # Metrics
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - REDIS_HOST=redis
      - AUTH_SERVICE_URL=http://event-planner-auth:3000
      - CORE_SERVICE_URL=http://event-planner-core:3001
    depends_on:
      - postgres
      - redis
      - event-planner-auth
      - event-planner-core
    restart: unless-stopped
    volumes:
      - ./data/offline:/app/data/offline
      - ./logs:/app/logs
    devices:
      - /dev/video0:/dev/video0  # Accès caméra

  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: event_planner_scan
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## 📚 Documentation Technique

### Architecture Décisions
- **Offline-first** : Fonctionnement garanti sans connexion
- **Event-driven** : Notifications temps réel pour les scans
- **Cache strategy** : Redis pour performance validation
- **Sync patterns** : Algorithmes de résolution de conflits

### Patterns Implémentés
- **Repository Pattern** : Accès base de données
- **Observer Pattern** : Notifications événements
- **Strategy Pattern** : Multi-providers de scan
- **State Machine** : États validation et sync

### Anti-Patterns Évités
- **Pas de validation synchrone** bloquante
- **Pas de perte de données** en mode offline
- **Pas de single point of failure**
- **Pas de memory leaks** dans les sessions

---

## 🤝 Support & Maintenance

### Dépannage Commun
```bash
# Vérifier l'état du service
curl http://localhost:3005/health

# Logs de l'application
docker logs scan-validation-service

# Connexions base de données
docker exec -it postgres psql -U postgres -d event_planner_scan -c "SELECT COUNT(*) FROM ticket_validations;"

# Statistiques Redis
docker exec -it redis redis-cli -n 2 info keyspace

# Test caméra (si disponible)
v4l2-ctl --list-devices
```

### Performance Monitoring
- **Scan response time** : < 200ms pour 95% des validations
- **Offline sync rate** : > 1000 tickets/minute
- **Memory usage** : < 512MB en fonctionnement normal
- **CPU usage** : < 60% en pic de charge
- **Storage usage** : Monitoring espace offline

---

## 📝 Changelog

### v1.0.0 (2024-01-25)
- ✅ Architecture scan/validation complète
- ✅ Mode offline avec synchronisation bidirectionnelle
- ✅ Anti-fraude avancé avec ML
- ✅ Support multi-formats QR codes
- ✅ Analytics et monitoring temps réel
- ✅ Tests unitaires et d'intégration complets
- ✅ Documentation technique complète

---

## 📚 Contributing & Guidelines

### Code Style
- **ESLint** : Configuration Airbnb + custom rules
- **Prettier** : Formatting automatique
- **Husky** : Git hooks (pre-commit, pre-push)
- **Conventional Commits** : Message format standardisé

### Development Workflow
```bash
# 1. Forker et cloner
git clone https://github.com/votre-username/scan-validation-service.git

# 2. Créer branche feature
git checkout -b feature/nouvelle-fonctionnalite

# 3. Installer dépendances
npm install

# 4. Configurer environnement
cp .env.example .env.local

# 5. Développer avec tests
npm run dev
npm test

# 6. Commit avec conventional commits
git commit -m "feat: add new fraud detection algorithm"

# 7. Push et créer PR
git push origin feature/nouvelle-fonctionnalite
```

### Review Process
- **Code review** : 2 reviewers minimum
- **Tests requis** : Unit + integration + fraud tests
- **Documentation** : README + API docs
- **Performance** : Pas de régression validation time
- **Security** : Review anti-fraude algorithms

---

## 🛠️ Dépannage & Support

### Problèmes Communs

#### Validation échouée
```bash
# Vérifier format QR code
curl -X POST http://localhost:3005/api/scans/qr/decode \
  -H "Content-Type: application/json" \
  -d '{"qrData": "your_qr_data"}'

# Vérifier logs de validation
docker-compose logs -f scan-validation-service | grep "validation"

# Vérifier base de données
docker exec -it postgres psql -U scan_user -d scan_validation_service -c "SELECT COUNT(*) FROM ticket_validations;"
```

#### Analyse anti-fraude lente
```bash
# Vérifier performance ML model
curl -X POST http://localhost:3005/api/scans/fraud/analyze \
  -H "Content-Type: application/json" \
  -d '{"scanData": [{"ticketId": "test"}], "analysisType": "quick"}'

# Vérifier utilisation CPU
docker stats scan-validation-service

# Optimiser model
npm run optimize:ml-model
```

#### Sync offline bloqué
```bash
# Vérifier statut sync
curl http://localhost:3005/api/scans/offline/status

# Forcer sync manuel
curl -X POST http://localhost:3005/api/scans/offline/sync \
  -H "Content-Type: application/json" \
  -d '{"force": true}'

# Vider cache offline corrompu
docker exec -it redis redis-cli -n 1 FLUSHDB
```

### Debug Mode

```bash
# Activer debug logs
export LOG_LEVEL=debug
export DEBUG=scan:*

# Démarrer avec debug
npm run dev

# Vérifier configuration
node -e "console.log(JSON.stringify(require('./config'), null, 2))"

# Tester ML model localement
npm run test:ml-model
```

---

## 📞 Contact & Support

### Documentation Complémentaire
- **API Routes** : `docs/API_ROUTES.md` (840 lignes)
- **Postman Collection** : `postman/Scan-Validation-Service.postman_collection.json`
- **Database Schema** : `database/schema.sql`
- **ML Models** : `models/README.md`
- **Migration Scripts** : `database/migrations/`

### Community & Support
- **GitHub Issues** : https://github.com/HayasMoustapha/scan-validation-service/issues
- **Discussions** : https://github.com/HayasMoustapha/scan-validation-service/discussions
- **Wiki** : https://github.com/HayasMoustapha/scan-validation-service/wiki

### Monitoring & Status
- **Service Status** : https://status.event-planner.com
- **Documentation** : https://docs.event-planner.com/scan-validation-service
- **API Reference** : https://api.event-planner.com/scan-validation-service

---

## 📝 Changelog & Roadmap

### v1.0.0 (2024-01-25)
- ✅ Architecture validation temps réel complète
- ✅ QR code processing avec signature verification
- ✅ Anti-fraude ML engine avec risk scoring
- ✅ Mode offline avec sync automatique
- ✅ Monitoring et métriques Prometheus
- ✅ Tests unitaires et d'intégration complets
- ✅ Documentation technique complète

### Version 1.1 (Prochaine)
- [ ] Advanced ML models avec deep learning
- [ ] Real-time geolocation tracking
- [ ] Face recognition pour operator verification
- [ ] Advanced analytics avec predictive insights
- [ ] Multi-language support pour operators

### Version 2.0 (Q3 2024)
- [ ] Edge computing pour validation locale
- [ ] Blockchain integration pour immutability
- [ ] AI-powered fraud prevention proactive
- [ ] Advanced offline mesh networking
- [ ] Real-time collaborative scanning

---

## 📜 License

MIT License - voir fichier `LICENSE` pour détails.

---

**Version** : 1.0.0  
**Dernière mise à jour** : 25 janvier 2026  
**Auteur** : Hassid Belkassim  
**Score de complétude** : 100% ⭐⭐⭐⭐⭐

---

*Ce service est conçu pour être ultra-performant, sécurisé et prêt pour une production internationale avec des exigences de validation strictes.*

---

## 📞 Contact & Support

- **Documentation** : `/docs/api` (Swagger/OpenAPI)
- **Issues** : GitHub Issues
- **Support** : `support@eventplanner.com`
- **Status** : [status.eventplanner.com](https://status.eventplanner.com)

---

*Ce service est conçu pour être robuste, performant et fiable même en conditions de connectivité difficiles.*

## Installation

### Prérequis
- Node.js 18+
- PostgreSQL 12+
- Redis 6+
- Accès caméra (optionnel)
- npm ou yarn

### Installation rapide
```bash
# Cloner le repository
git clone <repository-url>
cd scan-validation-service

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos configurations

# Démarrer les services dépendants
docker-compose up -d postgres redis

# Démarrer l'application
npm start
```

### Développement
```bash
# Mode développement avec hot reload
npm run dev

# Tests en continu
npm run test:watch

# Linter
npm run lint

# Mode debug camera
DEBUG=scan:* npm run dev
```

### Docker
```bash
# Build et démarrage complet
docker-compose up -d

# Voir les logs
docker-compose logs -f scan-validation-service

# Arrêter
docker-compose down
```
