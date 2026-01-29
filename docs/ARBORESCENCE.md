# 📁 ARBORESCENCE COMPLÈTE - SCAN VALIDATION SERVICE

## 🎯 Vue d'ensemble

Le **Scan Validation Service** gère la validation des tickets en temps réel lors des événements avec support offline et statistiques en direct.

```
📁 scan-validation-service/
├── 📁 src/                    # Code source principal
├── 📁 database/               # Gestion base de données
├── 📁 tests/                  # Tests automatisés
├── 📁 docs/                   # Documentation
├── 📁 postman/                # Collections API
├── 📁 logs/                   # Logs applicatifs
└── 📄 Configuration files     # Fichiers de config
```

---

## 📁 DÉTAIL DE L'ARBORESCENCE

### 📁 src/ - Code source principal

```
📁 src/
├── 📁 api/                    # API REST
│   ├── 📁 routes/             # Routes API
│   │   ├── 📄 scan.routes.js
│   │   ├── 📄 validate.routes.js
│   │   ├── 📄 statistics.routes.js
│   │   ├── 📄 sync.routes.js
│   │   └── 📄 health.routes.js
│   │
│   └── 📁 controllers/        # Contrôleurs API
│       ├── 📄 scan.controller.js
│       ├── 📄 validate.controller.js
│       ├── 📄 statistics.controller.js
│       ├── 📄 sync.controller.js
│       └── 📄 health.controller.js
│
├── 📁 core/                   # Cœur métier
│   ├── 📁 services/           # Services métier
│   │   ├── 📄 scan.service.js
│   │   ├── 📄 validate.service.js
│   │   ├── 📄 statistics.service.js
│   │   ├── 📄 sync.service.js
│   │   └── 📄 offline.service.js
│   │
│   ├── 📁 processors/         # Processeurs
│   │   ├── 📄 qr-processor.js
│   │   ├── 📄 ticket-processor.js
│   │   ├── 📄 validation-processor.js
│   │   └── 📄 sync-processor.js
│   │
│   └── 📁 scanners/           # Scanners
│       ├── 📄 qr-scanner.js
│       ├── 📄 barcode-scanner.js
│       ├── 📄 nfc-scanner.js
│       └── 📄 manual-scanner.js
│
├── 📁 services/              # Services partagés
│   ├── 📄 database.service.js
│   ├── 📄 redis.service.js
│   ├── 📄 cache.service.js
│   ├── 📄 storage.service.js
│   └── 📄 metrics.service.js
│
├── 📁 database/              # Base de données
│   ├── 📁 bootstrap/          # Scripts bootstrap
│   │   ├── 📄 001_create_schema_migrations.sql
│   │   └── 📄 002_create_database.sql
│   │
│   ├── 📁 migrations/         # Migrations SQL
│   │   ├── 📄 001_initial_schema.sql
│   │   ├── 📄 002_add_indexes.sql
│   │   └── 📄 003_add_offline_tables.sql
│   │
│   └── 📄 connection.js       # Connexion BDD
│
├── 📁 middleware/            # Middlewares
│   ├── 📄 validation.middleware.js
│   ├── 📄 rate-limit.middleware.js
│   ├── 📄 auth.middleware.js
│   └── 📄 error.middleware.js
│
├── 📁 config/                # Configuration
│   ├── 📄 database.js
│   ├── 📄 redis.js
│   ├── 📄 scanners.js
│   ├── 📄 offline.js
│   └── 📄 sync.js
│
├── 📁 utils/                 # Utilitaires
│   ├── 📄 logger.js
│   ├── 📄 helpers.js
│   ├── 📄 validators.js
│   └── 📄 constants.js
│
├── 📁 error/                 # Gestion erreurs
│   ├── 📄 error-handler.js
│   ├── 📄 custom-errors.js
│   └── 📄 error-types.js
│
├── 📁 health/                # Health checks
│   ├── 📄 health.controller.js
│   ├── 📄 health.routes.js
│   └── 📄 health.service.js
│
├── 📁 offline/               # Mode offline
│   ├── 📄 offline-storage.js
│   ├── 📄 offline-sync.js
│   └── 📄 offline-queue.js
│
├── 📁 real-time/             # Temps réel
│   ├── 📄 websocket.js
│   ├── 📄 sse.js
│   └── 📄 events.js
│
├── 📁 mobile/                # Mobile PWA
│   ├── 📄 pwa.js
│   ├── 📄 service-worker.js
│   └── 📄 manifest.json
│
├── 📄 server.js              # Serveur principal
├── 📄 bootstrap.js           # Initialisation
└── 📄 index.js               # Export principal
```

