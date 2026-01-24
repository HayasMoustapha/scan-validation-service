const { authClient } = require('../config');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Validate with Auth Service only (no local JWT verification)
    const authResult = await authClient.validateToken(token);

    if (!authResult.success) {
      return res.status(401).json({
        error: 'Invalid token',
        message: authResult.error
      });
    }

    // Attach user info to request
    const user = authResult.data.user;

    // Ensure user has required fields for downstream middleware
    if (!user) {
      return res.status(401).json({
        error: 'Invalid user data',
        message: 'User information not available'
      });
    }

    // Normalize user ID field (handle both userId and id)
    if (!user.id && user.userId) {
      user.id = user.userId;
    }

    if (!user.id) {
      return res.status(401).json({
        error: 'Invalid user data',
        message: 'User ID not found'
      });
    }

    // Ensure roles array exists
    if (!user.roles || !Array.isArray(user.roles)) {
      user.roles = [];
    }

    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during authentication',
      requestId: req.id || 'unknown'
    });
  }
};

// Alias for backward compatibility
const authenticateJWT = authenticate;

const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.replace('Bearer ', '');
    // Validate with Auth Service only (consistent with authenticate middleware)
    const authResult = await authClient.validateToken(token);

    if (authResult.success) {
      req.user = authResult.data.user;
      req.token = token;
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

/**
 * Middleware pour valider une clé API pour les webhooks externes
 */
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const expectedKey = process.env.SCAN_API_KEY;

  if (!expectedKey) {
    console.error('SCAN_API_KEY environment variable not configured');
    return res.status(500).json({
      error: 'Configuration error',
      message: 'API key not configured'
    });
  }

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      message: 'Please provide an API key via X-API-Key header or api_key query parameter'
    });
  }

  if (apiKey !== expectedKey) {
    return res.status(403).json({
      error: 'Invalid API key',
      message: 'The provided API key is not valid'
    });
  }

  next();
};

module.exports = {
  authenticate,
  authenticateJWT,
  optionalAuthenticate,
  validateApiKey
};
