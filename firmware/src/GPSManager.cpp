/**
 * Q-GUARD GPSManager Implementation
 */

#include "GPSManager.h"

GPSManager::GPSManager()
    : _serial(&Serial2),
      _initialized(false) {
    memset(&_data, 0, sizeof(_data));
    _data.latitude = NAN;
    _data.longitude = NAN;
    _data.altitude = NAN;
    _data.speed = NAN;
    _data.course = NAN;
    _data.hdop = NAN;
    _data.hasFix = false;
    _data.hasValidTime = false;
    _data.fixQuality = "NO_FIX";
}

bool GPSManager::begin() {
    Serial.println(F("[GPSManager] Initializing NEO-6M GPS..."));
    
    _serial->begin(GPS_BAUD, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);
    _initialized = true;
    
    Serial.printf("[GPSManager] UART2 configured: RX=GPIO%d, TX=GPIO%d, Baud=%d\n",
        PIN_GPS_RX, PIN_GPS_TX, GPS_BAUD);
    Serial.println(F("[GPSManager] Waiting for GPS data... (cold start may take 1-5 min)"));
    
    return true;
}

void GPSManager::update() {
    if (!_initialized) return;
    
    while (_serial->available() > 0) {
        char c = _serial->read();
        if (_gps.encode(c)) {
            _updateData();
        }
    }
}

const GPSData& GPSManager::getData() const {
    return _data;
}

bool GPSManager::hasFix() const {
    return _data.hasFix;
}

bool GPSManager::hasValidTime() const {
    return _data.hasValidTime;
}

String GPSManager::getFixQuality() const {
    return _data.fixQuality;
}

unsigned long GPSManager::getCharsProcessed() const {
    return _gps.charsProcessed();
}

void GPSManager::_updateData() {
    // Location
    if (_gps.location.isValid() && _gps.location.isUpdated()) {
        _data.latitude = _gps.location.lat();
        _data.longitude = _gps.location.lng();
        _data.hasFix = true;
        _data.lastFixMs = millis();
        _data.fixAgeMs = _gps.location.age();
        
        // Don't report 0,0 as valid position
        if (abs(_data.latitude) < 0.0001 && abs(_data.longitude) < 0.0001) {
            _data.hasFix = false;
            _data.latitude = NAN;
            _data.longitude = NAN;
        }
    } else if (_gps.location.age() > 10000) {
        // Fix is stale (>10 seconds old)
        _data.hasFix = false;
        _data.fixAgeMs = _gps.location.age();
    }
    
    // Altitude
    if (_gps.altitude.isValid()) {
        _data.altitude = _gps.altitude.meters();
    }
    
    // Speed
    if (_gps.speed.isValid()) {
        _data.speed = _gps.speed.kmph();
    }
    
    // Course
    if (_gps.course.isValid()) {
        _data.course = _gps.course.deg();
    }
    
    // Satellites
    if (_gps.satellites.isValid()) {
        _data.satellites = _gps.satellites.value();
        
        if (_data.satellites >= 4) {
            _data.fixQuality = "3D";
        } else if (_data.satellites >= 3) {
            _data.fixQuality = "2D";
        } else {
            _data.fixQuality = "NO_FIX";
        }
    }
    
    // HDOP
    if (_gps.hdop.isValid()) {
        _data.hdop = _gps.hdop.hdop();
    }
    
    // Date and Time
    if (_gps.date.isValid() && _gps.time.isValid()) {
        _data.year = _gps.date.year();
        _data.month = _gps.date.month();
        _data.day = _gps.date.day();
        _data.hour = _gps.time.hour();
        _data.minute = _gps.time.minute();
        _data.second = _gps.time.second();
        
        // Validate GPS time
        if (_data.year >= 2024 && _data.year <= 2030 && 
            _data.month >= 1 && _data.month <= 12) {
            _data.hasValidTime = true;
        }
    }
}
