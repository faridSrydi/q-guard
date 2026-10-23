/**
 * Q-GUARD SensorManager Implementation
 */

#include "SensorManager.h"

SensorManager::SensorManager()
    : _oneWire(PIN_DS18B20_DATA),
      _dallas(&_oneWire),
      _dallasInitialized(false),
      _bmeInitialized(false),
      _mpuInitialized(false),
      _doorInitialized(false),
      _probeCount(0),
      _conversionRequestedMs(0),
      _conversionReady(false),
      _doorPreviousState(false),
      _doorOpenStartMs(0) {
    
    // Initialize reading with safe defaults
    for (int i = 0; i < 3; i++) {
        _reading.probes[i].temperature = NAN;
        _reading.probes[i].status = SENSOR_NOT_INITIALIZED;
        _reading.probes[i].addressValid = false;
        snprintf(_reading.probes[i].label, sizeof(_reading.probes[i].label), "Probe %d", i + 1);
    }
    _reading.environment.temperature = NAN;
    _reading.environment.humidity = NAN;
    _reading.environment.pressure = NAN;
    _reading.environment.status = SENSOR_NOT_INITIALIZED;
    _reading.motion.accelX = NAN;
    _reading.motion.accelY = NAN;
    _reading.motion.accelZ = NAN;
    _reading.motion.gyroX = NAN;
    _reading.motion.gyroY = NAN;
    _reading.motion.gyroZ = NAN;
    _reading.motion.shockMagnitude = NAN;
    _reading.motion.status = SENSOR_NOT_INITIALIZED;
    _reading.door.isOpen = false;
    _reading.door.openSinceMs = 0;
    _reading.door.totalOpenDurationMs = 0;
    _reading.door.status = SENSOR_NOT_INITIALIZED;
    _reading.timestampMs = 0;
}

bool SensorManager::begin() {
    bool anySuccess = false;
    
    Serial.println(F("[SensorManager] Initializing sensors..."));
    
    // --- DS18B20 ---
    _dallas.begin();
    _probeCount = _dallas.getDeviceCount();
    Serial.printf("[SensorManager] DS18B20: Found %d device(s)\n", _probeCount);
    
    if (_probeCount > 0) {
        _dallasInitialized = true;
        anySuccess = true;
        
        // Read addresses for up to 3 probes
        for (int i = 0; i < min(_probeCount, 3); i++) {
            if (_dallas.getAddress(_reading.probes[i].address, i)) {
                _reading.probes[i].addressValid = true;
                _reading.probes[i].status = SENSOR_OK;
                Serial.printf("[SensorManager] Probe %d ROM: %s\n", 
                    i + 1, addressToString(_reading.probes[i].address).c_str());
            } else {
                _reading.probes[i].status = SENSOR_ERROR;
                Serial.printf("[SensorManager] Probe %d: Failed to read address\n", i + 1);
            }
        }
        
        // Mark extra probes as unavailable
        for (int i = _probeCount; i < 3; i++) {
            _reading.probes[i].status = SENSOR_UNAVAILABLE;
        }
        
        _dallas.setResolution(12); // 12-bit resolution
        _dallas.setWaitForConversion(false); // Async conversion
    } else {
        Serial.println(F("[SensorManager] DS18B20: No devices found"));
        for (int i = 0; i < 3; i++) {
            _reading.probes[i].status = SENSOR_UNAVAILABLE;
        }
    }
    
    // --- BME280 ---
    if (_bme.begin(I2C_ADDR_BME280, &Wire)) {
        _bmeInitialized = true;
        anySuccess = true;
        _reading.environment.status = SENSOR_OK;
        Serial.printf("[SensorManager] BME280: OK at 0x%02X\n", I2C_ADDR_BME280);
        
        // Configure for weather monitoring
        _bme.setSampling(Adafruit_BME280::MODE_NORMAL,
                         Adafruit_BME280::SAMPLING_X2,   // temp
                         Adafruit_BME280::SAMPLING_X16,  // pressure
                         Adafruit_BME280::SAMPLING_X1,   // humidity
                         Adafruit_BME280::FILTER_X16,
                         Adafruit_BME280::STANDBY_MS_500);
    } else {
        Serial.printf("[SensorManager] BME280: FAILED at 0x%02X\n", I2C_ADDR_BME280);
        _reading.environment.status = SENSOR_UNAVAILABLE;
    }
    
    // --- MPU6050 ---
    _mpu.initialize();
    if (_mpu.testConnection()) {
        _mpuInitialized = true;
        anySuccess = true;
        _reading.motion.status = SENSOR_OK;
        
        // Set accelerometer range to ±4g for shock detection
        _mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_4);
        Serial.println(F("[SensorManager] MPU6050: OK at 0x69 (AD0 HIGH)"));
    } else {
        Serial.println(F("[SensorManager] MPU6050: FAILED — check AD0 pin and I2C address"));
        _reading.motion.status = SENSOR_UNAVAILABLE;
    }
    
    // --- MC-38 Door Sensor ---
    pinMode(PIN_DOOR_SENSOR, INPUT);
    _doorInitialized = true;
    
    // Detect floating pin (missing external pull-up resistor)
    if (_detectDoorSensorFloat()) {
        _reading.door.status = SENSOR_ERROR;
        _doorInitialized = false;
        Serial.printf("[SensorManager] MC-38: ERROR on GPIO%d — pin floating, check pull-up resistor\n", PIN_DOOR_SENSOR);
    } else {
        _reading.door.status = SENSOR_OK;
        _doorPreviousState = digitalRead(PIN_DOOR_SENSOR) == HIGH;
        anySuccess = true;
        Serial.printf("[SensorManager] MC-38: OK on GPIO%d (initial: %s)\n", 
            PIN_DOOR_SENSOR, _doorPreviousState ? "OPEN" : "CLOSED");
    }
    
    _updateHealthSummary();
    
    Serial.printf("[SensorManager] Initialization %s\n", 
        anySuccess ? "complete" : "FAILED — no sensors available");
    
    return anySuccess;
}

