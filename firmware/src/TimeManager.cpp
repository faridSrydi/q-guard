/**
 * Q-GUARD TimeManager Implementation
 */

#include "TimeManager.h"

TimeManager::TimeManager()
    : _initialized(false),
      _source(TIME_SOURCE_NONE),
      _lastGPSSyncMs(0) {
}

bool TimeManager::begin() {
    Serial.println(F("[TimeManager] Initializing DS3231 RTC..."));
    
    if (!_rtc.begin()) {
        Serial.println(F("[TimeManager] DS3231: FAILED — not found on I2C"));
        _source = TIME_SOURCE_MILLIS;
        return false;
    }
    
    _initialized = true;
    
    if (_rtc.lostPower()) {
        Serial.println(F("[TimeManager] DS3231: Lost power — time may be invalid"));
        Serial.println(F("[TimeManager] Waiting for GPS sync to set correct time"));
        // Don't set compile time — it becomes stale quickly
        _source = TIME_SOURCE_MILLIS;
    } else {
        DateTime now = _rtc.now();
        if (_isReasonableTime(now)) {
            _source = TIME_SOURCE_RTC;
            Serial.printf("[TimeManager] DS3231: OK — %04d-%02d-%02d %02d:%02d:%02d\n",
                now.year(), now.month(), now.day(),
                now.hour(), now.minute(), now.second());
        } else {
            Serial.println(F("[TimeManager] DS3231: Time value is unreasonable"));
            _source = TIME_SOURCE_MILLIS;
        }
    }
    
    // Disable 32kHz output and SQW — not needed
    _rtc.disable32K();
    
    return true;
}

String TimeManager::getTimestamp() {
    if (!_initialized && _source == TIME_SOURCE_NONE) {
        return "";
    }
    
    DateTime now;
    if (_initialized) {
        now = _rtc.now();
    }
    
    if (_source == TIME_SOURCE_MILLIS || !_isReasonableTime(now)) {
        // Return millis-based relative time marker
        unsigned long ms = millis();
        unsigned long sec = ms / 1000;
        return "T+" + String(sec) + "s";
    }
    
    char buf[25];
    snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02d",
        now.year(), now.month(), now.day(),
        now.hour(), now.minute(), now.second());
    return String(buf);
}

uint32_t TimeManager::getUnixTime() {
    if (!_initialized) return 0;
    DateTime now = _rtc.now();
    if (!_isReasonableTime(now)) return 0;
    return now.unixtime();
}

DateTime TimeManager::getDateTime() {
    if (!_initialized) return DateTime(0);
    return _rtc.now();
}

bool TimeManager::syncFromGPS(int year, int month, int day, int hour, int minute, int second) {
    if (!_initialized) {
        Serial.println(F("[TimeManager] Cannot sync — RTC not initialized"));
        return false;
    }
    
    // Validate GPS time
    if (year < 2024 || year > 2030 || month < 1 || month > 12 || day < 1 || day > 31) {
        Serial.println(F("[TimeManager] GPS time rejected — unreasonable date"));
        return false;
    }
    
    // Don't sync too frequently
    if (_lastGPSSyncMs > 0 && (millis() - _lastGPSSyncMs) < 3600000) {
        // Already synced within the last hour
        return true;
    }
    
    DateTime gpsTime(year, month, day, hour, minute, second);
    _rtc.adjust(gpsTime);
    _source = TIME_SOURCE_GPS;
    _lastGPSSyncMs = millis();
    
    Serial.printf("[TimeManager] RTC synced from GPS: %04d-%02d-%02d %02d:%02d:%02d\n",
        year, month, day, hour, minute, second);
    
    return true;
}

TimeSource TimeManager::getTimeSource() const {
    return _source;
}

String TimeManager::getTimeSourceString() const {
    switch (_source) {
        case TIME_SOURCE_RTC:    return "RTC";
        case TIME_SOURCE_GPS:    return "GPS";
        case TIME_SOURCE_MILLIS: return "MILLIS";
        default:                 return "NONE";
    }
}

bool TimeManager::isTimeValid() const {
    return _source == TIME_SOURCE_RTC || _source == TIME_SOURCE_GPS;
}

float TimeManager::getRTCTemperature() {
    if (!_initialized) return NAN;
    return _rtc.getTemperature();
}

bool TimeManager::_isReasonableTime(const DateTime& dt) {
    // Reject dates before 2024 or after 2030
    if (dt.year() < 2024 || dt.year() > 2030) return false;
    if (dt.month() < 1 || dt.month() > 12) return false;
    if (dt.day() < 1 || dt.day() > 31) return false;
    return true;
}
