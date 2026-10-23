/**
 * Q-GUARD Risk Engine Routes
 * 
 * Provides Rule-Based Cold-Chain Risk Evaluation, Mean Kinetic Temperature (MKT),
 * Arrhenius Quality Loss Index, and Smart Quarantine Recommendations.
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

// Arrhenius Activation Energy constant for frozen protein deterioration (kJ/mol)
const ACTIVATION_ENERGY_KJ = 83.14; 
const GAS_CONSTANT = 8.314e-3; // kJ/(mol·K)

/**
 * Calculate Mean Kinetic Temperature (MKT) according to USP/FDA formula:
 * MKT = (ΔH / R) / -ln( (1/n) * Σ exp(-ΔH / (R * Ti)) )
 */
function calculateMKT(temperatures) {
    if (!temperatures || temperatures.length === 0) return null;
    const validTemps = temperatures.filter(t => t !== null && !isNaN(t));
    if (validTemps.length === 0) return null;

    const deltaH_over_R = ACTIVATION_ENERGY_KJ / GAS_CONSTANT; // 10000 K
    let sumExp = 0;

    for (const tempC of validTemps) {
        const tempK = tempC + 273.15;
        sumExp += Math.exp(-deltaH_over_R / tempK);
    }

    const avgExp = sumExp / validTemps.length;
    if (avgExp <= 0) return validTemps[0];

    const mktKelvin = deltaH_over_R / (-Math.log(avgExp));
    return Math.round((mktKelvin - 273.15) * 100) / 100;
}

/**
 * Comprehensive Risk Evaluation for a series of sensor readings
 */
