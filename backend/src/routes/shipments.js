/**
 * Q-GUARD Shipment Management Routes
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { optionalAuth, authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

// GET /api/shipments - List shipments
router.get('/', optionalAuth, (req, res) => {
    try {
        const { status, device_id } = req.query;
        const db = getDb();
        try {
            db.prepare("UPDATE shipments SET commodity = 'Ikan Tuna Segar (Ekspor)' WHERE commodity LIKE '%SIMULATED%'").run();
        } catch (e) {}

        let query = `
            SELECT s.*,
                   d.name as device_name,
                   d.status as device_status,
                   (SELECT COUNT(*) FROM sensor_readings WHERE shipment_id = s.id) as total_readings,
                   (SELECT COUNT(*) FROM risk_events WHERE shipment_id = s.id) as total_alerts
            FROM shipments s
            LEFT JOIN devices d ON s.device_id = d.id
        `;
        const conditions = [];
        const params = [];

        if (status) {
            conditions.push('s.status = ?');
            params.push(status);
        }
        if (device_id) {
            conditions.push('s.device_id = ?');
            params.push(device_id);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY s.created_at DESC';

        const shipments = db.prepare(query).all(...params);
        res.json({ shipments, count: shipments.length });
    } catch (err) {
        logger.error(`Error fetching shipments: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve shipments' });
    }
});

// GET /api/shipments/:id - Shipment details + statistics
router.get('/:id', optionalAuth, (req, res) => {
    try {
        const db = getDb();
        const shipment = db.prepare(`
            SELECT s.*,
                   d.name as device_name,
                   d.status as device_status
            FROM shipments s
            LEFT JOIN devices d ON s.device_id = d.id
            WHERE s.id = ?
        `).get(req.params.id);

        if (!shipment) {
            return res.status(404).json({ error: `Shipment ${req.params.id} not found` });
        }

        // Summary stats
        const stats = db.prepare(`
            SELECT 
                COUNT(*) as readings_count,
                MIN(temperature_probe_1) as min_temp_probe_1,
                MAX(temperature_probe_1) as max_temp_probe_1,
                AVG(temperature_probe_1) as avg_temp_probe_1,
                MIN(ambient_temperature) as min_ambient_temp,
                MAX(ambient_temperature) as max_ambient_temp,
                AVG(ambient_temperature) as avg_ambient_temp,
                AVG(relative_humidity) as avg_humidity,
                MAX(door_status) as last_door_status
            FROM sensor_readings
            WHERE shipment_id = ?
        `).get(req.params.id);

        const alertStats = db.prepare(`
            SELECT 
                COUNT(*) as total_alerts,
                SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical_alerts,
                SUM(CASE WHEN severity = 'WARNING' THEN 1 ELSE 0 END) as warning_alerts,
                SUM(CASE WHEN acknowledged = 0 THEN 1 ELSE 0 END) as unacknowledged_alerts
            FROM risk_events
            WHERE shipment_id = ?
        `).get(req.params.id);

        res.json({
            shipment,
            statistics: stats,
            alerts_summary: alertStats
        });
    } catch (err) {
        logger.error(`Error fetching shipment ${req.params.id}: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve shipment details' });
    }
});

// GET /api/shipments/:id/readings - Time series data
router.get('/:id/readings', optionalAuth, (req, res) => {
    try {
        const { limit = 100, order = 'DESC' } = req.query;
        const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        const limitNum = Math.min(Math.max(parseInt(limit) || 100, 1), 1000);

        const db = getDb();
        const readings = db.prepare(`
            SELECT * FROM sensor_readings
            WHERE shipment_id = ?
            ORDER BY timestamp ${sortOrder}
            LIMIT ?
        `).all(req.params.id, limitNum);

        res.json({ readings, count: readings.length });
    } catch (err) {
        logger.error(`Error fetching readings for shipment ${req.params.id}: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch sensor readings' });
    }
});

// POST /api/shipments - Create shipment
router.post('/', optionalAuth, (req, res) => {
    const { id, device_id, commodity, origin, destination, temp_min, temp_max, notes } = req.body;

    const shipmentId = id || ('SHP-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000));

    try {
        const db = getDb();

        const existing = db.prepare('SELECT id FROM shipments WHERE id = ?').get(shipmentId);
        if (existing) {
            return res.status(409).json({ error: `Shipment ID ${shipmentId} already exists` });
        }

        const now = new Date().toISOString();
        const cleanDeviceId = device_id ? String(device_id).trim() : null;

        // Auto-provision device if it does not exist in devices table yet (prevents foreign key errors)
        if (cleanDeviceId) {
            const existingDevice = db.prepare('SELECT id FROM devices WHERE id = ?').get(cleanDeviceId);
            if (!existingDevice) {
                db.prepare(`
                    INSERT INTO devices (id, name, status, created_at, updated_at)
                    VALUES (?, ?, 'registered', ?, ?)
                `).run(cleanDeviceId, `Unit ${cleanDeviceId}`, now, now);
                logger.info(`Auto-provisioned device: ${cleanDeviceId}`);
            }
        }

        const parseTemp = (val, defaultVal) => {
            if (val === undefined || val === null || val === '') return defaultVal;
            if (typeof val === 'string') val = val.replace(',', '.');
            const n = parseFloat(val);
            return isNaN(n) ? defaultVal : n;
        };

        const parsedMin = parseTemp(temp_min, -25.0);
        const parsedMax = parseTemp(temp_max, -18.0);

        db.prepare(`
            INSERT INTO shipments (
                id, device_id, commodity, origin, destination, status,
                started_at, temp_min, temp_max, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
        `).run(
            shipmentId,
            cleanDeviceId,
            commodity || 'Frozen Product',
            origin || 'Origin Facility',
            destination || 'Destination Facility',
            now,
            parsedMin,
            parsedMax,
            notes || null,
            now,
            now
        );

        logger.info(`Shipment created: ${shipmentId}`);
        res.status(201).json({
            message: 'Shipment created successfully',
            shipment: {
                id: shipmentId,
                device_id: cleanDeviceId,
                commodity: commodity || 'Frozen Product',
                origin: origin || 'Origin Facility',
                destination: destination || 'Destination Facility',
                status: 'active',
                temp_min: parsedMin,
                temp_max: parsedMax,
                started_at: now
            }
        });
    } catch (err) {
        logger.error(`Error creating shipment: ${err.message}`);
        res.status(500).json({ error: `Failed to create shipment: ${err.message}` });
    }
});

// PUT /api/shipments/:id - Update shipment
router.put('/:id', optionalAuth, (req, res) => {
    const { status, commodity, origin, destination, temp_min, temp_max, notes } = req.body;

    try {
        const db = getDb();
        const existing = db.prepare('SELECT * FROM shipments WHERE id = ?').get(req.params.id);

        if (!existing) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        const now = new Date().toISOString();
        const endedAt = (status === 'completed' || status === 'cancelled') ? now : existing.ended_at;

        db.prepare(`
            UPDATE shipments
            SET status = COALESCE(?, status),
                commodity = COALESCE(?, commodity),
                origin = COALESCE(?, origin),
                destination = COALESCE(?, destination),
                temp_min = COALESCE(?, temp_min),
                temp_max = COALESCE(?, temp_max),
                notes = COALESCE(?, notes),
                ended_at = ?,
                updated_at = ?
            WHERE id = ?
        `).run(
            status,
            commodity,
            origin,
            destination,
            temp_min !== undefined ? parseFloat(temp_min) : null,
            temp_max !== undefined ? parseFloat(temp_max) : null,
            notes,
            endedAt,
            now,
            req.params.id
        );

        res.json({ message: 'Shipment updated successfully' });
    } catch (err) {
        logger.error(`Error updating shipment ${req.params.id}: ${err.message}`);
        res.status(500).json({ error: 'Failed to update shipment' });
    }
});

// DELETE /api/shipments/:id - Delete shipment
router.delete('/:id', optionalAuth, (req, res) => {
    try {
        const db = getDb();
        const existing = db.prepare('SELECT id FROM shipments WHERE id = ?').get(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'Shipment not found' });
        }
        db.prepare('UPDATE sensor_readings SET shipment_id = NULL WHERE shipment_id = ?').run(req.params.id);
        db.prepare('DELETE FROM risk_events WHERE shipment_id = ?').run(req.params.id);
        db.prepare('DELETE FROM shipments WHERE id = ?').run(req.params.id);
        logger.info(`Shipment deleted: ${req.params.id}`);
        res.json({ message: `Shipment ${req.params.id} deleted successfully` });
    } catch (err) {
        logger.error(`Error deleting shipment ${req.params.id}: ${err.message}`);
        res.status(500).json({ error: 'Failed to delete shipment' });
    }
});

module.exports = router;

