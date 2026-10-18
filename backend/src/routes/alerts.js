/**
 * Q-GUARD Alerts & Events Routes
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { optionalAuth, authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

// GET /api/alerts - List alerts
router.get('/', optionalAuth, (req, res) => {
    try {
        const { severity, shipment_id, device_id, acknowledged, limit = 50, page = 1 } = req.query;
        const db = getDb();

        let query = `
            SELECT e.*, 
                   s.commodity as shipment_commodity,
                   d.name as device_name
            FROM risk_events e
            LEFT JOIN shipments s ON e.shipment_id = s.id
            LEFT JOIN devices d ON e.device_id = d.id
        `;
        const conditions = [];
        const params = [];

        if (severity) {
            conditions.push('e.severity = ?');
            params.push(severity.toUpperCase());
        }
        if (shipment_id) {
            conditions.push('e.shipment_id = ?');
            params.push(shipment_id);
        }
        if (device_id) {
            conditions.push('e.device_id = ?');
            params.push(device_id);
        }
        if (acknowledged !== undefined) {
            conditions.push('e.acknowledged = ?');
            params.push(acknowledged === 'true' || acknowledged === '1' ? 1 : 0);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        const countQuery = query.replace('SELECT e.*, \n                   s.commodity as shipment_commodity,\n                   d.name as device_name', 'SELECT COUNT(*) as count');
        const total = db.prepare(countQuery).get(...params).count;

        const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
        const pageNum = Math.max(parseInt(page) || 1, 1);
        const offset = (pageNum - 1) * limitNum;

        query += ' ORDER BY e.created_at DESC, e.id DESC LIMIT ? OFFSET ?';
        params.push(limitNum, offset);

        const alerts = db.prepare(query).all(...params);

        res.json({
            alerts,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (err) {
        logger.error(`Error fetching alerts: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve alerts' });
    }
});

// GET /api/alerts/summary - Counts of alerts
router.get('/summary', optionalAuth, (req, res) => {
    try {
        const db = getDb();
        const counts = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical,
                SUM(CASE WHEN severity = 'WARNING' THEN 1 ELSE 0 END) as warning,
                SUM(CASE WHEN severity = 'INFO' THEN 1 ELSE 0 END) as info,
                SUM(CASE WHEN acknowledged = 0 THEN 1 ELSE 0 END) as unacknowledged
            FROM risk_events
        `).get();

        res.json({ summary: counts });
    } catch (err) {
        logger.error(`Error fetching alert summary: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve alert summary' });
    }
});

// POST /api/alerts/:id/ack - Acknowledge alert
router.post('/:id/ack', optionalAuth, (req, res) => {
    try {
        const db = getDb();
        const alertId = req.params.id;
        const acknowledgedBy = (req.user && req.user.username) || req.body.acknowledged_by || 'operator';
        const now = new Date().toISOString();

        const result = db.prepare(`
            UPDATE risk_events 
            SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = ?
            WHERE id = ?
        `).run(acknowledgedBy, now, alertId);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        logger.info(`Alert ${alertId} acknowledged by ${acknowledgedBy}`);
        res.json({ message: 'Alert acknowledged successfully', id: alertId, acknowledged_by: acknowledgedBy });
    } catch (err) {
        logger.error(`Error acknowledging alert ${req.params.id}: ${err.message}`);
        res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
});

// POST /api/alerts/ack-all - Acknowledge all
router.post('/ack-all', optionalAuth, (req, res) => {
    try {
        const { shipment_id, device_id } = req.body;
        const db = getDb();
        const acknowledgedBy = (req.user && req.user.username) || req.body.acknowledged_by || 'operator';
        const now = new Date().toISOString();

        let query = 'UPDATE risk_events SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = ? WHERE acknowledged = 0';
        const params = [acknowledgedBy, now];

        if (shipment_id) {
            query += ' AND shipment_id = ?';
            params.push(shipment_id);
        }
        if (device_id) {
            query += ' AND device_id = ?';
            params.push(device_id);
        }

        const result = db.prepare(query).run(...params);
        res.json({ message: 'Alerts acknowledged', acknowledged_count: result.changes });
    } catch (err) {
        logger.error(`Error bulk acknowledging alerts: ${err.message}`);
        res.status(500).json({ error: 'Failed to acknowledge alerts' });
    }
});

module.exports = router;
