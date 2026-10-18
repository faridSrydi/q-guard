/**
 * Q-GUARD Backend Server
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { getDb, closeDb } = require('./db/connection');
const logger = require('./utils/logger');

// Routes
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const shipmentRoutes = require('./routes/shipments');
const sensorDataRoutes = require('./routes/sensorData');
const riskRoutes = require('./routes/risk');
const alertRoutes = require('./routes/alerts');
const configRoutes = require('./routes/config');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));

const rawCors = process.env.CORS_ORIGIN || 'http://localhost:5173';
const corsOrigin = rawCors === '*' ? '*' : (rawCors.includes(',') ? rawCors.split(',').map(s => s.trim()) : rawCors);

app.use(cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing with size limits
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (req.path !== '/api/health') {
            logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
        }
    });
    next();
});

// Initialize database
try {
    getDb();
    logger.info('Database connected');
} catch (err) {
    logger.error('Database connection failed:', err.message);
    process.exit(1);
}

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/sensor-data', sensorDataRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/config', configRoutes);
app.use('/api/reports', reportRoutes);

// Static dashboard serving
const dashboardDir = path.join(__dirname, '..', '..', 'dashboard');
app.use(express.static(dashboardDir));

// Fallback to dashboard index.html for non-API client routes
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.sendFile(path.join(dashboardDir, 'index.html'));
});

// 404 handler for API routes
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err.message);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('Shutting down...');
    closeDb();
    process.exit(0);
});

app.listen(PORT, HOST, () => {
    logger.info(`Q-GUARD Backend running on http://${HOST}:${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
