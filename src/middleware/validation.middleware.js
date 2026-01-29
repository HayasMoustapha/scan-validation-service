const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Middleware de validation pour le scan-validation-service
 * Validation des requêtes avec Joi
 */
class ValidationMiddleware {
  /**
   * Middleware de validation principal
   * @param {Object} schema - Schéma Joi de validation
   * @returns {Function} Middleware Express
   */
  static validate(schema) {
    return (req, res, next) => {
      try {
        // Valider le body
        if (schema && Object.keys(schema).length > 0) {
          const { error, value } = Joi.object(schema).validate(req.body, {
            abortEarly: false,
            allowUnknown: false,
            stripUnknown: true
          });

          if (error) {
            const errorDetails = error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message,
              value: detail.context?.value
            }));

            logger.warn('Validation failed', {
              error: errorDetails,
              body: req.body
            });

            return res.status(400).json({
              success: false,
              error: 'Données invalides',
              details: errorDetails,
              code: 'VALIDATION_ERROR'
            });
          }

          // Mettre à jour le body avec les données validées
          req.body = value;
        }

        next();
      } catch (error) {
        logger.error('Validation middleware error', {
          error: error.message,
          stack: error.stack
        });

        return res.status(500).json({
          success: false,
          error: 'Erreur de validation',
          message: error.message,
          code: 'VALIDATION_SYSTEM_ERROR'
        });
      }
    };
  }

  /**
   * Middleware de validation pour les paramètres de route
   * @param {Object} schema - Schéma Joi pour les params
   * @returns {Function} Middleware Express
   */
  static validateParams(schema) {
    return (req, res, next) => {
      try {
        const { error, value } = Joi.object(schema).validate(req.params, {
          abortEarly: false,
          allowUnknown: false,
          stripUnknown: true
        });

        if (error) {
          const errorDetails = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }));

          return res.status(400).json({
            success: false,
            error: 'Paramètres invalides',
            details: errorDetails,
            code: 'PARAMS_VALIDATION_ERROR'
          });
        }

        req.params = value;
        next();
      } catch (error) {
        logger.error('Params validation error', {
          error: error.message
        });

        return res.status(500).json({
          success: false,
          error: 'Erreur de validation des paramètres',
          message: error.message,
          code: 'PARAMS_VALIDATION_SYSTEM_ERROR'
        });
      }
    };
  }

  /**
   * Middleware de validation pour les query parameters
   * @param {Object} schema - Schéma Joi pour les query params
   * @returns {Function} Middleware Express
   */
  static validateQuery(schema) {
    return (req, res, next) => {
      try {
        const { error, value } = Joi.object(schema).validate(req.query, {
          abortEarly: false,
          allowUnknown: false,
          stripUnknown: true
        });

        if (error) {
          const errorDetails = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }));

          return res.status(400).json({
            success: false,
            error: 'Query parameters invalides',
            details: errorDetails,
            code: 'QUERY_VALIDATION_ERROR'
          });
        }

        // Mettre à jour la query sans réassigner l'objet req.query
        Object.keys(value).forEach(key => {
          req.query[key] = value[key];
        });
        
        // Supprimer les clés non validées
        Object.keys(req.query).forEach(key => {
          if (!Object.prototype.hasOwnProperty.call(value, key)) {
            delete req.query[key];
          }
        });

        next();
      } catch (error) {
        logger.error('Query validation error', {
          error: error.message
        });

        return res.status(500).json({
          success: false,
          error: 'Erreur de validation des query parameters',
          message: error.message,
          code: 'QUERY_VALIDATION_SYSTEM_ERROR'
        });
      }
    };
  }

  /**
   * Middleware combiné pour valider body, params et query
   * @param {Object} schemas - Schémas Joi { body, params, query }
   * @returns {Function} Middleware Express
   */
  static validateAll(schemas) {
    return (req, res, next) => {
      try {
        // Valider le body
        if (schemas.body) {
          const { error, value } = Joi.object(schemas.body).validate(req.body, {
            abortEarly: false,
            allowUnknown: false,
            stripUnknown: true
          });

          if (error) {
            const errorDetails = error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message
            }));

            return res.status(400).json({
              success: false,
              error: 'Données invalides',
              details: errorDetails,
              code: 'BODY_VALIDATION_ERROR'
            });
          }

          req.body = value;
        }

        // Valider les params
        if (schemas.params) {
          const { error, value } = Joi.object(schemas.params).validate(req.params, {
            abortEarly: false,
            allowUnknown: false,
            stripUnknown: true
          });

          if (error) {
            const errorDetails = error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message
            }));

            return res.status(400).json({
              success: false,
              error: 'Paramètres invalides',
              details: errorDetails,
              code: 'PARAMS_VALIDATION_ERROR'
            });
          }

          req.params = value;
        }

        // Valider la query
        if (schemas.query) {
          const { error, value } = Joi.object(schemas.query).validate(req.query, {
            abortEarly: false,
            allowUnknown: false,
            stripUnknown: true
          });

          if (error) {
            const errorDetails = error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message
            }));

            return res.status(400).json({
              success: false,
              error: 'Query parameters invalides',
              details: errorDetails,
              code: 'QUERY_VALIDATION_ERROR'
            });
          }

          req.query = value;
        }

        next();
      } catch (error) {
        logger.error('Combined validation error', {
          error: error.message
        });

        return res.status(500).json({
          success: false,
          error: 'Erreur de validation',
          message: error.message,
          code: 'VALIDATION_SYSTEM_ERROR'
        });
      }
    };
  }
}

module.exports = ValidationMiddleware;