function evaluateRisk(readings, thresholds = {}) {
    const tempMin = thresholds.temp_min !== undefined ? thresholds.temp_min : -25.0;
    const tempMax = thresholds.temp_max !== undefined ? thresholds.temp_max : -18.0;
    const shockThreshold = thresholds.shock_threshold_g !== undefined ? thresholds.shock_threshold_g : 2.0;

    if (!readings || readings.length === 0) {
        return {
            overall_risk_score: 0,
            risk_level: 'NORMAL',
            status: 'NO_DATA',
            mkt: null,
            mkt_celsius: null,
            mkt_probe_1: null,
            mkt_probe_2: null,
            mkt_probe_3: null,
            max_thermal_gradient_c: null,
            quality_retention_percent: 100,
            shelf_life_loss_percent: 0,
            factors: [],
            recommendations: ['Tidak ada data pembacaan sensor yang tersedia untuk evaluasi.']
        };
    }

    const tempsP1 = [];
    const tempsP2 = [];
    const tempsP3 = [];
    const primaryTemps = [];

    let highTempExcursions = 0;
    let criticalHighExcursions = 0;
    let boundaryExcursions = 0;
    let severeLowExcursions = 0;
    let doorOpenCount = 0;
    let maxShockG = 0;
    let maxThermalGradient = 0;
    let totalReadings = readings.length;

    for (const r of readings) {
        const t1 = r.temperature_probe_1 !== null && !isNaN(r.temperature_probe_1) ? r.temperature_probe_1 : null;
        const t2 = r.temperature_probe_2 !== null && !isNaN(r.temperature_probe_2) ? r.temperature_probe_2 : null;
        const t3 = r.temperature_probe_3 !== null && !isNaN(r.temperature_probe_3) ? r.temperature_probe_3 : null;
        const amb = r.ambient_temperature !== null && !isNaN(r.ambient_temperature) ? r.ambient_temperature : null;

        // Core probe
        if (t1 !== null) {
            tempsP1.push(t1);
            primaryTemps.push(t1);
            if (t1 > tempMax) {
                highTempExcursions++;
                if (t1 > (tempMax + 5)) {
                    criticalHighExcursions++;
                }
            } else if (t1 < (tempMin - 5)) {
                severeLowExcursions++;
            }
        } else if (amb !== null) {
            primaryTemps.push(amb);
        }

        // Mid-pack probe
        if (t2 !== null) tempsP2.push(t2);

        // Door boundary probe
        if (t3 !== null) {
            tempsP3.push(t3);
            if (t3 > tempMax && (t1 === null || t1 <= tempMax)) {
                boundaryExcursions++;
            }
        }

        // Thermal gradient between boundary and core (|T3 - T1|)
        if (t3 !== null && t1 !== null) {
            const grad = Math.abs(t3 - t1);
            if (grad > maxThermalGradient) maxThermalGradient = grad;
        }

        if (r.door_status === 'OPEN') {
            doorOpenCount++;
        }

        // Net dynamic shock (subtracting 1.0g gravity baseline)
        const ax = r.acceleration_x || 0;
        const ay = r.acceleration_y || 0;
        const az = r.acceleration_z || 0;
        const totalG = Math.sqrt(ax * ax + ay * ay + az * az);
        const netShock = Math.abs(totalG - 1.0);
        if (netShock > maxShockG) {
            maxShockG = netShock;
        }
    }

    // USP/FDA Arrhenius Mean Kinetic Temperature
    const mkt = calculateMKT(primaryTemps.length > 0 ? primaryTemps : tempsP1);
    const mktP1 = calculateMKT(tempsP1);
    const mktP2 = calculateMKT(tempsP2);
    const mktP3 = calculateMKT(tempsP3);

    // Score components (0-100 scale)
    let tempScore = 0;
    let physicalScore = 0;
    let integrityScore = 0;
    const factors = [];
    const recommendations = [];

    // 1. Temperature excursion severity
    const excursionRatio = totalReadings > 0 ? (highTempExcursions / totalReadings) : 0;
    if (criticalHighExcursions > 0) {
        tempScore += 50 + Math.min(criticalHighExcursions * 10, 40);
        factors.push({
            factor: 'Penyimpangan Suhu Kritis (Inti)',
            severity: 'CRITICAL',
            details: `${criticalHighExcursions} pembacaan melampaui batas kritis (${tempMax + 5}°C)`
        });
        recommendations.push('Karantina produk segera. Lakukan pengujian mikroba dan uji Total Volatile Basic Nitrogen (TVB-N).');
    } else if (highTempExcursions > 0) {
        tempScore += Math.min(excursionRatio * 80 + highTempExcursions * 5, 65);
        factors.push({
            factor: 'Fluktuasi Suhu Melebihi Batas (Inti)',
            severity: 'WARNING',
            details: `${highTempExcursions} pembacaan di atas batas aman (${tempMax}°C)`
        });
        recommendations.push('Periksa integritas kemasan dan uji suhu inti produk menggunakan probe yang terkalibrasi.');
    } else if (boundaryExcursions > 0) {
        // Early warning: boundary infiltration detected while core remained safe
        tempScore += Math.min(boundaryExcursions * 3, 25);
        factors.push({
            factor: 'Peringatan Dini Penetrasi Kalor Pintu',
            severity: 'CAUTION',
            details: `${boundaryExcursions} pembacaan probe pintu melampaui batas aman (${tempMax}°C) sementara suhu inti tetap terjaga`
        });
        recommendations.push('Periksa kerapatan gasket pintu wadah/kontainer dan kondisi insulasi di area bibir penutup.');
    }

    // 2. Physical Shock (Net dynamic g-force)
    if (maxShockG > shockThreshold * 1.5) {
        physicalScore += 70;
        factors.push({
            factor: 'Benturan Keras / Jatuh',
            severity: 'CRITICAL',
            details: `Puncak benturan bersih ${maxShockG.toFixed(2)}g melampaui batas toleransi (${shockThreshold}g)`
        });
        recommendations.push('Periksa struktur fisik kontainer dari kerusakan, kebocoran segel pintu, dan hilangnya media pendingin sekunder.');
    } else if (maxShockG > shockThreshold) {
        physicalScore += 40;
        factors.push({
            factor: 'Getaran / Guncangan Berlebih',
            severity: 'WARNING',
            details: `Puncak guncangan bersih ${maxShockG.toFixed(2)}g melampaui batas toleransi (${shockThreshold}g)`
        });
    }

    // 3. Door breaches
    if (doorOpenCount > 5) {
        integrityScore += 50;
        factors.push({
            factor: 'Pelanggaran Buka-Tutup Pintu',
            severity: 'WARNING',
            details: `Pintu wadah dibuka ${doorOpenCount} kali selama pengiriman transit`
        });
        recommendations.push('Verifikasi log chain-of-custody untuk memvalidasi otorisasi pembukaan pintu kontainer/wadah.');
    } else if (doorOpenCount > 0) {
        integrityScore += 20;
    }

    // Overall weighted score (CACCR 60/25/15)
    const overallRiskScore = Math.min(Math.round(
        tempScore * 0.60 + physicalScore * 0.25 + integrityScore * 0.15
    ), 100);

    let riskLevel = 'NORMAL';
    if (overallRiskScore >= 80) riskLevel = 'CRITICAL';
    else if (overallRiskScore >= 60) riskLevel = 'WARNING';
    else if (overallRiskScore >= 30) riskLevel = 'CAUTION';

    if (recommendations.length === 0) {
        recommendations.push('Integritas rantai dingin terjaga dalam batas aman. Memenuhi syarat penerbitan izin rilis jalur cepat (Jalur Hijau).');
    }

    // Quality Retention Index (Rough estimate: 100% minus score * 0.8)
    const shelfLifeLossPercent = Math.min(Math.round(overallRiskScore * 0.75), 100);
    const qualityRetentionPercent = 100 - shelfLifeLossPercent;

    return {
        overall_risk_score: overallRiskScore,
        risk_level: riskLevel,
        mkt_celsius: mkt,
        mkt_probe_1: mktP1,
        mkt_probe_2: mktP2,
        mkt_probe_3: mktP3,
        max_thermal_gradient_c: Math.round(maxThermalGradient * 10) / 10,
        quality_retention_percent: qualityRetentionPercent,
        shelf_life_loss_percent: shelfLifeLossPercent,
        statistics: {
            total_readings: totalReadings,
            high_temp_excursions: highTempExcursions,
            critical_high_excursions: criticalHighExcursions,
            boundary_early_warnings: boundaryExcursions,
            door_open_events: doorOpenCount,
            peak_shock_g: Math.round(maxShockG * 100) / 100
        },
        factors,
        recommendations
    };
}

