/**
 * Q-GUARD RiskEngine Implementation
 */

#include "RiskEngine.h"

RiskEngine::RiskEngine() {
    memset(_tempDeviationStartMs, 0, sizeof(_tempDeviationStartMs));
    _doorOpenStartMs = 0;
}

void RiskEngine::begin() {
    _thresholds.tempMin = TEMP_MIN_DEFAULT;
    _thresholds.tempMax = TEMP_MAX_DEFAULT;
    _thresholds.tempDeviationDurationS = TEMP_DEVIATION_DURATION_S;
    _thresholds.humidityMin = HUMIDITY_MIN_DEFAULT;
    _thresholds.humidityMax = HUMIDITY_MAX_DEFAULT;
    _thresholds.shockThresholdG = SHOCK_THRESHOLD_G;
    _thresholds.doorOpenMaxS = DOOR_OPEN_MAX_S;
    
    _lastResult.level = RISK_UNKNOWN;
    _lastResult.score = 0;
    _lastResult.reasons = "";
    _lastResult.rulesTriggered = 0;
    _lastResult.rulesEvaluated = 0;
    _lastResult.dataCompleteness = 0.0f;
    _lastResult.evidenceConfidence = "INSUFFICIENT";
    
    Serial.println(F("[RiskEngine] Initialized with default thresholds"));
    Serial.printf("[RiskEngine] Temp range: %.1f to %.1f °C\n", 
        _thresholds.tempMin, _thresholds.tempMax);
}

void RiskEngine::setThresholds(const RiskThresholds& thresholds) {
    _thresholds = thresholds;
    Serial.println(F("[RiskEngine] Thresholds updated"));
}

const RiskThresholds& RiskEngine::getThresholds() const {
    return _thresholds;
}

RiskResult RiskEngine::evaluate(const SensorReading& reading) {
    int score = 0;
    String reasons = "";
    int triggered = 0;
    int evaluated = 0;
    float completeness = 0.0f;
    
    _evaluateTemperature(reading, score, reasons, triggered, evaluated);
    _evaluateHumidity(reading, score, reasons, triggered, evaluated);
    _evaluateShock(reading, score, reasons, triggered, evaluated);
    _evaluateDoor(reading, score, reasons, triggered, evaluated);
    _evaluateDataCompleteness(reading, completeness);
    
    // Cap score at 100
    if (score > 100) score = 100;
    
    _lastResult.score = score;
    _lastResult.reasons = reasons;
    _lastResult.rulesTriggered = triggered;
    _lastResult.rulesEvaluated = evaluated;
    _lastResult.dataCompleteness = completeness;
    _lastResult.evidenceConfidence = _calculateEvidenceConfidence(completeness, reading);
    _lastResult.level = _scoreToLevel(score, completeness);
    
    return _lastResult;
}

const RiskResult& RiskEngine::getLastResult() const {
    return _lastResult;
}

void RiskEngine::_evaluateTemperature(const SensorReading& reading, int& score, 
                                       String& reasons, int& triggered, int& evaluated) {
    for (int i = 0; i < 3; i++) {
        if (reading.probes[i].status != SENSOR_OK) {
            if (reading.probes[i].status == SENSOR_ERROR) {
                score += 10;
                triggered++;
                if (reasons.length() > 0) reasons += "; ";
                reasons += "Probe " + String(i + 1) + " ERROR";
            }
            // Don't evaluate unavailable sensors
            if (reading.probes[i].status != SENSOR_UNAVAILABLE) {
                evaluated++;
            }
            continue;
        }
        
        evaluated++;
        float temp = reading.probes[i].temperature;
        
        if (temp < _thresholds.tempMin) {
            float deviation = _thresholds.tempMin - temp;
            score += (int)(deviation * 5);
            triggered++;
            if (reasons.length() > 0) reasons += "; ";
            reasons += "Probe " + String(i + 1) + " too cold: " + 
                       String(temp, 1) + "°C (min: " + String(_thresholds.tempMin, 1) + ")";
            
            // Track deviation duration
            if (_tempDeviationStartMs[i] == 0) {
                _tempDeviationStartMs[i] = millis();
            } else {
                unsigned long durationS = (millis() - _tempDeviationStartMs[i]) / 1000;
                if (durationS > (unsigned long)_thresholds.tempDeviationDurationS) {
                    score += 20; // Escalation for prolonged deviation
                    reasons += " [>" + String(_thresholds.tempDeviationDurationS) + "s]";
                }
            }
        } else if (temp > _thresholds.tempMax) {
            float deviation = temp - _thresholds.tempMax;
            score += (int)(deviation * 8); // Higher weight for too-warm in cold chain
            triggered++;
            if (reasons.length() > 0) reasons += "; ";
            reasons += "Probe " + String(i + 1) + " too warm: " + 
                       String(temp, 1) + "°C (max: " + String(_thresholds.tempMax, 1) + ")";
            
            if (_tempDeviationStartMs[i] == 0) {
                _tempDeviationStartMs[i] = millis();
            } else {
                unsigned long durationS = (millis() - _tempDeviationStartMs[i]) / 1000;
                if (durationS > (unsigned long)_thresholds.tempDeviationDurationS) {
                    score += 25;
                    reasons += " [>" + String(_thresholds.tempDeviationDurationS) + "s]";
                }
            }
        } else {
            // Temperature in range — reset deviation tracking
            _tempDeviationStartMs[i] = 0;
        }
    }
}

