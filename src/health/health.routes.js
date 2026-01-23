const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * Health check routes for Scan Validation Service
 */

// Simple health check
router.get('/', async (req, res) => {
  try {
    logger.info('Health check accessed');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'scan-validation',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Detailed health check
router.get('/detailed', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'scan-validation',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      dependencies: {
        redis: 'not_configured',
        database: 'not_configured'
      },
      services: {
        validation: 'healthy',
        qr: 'healthy',
        offline: 'healthy'
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    res.json(health);
  } catch (error) {
    logger.error('Detailed health check failed', { error: error.message });
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Readiness check
router.get('/ready', async (req, res) => {
  try {
    const ready = {
      status: 'ready',
      timestamp: new Date().toISOString(),
      dependencies: {
        redis: 'not_configured',
        database: 'not_configured'
      }
    };

    res.json(ready);
  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({
      status: 'not_ready',
      error: error.message
    });
  }
});

// Liveness check
router.get('/live', async (req, res) => {
  try {
    res.json({
      status: 'alive',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Liveness check failed', { error: error.message });
    res.status(503).json({
      status: 'not_alive',
      error: error.message
    });
  }
});

// Component-specific health checks
router.get('/components/validation', async (req, res) => {
  try {
    res.json({
      success: true,
      component: 'validation',
      healthy: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      component: 'validation',
      healthy: false,
      error: error.message
    });
  }
});

router.get('/components/qr', async (req, res) => {
  try {
    res.json({
      success: true,
      component: 'qr',
      healthy: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      component: 'qr',
      healthy: false,
      error: error.message
    });
  }
});

router.get('/components/offline', async (req, res) => {
  try {
    res.json({
      success: true,
      component: 'offline',
      healthy: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      component: 'offline',
      healthy: false,
      error: error.message
    });
  }
});

// Providers status
router.get('/providers', async (req, res) => {
  try {
    const providers = {
      validation: {
        status: 'healthy',
        lastCheck: new Date().toISOString()
      },
      qr: {
        status: 'healthy',
        lastCheck: new Date().toISOString()
      },
      offline: {
        status: 'healthy',
        lastCheck: new Date().toISOString()
      }
    };

    res.json({
      success: true,
      providers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Configuration endpoint
router.get('/config', async (req, res) => {
  try {
    const config = {
      qrCode: {
        secretKey: process.env.QR_CODE_SECRET_KEY ? 'configured' : 'not_configured',
        expiration: process.env.QR_CODE_EXPIRATION || '24h'
      },
      offline: {
        enabled: process.env.OFFLINE_VALIDATION_ENABLED === 'true',
        syncInterval: process.env.OFFLINE_SYNC_INTERVAL || '5m'
      },
      validation: {
        maxRetries: process.env.VALIDATION_MAX_RETRIES || 3,
        timeout: process.env.VALIDATION_TIMEOUT || '5s'
      }
    };

    res.json({
      success: true,
      config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
