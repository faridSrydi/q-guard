/**
 * Q-GUARD GPSManager
 * 
 * Manages NEO-6M GPS module via UART2.
 * Provides position data and time for RTC sync.
 */

#ifndef GPS_MANAGER_H
#define GPS_MANAGER_H

#include <Arduino.h>
#include <TinyGPSPlus.h>
#include "config.h"

struct GPSData {
    double latitude;
    double longitude;
    double altitude;
    double speed;       // km/h
    double course;
    int satellites;
    double hdop;
    bool hasFix;
    bool hasValidTime;
    int year, month, day;
    int hour, minute, second;
    unsigned long fixAgeMs;
    unsigned long lastFixMs;
    String fixQuality;  // "NO_FIX", "2D", "3D"
};

class GPSManager {
public:
    GPSManager();
    
    bool begin();
    
    /**
     * Process incoming GPS data. Call frequently.
     */
    void update();
    
    /**
     * Get latest GPS data.
     */
    const GPSData& getData() const;
    
    /**
     * Check if GPS has a valid fix.
     */
    bool hasFix() const;
    
    /**
     * Check if GPS time data is valid for RTC sync.
     */
    bool hasValidTime() const;
    
    /**
     * Get fix quality as string.
     */
    String getFixQuality() const;
    
    /**
     * Get number of characters processed (debug).
     */
    unsigned long getCharsProcessed() const;
    
    bool isInitialized() const { return _initialized; }

private:
    TinyGPSPlus _gps;
    HardwareSerial* _serial;
    GPSData _data;
    bool _initialized;
    
    void _updateData();
};

#endif // GPS_MANAGER_H
