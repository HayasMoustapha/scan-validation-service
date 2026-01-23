require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
const rawBody = require('raw-body');

const logger = require('./utils/logger');
const healthRoutes = require('./health/health.routes');
const scansRoutes = require('./api/routes/scans.routes');
const offlineService = require('./core/offline/offline.service');

/**
 * Serveur principal du Scan Validation Service
 */
class ScanValidationServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3005;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Configure les middlewares
   */
  setupMiddleware() {
    // Sécurité
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

    // CORS
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    }));

    // Compression
    this.app.use(compression());

    // Body parsing avec support pour les QR codes
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        req.rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Support pour les données brutes (QR codes en base64)
    this.app.use('/api/scans/validate', async (req, res, next) => {
      if (req.is('application/json')) {
        try {
          const buf = await rawBody(req, {
            encoding: null,
            limit: '10mb'
          });
          req.rawBody = buf;
          next();
        } catch (error) {
          logger.error('Failed to parse raw body', {
            error: error.message
          });
          return res.status(400).json({
            success: false,
            error: 'Invalid request body',
            code: 'INVALID_BODY'
          });
        }
      } else {
        next();
      }
    });

    // Sécurité contre les injections NoSQL
    this.app.use(mongoSanitize());

    // Logging
    if (process.env.NODE_ENV !== 'test') {
      this.app.use(morgan('combined', {
        stream: {
          write: (message) => logger.info(message.trim())
        }
      }));
    }

    // Rate limiting général
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
      message: {
        success: false,
        message: 'Trop de requêtes, veuillez réessayer plus tard',
        error: {
          code: 'RATE_LIMIT_EXCEEDED'
        }
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api', limiter);

    // Rate limiting spécifique pour les scans
    const scanLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: parseInt(process.env.SCAN_RATE_LIMIT) || 20, // limit each IP to 20 scans per minute
      message: {
        success: false,
        message: 'Limite de scans atteinte, veuillez réessayer plus tard',
        error: {
          code: 'SCAN_RATE_LIMIT_EXCEEDED'
        }
      },
      keyGenerator: (req) => {
        // Utiliser l'ID utilisateur si authentifié, sinon l'IP
        return req.user?.id || req.ip;
      }
    });
    this.app.use('/api/scans/validate', scanLimiter);
    this.app.use('/api/scans/validate-offline', scanLimiter);

    // Request logging
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
   * Configure les routes
   */
  setupRoutes() {
    // Route racine
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Scan Validation Service',
        version: process.env.npm_package_version || '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        capabilities: {
          validation: true,
          qrCode: true,
          offline: true,
          webhooks: true,
          batch: true,
          statistics: true
        }
      });
    });

    // Routes de santé
    this.app.use('/health', healthRoutes);

    // Routes API
    this.app.use('/api/scans', scansRoutes);

    // Route API racine
    this.app.get('/api', (req, res) => {
      res.json({
        service: 'Scan Validation API',
        version: process.env.npm_package_version || '1.0.0',
        endpoints: {
          scans: '/api/scans',
          health: '/health'
        },
        documentation: '/api/docs',
        timestamp: new Date().toISOString()
      });
    });

    // Route pour les métriques Prometheus si activé
    if (process.env.ENABLE_METRICS === 'true') {
      const promClient = require('prom-client');
      
      // Créer un registre de métriques
      const register = new promClient.Registry();
      
      // Ajouter des métriques par défaut
      promClient.collectDefaultMetrics({ register });
      
      // Métriques personnalisées
      const validationCounter = new promClient.Counter({
        name: 'scan_validation_service_validations_total',
        help: 'Total number of ticket validations',
        labelNames: ['status', 'type', 'offline']
      });
      
      const qrCounter = new promClient.Counter({
        name: 'scan_validation_service_qr_generated_total',
        help: 'Total number of QR codes generated',
        labelNames: ['type', 'batch']
      });
      
      const offlineCounter = new promClient.Counter({
        name: 'scan_validation_service_offline_operations_total',
        help: 'Total number of offline operations',
        labelNames: ['operation', 'status']
      });
      
      const validationDuration = new promClient.Histogram({
        name: 'scan_validation_service_validation_duration_seconds',
        help: 'Duration of ticket validation',
        labelNames: ['status', 'type'],
        buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
      });
      
      register.registerMetric(validationCounter);
      register.registerMetric(qrCounter);
      register.registerMetric(offlineCounter);
      register.registerMetric(validationDuration);
      
      // Endpoint pour les métriques
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

    // Route 404
    this.app.use('*', (req, res) => {
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
   * Configure la gestion des erreurs
   */
  setupErrorHandling() {
    // Gestionnaire d'erreurs global
    this.app.use((error, req, res, next) => {
      logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Ne pas envoyer le stack trace en production
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      const errorResponse = {
        success: false,
        message: isDevelopment ? error.message : 'Erreur interne du serveur',
        error: {
          code: 'INTERNAL_SERVER_ERROR'
        },
        timestamp: new Date().toISOString()
      };

      if (isDevelopment) {
        errorResponse.error.stack = error.stack;
      }

      res.status(error.status || 500).json(errorResponse);
    });

    // Gestion des promesses rejetées non capturées
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', {
        promise,
        reason: reason.message || reason
      });
    });

    // Gestion des exceptions non capturées
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', {
        error: error.message,
        stack: error.stack
      });
      
      // Arrêter le serveur proprement
      this.gracefulShutdown('SIGTERM');
    });

    // Gestion des signaux système
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received');
      this.gracefulShutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received');
      this.gracefulShutdown('SIGINT');
    });
  }

  /**
   * Démarre le serveur
   */
  async start() {
    try {
      // Initialiser le service offline
      await offlineService.initialize();
      
      this.server = this.app.listen(this.port, () => {
        logger.info(`Scan Validation Service started successfully`, {
          port: this.port,
          environment: process.env.NODE_ENV || 'development',
          version: process.env.npm_package_version || '1.0.0',
          pid: process.pid,
          capabilities: {
            validation: true,
            qrCode: true,
            offline: true,
            webhooks: true,
            batch: true,
            statistics: true,
            metrics: process.env.ENABLE_METRICS === 'true'
          }
        });
      });

      this.server.on('error', (error) => {
        if (error.syscall !== 'listen') {
          throw error;
        }

        const bind = typeof this.port === 'string'
          ? 'Pipe ' + this.port
          : 'Port ' + this.port;

        switch (error.code) {
          case 'EACCES':
            logger.error(`${bind} requires elevated privileges`);
            process.exit(1);
            break;
          case 'EADDRINUSE':
            logger.error(`${bind} is already in use`);
            process.exit(1);
            break;
          default:
            throw error;
        }
      });
    } catch (error) {
      logger.error('Failed to start Scan Validation Service', {
        error: error.message
      });
      process.exit(1);
    }
  }

  /**
   * Arrête proprement le serveur
   * @param {string} signal - Signal reçu
   */
  async gracefulShutdown(signal) {
    logger.info(`Graceful shutdown initiated by ${signal}`);

    try {
      // Arrêter d'accepter de nouvelles connexions
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed');
        });
      }

      // Synchroniser les données offline avant de quitter
      if (offlineService.pendingSync.size > 0) {
        logger.info('Syncing remaining offline data before shutdown');
        await offlineService.syncOfflineData();
      }

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', {
        error: error.message
      });
      process.exit(1);
    }
  }
}

// Démarrer le serveur si ce fichier est exécuté directement
if (require.main === module) {
  const server = new ScanValidationServer();
  server.start();
}

module.exports = ScanValidationServer;
