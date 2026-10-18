/**
 * Q-GUARD AlarmManager Implementation
 */

#include "AlarmManager.h"

AlarmManager::AlarmManager()
    : _buzzerSilenced(false),
      _buzzerActive(false),
      _lastBuzzerToggleMs(0),
      _buzzerPattern(0) {
}

void AlarmManager::begin() {
    pinMode(PIN_LED_RED, OUTPUT);
    pinMode(PIN_LED_YELLOW, OUTPUT);
    pinMode(PIN_LED_GREEN, OUTPUT);
    pinMode(PIN_BUZZER, OUTPUT);
    
    allOff();
    
    Serial.println(F("[AlarmManager] Initialized"));
}

void AlarmManager::update(RiskLevel level, bool hasHardwareError) {
    _setLED(level, hasHardwareError);
    
    // Determine buzzer pattern
    if (hasHardwareError) {
        _buzzerPattern = 2; // Intermittent for hardware error
    } else {
        switch (level) {
            case RISK_CRITICAL:
                _buzzerPattern = 1; // Continuous
                break;
            case RISK_HIGH:
                _buzzerPattern = 2; // Intermittent
                break;
            default:
                _buzzerPattern = 0; // Off
                break;
        }
    }
    
    _updateBuzzer();
}

void AlarmManager::silenceBuzzer() {
    _buzzerSilenced = true;
    _buzzerActive = false;
    digitalWrite(PIN_BUZZER, LOW);
    Serial.println(F("[AlarmManager] Buzzer silenced"));
}

void AlarmManager::enableBuzzer() {
    _buzzerSilenced = false;
    Serial.println(F("[AlarmManager] Buzzer enabled"));
}

bool AlarmManager::isBuzzerSilenced() const {
    return _buzzerSilenced;
}

void AlarmManager::allOff() {
    digitalWrite(PIN_LED_RED, LOW);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_BUZZER, LOW);
    _buzzerActive = false;
}

void AlarmManager::selfTest() {
    Serial.println(F("[AlarmManager] Self-test: LEDs and buzzer"));
    
    // Green
    digitalWrite(PIN_LED_GREEN, HIGH);
    delay(300);
    digitalWrite(PIN_LED_GREEN, LOW);
    
    // Yellow
    digitalWrite(PIN_LED_YELLOW, HIGH);
    delay(300);
    digitalWrite(PIN_LED_YELLOW, LOW);
    
    // Red
    digitalWrite(PIN_LED_RED, HIGH);
    delay(300);
    digitalWrite(PIN_LED_RED, LOW);
    
    // Buzzer — short beep
    digitalWrite(PIN_BUZZER, HIGH);
    delay(100);
    digitalWrite(PIN_BUZZER, LOW);
    
    Serial.println(F("[AlarmManager] Self-test complete"));
}

void AlarmManager::_setLED(RiskLevel level, bool hasError) {
    // Turn all off first
    digitalWrite(PIN_LED_RED, LOW);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_GREEN, LOW);
    
    if (hasError) {
        // Hardware error: yellow blinking (handled via toggle in update loop)
        digitalWrite(PIN_LED_YELLOW, (millis() / 500) % 2 ? HIGH : LOW);
        return;
    }
    
    switch (level) {
        case RISK_NORMAL:
            digitalWrite(PIN_LED_GREEN, HIGH);
            break;
        case RISK_WARNING:
            digitalWrite(PIN_LED_YELLOW, HIGH);
            break;
        case RISK_HIGH:
            digitalWrite(PIN_LED_RED, HIGH);
            break;
        case RISK_CRITICAL:
            // Red blinking
            digitalWrite(PIN_LED_RED, (millis() / 250) % 2 ? HIGH : LOW);
            break;
        case RISK_UNKNOWN:
            // Yellow dim (blink slowly)
            digitalWrite(PIN_LED_YELLOW, (millis() / 1000) % 2 ? HIGH : LOW);
            break;
    }
}

void AlarmManager::_updateBuzzer() {
    if (_buzzerSilenced || _buzzerPattern == 0) {
        if (_buzzerActive) {
            digitalWrite(PIN_BUZZER, LOW);
            _buzzerActive = false;
        }
        return;
    }
    
    unsigned long now = millis();
    
    if (_buzzerPattern == 1) {
        // Continuous
        if (!_buzzerActive) {
            digitalWrite(PIN_BUZZER, HIGH);
            _buzzerActive = true;
        }
    } else if (_buzzerPattern == 2) {
        // Intermittent: 200ms on, 800ms off
        if (now - _lastBuzzerToggleMs > (_buzzerActive ? 200 : 800)) {
            _buzzerActive = !_buzzerActive;
            digitalWrite(PIN_BUZZER, _buzzerActive ? HIGH : LOW);
            _lastBuzzerToggleMs = now;
        }
    }
}