void SensorManager::readAll() {
    _reading.timestampMs = millis();
    
    _readDS18B20();
    _readBME280();
    _readMPU6050();
    _readDoor();
    _updateHealthSummary();
}

const SensorReading& SensorManager::getReading() const {
    return _reading;
}

void SensorManager::_readDS18B20() {
    if (!_dallasInitialized) return;
    
    unsigned long now = millis();
    
    // Phase 1: If no conversion in progress, start one
    if (_conversionRequestedMs == 0) {
        _dallas.requestTemperatures();
        _conversionRequestedMs = now;
        _conversionReady = false;
        return; // Don't read yet — conversion takes ~750ms at 12-bit
    }
    
    // Phase 2: Check if conversion is complete
    if (!_conversionReady) {
        if ((now - _conversionRequestedMs) >= DS18B20_CONVERSION_MS) {
            _conversionReady = true;
        } else {
            return; // Still converting — skip this read cycle
        }
    }
    
    // Phase 3: Read the completed conversion results
    for (int i = 0; i < min(_probeCount, 3); i++) {
        if (!_reading.probes[i].addressValid) continue;
        
        float temp = _dallas.getTempC(_reading.probes[i].address);
        
        if (_isValidTemperature(temp)) {
            _reading.probes[i].temperature = temp;
            _reading.probes[i].status = SENSOR_OK;
        } else {
            _reading.probes[i].temperature = NAN;
            _reading.probes[i].status = SENSOR_ERROR;
        }
    }
    
    // Start next conversion immediately after reading
    _dallas.requestTemperatures();
    _conversionRequestedMs = now;
    _conversionReady = false;
}

void SensorManager::_readBME280() {
    if (!_bmeInitialized) return;
    
    float temp = _bme.readTemperature();
    float hum = _bme.readHumidity();
    float pres = _bme.readPressure() / 100.0f; // hPa
    
    if (!isnan(temp) && temp > -40.0f && temp < 85.0f) {
        _reading.environment.temperature = temp;
    } else {
        _reading.environment.temperature = NAN;
        _reading.environment.status = SENSOR_ERROR;
        return;
    }
    
    if (!isnan(hum) && hum >= 0.0f && hum <= 100.0f) {
        _reading.environment.humidity = hum;
    } else {
        _reading.environment.humidity = NAN;
    }
    
    if (!isnan(pres) && pres > 300.0f && pres < 1100.0f) {
        _reading.environment.pressure = pres;
    } else {
        _reading.environment.pressure = NAN;
    }
    
    _reading.environment.status = SENSOR_OK;
}

void SensorManager::_readMPU6050() {
    if (!_mpuInitialized) return;
    
    int16_t ax, ay, az, gx, gy, gz;
    _mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
    
    // Convert to physical units
    // ±4g range: sensitivity = 8192 LSB/g
    const float accelScale = 4.0f / 32768.0f;
    // ±250°/s range: sensitivity = 131 LSB/(°/s)
    const float gyroScale = 250.0f / 32768.0f;
    
    _reading.motion.accelX = ax * accelScale;
    _reading.motion.accelY = ay * accelScale;
    _reading.motion.accelZ = az * accelScale;
    _reading.motion.gyroX = gx * gyroScale;
    _reading.motion.gyroY = gy * gyroScale;
    _reading.motion.gyroZ = gz * gyroScale;
    
    // Calculate shock magnitude (resultant g-force minus gravity)
    float resultant = sqrtf(_reading.motion.accelX * _reading.motion.accelX +
                            _reading.motion.accelY * _reading.motion.accelY +
                            _reading.motion.accelZ * _reading.motion.accelZ);
    _reading.motion.shockMagnitude = fabsf(resultant - 1.0f); // Subtract 1g (gravity)
    
    _reading.motion.status = SENSOR_OK;
}

