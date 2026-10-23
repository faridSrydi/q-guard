/**
 * Q-GUARD Audit & Report Generation Routes
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

// GET /api/reports/shipment/:id - Comprehensive audit dossier
router.get('/shipment/:id', optionalAuth, (req, res) => {
    try {
        const db = getDb();
        const shipment = db.prepare(`
            SELECT s.*, d.name as device_name
            FROM shipments s
            LEFT JOIN devices d ON s.device_id = d.id
            WHERE s.id = ?
        `).get(req.params.id);

        if (!shipment) {
            return res.status(404).json({ error: `Shipment ${req.params.id} not found` });
        }

        const readings = db.prepare(`
            SELECT * FROM sensor_readings
            WHERE shipment_id = ?
            ORDER BY timestamp ASC
        `).all(req.params.id);

        const alerts = db.prepare(`
            SELECT * FROM risk_events
            WHERE shipment_id = ?
            ORDER BY created_at ASC
        `).all(req.params.id);

        // Compute tri-probe metrics
        let minT1 = Infinity, maxT1 = -Infinity, sumT1 = 0, countT1 = 0;
        let minT2 = Infinity, maxT2 = -Infinity, sumT2 = 0, countT2 = 0;
        let minT3 = Infinity, maxT3 = -Infinity, sumT3 = 0, countT3 = 0;
        let minAmb = Infinity, maxAmb = -Infinity, sumAmb = 0, countAmb = 0;
        let maxThermalGradient = 0;
        let maxShock = 0;
        let excursionsCount = 0;
        let boundaryWarningsCount = 0;
        const gpsTrack = [];

        for (const r of readings) {
            // Probe 1 (Core)
            if (r.temperature_probe_1 !== null && !isNaN(r.temperature_probe_1)) {
                const t = r.temperature_probe_1;
                if (t < minT1) minT1 = t;
                if (t > maxT1) maxT1 = t;
                sumT1 += t;
                countT1++;
                if (t > shipment.temp_max || t < shipment.temp_min) {
                    excursionsCount++;
                }
            }

            // Probe 2 (Mid-pack)
            if (r.temperature_probe_2 !== null && !isNaN(r.temperature_probe_2)) {
                const t = r.temperature_probe_2;
                if (t < minT2) minT2 = t;
                if (t > maxT2) maxT2 = t;
                sumT2 += t;
                countT2++;
            }

            // Probe 3 (Door boundary)
            if (r.temperature_probe_3 !== null && !isNaN(r.temperature_probe_3)) {
                const t = r.temperature_probe_3;
                if (t < minT3) minT3 = t;
                if (t > maxT3) maxT3 = t;
                sumT3 += t;
                countT3++;
                if (t > shipment.temp_max && (r.temperature_probe_1 === null || r.temperature_probe_1 <= shipment.temp_max)) {
                    boundaryWarningsCount++;
                }
            }

            // Thermal gradient (|T3 - T1|)
            if (r.temperature_probe_3 !== null && r.temperature_probe_1 !== null &&
                !isNaN(r.temperature_probe_3) && !isNaN(r.temperature_probe_1)) {
                const grad = Math.abs(r.temperature_probe_3 - r.temperature_probe_1);
                if (grad > maxThermalGradient) maxThermalGradient = grad;
            }

            // Ambient (BME280)
            if (r.ambient_temperature !== null && !isNaN(r.ambient_temperature)) {
                const a = r.ambient_temperature;
                if (a < minAmb) minAmb = a;
                if (a > maxAmb) maxAmb = a;
                sumAmb += a;
                countAmb++;
            }

            // Net dynamic shock minus 1g gravity baseline
            const totalG = Math.sqrt((r.acceleration_x||0)**2 + (r.acceleration_y||0)**2 + (r.acceleration_z||0)**2);
            const netG = Math.abs(totalG - 1.0);
            if (netG > maxShock) maxShock = netG;

            if (r.latitude && r.longitude) {
                gpsTrack.push({
                    lat: r.latitude,
                    lng: r.longitude,
                    timestamp: r.timestamp,
                    temp: r.temperature_probe_1
                });
            }
        }

        const avgT1 = countT1 > 0 ? (sumT1 / countT1) : null;
        const avgT2 = countT2 > 0 ? (sumT2 / countT2) : null;
        const avgT3 = countT3 > 0 ? (sumT3 / countT3) : null;
        const avgAmb = countAmb > 0 ? (sumAmb / countAmb) : null;
        const complianceRate = countT1 > 0 ? Math.round(((countT1 - excursionsCount) / countT1) * 1000) / 10 : 100;

        // Quarantine disposition recommendation
        let quarantineVerdict = 'PASSED';
        let verdictReason = 'Suhu terjaga dalam batas aman rantai dingin selama perjalanan transit.';
        if (complianceRate < 80 || (maxT1 !== -Infinity && maxT1 > shipment.temp_max + 4)) {
            quarantineVerdict = 'REJECTED_QUARANTINE';
            verdictReason = 'Kegagalan rantai dingin kritis. Suhu inti melampaui batas aman maksimal untuk durasi signifikan.';
        } else if (complianceRate < 95 || excursionsCount > 0) {
            quarantineVerdict = 'CONDITIONAL_INSPECTION';
            verdictReason = 'Penyimpangan minor terdeteksi. Disarankan inspeksi fisik dan uji organoleptik sebelum izin rilis diberikan.';
        } else if (boundaryWarningsCount > 0) {
            quarantineVerdict = 'CONDITIONAL_INSPECTION';
            verdictReason = 'Penetrasi panas terdeteksi di probe pintu wadah. Lakukan inspeksi visual kemasan luar sebelum rilis.';
        }

        res.json({
            report_generated_at: new Date().toISOString(),
            dossier_id: `DOSSIER-${shipment.id}`,
            shipment,
            summary_metrics: {
                total_records: readings.length,
                monitoring_start: readings.length > 0 ? readings[0].timestamp : shipment.started_at,
                monitoring_end: readings.length > 0 ? readings[readings.length - 1].timestamp : null,
                temp_probe_1: {
                    name: 'Core (Inti)',
                    min: countT1 > 0 ? Math.round(minT1 * 10) / 10 : null,
                    max: countT1 > 0 ? Math.round(maxT1 * 10) / 10 : null,
                    avg: avgT1 !== null ? Math.round(avgT1 * 10) / 10 : null
                },
                temp_probe_2: {
                    name: 'Mid-Pack (Tengah)',
                    min: countT2 > 0 ? Math.round(minT2 * 10) / 10 : null,
                    max: countT2 > 0 ? Math.round(maxT2 * 10) / 10 : null,
                    avg: avgT2 !== null ? Math.round(avgT2 * 10) / 10 : null
                },
                temp_probe_3: {
                    name: 'Door Boundary (Pintu)',
                    min: countT3 > 0 ? Math.round(minT3 * 10) / 10 : null,
                    max: countT3 > 0 ? Math.round(maxT3 * 10) / 10 : null,
                    avg: avgT3 !== null ? Math.round(avgT3 * 10) / 10 : null
                },
                max_thermal_gradient_c: Math.round(maxThermalGradient * 10) / 10,
                ambient_temp: {
                    min: countAmb > 0 ? Math.round(minAmb * 10) / 10 : null,
                    max: countAmb > 0 ? Math.round(maxAmb * 10) / 10 : null,
                    avg: avgAmb !== null ? Math.round(avgAmb * 10) / 10 : null
                },
                peak_impact_g: Math.round(maxShock * 100) / 100,
                excursions_count: excursionsCount,
                boundary_warnings_count: boundaryWarningsCount,
                cold_chain_compliance_percent: complianceRate
            },
            quarantine_disposition: {
                verdict: quarantineVerdict,
                reason: verdictReason,
                recommended_action: quarantineVerdict === 'PASSED' 
                    ? 'Terbitkan Sertifikat Pelepasan Karantina Resmi (Smart Quarantine Certificate of Release).' 
                    : 'Karantina produk segera. Lakukan sampling laboratorium dan uji kadar TVB-N/mikrobiologi.'
            },
            alerts_count: alerts.length,
            gps_waypoint_count: gpsTrack.length,
            recent_alerts: alerts.slice(-10)
        });
    } catch (err) {
        logger.error(`Error generating report for shipment ${req.params.id}: ${err.message}`);
        res.status(500).json({ error: 'Failed to generate shipment report' });
    }
});

// GET /api/reports/export/csv - Export CSV of readings
router.get('/export/csv', optionalAuth, (req, res) => {
    try {
        const { shipment_id, device_id } = req.query;
        const db = getDb();

        let query = 'SELECT * FROM sensor_readings';
        const conditions = [];
        const params = [];

        if (shipment_id) {
            conditions.push('shipment_id = ?');
            params.push(shipment_id);
        }
        if (device_id) {
            conditions.push('device_id = ?');
            params.push(device_id);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY timestamp ASC LIMIT 5000';

        const readings = db.prepare(query).all(...params);

        // Build CSV string
        const headers = [
            'Record ID', 'Device ID', 'Shipment ID', 'Timestamp',
            'Probe 1 (°C)', 'Probe 2 (°C)', 'Probe 3 (°C)',
            'Ambient Temp (°C)', 'Humidity (%)',
            'Accel X (g)', 'Accel Y (g)', 'Accel Z (g)',
            'Door Status', 'Latitude', 'Longitude', 'GPS Fix',
            'Sensor Health', 'Risk Level', 'Risk Reasons'
        ];

        let csv = headers.join(',') + '\r\n';

        for (const r of readings) {
            const row = [
                r.device_record_id || r.id,
                `"${r.device_id || ''}"`,
                `"${r.shipment_id || ''}"`,
                `"${r.timestamp || ''}"`,
                r.temperature_probe_1 !== null ? r.temperature_probe_1 : '',
                r.temperature_probe_2 !== null ? r.temperature_probe_2 : '',
                r.temperature_probe_3 !== null ? r.temperature_probe_3 : '',
                r.ambient_temperature !== null ? r.ambient_temperature : '',
                r.relative_humidity !== null ? r.relative_humidity : '',
                r.acceleration_x !== null ? r.acceleration_x : '',
                r.acceleration_y !== null ? r.acceleration_y : '',
                r.acceleration_z !== null ? r.acceleration_z : '',
                `"${r.door_status || ''}"`,
                r.latitude !== null ? r.latitude : '',
                r.longitude !== null ? r.longitude : '',
                `"${r.gps_fix_status || ''}"`,
                `"${r.sensor_health || ''}"`,
                `"${r.risk_level || ''}"`,
                `"${(r.risk_reasons || '').replace(/"/g, '""')}"`
            ];
            csv += row.join(',') + '\r\n';
        }

        const filename = `qguard-readings-${shipment_id || device_id || 'all'}-${Date.now()}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    } catch (err) {
        logger.error(`Error exporting CSV: ${err.message}`);
        res.status(500).json({ error: 'Failed to export CSV' });
    }
});

// GET /api/reports/summary - Aggregate analytics across system
router.get('/summary', optionalAuth, (req, res) => {
    try {
        const db = getDb();
        const devicesCount = db.prepare('SELECT COUNT(*) as count FROM devices').get().count;
        const shipmentsCount = db.prepare('SELECT COUNT(*) as count FROM shipments').get().count;
        const readingsCount = db.prepare('SELECT COUNT(*) as count FROM sensor_readings').get().count;
        const alertsCount = db.prepare('SELECT COUNT(*) as count FROM risk_events').get().count;
        const criticalAlerts = db.prepare("SELECT COUNT(*) as count FROM risk_events WHERE severity = 'CRITICAL'").get().count;

        res.json({
            system_overview: {
                total_devices: devicesCount,
                total_shipments: shipmentsCount,
                total_sensor_readings: readingsCount,
                total_risk_events: alertsCount,
                critical_events: criticalAlerts
            }
        });
    } catch (err) {
        logger.error(`Error fetching report summary: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve report summary' });
    }
});

module.exports = router;
