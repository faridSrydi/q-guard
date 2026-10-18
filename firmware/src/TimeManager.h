/**
 * Q-GUARD TimeManager
 * 
 * Manages time sources:
 * - DS3231 RTC as backup/primary time source
 * - GPS time synchronization
 * - System time tracking
 */

#ifndef TIME_MANAGER_H
#define TIME_MANAGER_H

#include <Arduino.h>
#include <RTClib.h>
#include <Wire.h>
#include "config.h"

enum TimeSource {
    TIME_SOURCE_NONE = 0,
    TIME_SOURCE_RTC,
    TIME_SOURCE_GPS,
    TIME_SOURCE_MILLIS   // Fallback — relative time only
};

class TimeManager {
public:
    TimeManager();
    
    bool begin();
    
    /**
     * Get current timestamp as ISO 8601 string.
     * Returns empty string if no valid time source.
     */
    String getTimestamp();
    
    /**
     * Get Unix timestamp (seconds since epoch).
     * Returns 0 if no valid time source.
     */
    uint32_t getUnixTime();
    
    /**
     * Get DateTime object from RTC.
     */
    DateTime getDateTime();
    
    /**
     * Sync RTC from GPS time.
     * Only syncs if GPS time is considered valid (has date and time).
     */
    bool syncFromGPS(int year, int month, int day, int hour, int minute, int second);
    
    /**
     * Get current active time source.
     */
    TimeSource getTimeSource() const;
    
    /**
     * Get time source as human-readable string.
     */
    String getTimeSourceString() const;
    
    /**
     * Check if time is valid (not default/unset).
     */
    bool isTimeValid() const;
    
    /**
     * Get RTC temperature (DS3231 has built-in temp sensor).
     */
    float getRTCTemperature();
    
    bool isInitialized() const { return _initialized; }

private:
    RTC_DS3231 _rtc;
    bool _initialized;
    TimeSource _source;
    unsigned long _lastGPSSyncMs;
    
    bool _isReasonableTime(const DateTime& dt);
};

#endif // TIME_MANAGER_H
