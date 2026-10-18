/**
 * Q-GUARD Authentication Middleware
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const API_KEY = process.env.API_KEY || '';

/**
 * Authenticate via JWT token or API key.
 * API key is used by ESP32 devices.
 * JWT is used by dashboard users.
 */
function authenticate(req, res, next) {
    // Check API key first (for device communication)
    const apiKey = req.headers['x-api-key'];
    if (apiKey && API_KEY && apiKey === API_KEY) {
        req.authType = 'api_key';
        req.deviceAuth = true;
        return next();
    }
    
    // Check JWT token
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.substring(7);
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        req.authType = 'jwt';
        next();
    } catch (err) {
        logger.warn(`Auth failed: ${err.message}`);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

/**
 * Optional authentication — allows unauthenticated access
 * but attaches user info if token is present.
 */
function optionalAuth(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && API_KEY && apiKey === API_KEY) {
        req.authType = 'api_key';
        req.deviceAuth = true;
        return next();
    }
    
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            req.user = jwt.verify(authHeader.substring(7), JWT_SECRET);
            req.authType = 'jwt';
        } catch (e) {
            // Ignore invalid tokens for optional auth
        }
    }
    next();
}

module.exports = { authenticate, optionalAuth };