void RiskEngine::_evaluateHumidity(const SensorReading& reading, int& score, 
                                    String& reasons, int& triggered, int& evaluated) {
    if (reading.environment.status != SENSOR_OK) {
        if (reading.environment.status == SENSOR_ERROR) {
            score += 5;
            triggered++;
            if (reasons.length() > 0) reasons += "; ";
            reasons += "BME280 sensor ERROR";
        }
        return;
    }
    
    evaluated++;
    
    if (!isnan(reading.environment.humidity)) {
        if (reading.environment.humidity < _thresholds.humidityMin ||
            reading.environment.humidity > _thresholds.humidityMax) {
            score += 10;
            triggered++;
            if (reasons.length() > 0) reasons += "; ";
            reasons += "Humidity out of range: " + String(reading.environment.humidity, 1) + "%";
        }
    }
}

void RiskEngine::_evaluateShock(const SensorReading& reading, int& score, 
                                 String& reasons, int& triggered, int& evaluated) {
    if (reading.motion.status != SENSOR_OK) return;
    
    evaluated++;
    
    if (!isnan(reading.motion.shockMagnitude) && 
        reading.motion.shockMagnitude > _thresholds.shockThresholdG) {
        score += 15;
        triggered++;
        if (reasons.length() > 0) reasons += "; ";
        reasons += "Shock detected: " + String(reading.motion.shockMagnitude, 2) + 
                   "g (threshold: " + String(_thresholds.shockThresholdG, 1) + "g)";
    }
}

void RiskEngine::_evaluateDoor(const SensorReading& reading, int& score, 
                                String& reasons, int& triggered, int& evaluated) {
    if (reading.door.status != SENSOR_OK) return;
    
    evaluated++;
    
    if (reading.door.isOpen) {
        unsigned long openDurationS = 0;
        if (reading.door.openSinceMs > 0) {
            openDurationS = (millis() - reading.door.openSinceMs) / 1000;
        }
        
        if (openDurationS > (unsigned long)_thresholds.doorOpenMaxS) {
            score += 20;
            triggered++;
            if (reasons.length() > 0) reasons += "; ";
            reasons += "Door open too long: " + String(openDurationS) + 
                       "s (max: " + String(_thresholds.doorOpenMaxS) + "s)";
        } else if (openDurationS > 0) {
            // Door is open but within threshold — warning
            score += 5;
            triggered++;
            if (reasons.length() > 0) reasons += "; ";
            reasons += "Door open: " + String(openDurationS) + "s";
        }
    }
}

void RiskEngine::_evaluateDataCompleteness(const SensorReading& reading, float& completeness) {
    int totalFields = 0;
    int validFields = 0;
    
    // Temperature probes (3 fields)
    for (int i = 0; i < 3; i++) {
        totalFields++;
        if (reading.probes[i].status == SENSOR_OK && !isnan(reading.probes[i].temperature)) {
            validFields++;
        }
    }
    
    // Environment (2 fields: temp + humidity)
    totalFields += 2;
    if (reading.environment.status == SENSOR_OK) {
        if (!isnan(reading.environment.temperature)) validFields++;
        if (!isnan(reading.environment.humidity)) validFields++;
    }
    
    // Motion (1 field: shock magnitude)
    totalFields++;
    if (reading.motion.status == SENSOR_OK && !isnan(reading.motion.shockMagnitude)) {
        validFields++;
    }
    
    // Door (1 field)
    totalFields++;
    if (reading.door.status == SENSOR_OK) validFields++;
    
    completeness = (totalFields > 0) ? (float)validFields / totalFields : 0.0f;
}

String RiskEngine::_calculateEvidenceConfidence(float completeness, const SensorReading& reading) {
    if (completeness >= 0.9f) return "HIGH";
    if (completeness >= 0.7f) return "MEDIUM";
    if (completeness >= 0.4f) return "LOW";
    return "INSUFFICIENT";
}

RiskLevel RiskEngine::_scoreToLevel(int score, float completeness) {
    // If data is too incomplete, return UNKNOWN regardless of score
    if (completeness < 0.3f) return RISK_UNKNOWN;
    
    if (score >= 60) return RISK_CRITICAL;
    if (score >= 40) return RISK_HIGH;
    if (score >= 15) return RISK_WARNING;
    if (completeness >= 0.5f) return RISK_NORMAL;
    
    return RISK_UNKNOWN;
}

String RiskEngine::levelToString(RiskLevel level) {
    switch (level) {
        case RISK_NORMAL:   return "NORMAL";
        case RISK_WARNING:  return "WARNING";
        case RISK_HIGH:     return "HIGH";
        case RISK_CRITICAL: return "CRITICAL";
        default:            return "UNKNOWN";
    }
}

uint16_t RiskEngine::levelToColor(RiskLevel level) {
    switch (level) {
        case RISK_NORMAL:   return 0x07E0; // Green
        case RISK_WARNING:  return 0xFD20; // Orange
        case RISK_HIGH:     return 0xF800; // Red
        case RISK_CRITICAL: return 0xF800; // Red (bright)
        default:            return 0xAD55; // Gray
    }
}
