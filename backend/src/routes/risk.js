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
            factors: [],
            recommendations: ['No sensor readings available for evaluation.']
        };
    }

    const temps = [];
    let highTempExcursions = 0;
    let criticalHighExcursions = 0;
    let severeLowExcursions = 0;
    let doorOpenCount = 0;
    let maxShockG = 0;
    let totalReadings = readings.length;

    for (const r of readings) {
        const t1 = r.temperature_probe_1 !== null && !isNaN(r.temperature_probe_1) ? r.temperature_probe_1 : r.ambient_temperature;
        if (t1 !== null && !isNaN(t1)) {
            temps.push(t1);
            if (t1 > tempMax) {
                highTempExcursions++;
                if (t1 > (tempMax + 5)) {
                    criticalHighExcursions++;
                }
            } else if (t1 < (tempMin - 5)) {
                severeLowExcursions++;
            }
        }

        if (r.door_status === 'OPEN') {
            doorOpenCount++;
        }

        const ax = r.acceleration_x || 0;
        const ay = r.acceleration_y || 0;
        const az = r.acceleration_z || 0;
        const gForce = Math.sqrt(ax * ax + ay * ay + az * az);
        if (gForce > maxShockG) {
            maxShockG = gForce;
        }
    }

    const mkt = calculateMKT(temps);

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
            factor: 'Severe Temperature Abuse',
            severity: 'CRITICAL',
            details: `${criticalHighExcursions} readings exceeded severe threshold (${tempMax + 5}°C)`
        });
        recommendations.push('Quarantine product immediately. Conduct microbial test and total volatile basic nitrogen (TVB-N) assay.');
    } else if (highTempExcursions > 0) {
        tempScore += Math.min(excursionRatio * 80 + highTempExcursions * 5, 65);
        factors.push({
            factor: 'Temperature Excursion',
            severity: 'WARNING',
            details: `${highTempExcursions} readings above safe maximum (${tempMax}°C)`
        });
        recommendations.push('Inspect package integrity and check core product temperature with calibrated probe.');
    }

    // 2. Physical Shock
    if (maxShockG > shockThreshold * 1.5) {
        physicalScore += 70;
        factors.push({
            factor: 'Severe Impact / Drop',
            severity: 'CRITICAL',
            details: `Peak impact ${maxShockG.toFixed(2)}g exceeded threshold (${shockThreshold}g)`
        });
        recommendations.push('Check container for structural damage, seal rupture, and secondary refrigerant loss.');
    } else if (maxShockG > shockThreshold) {
        physicalScore += 40;
        factors.push({
            factor: 'Excessive Vibration / Shock',
            severity: 'WARNING',
            details: `Peak impact ${maxShockG.toFixed(2)}g exceeded threshold (${shockThreshold}g)`
        });
    }

    // 3. Door breaches
    if (doorOpenCount > 5) {
        integrityScore += 50;
        factors.push({
            factor: 'Repeated Door Breaches',
            severity: 'WARNING',
            details: `Door opened ${doorOpenCount} times during transit`
        });
        recommendations.push('Verify chain-of-custody log to validate authorized door openings.');
    } else if (doorOpenCount > 0) {
        integrityScore += 20;
    }

    // Overall weighted score
    const overallRiskScore = Math.min(Math.round(
        tempScore * 0.60 + physicalScore * 0.25 + integrityScore * 0.15
    ), 100);

    let riskLevel = 'NORMAL';
    if (overallRiskScore >= 80) riskLevel = 'CRITICAL';
    else if (overallRiskScore >= 60) riskLevel = 'WARNING';
    else if (overallRiskScore >= 30) riskLevel = 'CAUTION';

    if (recommendations.length === 0) {
        recommendations.push('Cold-chain integrity maintained within safe limits. Eligible for fast-track clearance.');
    }

    // Quality Retention Index (Rough estimate: 100% minus score * 0.8)
    const shelfLifeLossPercent = Math.min(Math.round(overallRiskScore * 0.75), 100);
    const qualityRetentionPercent = 100 - shelfLifeLossPercent;

    return {
        overall_risk_score: overallRiskScore,
        risk_level: riskLevel,
        mkt_celsius: mkt,
        quality_retention_percent: qualityRetentionPercent,
        shelf_life_loss_percent: shelfLifeLossPercent,
        statistics: {
            total_readings: totalReadings,
            high_temp_excursions: highTempExcursions,
            critical_high_excursions: criticalHighExcursions,
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
                SELECT temperature_probe_1, ambient_temperature, acceleration_x, acceleration_y, acceleration_z, door_status
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