### 📁 database/ - Gestion base de données

```
📁 database/
├── 📁 bootstrap/              # Scripts bootstrap
│   ├── 📄 001_create_schema_migrations.sql
│   ├── 📄 002_create_database.sql
│   └── 📄 003_create_extensions.sql
│
├── 📁 migrations/             # Migrations SQL
│   ├── 📄 001_initial_schema.sql
│   ├── 📄 002_add_indexes.sql
│   ├── 📄 003_add_offline_tables.sql
│   ├── 📄 004_add_statistics.sql
│   └── 📄 005_add_audit_tables.sql
│
├── 📁 schema/                 # Documentation schéma
│   ├── 📄 validations.sql
│   ├── 📄 scan_stats.sql
│   ├── 📄 offline_data.sql
│   └── 📄 scanner_sessions.sql
│
├── 📁 seeds/                  # Données initiales
│   ├── 📄 001_test_validations.sql
│   ├── 📄 002_sample_stats.sql
│   └── 📄 003_offline_data.sql
│
├── 📄 DATABASE_BOOTSTRAP.md   # Documentation BDD
├── 📄 README.md               # README database
└── 📄 connection.js           # Configuration connexion
```

### 📁 tests/ - Tests automatisés

```
📁 tests/
├── 📁 unit/                   # Tests unitaires
│   ├── 📁 services/
│   │   ├── 📄 scan.service.test.js
│   │   ├── 📄 validate.service.test.js
│   │   ├── 📄 statistics.service.test.js
│   │   └── 📄 sync.service.test.js
│   ├── 📁 processors/
│   │   ├── 📄 qr-processor.test.js
│   │   ├── 📄 ticket-processor.test.js
│   │   └── 📄 validation-processor.test.js
│   └── 📁 utils/
│       ├── 📄 logger.test.js
│       └── 📄 helpers.test.js
│
├── 📁 integration/            # Tests d'intégration
│   ├── 📄 scan.integration.test.js
│   ├── 📄 validate.integration.test.js
│   ├── 📄 statistics.integration.test.js
│   └── 📄 sync.integration.test.js
│
├── 📁 e2e/                    # Tests end-to-end
│   ├── 📄 ticket-scan.e2e.test.js
│   ├── 📄 offline-validation.e2e.test.js
│   ├── 📄 real-time-stats.e2e.test.js
│   └── 📄 mobile-pwa.e2e.test.js
│
├── 📁 fixtures/               # Données de test
│   ├── 📄 tickets.json
│   ├── 📄 validations.json
│   ├── 📄 statistics.json
│   └── 📄 offline-data.json
│
├── 📁 helpers/                # Helpers de test
│   ├── 📄 database.helper.js
│   ├── 📄 qr-helper.js
│   └── 📄 mock.helper.js
│
├── 📄 setup.js                # Configuration tests
├── 📄 teardown.js             # Nettoyage tests
└── 📄 test.config.js          # Config tests
```

### 📁 docs/ - Documentation

```
📁 docs/
├── 📄 README.md               # Documentation principale
├── 📄 API_ROUTES.md           # Routes API
├── 📄 SCANNING.md             # Processus de scan
├── 📄 OFFLINE_MODE.md         # Mode offline
├── 📄 REAL_TIME_STATS.md      # Statistiques temps réel
├── 📄 MOBILE_PWA.md           # Application mobile PWA
├── 📄 DEPLOYMENT.md           # Guide déploiement
└── 📄 TROUBLESHOOTING.md      # Dépannage
```

### 📁 postman/ - Collections API

```
📁 postman/
├── 📄 Scan-Validation-Service.postman_collection.json
├── 📄 Scan-Validation-Service.postman_environment.json
├── 📄 scan-validation-service.postman_collection.json.backup
└── 📁 examples/
    ├── 📄 scan-ticket.json
    ├── 📄 validate-qr.json
    ├── 📄 get-stats.json
    └── 📄 sync-offline.json
```

---

## 📄 Fichiers de configuration

### 📄 Fichiers principaux

```
📄 package.json              # Dépendances et scripts
📄 package-lock.json          # Lock versions
📄 .env.example              # Variables environnement
📄 .env.test                 # Env test
📄 .gitignore                # Fichiers ignorés Git
├── 📄 README.md               # README principal
├── 📄 API_ROUTES.md           # Documentation routes API
└── 📄 Dockerfile                # Configuration Docker
```

---

## 🎯 Rôle de chaque dossier

### 📁 src/ - Code métier
Contient toute la logique applicative organisée en couches pour une meilleure maintenabilité.

