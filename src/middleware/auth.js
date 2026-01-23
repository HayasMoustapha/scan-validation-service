const jwt = require('jsonwebtoken');
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Authentication middleware for Scan Validation Service
 */

// JWT authentication
const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
        error: {
          code: 'MISSING_TOKEN'
        }
      });
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
        error: {
          code: 'MISSING_TOKEN'
        }
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (jwtError) {
      logger.warn('Invalid JWT token', { error: jwtError.message });
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        error: {
          code: 'INVALID_TOKEN'
        }
      });
    }
  } catch (error) {
    logger.error('Authentication error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: {
        code: 'AUTH_ERROR'
      }
    });
  }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
      } catch (jwtError) {
        // Token is invalid but we don't fail the request
        logger.warn('Invalid optional JWT token', { error: jwtError.message });
      }
    }
    
    next();
  } catch (error) {
    logger.error('Optional authentication error', { error: error.message });
    next(); // Continue even if there's an error
  }
};

// Validate with Auth Service
const validateWithAuthService = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
        error: {
          code: 'MISSING_TOKEN'
        }
      });
    }

    const token = authHeader.substring(7);
    
    try {
      // Validate token with Auth Service
      const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3000';
      const response = await axios.get(`${authServiceUrl}/api/auth/validate`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 5000
      });

      if (response.data.success) {
        req.user = response.data.data;
        next();
      } else {
        return res.status(401).json({
          success: false,
          message: 'Invalid token',
          error: {
            code: 'INVALID_TOKEN'
          }
        });
      }
    } catch (axiosError) {
      logger.warn('Auth service validation failed', { 
        error: axiosError.message,
        status: axiosError.response?.status
      });
      
      // Fallback to local JWT validation
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
      } catch (jwtError) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token',
          error: {
            code: 'INVALID_TOKEN'
          }
        });
      }
    }
  } catch (error) {
    logger.error('Auth service validation error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: {
        code: 'AUTH_ERROR'
      }
    });
  }
};

// Permission check
const requirePermission = (permission) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: {
            code: 'AUTHENTICATION_REQUIRED'
          }
        });
      }

      const userPermissions = req.user.permissions || [];
      
      if (!userPermissions.includes(permission)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            required: permission
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Permission check error', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Permission check error',
        error: {
          code: 'PERMISSION_ERROR'
        }
      });
    }
  };
};

// Role check
const requireRole = (role) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: {
            code: 'AUTHENTICATION_REQUIRED'
          }
        });
      }

      const userRoles = req.user.roles || [];
      
      if (!userRoles.includes(role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient role',
          error: {
            code: 'INSUFFICIENT_ROLE',
            required: role
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Role check error', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Role check error',
        error: {
          code: 'ROLE_ERROR'
        }
      });
    }
  };
};

// API Key validation
const validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key required',
        error: {
          code: 'MISSING_API_KEY'
        }
      });
    }

    const validApiKey = process.env.WEBHOOK_SECRET;
    
    if (!validApiKey || apiKey !== validApiKey) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key',
        error: {
          code: 'INVALID_API_KEY'
        }
      });
    }

    next();
  } catch (error) {
    logger.error('API key validation error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'API key validation error',
      error: {
        code: 'API_KEY_ERROR'
      }
    });
  }
};

// Webhook signature validation
const validateWebhookSignature = (req, res, next) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const webhookSecret = process.env.WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      return res.status(500).json({
        success: false,
        message: 'Webhook secret not configured',
        error: {
          code: 'WEBHOOK_NOT_CONFIGURED'
        }
      });
    }

    // Simple validation - in production, use proper HMAC verification
    if (!signature || signature !== webhookSecret) {
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature',
        error: {
          code: 'INVALID_WEBHOOK_SIGNATURE'
        }
      });
    }

    next();
  } catch (error) {
    logger.error('Webhook signature validation error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Webhook signature validation error',
      error: {
        code: 'WEBHOOK_SIGNATURE_ERROR'
      }
    });
  }
};

// Operator validation
const validateOperator = async (req, res, next) => {
  try {
    const operatorId = req.user?.id || req.body.operatorId || req.query.operatorId;
    
    if (!operatorId) {
      return res.status(400).json({
        success: false,
        message: 'Operator ID required',
        error: {
          code: 'MISSING_OPERATOR_ID'
        }
      });
    }

    // In a real implementation, validate operator against database
    // For now, we'll just check if the user has operator permissions
    const userPermissions = req.user?.permissions || [];
    
    if (!userPermissions.includes('scan:validate') && !userPermissions.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Operator permissions required',
        error: {
          code: 'INSUFFICIENT_PERMISSIONS'
        }
      });
    }

    req.operatorId = operatorId;
    next();
  } catch (error) {
    logger.error('Operator validation error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Operator validation error',
      error: {
        code: 'OPERATOR_VALIDATION_ERROR'
      }
    });
  }
};

module.exports = {
  authenticateJWT,
  optionalAuth,
  validateWithAuthService,
  requirePermission,
  requireRole,
  validateApiKey,
  validateWebhookSignature,
  validateOperator
};
