/**
 * Q-GUARD AlarmManager
 * 
 * Controls LED indicators and buzzer based on system state.
 */

#ifndef ALARM_MANAGER_H
#define ALARM_MANAGER_H

#include <Arduino.h>
#include "config.h"
#include "RiskEngine.h"

class AlarmManager {
public:
    AlarmManager();
    
    void begin();
    
    /**
     * Update LED and buzzer state based on risk level.
     */
    void update(RiskLevel level, bool hasHardwareError);
    
    /**
     * Silence the buzzer (user action).
     */
    void silenceBuzzer();
    
    /**
     * Re-enable buzzer after silence.
     */
    void enableBuzzer();
    
    /**
     * Check if buzzer is silenced.
     */
    bool isBuzzerSilenced() const;
    
    /**
     * Set all LEDs off.
     */
    void allOff();
    
    /**
     * Test all outputs (startup sequence).
     */
    void selfTest();

private:
    bool _buzzerSilenced;
    bool _buzzerActive;
    unsigned long _lastBuzzerToggleMs;
    int _buzzerPattern;  // 0=off, 1=continuous, 2=intermittent
    
    void _setLED(RiskLevel level, bool hasError);
    void _updateBuzzer();
};

#endif // ALARM_MANAGER_H