### 📁 database/ - Persistance
Gère tout ce qui concerne la base de données : schéma, migrations, seeds et connexions.

### 📁 tests/ - Qualité
Assure la qualité du code avec des tests unitaires, d'intégration et end-to-end.

### 📁 docs/ - Documentation
Centralise toute la documentation technique et utilisateur.

### 📁 postman/ - API Testing
Facilite les tests manuels et l'exploration des API avec des collections Postman.

### 📁 logs/ - Logging
Centralise tous les logs applicatifs pour le debugging et le monitoring.

---

## 🚀 Points d'entrée principaux

### 📄 server.js
Point d'entrée principal du serveur Express. Configure et démarre l'application.

### 📄 bootstrap.js
Script d'initialisation : connexion BDD, migrations, démarrage services.

### 📄 index.js
Export principal pour les tests et l'utilisation comme module.

---

## 🔧 Configuration

### Variables d'environnement clés
- `NODE_ENV` : Environnement (development/production)
- `PORT` : Port d'écoute (3005)
- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` : BDD
- `REDIS_URL` : Redis
- `OFFLINE_STORAGE_PATH` : Chemin stockage offline
- `SYNC_BATCH_SIZE` : Taille batch sync
- `REAL_TIME_ENABLED` : Activation temps réel

### Scripts npm principaux
- `npm start` : Démarrage production
- `npm run dev` : Développement avec nodemon
- `npm test` : Tests unitaires
- `npm run test:integration` : Tests intégration
- `npm run test:e2e` : Tests E2E
- `npm run build` : Build production
- `npm run migrate` : Migrations BDD
- `npm run seed` : Seeding BDD

---

## 🔄 Processus de validation

### 1. Scan QR Code
```
Mobile App → QR Scanner → Validation Service → Database → Response
```

### 2. Validation Ticket
```
QR Data → Decode → Verify Signature → Check Database → Update Status
```

### 3. Mode Offline
```
Local Storage → Queue → Sync when Online → Database
```

---

## 📱 Mode Offline

### Stockage local
- **IndexedDB** : Navigateur mobile
- **LocalStorage** : Fallback
- **SQLite** : Application native

### Synchronisation
- **Queue** : File d'attente locale
- **Batch sync** : Synchronisation par lots
- **Conflict resolution** : Gestion des conflits
- **Retry logic** : Tentatives automatiques

### Données offline
```javascript
{
  "validations": [
    {
      "ticketId": "TC-2024-123456",
      "validatedAt": "2024-01-01T18:30:00Z",
      "scannerId": "scanner-123",
      "location": "Entrance A",
      "synced": false
    }
  ],
  "lastSync": "2024-01-01T18:00:00Z"
}
```

---

## 📊 Statistiques temps réel

### WebSocket Events
```javascript
// Client connecté
socket.on('ticket:validated', (data) => {
  console.log('Ticket validifié:', data);
});

// Mise à jour statistiques
socket.on('stats:update', (stats) => {
  updateDashboard(stats);
});
```

### Types de statistiques
- **Total validés** : Nombre total de tickets validés
- **Par heure** : Validations par heure
- **Par type** : Validations par type de ticket
- **Par scanner** : Validations par scanner
- **Par lieu** : Validations par lieu
- **Taux de validation** : Pourcentage de validation

---

## 📱 PWA Mobile

### Service Worker
```javascript
// Cache des ressources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('scan-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/offline.html',
        '/manifest.json'
      ]);
    })
  );
});

// Sync en arrière-plan
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-validations') {
    event.waitUntil(syncValidations());
  }
});
```

### Manifest
```json
{
  "name": "Event Scanner",
  "short_name": "Scanner",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#007bff",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

---

## 🔒 Sécurité

### Validation QR Code
- **Signature verification** : Vérification HMAC
- **Timestamp validation** : Validation temporelle
- **Duplicate check** : Détection doublons
- **Rate limiting** : Limitation par scanner

### Anti-fraude
- **Geolocation** : Vérification localisation
- **Time windows** : Fenêtres temporelles
- **Scanner authentication** : Auth scanners
- **Audit trail** : Traçabilité complète

---

## 📊 Performance

### Optimisations
- **Redis cache** : Cache des validations récentes
- **Batch processing** : Traitement par lot
- **Connection pooling** : Pool de connexions BDD
- **CDN integration** : Distribution statique

### Monitoring
- **Response time** : Temps de réponse
- **Throughput** : Débit de validations
- **Error rate** : Taux d'erreurs
- **Memory usage** : Utilisation mémoire

---

**Version** : 1.0.0  
**Dernière mise à jour** : 29 janvier 2026