void SensorManager::_readDoor() {
    if (!_doorInitialized) return;
    
    bool currentState = digitalRead(PIN_DOOR_SENSOR) == HIGH;
    _reading.door.isOpen = currentState;
    
    if (currentState && !_doorPreviousState) {
        // Door just opened
        _doorOpenStartMs = millis();
        _reading.door.openSinceMs = _doorOpenStartMs;
    } else if (!currentState && _doorPreviousState) {
        // Door just closed
        if (_doorOpenStartMs > 0) {
            _reading.door.totalOpenDurationMs += (millis() - _doorOpenStartMs);
        }
        _reading.door.openSinceMs = 0;
        _doorOpenStartMs = 0;
    }
    
    _doorPreviousState = currentState;
    _reading.door.status = SENSOR_OK;
}

void SensorManager::_updateHealthSummary() {
    String health = "";
    int ok = 0, err = 0, na = 0;
    
    for (int i = 0; i < 3; i++) {
        switch (_reading.probes[i].status) {
            case SENSOR_OK: ok++; break;
            case SENSOR_ERROR: err++; break;
            default: na++; break;
        }
    }
    
    if (_reading.environment.status == SENSOR_OK) ok++; else if (_reading.environment.status == SENSOR_ERROR) err++; else na++;
    if (_reading.motion.status == SENSOR_OK) ok++; else if (_reading.motion.status == SENSOR_ERROR) err++; else na++;
    if (_reading.door.status == SENSOR_OK) ok++; else if (_reading.door.status == SENSOR_ERROR) err++; else na++;
    
    health = String(ok) + "OK/" + String(err) + "ERR/" + String(na) + "NA";
    _reading.sensorHealthSummary = health;
}

bool SensorManager::_isValidTemperature(float t) {
    // DS18B20 returns DEVICE_DISCONNECTED_C (-127) on error
    // and 85°C on power-on reset without proper conversion
    if (isnan(t) || t <= -126.0f || t == 85.0f) {
        return false;
    }
    // Reasonable range for cold-chain: -55°C to 125°C (DS18B20 range)
    if (t < -55.0f || t > 125.0f) {
        return false;
    }
    return true;
}

bool SensorManager::hasErrors() const {
    for (int i = 0; i < 3; i++) {
        if (_reading.probes[i].status == SENSOR_ERROR) return true;
    }
    if (_reading.environment.status == SENSOR_ERROR) return true;
    if (_reading.motion.status == SENSOR_ERROR) return true;
    if (_reading.door.status == SENSOR_ERROR) return true;
    return false;
}

String SensorManager::getHealthSummary() const {
    return _reading.sensorHealthSummary;
}

void SensorManager::scanI2C() {
    Serial.println(F("[SensorManager] I2C Scanner:"));
    int found = 0;
    for (uint8_t addr = 1; addr < 127; addr++) {
        Wire.beginTransmission(addr);
        uint8_t error = Wire.endTransmission();
        if (error == 0) {
            Serial.printf("  Device at 0x%02X", addr);
            if (addr == 0x68) Serial.print(" (DS3231 or MPU6050 default)");
            if (addr == 0x69) Serial.print(" (MPU6050 AD0=HIGH)");
            if (addr == 0x76) Serial.print(" (BME280)");
            if (addr == 0x77) Serial.print(" (BME280 alt)");
            Serial.println();
            found++;
        }
    }
    Serial.printf("[SensorManager] I2C scan complete: %d device(s) found\n", found);
}

String SensorManager::addressToString(const DeviceAddress& addr) {
    char buf[24];
    snprintf(buf, sizeof(buf), "%02X:%02X:%02X:%02X:%02X:%02X:%02X:%02X",
        addr[0], addr[1], addr[2], addr[3],
        addr[4], addr[5], addr[6], addr[7]);
    return String(buf);
}

bool SensorManager::_detectDoorSensorFloat() {
    // Rapidly sample the door sensor pin 20 times over ~100ms.
    // A properly connected sensor (with pull-up) will read consistently.
    // A floating pin will show random high/low transitions.
    int transitions = 0;
    bool lastState = digitalRead(PIN_DOOR_SENSOR) == HIGH;
    
    for (int i = 0; i < 20; i++) {
        delay(5);
        bool currentState = digitalRead(PIN_DOOR_SENSOR) == HIGH;
        if (currentState != lastState) {
            transitions++;
            lastState = currentState;
        }
    }
    
    // More than 5 transitions in 100ms = floating pin
    if (transitions > 5) {
        Serial.printf("[SensorManager] Door sensor float detected: %d transitions in 100ms\n", transitions);
        return true;
    }
    return false;
}
