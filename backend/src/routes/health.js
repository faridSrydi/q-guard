/**
 * Q-GUARD Health Check Routes
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');

router.get('/', (req, res) => {
    let dbStatus = 'healthy';
    let dbDetails = null;

    try {
        const db = getDb();
        const result = db.prepare('SELECT 1 as test').get();
        if (!result || result.test !== 1) {
            dbStatus = 'degraded';
        }
    } catch (err) {
        dbStatus = 'unhealthy';
        dbDetails = err.message;
    }

    const uptimeSeconds = process.uptime();
    const memoryUsage = process.memoryUsage();

    res.json({
        status: dbStatus === 'healthy' ? 'OK' : 'DEGRADED',
        service: 'Q-GUARD Backend API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime_seconds: Math.floor(uptimeSeconds),
        database: {
            status: dbStatus,
            details: dbDetails
        },
        memory: {
            rss_mb: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100,
            heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
            heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100
        }
    });
});

module.exports = router;
