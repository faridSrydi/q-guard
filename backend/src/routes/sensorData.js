/**
 * Q-GUARD Sensor Data Ingestion & Query Routes
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { optionalAuth, authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

// POST /api/sensor-data/batch - Primary endpoint for ESP32 batch upload
router.post('/batch', optionalAuth, (req, res) => {
    const { device_id, batch_size, readings } = req.body;

    if (!device_id || !Array.isArray(readings) || readings.length === 0) {
        return res.status(400).json({ error: 'device_id and non-empty readings array required' });
    }

    try {
        const db = getDb();

        // Ensure device exists or register it
        const device = db.prepare('SELECT id FROM devices WHERE id = ?').get(device_id);
        const now = new Date().toISOString();

        if (!device) {
            db.prepare(`
                INSERT INTO devices (id, name, status, last_seen_at, created_at, updated_at)
                VALUES (?, ?, 'online', ?, ?, ?)
            `).run(device_id, 'Q-GUARD ' + device_id, now, now, now);
        } else {
            db.prepare(`
                UPDATE devices 
                SET status = 'online', last_seen_at = ?, updated_at = ?
                WHERE id = ?
            `).run(now, now, device_id);
        }

        // Get active thresholds
        const thresholds = {};
        const configRows = db.prepare('SELECT key, value FROM system_configurations').all();
        for (const r of configRows) {
            thresholds[r.key] = parseFloat(r.value);
        }
        const tempMin = thresholds.temp_min !== undefined ? thresholds.temp_min : -25.0;
        const tempMax = thresholds.temp_max !== undefined ? thresholds.temp_max : -18.0;
        const shockThreshold = thresholds.shock_threshold_g !== undefined ? thresholds.shock_threshold_g : 2.0;

        const insertReading = db.prepare(`
            INSERT OR IGNORE INTO sensor_readings (
                device_record_id, device_id, shipment_id, timestamp,
                temperature_probe_1, temperature_probe_2, temperature_probe_3,
                ambient_temperature, relative_humidity,
                acceleration_x, acceleration_y, acceleration_z,
                door_status, latitude, longitude, gps_fix_status,
                sensor_health, risk_level, risk_reasons, created_at
            ) VALUES (
                @device_record_id, @device_id, @shipment_id, @timestamp,
                @temperature_probe_1, @temperature_probe_2, @temperature_probe_3,
                @ambient_temperature, @relative_humidity,
                @acceleration_x, @acceleration_y, @acceleration_z,
                @door_status, @latitude, @longitude, @gps_fix_status,
                @sensor_health, @risk_level, @risk_reasons, @created_at
            )
        `);

        const insertRiskEvent = db.prepare(`
            INSERT INTO risk_events (
                device_id, shipment_id, event_type, severity, risk_level,
                risk_score, description, sensor_reading_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let insertedCount = 0;
        let duplicateCount = 0;
        let generatedAlerts = 0;

        const runBatch = db.transaction((records) => {
            for (const r of records) {
                const recordId = r.record_id || r.device_record_id || null;

                // Validate shipment_id to prevent FOREIGN KEY constraint failed error
                let validShipmentId = null;
                if (r.shipment_id) {
                    const checkShipment = db.prepare('SELECT id FROM shipments WHERE id = ?').get(r.shipment_id);
                    if (checkShipment) {
                        validShipmentId = checkShipment.id;
                    }
                }
                if (!validShipmentId) {
                    const activeShipment = db.prepare('SELECT id FROM shipments WHERE device_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1').get(device_id, 'active');
                    if (activeShipment) {
                        validShipmentId = activeShipment.id;
                    }
                }

                const readingParams = {
                    device_record_id: recordId,
                    device_id: device_id,
                    shipment_id: validShipmentId,
                    timestamp: r.timestamp || now,
                    temperature_probe_1: r.temperature_probe_1 !== undefined ? r.temperature_probe_1 : null,
                    temperature_probe_2: r.temperature_probe_2 !== undefined ? r.temperature_probe_2 : null,
                    temperature_probe_3: r.temperature_probe_3 !== undefined ? r.temperature_probe_3 : null,
                    ambient_temperature: r.ambient_temperature !== undefined ? r.ambient_temperature : null,
                    relative_humidity: r.relative_humidity !== undefined ? r.relative_humidity : null,
                    acceleration_x: r.acceleration_x !== undefined ? r.acceleration_x : null,
                    acceleration_y: r.acceleration_y !== undefined ? r.acceleration_y : null,
                    acceleration_z: r.acceleration_z !== undefined ? r.acceleration_z : null,
                    door_status: r.door_status || 'CLOSED',
                    latitude: r.latitude !== undefined ? r.latitude : null,
                    longitude: r.longitude !== undefined ? r.longitude : null,
                    gps_fix_status: r.gps_fix_status || 'NO_FIX',
                    sensor_health: r.sensor_health || 'OK',
                    risk_level: r.risk_level || 'NORMAL',
                    risk_reasons: r.risk_reasons || 'OK',
                    created_at: now
                };

                const result = insertReading.run(readingParams);
                if (result.changes > 0) {
                    insertedCount++;
                    const readingId = result.lastInsertRowid;

                    // Automatic risk checks: Tri-probe thermal monitoring
                    const t1 = readingParams.temperature_probe_1;
                    const t3 = readingParams.temperature_probe_3;

                    if (t1 !== null) {
                        if (t1 > tempMax) {
                            insertRiskEvent.run(
                                device_id, readingParams.shipment_id,
                                'TEMPERATURE_HIGH', 'CRITICAL', 'CRITICAL', 85,
                                `Temperature excursion high (Core Probe 1): ${t1.toFixed(1)}°C (threshold: ${tempMax}°C)`,
                                readingId, now
                            );
                            generatedAlerts++;
                        } else if (t1 < tempMin) {
                            insertRiskEvent.run(
                                device_id, readingParams.shipment_id,
                                'TEMPERATURE_LOW', 'WARNING', 'WARNING', 60,
                                `Temperature below minimum threshold: ${t1.toFixed(1)}°C (threshold: ${tempMin}°C)`,
                                readingId, now
                            );
                            generatedAlerts++;
                        }
                    }

                    // Early warning: Door boundary probe (Probe 3) warming before core probe (Probe 1)
                    if (t3 !== null && t3 > tempMax && (t1 === null || t1 <= tempMax)) {
                        insertRiskEvent.run(
                            device_id, readingParams.shipment_id,
                            'BOUNDARY_WARMING', 'WARNING', 'CAUTION', 45,
                            `Early warning - Door boundary infiltration: ${t3.toFixed(1)}°C (threshold: ${tempMax}°C, Core: ${t1 !== null ? t1.toFixed(1) + '°C' : '--'})`,
                            readingId, now
                        );
                        generatedAlerts++;
                    }

                    // Shock detection: resultant minus 1g baseline gravity (net dynamic shock)
                    const ax = readingParams.acceleration_x || 0;
                    const ay = readingParams.acceleration_y || 0;
                    const az = readingParams.acceleration_z || 0;
                    const totalG = Math.sqrt(ax * ax + ay * ay + az * az);
                    const netShock = Math.abs(totalG - 1.0);
                    if (netShock > shockThreshold) {
                        insertRiskEvent.run(
                            device_id, readingParams.shipment_id,
                            'SHOCK_EXCESSIVE', 'WARNING', 'WARNING', 55,
                            `Excessive shock/vibration detected: ${netShock.toFixed(2)}g (net dynamic, threshold: ${shockThreshold}g)`,
                            readingId, now
                        );
                        generatedAlerts++;
                    }

                    // Door status
                    if (readingParams.door_status === 'OPEN') {
                        insertRiskEvent.run(
                            device_id, readingParams.shipment_id,
                            'DOOR_OPENED', 'INFO', 'CAUTION', 30,
                            'Container door breach / open detected',
                            readingId, now
                        );
                        generatedAlerts++;
                    }
                } else {
                    duplicateCount++;
                }
            }

            // Sync log
            const firstId = records[0].record_id || null;
            const lastId = records[records.length - 1].record_id || null;
            db.prepare(`
                INSERT INTO sync_logs (device_id, batch_size, records_from, records_to, status, created_at)
                VALUES (?, ?, ?, ?, 'success', ?)
            `).run(device_id, records.length, firstId, lastId, now);
        });

        runBatch(readings);

        logger.info(`Batch from ${device_id}: ${insertedCount} inserted, ${duplicateCount} duplicate, ${generatedAlerts} alerts`);

        // Retrieve active shipment profile for two-way sync to device
        const activeShipment = db.prepare(`
            SELECT id, commodity, temp_min, temp_max, shock_threshold_g 
            FROM shipments 
            WHERE device_id = ? AND status = 'active' 
            ORDER BY created_at DESC LIMIT 1
        `).get(device_id) || db.prepare(`
            SELECT id, commodity, temp_min, temp_max, shock_threshold_g 
            FROM shipments 
            WHERE status = 'active' 
            ORDER BY created_at DESC LIMIT 1
        `).get();

        res.status(201).json({
            status: 'success',
            device_id,
            received: readings.length,
            accepted: insertedCount,
            duplicates: duplicateCount,
            alerts_generated: generatedAlerts,
            active_shipment: activeShipment ? {
                id: activeShipment.id,
                commodity: activeShipment.commodity,
                temp_min: activeShipment.temp_min,
                temp_max: activeShipment.temp_max,
                shock_threshold_g: activeShipment.shock_threshold_g !== undefined ? activeShipment.shock_threshold_g : shockThreshold
            } : null
        });
    } catch (err) {
        logger.error(`Error processing batch upload: ${err.message}`);
        res.status(500).json({ error: 'Failed to ingest batch readings', message: err.message });
    }
});

// GET /api/sensor-data/latest - Latest readings
router.get('/latest', optionalAuth, (req, res) => {
    try {
        const { device_id, shipment_id } = req.query;
        const db = getDb();

        let query = 'SELECT * FROM sensor_readings';
        const conditions = [];
        const params = [];

        if (device_id) {
            conditions.push('device_id = ?');
            params.push(device_id);
        }
        if (shipment_id) {
            conditions.push('shipment_id = ?');
            params.push(shipment_id);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY id DESC LIMIT 1';

        const latest = db.prepare(query).get(...params);

        let wifi_status = 'OFFLINE';
        let last_seen_at = null;
        let seconds_ago = null;

        const targetDevId = device_id || (latest ? latest.device_id : 'QGUARD-001');
        if (targetDevId) {
            const dev = db.prepare('SELECT status, last_seen_at FROM devices WHERE id = ?').get(targetDevId);
            if (dev && dev.last_seen_at) {
                last_seen_at = dev.last_seen_at;
                const diffMs = Date.now() - new Date(dev.last_seen_at).getTime();
                seconds_ago = Math.max(0, Math.floor(diffMs / 1000));
                wifi_status = seconds_ago <= 45 ? 'ONLINE' : 'OFFLINE';
            } else if (latest) {
                const ts = latest.created_at || latest.timestamp;
                const diffMs = Date.now() - new Date(ts).getTime();
                seconds_ago = Math.max(0, Math.floor(diffMs / 1000));
                wifi_status = seconds_ago <= 45 ? 'ONLINE' : 'OFFLINE';
                last_seen_at = ts;
            }
        }

        res.json({ 
            reading: latest || null,
            wifi_status,
            last_seen_at,
            seconds_ago
        });
    } catch (err) {
        logger.error(`Error getting latest reading: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve latest reading' });
    }
});

// GET /api/sensor-data/history - Query history with filters
router.get('/history', optionalAuth, (req, res) => {
    try {
        const { device_id, shipment_id, from, to, limit = 100, page = 1 } = req.query;
        const db = getDb();

        let query = 'SELECT * FROM sensor_readings';
        const conditions = [];
        const params = [];

        if (device_id) {
            conditions.push('device_id = ?');
            params.push(device_id);
        }
        if (shipment_id) {
            conditions.push('shipment_id = ?');
            params.push(shipment_id);
        }
        if (from) {
            conditions.push('timestamp >= ?');
            params.push(from);
        }
        if (to) {
            conditions.push('timestamp <= ?');
            params.push(to);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
        const total = db.prepare(countQuery).get(...params).count;

        const limitNum = Math.min(Math.max(parseInt(limit) || 100, 1), 1000);
        const pageNum = Math.max(parseInt(page) || 1, 1);
        const offset = (pageNum - 1) * limitNum;

        query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
        params.push(limitNum, offset);

        const readings = db.prepare(query).all(...params);

        res.json({
            readings,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (err) {
        logger.error(`Error getting history: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve sensor history' });
    }
});

// DELETE /api/sensor-data/clear - Purge sensor readings and risk events
router.delete('/clear', optionalAuth, (req, res) => {
    try {
        const db = getDb();
        const { device_id, shipment_id } = req.query;
        let deletedReadings, deletedEvents;

        if (shipment_id) {
            deletedEvents = db.prepare('DELETE FROM risk_events WHERE shipment_id = ?').run(shipment_id);
            deletedReadings = db.prepare('DELETE FROM sensor_readings WHERE shipment_id = ?').run(shipment_id);
        } else if (device_id) {
            deletedEvents = db.prepare('DELETE FROM risk_events WHERE device_id = ?').run(device_id);
            deletedReadings = db.prepare('DELETE FROM sensor_readings WHERE device_id = ?').run(device_id);
        } else {
            deletedEvents = db.prepare('DELETE FROM risk_events').run();
            deletedReadings = db.prepare('DELETE FROM sensor_readings').run();
        }

        logger.info(`Cleared data: ${deletedReadings.changes} readings, ${deletedEvents.changes} events`);
        res.json({
            message: 'Data telemetri berhasil dibersihkan',
            deleted_readings: deletedReadings.changes,
            deleted_events: deletedEvents.changes
        });
    } catch (err) {
        logger.error(`Error clearing sensor data: ${err.message}`);
        res.status(500).json({ error: 'Gagal membersihkan data sensor' });
    }
});

module.exports = router;