/**
 * 📸 SCAN VALIDATION SERVICE - SERVEUR PRINCIPAL
 * 
 * RÔLE : Service technique de validation de tickets QR code
 * PORT : 3005
 * 
 * RESPONSABILITÉS :
 * - Validation technique des QR codes
 * - Détection des doublons de scan
 * - Mode offline pour validation sans connexion
 * - Journalisation technique des scans
 * - Statistiques basiques de scan
 * 
 * NE GÈRE PAS :
 * - L'authentification utilisateur (délégué à event-planner-auth)
 * - La logique métier (délégué à event-planner-core)
 * - La génération de QR codes (délégué à ticket-generator-service)
 * - La gestion des utilisateurs/opérateurs (délégué à event-planner-core)
 */

const path = require('path');
const dotenv = require('dotenv');

if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
} else {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
const rawBody = require('raw-body');

// Import des services et routes internes
const logger = require('./utils/logger');
const healthRoutes = require('./health/health.routes');
const scansRoutes = require('./api/routes/scans.routes');
const confirmationRoutes = require('./api/routes/confirmation.routes');
const offlineService = require('./core/offline/offline.service');
const bootstrap = require("./bootstrap");

/**
 * 🏗️ CLASSE PRINCIPALE DU SERVEUR
 * 
 * Configure et démarre le service de validation de tickets.
 * Ce service est purement technique et ne contient aucune logique métier.
 */
class ScanValidationServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3005;
    
    // Configuration du serveur
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * 🔧 CONFIGURATION DES MIDDLEWARES
   * 
   * Configure les middlewares de sécurité, parsing et logging.
   * Note : Pas d'authentification - service technique pur.
   */
  setupMiddleware() {
    // 🛡️ SÉCURITÉ - Protection des en-têtes HTTP
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // 🌐 CORS - Partage de ressources entre origines
    // Permet à event-planner-core d'appeler ce service
    this.app.use(cors({
      origin: [process.env.CORS_ORIGIN || 'http://localhost:3000', 'http://localhost:3099'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    }));

    // 📦 COMPRESSION - Réduction de la taille des réponses
    this.app.use(compression());

    // 📝 PARSING - Traitement des corps de requête
    // Support pour les QR codes qui peuvent être volumineux (base64)
    this.app.use(express.json({ 
      limit: '10mb'
    }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 🔒 SÉCURITÉ CONTRE INJECTIONS NoSQL
    // Implémentation d'un middleware de sanitization basique
    const self = this;
    this.app.use((req, res, next) => {
      try {
        // Sanitize les objets dans le body pour prévenir les injections NoSQL
        if (req.body && typeof req.body === 'object') {
          req.body = self.sanitizeObject(req.body);
        }
        
        // NE PAS MODIFIER req.query directement - créer une copie si nécessaire
        // req.query est en lecture seule dans certaines versions d'Express
        // if (req.query && typeof req.query === 'object') {
        //   req.query = self.sanitizeObject(req.query);
        // }
      } catch (error) {
        logger.error('Sanitization error:', error);
      }
      
      next();
    });

    // 📊 LOGGING - Journalisation des requêtes HTTP
    // Désactivé en mode test pour éviter la pollution des logs
    if (process.env.NODE_ENV !== 'test') {
      this.app.use(morgan('combined', {
        stream: {
          write: (message) => logger.info(message.trim())
        }
      }));
    }

    // 🚦 RATE LIMITING GÉNÉRAL
    // Désactivé pour le moment - peut être réactivé si nécessaire
    // const limiter = rateLimit({
    //   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    //   max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    //   message: {
    //     success: false,
    //     message: 'Trop de requêtes, veuillez réessayer plus tard',
    //     error: {
    //       code: 'RATE_LIMIT_EXCEEDED'
    //     }
    //   },
    //   standardHeaders: true,
    //   legacyHeaders: false,
    // });
    // this.app.use('/api', limiter);

    // 🎫 RATE LIMITING SPÉCIFIQUE POUR LES SCANS
    // Protection contre les abus de validation de tickets
    const scanLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: parseInt(process.env.SCAN_RATE_LIMIT) || 20, // 20 scans par minute par IP
      message: {
        success: false,
        message: 'Limite de scans atteinte, veuillez réessayer plus tard',
        error: {
          code: 'SCAN_RATE_LIMIT_EXCEEDED'
        }
      }
    });
    // Appliquer le rate limiting aux endpoints de validation
    this.app.use('/api/scans/validate', scanLimiter);
    this.app.use('/api/scans/validate-offline', scanLimiter);

    // 📝 LOGGING PERSONNALISÉ - Journalisation des requêtes entrantes
    // Log détaillé pour le monitoring et le débogage
    this.app.use((req, res, next) => {
      logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentType: req.get('Content-Type')
      });
      next();
    });
  }

  /**
   * 🛣️ CONFIGURATION DES ROUTES
   * 
   * Configure toutes les routes du service.
   * Note : Aucune route n'est protégée par authentification.
   */
  setupRoutes() {
    // 🏠 ROUTE RACINE - Informations sur le service
    // Endpoint public pour vérifier que le service fonctionne
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Scan Validation Service',
        version: process.env.npm_package_version || '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        capabilities: {
          validation: true,        // Validation de QR codes
          qrCode: true,           // Décodeur QR code
          offline: true,          // Mode offline
          statistics: true        // Stats basiques
        }
      });
    });

    // 🏥 ROUTES DE SANTÉ - Monitoring technique
    // Endpoints publics pour le monitoring du service
    this.app.use('/health', healthRoutes);

    // E5.6 — Stack de validation UNIQUE et canonique : /api/scans.
    // L'ancien stack /api (scan-validation-routes, contrat /api/validate divergent)
    // a été retiré pour éliminer la double validation. Le BFF frontend et les
    // clients utilisent /api/scans/*.
    // 🎫 ROUTES API ACTUELLES - Routes principales de validation de tickets
    this.app.use('/api/scans', scansRoutes);

    // � ROUTES INTERNES - Communication inter-services
    // Routes pour recevoir les confirmations d'Event-Planner-Core
    this.app.use('/api/internal', confirmationRoutes);

    // � ROUTE API RACINE - Informations sur l'API
    // Endpoint public pour les informations sur l'API
    this.app.get('/api', (req, res) => {
      res.json({
        service: 'Scan Validation API',
        version: process.env.npm_package_version || '1.0.0',
        endpoints: {
          scans: '/api/scans',           // Routes de validation
          internal: '/api/internal',     // Routes internes inter-services
          health: '/health'              // Routes de santé
        },
        documentation: '/api/docs', // Documentation Swagger
        timestamp: new Date().toISOString()
      });
    });

    // 📊 MÉTRIQUES PROMETHEUS - Monitoring avancé (optionnel)
    // Si activé, expose des métriques pour Prometheus
    if (process.env.ENABLE_METRICS === 'true') {
      const promClient = require('prom-client');
      
      // 📈 REGISTRE DE MÉTRIQUES
      // Crée un registre pour collecter toutes les métriques
      const register = new promClient.Registry();
      
      // 📊 MÉTRIQUES PAR DÉFAUT - Métriques système standard
      // CPU, mémoire, etc.
      promClient.collectDefaultMetrics({ register });
      
      // 📱 COMPTEUR DE VALIDATIONS - Nombre total de validations
      const validationCounter = new promClient.Counter({
        name: 'scan_validation_service_validations_total',
        help: 'Total number of ticket validations',
        labelNames: ['status', 'type', 'offline'], // valid/invalid, online/offline
        registers: [register] // Spécifier le registre pour éviter les conflits
      });
      
      // 📱 COMPTEUR DE QR GÉNÉRÉS - Nombre total de QR codes générés
      const qrCounter = new promClient.Counter({
        name: 'scan_validation_service_qr_generated_total',
        help: 'Total number of QR codes generated',
        labelNames: ['type', 'batch'], // single/batch
        registers: [register] // Spécifier le registre pour éviter les conflits
      });
      
      // 📴 COMPTEUR OPÉRATIONS OFFLINE - Nombre d'opérations offline
      const offlineCounter = new promClient.Counter({
        name: 'scan_validation_service_offline_operations_total',
        help: 'Total number of offline operations',
        labelNames: ['operation', 'status'], // sync/validate, success/failure
        registers: [register] // Spécifier le registre pour éviter les conflits
      });
      
      // ⏱️ HISTOGRAMME DE DURÉE - Temps de validation
      const validationDuration = new promClient.Histogram({
        name: 'scan_validation_service_validation_duration_seconds',
        help: 'Duration of ticket validation',
        labelNames: ['status', 'type'],
        buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5], // En secondes
        registers: [register] // Spécifier le registre pour éviter les conflits
      });
      
      // 📝 ENREGISTREMENT DES MÉTRIQUES
      register.registerMetric(validationCounter);
      register.registerMetric(qrCounter);
      register.registerMetric(offlineCounter);
      register.registerMetric(validationDuration);
      
      // 📈 ENDPOINT MÉTRIQUES - Expose les métriques Prometheus
      this.app.get('/metrics', async (req, res) => {
        try {
          res.set('Content-Type', register.contentType);
          res.end(await register.metrics());
        } catch (error) {
          logger.error('Failed to generate metrics', {
            error: error.message
          });
          res.status(500).end();
        }
      });
    }

    // Documentation Swagger — http://localhost:3005/docs
    const { specs: swaggerSpecs, swaggerUi, swaggerUiOptions } = require('./config/swagger');
    this.app.use('/docs', swaggerUi.serve);
    this.app.get('/docs', swaggerUi.setup(swaggerSpecs, swaggerUiOptions));

    // 🚫 ROUTE 404 - Gestion des routes non trouvées
    // Route par défaut pour toutes les URLs non gérées
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route non trouvée',
        error: {
          code: 'NOT_FOUND',
          path: req.originalUrl
        },
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * 🚨 CONFIGURATION DE LA GESTION DES ERREURS
   * 
   * Configure le gestionnaire d'erreurs global.
   * Toutes les erreurs non gérées passent par ici.
   */
  setupErrorHandling() {
    // 🛑 GESTIONNAIRE D'ERREURS GLOBAL
    // Capture toutes les erreurs non gérées dans l'application
    this.app.use((error, req, res, next) => {
      // 📝 LOG DÉTAILLÉ DE L'ERREUR
      logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // 🔒 SÉCURITÉ - Ne pas exposer le stack trace en production
      // En développement, on peut envoyer plus de détails pour le débogage
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      const errorResponse = {
        success: false,
        message: isDevelopment ? error.message : 'Erreur interne du serveur',
        error: {
          code: 'INTERNAL_SERVER_ERROR'
        },
        timestamp: new Date().toISOString()
      };

      // 🐛 MODE DÉVELOPPEMENT - Ajouter le stack trace pour le débogage
      if (isDevelopment) {
        errorResponse.error.stack = error.stack;
      }

      // 📤 RÉPONSE D'ERREUR
      res.status(error.status || 500).json(errorResponse);
    });

    // 🚨 GESTION DES PROMESSES REJETÉES - Erreurs asynchrones non capturées
    // Capture les erreurs de promesses qui n'ont pas de .catch()
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', {
        promise,
        reason: reason.message || reason
      });
    });

    // 💥 GESTION DES EXCEPTIONS NON CAPTURÉES - Erreurs synchrones critiques
    // Dernière ligne de défense contre les erreurs non gérées
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', {
        error: error.message,
        stack: error.stack
      });
      
      // 🛑 ARRÊT PROPRE DU SERVEUR - Évite la corruption des données
      this.gracefulShutdown('SIGTERM');
    });

    // 📡 GESTION DES SIGNAUX SYSTÈME - Arrêt propre du service
    // 📡 GESTION DES SIGNAUX SYSTÈME - Arrêt propre du service (Ctrl+C)
    // Permet au service de s'arrêter proprement lors d'un Ctrl+C
    process.on('SIGINT', () => {
      logger.info('SIGINT received');
      this.gracefulShutdown('SIGINT');
    });
  }

  /**
   * 🚀 DÉMARRAGE DU SERVEUR
   * 
   * Démarre le serveur après initialisation complète.
   * Initialise la base de données, le service offline, puis démarre l'écoute.
   */
  async start() {
    try {
      // 🔧 BOOTSTRAP AUTOMATIQUE - Initialisation de la base de données
      // Crée la base de données et applique les migrations si nécessaire
      await bootstrap.initialize();
      
      // 📴 INITIALISATION SERVICE OFFLINE - Préparation du mode offline
      // Configure le service pour fonctionner sans connexion réseau
      await offlineService.initialize();
      
      // 🚀 DÉMARRAGE DU SERVEUR
      logger.info('🚀 Starting Scan Validation Service server...');
      
      // 📡 DÉMARRAGE DE L'ÉCOUTE - Mise en route du serveur HTTP
      this.server = this.app.listen(this.port, () => {
        logger.info(`Scan Validation Service started successfully`, {
          port: this.port,
          environment: process.env.NODE_ENV || 'development',
          version: process.env.npm_package_version || '1.0.0',
          pid: process.pid,
          capabilities: {
            validation: true,        // Validation de QR codes
            qrCode: true,           // Décodeur QR code
            offline: true,          // Mode offline
            webhooks: true,         // Webhooks techniques
            batch: true,            // Traitement par lot
            statistics: true,       // Statistiques basiques
            metrics: process.env.ENABLE_METRICS === 'true' // Métriques Prometheus
          }
        });
      });

      // 🚨 GESTION DES ERREURS DE SERVEUR
      // Capture les erreurs au niveau du serveur HTTP
      this.server.on('error', (error) => {
        if (error.syscall !== 'listen') {
          throw error;
        }

        // 📍 CONSTRUCTION DU MESSAGE D'ERREUR
        const bind = typeof this.port === 'string'
          ? 'Pipe ' + this.port
          : 'Port ' + this.port;

        // 🔍 GESTION DES ERREURS SPÉCIFIQUES AU PORT
        // Traite les erreurs courantes de démarrage de serveur
        switch (error.code) {
          case 'EACCES':
            // 🔐 PERMISSION REFUSÉE - Le port nécessite des privilèges élevés
            logger.error(`${bind} requires elevated privileges`);
            process.exit(1);
            break;
          case 'EADDRINUSE':
            // 📍 PORT DÉJÀ UTILISÉ - Un autre processus utilise ce port
            logger.error(`${bind} is already in use`);
            process.exit(1);
            break;
          default:
            // ❌ ERREUR INCONNUE - Propager l'erreur
            throw error;
        }
      });
    } catch (error) {
      // 🚨 ÉCHEC DU DÉMARRAGE - Erreur lors de l'initialisation
      logger.error('Failed to start Scan Validation Service', {
        error: error.message
      });
      process.exit(1);
    }
  }

  /**
   * � SANITIZATION DES OBJETS - Prévention des injections NoSQL
   * 
   * Nettoie les objets en supprimant les opérateurs MongoDB dangereux
   * et en validant la structure des données.
   * 
   * @param {Object} obj - Objet à nettoyer
   * @returns {Object} Objet nettoyé
   */
  sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    // Liste des opérateurs MongoDB dangereux à bloquer
    const dangerousOperators = [
      '$where', '$regex', '$expr', '$jsonSchema', '$text', '$elemMatch',
      '$gt', '$gte', '$lt', '$lte', '$ne', '$in', '$nin', '$exists',
      '$type', '$mod', '$all', '$size', '$not', '$nor', '$and', '$or',
      '$inc', '$mul', '$rename', '$setOnInsert', '$min', '$max', '$currentDate',
      '$addToSet', '$push', '$each', '$slice', '$sort', '$position', '$bit',
      '$pull', '$pullAll', '$pop', '$unset'
    ];

    const clean = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Vérifier si la clé est un opérateur dangereux
      if (dangerousOperators.includes(key)) {
        logger.warn('Dangerous operator detected and removed', { 
          operator: key, 
          value: typeof value === 'object' ? '[Object]' : value 
        });
        continue;
      }

      // Nettoyer récursivement les objets imbriqués
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        clean[key] = this.sanitizeObject(value);
      } 
      // Nettoyer les tableaux
      else if (Array.isArray(value)) {
        clean[key] = value.map(item => 
          (item && typeof item === 'object') ? this.sanitizeObject(item) : item
        );
      }
      // Valider les chaînes de caractères
      else if (typeof value === 'string') {
        // Limiter la taille des chaînes pour prévenir les attaques
        clean[key] = value.length > 10000 ? value.substring(0, 10000) : value;
      }
      // Garder les autres types tels quels
      else {
        clean[key] = value;
      }
    }

    return clean;
  }

  /**
   * �🛑 ARRÊT PROPRE DU SERVEUR
   * 
   * Arrête le serveur proprement en sauvegardant les données
   * et en fermant les connexions existantes.
   * 
   * @param {string} signal - Signal système reçu (SIGTERM, SIGINT)
   */
  async gracefulShutdown(signal) {
    logger.info(`Graceful shutdown initiated by ${signal}`);

    try {
      // 📡 ARRÊT DU SERVEUR HTTP - Plus de nouvelles connexions
      // Ferme le serveur mais permet aux requêtes en cours de se terminer
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed');
        });
      }

      // 📴 SYNCHRONISATION OFFLINE - Sauvegarde des données locales
      // Synchronise toutes les données offline avant d'arrêter
      if (offlineService.pendingSync.size > 0) {
        logger.info('Syncing remaining offline data before shutdown');
        await offlineService.syncOfflineData();
      }

      // ✅ ARRÊT COMPLÉTÉ - Toutes les données sauvegardées
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      // 🚨 ERREUR LORS DE L'ARRÊT - Problème lors de la sauvegarde
      logger.error('Error during graceful shutdown', {
        error: error.message
      });
      process.exit(1);
    }
  }
}

// 🚀 DÉMARRAGE AUTOMATIQUE - Si ce fichier est exécuté directement
// Permet de démarrer le service avec `node src/server.js`
if (require.main === module) {
  const server = new ScanValidationServer();
  server.start().catch(error => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

// 📤 EXPORTATION - Pour les tests et l'utilisation dans d'autres modules
module.exports = ScanValidationServer;

// Export de l'app Express pour les tests
const testServerInstance = new ScanValidationServer();
module.exports.app = testServerInstance.app;
