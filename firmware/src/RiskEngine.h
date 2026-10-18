/**
 * Q-GUARD RiskEngine
 * 
 * Rule-based risk assessment for cold-chain monitoring.
 * Evaluates sensor data against configurable thresholds.
 */

#ifndef RISK_ENGINE_H
#define RISK_ENGINE_H

#include <Arduino.h>
#include "config.h"
#include "SensorManager.h"

enum RiskLevel {
    RISK_NORMAL = 0,
    RISK_WARNING,
    RISK_HIGH,
    RISK_CRITICAL,
    RISK_UNKNOWN
};

struct RiskThresholds {
    float tempMin;
    float tempMax;
    int tempDeviationDurationS;
    float humidityMin;
    float humidityMax;
    float shockThresholdG;
    int doorOpenMaxS;
};

struct RiskResult {
    RiskLevel level;
    int score;          // 0-100
    String reasons;     // Semicolon-separated list
    int rulesTriggered;
    int rulesEvaluated;
    float dataCompleteness;  // 0.0 - 1.0
    String evidenceConfidence; // "HIGH", "MEDIUM", "LOW", "INSUFFICIENT"
};

class RiskEngine {
public:
    RiskEngine();
    
    /**
     * Initialize with default thresholds.
     */
    void begin();
    
    /**
     * Set thresholds from configuration.
     */
    void setThresholds(const RiskThresholds& thresholds);
    
    /**
     * Get current thresholds.
     */
    const RiskThresholds& getThresholds() const;
    
    /**
     * Evaluate risk based on current sensor reading.
     */
    RiskResult evaluate(const SensorReading& reading);
    
    /**
     * Get last evaluation result.
     */
    const RiskResult& getLastResult() const;
    
    /**
     * Convert risk level to string.
     */
    static String levelToString(RiskLevel level);
    
    /**
     * Convert risk level to color (for display).
     * Returns TFT color value.
     */
    static uint16_t levelToColor(RiskLevel level);

private:
    RiskThresholds _thresholds;
    RiskResult _lastResult;
    
    // Deviation tracking
    unsigned long _tempDeviationStartMs[3]; // Per probe
    unsigned long _doorOpenStartMs;
    
    void _evaluateTemperature(const SensorReading& reading, int& score, String& reasons, int& triggered, int& evaluated);
    void _evaluateHumidity(const SensorReading& reading, int& score, String& reasons, int& triggered, int& evaluated);
    void _evaluateShock(const SensorReading& reading, int& score, String& reasons, int& triggered, int& evaluated);
    void _evaluateDoor(const SensorReading& reading, int& score, String& reasons, int& triggered, int& evaluated);
    void _evaluateDataCompleteness(const SensorReading& reading, float& completeness);
    String _calculateEvidenceConfidence(float completeness, const SensorReading& reading);
    RiskLevel _scoreToLevel(int score, float completeness);
};

#endif // RISK_ENGINE_H
