/**
 * Q-GUARD Device Management Routes
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { optionalAuth, authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

// GET /api/devices - List all devices with last seen and status
router.get('/', optionalAuth, (req, res) => {
    try {
        const db = getDb();
        const devices = db.prepare(`
            SELECT 
                d.id, 
                d.name, 
                d.firmware_version, 
                d.status, 
                d.last_seen_at, 
                d.config_json,
                d.created_at,
                d.updated_at,
                (SELECT COUNT(*) FROM sensor_readings WHERE device_id = d.id) as total_readings,
                (SELECT id FROM shipments WHERE device_id = d.id AND status = 'active' LIMIT 1) as active_shipment_id
            FROM devices d
            ORDER BY d.created_at DESC
        `).all();

        // Parse JSON configs
        const result = devices.map(dev => {
            let config = {};
            try {
                config = JSON.parse(dev.config_json || '{}');
            } catch (e) {
                config = {};
            }
            return {
                ...dev,
                config
            };
        });

        res.json({ devices: result, count: result.length });
    } catch (err) {
        logger.error(`Error fetching devices: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve devices' });
    }
});

// GET /api/devices/:id - Details of specific device
router.get('/:id', optionalAuth, (req, res) => {
    try {
        const db = getDb();
        const device = db.prepare(`
            SELECT d.*, 
                   (SELECT COUNT(*) FROM sensor_readings WHERE device_id = d.id) as total_readings,
                   (SELECT COUNT(*) FROM risk_events WHERE device_id = d.id) as total_alerts
            FROM devices d
            WHERE d.id = ?
        `).get(req.params.id);

        if (!device) {
            return res.status(404).json({ error: `Device with ID ${req.params.id} not found` });
        }

        try {
            device.config = JSON.parse(device.config_json || '{}');
        } catch (e) {
            device.config = {};
        }

        res.json({ device });
    } catch (err) {
        logger.error(`Error fetching device ${req.params.id}: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve device' });
    }
});

// GET /api/devices/:id/latest - Latest reading from device
router.get('/:id/latest', optionalAuth, (req, res) => {
    try {
        const db = getDb();
        const latest = db.prepare(`
            SELECT * FROM sensor_readings
            WHERE device_id = ?
            ORDER BY timestamp DESC, id DESC
            LIMIT 1
        `).get(req.params.id);

        if (!latest) {
            return res.status(404).json({ message: 'No readings found for this device', reading: null });
        }

        res.json({ reading: latest });
    } catch (err) {
        logger.error(`Error fetching latest reading for device ${req.params.id}: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch latest sensor reading' });
    }
});

// POST /api/devices - Register new device
router.post('/', authenticate, (req, res) => {
    const { id, name, firmware_version, config } = req.body;

    if (!id) {
        return res.status(400).json({ error: 'Device id is required (e.g. QGUARD-001)' });
    }

    try {
        const db = getDb();
        const existing = db.prepare('SELECT id FROM devices WHERE id = ?').get(id);
        if (existing) {
            return res.status(409).json({ error: `Device with ID ${id} already exists` });
        }

        const configJson = config ? JSON.stringify(config) : '{}';
        const now = new Date().toISOString();

        db.prepare(`
            INSERT INTO devices (id, name, firmware_version, status, config_json, created_at, updated_at)
            VALUES (?, ?, ?, 'offline', ?, ?, ?)
        `).run(id, name || 'Q-GUARD Device', firmware_version || '1.0.0', configJson, now, now);

        logger.info(`Device registered: ${id}`);
        res.status(201).json({
            message: 'Device registered successfully',
            device: {
                id,
                name: name || 'Q-GUARD Device',
                firmware_version: firmware_version || '1.0.0',
                status: 'offline',
                config: config || {}
            }
        });
    } catch (err) {
        logger.error(`Error registering device: ${err.message}`);
        res.status(500).json({ error: 'Failed to register device' });
    }
});

// PUT /api/devices/:id - Update device
router.put('/:id', authenticate, (req, res) => {
    const { name, firmware_version, status, config } = req.body;

    try {
        const db = getDb();
        const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        const newName = name !== undefined ? name : device.name;
        const newFw = firmware_version !== undefined ? firmware_version : device.firmware_version;
        const newStatus = status !== undefined ? status : device.status;
        const newConfig = config !== undefined ? JSON.stringify(config) : device.config_json;
        const now = new Date().toISOString();

        db.prepare(`
            UPDATE devices 
            SET name = ?, firmware_version = ?, status = ?, config_json = ?, updated_at = ?
            WHERE id = ?
        `).run(newName, newFw, newStatus, newConfig, now, req.params.id);

        res.json({ message: 'Device updated successfully' });
    } catch (err) {
        logger.error(`Error updating device ${req.params.id}: ${err.message}`);
        res.status(500).json({ error: 'Failed to update device' });
    }
});

// DELETE /api/devices/:id - Deregister device
router.delete('/:id', authenticate, (req, res) => {
    try {
        const db = getDb();
        const result = db.prepare('DELETE FROM devices WHERE id = ?').run(req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }

        res.json({ message: 'Device deleted successfully' });
    } catch (err) {
        logger.error(`Error deleting device ${req.params.id}: ${err.message}`);
        res.status(500).json({ error: 'Failed to delete device' });
    }
});

module.exports = router;
