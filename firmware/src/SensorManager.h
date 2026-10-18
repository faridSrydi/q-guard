/**
 * Q-GUARD SensorManager
 * 
 * Manages all sensor peripherals:
 * - 3× DS18B20 temperature probes (OneWire)
 * - BME280 ambient temperature & humidity (I²C)
 * - MPU6050 accelerometer/gyroscope (I²C)
 * - MC-38 magnetic door sensor (digital input)
 */

#ifndef SENSOR_MANAGER_H
#define SENSOR_MANAGER_H

#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_BME280.h>
#include <MPU6050.h>
#include <Wire.h>
#include "config.h"

// Sensor status codes
enum SensorStatus {
    SENSOR_OK = 0,
    SENSOR_ERROR,
    SENSOR_UNAVAILABLE,
    SENSOR_NOT_INITIALIZED
};

// Individual DS18B20 probe data
struct ProbeData {
    float temperature;
    DeviceAddress address;
    SensorStatus status;
    bool addressValid;
    char label[20];
};

// BME280 data
struct EnvironmentData {
    float temperature;
    float humidity;
    float pressure;
    SensorStatus status;
};

// MPU6050 data
struct MotionData {
    float accelX;  // g-force
    float accelY;
    float accelZ;
    float gyroX;   // degrees/sec
    float gyroY;
    float gyroZ;
    float shockMagnitude;  // resultant g-force
    SensorStatus status;
};

// Door sensor data
struct DoorData {
    bool isOpen;
    unsigned long openSinceMs;  // millis() when door opened, 0 if closed
    unsigned long totalOpenDurationMs;
    SensorStatus status;
};

// Aggregate sensor reading
struct SensorReading {
    ProbeData probes[3];
    EnvironmentData environment;
    MotionData motion;
    DoorData door;
    unsigned long timestampMs;
    String sensorHealthSummary;
};

class SensorManager {
public:
    SensorManager();
    
    /**
     * Initialize all sensors.
     * Returns true if at least one sensor initialized successfully.
     */
    bool begin();
    
    /**
     * Read all sensors. Call at SENSOR_SAMPLE_INTERVAL_MS.
     */
    void readAll();
    
    /**
     * Get the latest sensor reading.
     */
    const SensorReading& getReading() const;
    
    /**
     * Scan I²C bus and report found devices.
     * Useful for debugging address conflicts.
     */
    void scanI2C();
    
    /**
     * Get human-readable sensor health summary.
     */
    String getHealthSummary() const;
    
    /**
     * Check if any sensor is in error state.
     */
    bool hasErrors() const;
    
    /**
     * Get DS18B20 ROM address as string for identification.
     */
    static String addressToString(const DeviceAddress& addr);

private:
    OneWire _oneWire;
    DallasTemperature _dallas;
    Adafruit_BME280 _bme;
    MPU6050 _mpu;
    
    SensorReading _reading;
    
    bool _dallasInitialized;
    bool _bmeInitialized;
    bool _mpuInitialized;
    bool _doorInitialized;
    
    int _probeCount;
    
    // Door state tracking
    bool _doorPreviousState;
    unsigned long _doorOpenStartMs;
    
    void _readDS18B20();
    void _readBME280();
    void _readMPU6050();
    void _readDoor();
    void _updateHealthSummary();
    
    bool _isValidTemperature(float t);
};

#endif // SENSOR_MANAGER_H