// GET /api/risk/summary - System-wide risk summary
router.get('/summary', optionalAuth, (req, res) => {
    try {
        const db = getDb();
        const activeShipments = db.prepare(`
            SELECT id, commodity, status, started_at
            FROM shipments
            WHERE status = 'active'
        `).all();

        const summary = [];
        let criticalCount = 0;
        let warningCount = 0;
        let normalCount = 0;

        for (const s of activeShipments) {
            const readings = db.prepare(`
                SELECT temperature_probe_1, temperature_probe_2, temperature_probe_3, ambient_temperature, acceleration_x, acceleration_y, acceleration_z, door_status
                FROM sensor_readings
                WHERE shipment_id = ?
                ORDER BY timestamp DESC
                LIMIT 500
            `).all(s.id);

            const evalResult = evaluateRisk(readings);
            if (evalResult.risk_level === 'CRITICAL') criticalCount++;
            else if (evalResult.risk_level === 'WARNING') warningCount++;
            else normalCount++;

            summary.push({
                shipment_id: s.id,
                commodity: s.commodity,
                risk_level: evalResult.risk_level,
                risk_score: evalResult.overall_risk_score,
                mkt: evalResult.mkt_celsius
            });
        }

        res.json({
            active_shipments_evaluated: activeShipments.length,
            counts: {
                critical: criticalCount,
                warning: warningCount,
                normal: normalCount
            },
            shipments: summary
        });
    } catch (err) {
        logger.error(`Error generating risk summary: ${err.message}`);
        res.status(500).json({ error: 'Failed to generate risk summary' });
    }
});

// GET /api/risk/evaluate/:shipmentId - Detailed risk evaluation for a shipment
router.get('/evaluate/:shipmentId', optionalAuth, (req, res) => {
    try {
        const db = getDb();
        const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(req.params.shipmentId);

        if (!shipment) {
            return res.status(404).json({ error: `Shipment ${req.params.shipmentId} not found` });
        }

        const readings = db.prepare(`
            SELECT * FROM sensor_readings
            WHERE shipment_id = ?
            ORDER BY timestamp ASC
        `).all(req.params.shipmentId);

        const thresholds = {
            temp_min: shipment.temp_min,
            temp_max: shipment.temp_max
        };

        const result = evaluateRisk(readings, thresholds);
        res.json({
            shipment_id: shipment.id,
            commodity: shipment.commodity,
            thresholds,
            evaluation: result
        });
    } catch (err) {
        logger.error(`Error evaluating risk for shipment ${req.params.shipmentId}: ${err.message}`);
        res.status(500).json({ error: 'Failed to evaluate shipment risk' });
    }
});

// POST /api/risk/analyze - On-demand evaluation for provided sensor array
router.post('/analyze', optionalAuth, (req, res) => {
    const { readings, thresholds } = req.body;
    if (!Array.isArray(readings)) {
        return res.status(400).json({ error: 'readings array required' });
    }

    try {
        const evaluation = evaluateRisk(readings, thresholds || {});
        res.json({ evaluation });
    } catch (err) {
        logger.error(`Error in on-demand risk analysis: ${err.message}`);
        res.status(500).json({ error: 'Failed to analyze risk' });
    }
});

module.exports = router;
