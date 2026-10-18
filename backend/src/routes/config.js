/**
 * Q-GUARD System Configuration Routes
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { optionalAuth, authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

// GET /api/config - Get all configurations
router.get('/', optionalAuth, (req, res) => {
    try {
        const db = getDb();
        const rows = db.prepare('SELECT * FROM system_configurations ORDER BY key ASC').all();
        
        // Return as key-value map and list
        const configMap = {};
        for (const row of rows) {
            configMap[row.key] = {
                value: row.value,
                description: row.description,
                updated_at: row.updated_at
            };
        }

        res.json({
            configurations: rows,
            map: configMap
        });
    } catch (err) {
        logger.error(`Error fetching configs: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve configurations' });
    }
});

// PUT /api/config/:key - Update a specific configuration
router.put('/:key', authenticate, (req, res) => {
    const { value, description } = req.body;

    if (value === undefined) {
        return res.status(400).json({ error: 'value is required' });
    }

    try {
        const db = getDb();
        const now = new Date().toISOString();

        const existing = db.prepare('SELECT key, description FROM system_configurations WHERE key = ?').get(req.params.key);

        if (existing) {
            const desc = description !== undefined ? description : existing.description;
            db.prepare(`
                UPDATE system_configurations 
                SET value = ?, description = ?, updated_at = ?
                WHERE key = ?
            `).run(String(value), desc, now, req.params.key);
        } else {
            db.prepare(`
                INSERT INTO system_configurations (key, value, description, updated_at)
                VALUES (?, ?, ?, ?)
            `).run(req.params.key, String(value), description || '', now);
        }

        logger.info(`Configuration updated: ${req.params.key} = ${value}`);
        res.json({
            message: 'Configuration updated successfully',
            key: req.params.key,
            value: String(value)
        });
    } catch (err) {
        logger.error(`Error updating config ${req.params.key}: ${err.message}`);
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

// POST /api/config/bulk - Bulk update configs
router.post('/bulk', authenticate, (req, res) => {
    const { configs } = req.body;

    if (!configs || typeof configs !== 'object') {
        return res.status(400).json({ error: 'configs object mapping key to value required' });
    }

    try {
        const db = getDb();
        const now = new Date().toISOString();
        const stmt = db.prepare(`
            INSERT INTO system_configurations (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `);

        const updateAll = db.transaction((cfg) => {
            for (const [k, v] of Object.entries(cfg)) {
                stmt.run(k, String(v), now);
            }
        });

        updateAll(configs);

        logger.info(`Bulk configuration updated: ${Object.keys(configs).length} keys`);
        res.json({ message: 'Configurations updated successfully', updated_keys: Object.keys(configs) });
    } catch (err) {
        logger.error(`Error bulk updating configs: ${err.message}`);
        res.status(500).json({ error: 'Failed to bulk update configurations' });
    }
});

module.exports = router;
