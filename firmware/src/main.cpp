/**
 * Q-GUARD Main Application
 * 
 * System initialization, main loop, and module coordination.
 */

#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <esp_task_wdt.h>

#include "config.h"
#include "SensorManager.h"
#include "TimeManager.h"
#include "GPSManager.h"
#include "StorageManager.h"
#include "NetworkManager.h"
#include "SyncManager.h"
#include "RiskEngine.h"
#include "AlarmManager.h"
#include "DisplayManager.h"
#include "ConfigManager.h"

// Module instances
SensorManager sensorMgr;
TimeManager timeMgr;
GPSManager gpsMgr;
StorageManager storageMgr;
NetworkManager networkMgr;
SyncManager syncMgr(storageMgr, networkMgr);
RiskEngine riskEngine;
AlarmManager alarmMgr;
DisplayManager displayMgr;
ConfigManager configMgr;

// Timing
unsigned long lastSensorReadMs = 0;
unsigned long lastDisplayUpdateMs = 0;
unsigned long lastGPSCheckMs = 0;
unsigned long lastSyncCheckMs = 0;

// Touch state
bool touchActive = false;
unsigned long lastTouchMs = 0;

// System state
bool systemReady = false;
int initErrors = 0;

void setup() {
    Serial.begin(SERIAL_BAUD);
    delay(500); // Let serial stabilize
    
    Serial.println(F(""));
    Serial.println(F("========================================"));
    Serial.println(F("  Q-GUARD Cold-Chain Risk Monitoring"));
    Serial.printf("  Firmware v%s\n", FIRMWARE_VERSION);
    Serial.printf("  Device: %s\n", DEVICE_ID);
    Serial.println(F("========================================"));
    Serial.println(F(""));
    
    // Initialize I2C
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    Wire.setClock(100000); // 100kHz — safe for all devices
    Serial.println(F("[Main] I2C initialized"));
    
    // Initialize SPI (shared by TFT, Touch, SD)
    SPI.begin(PIN_SPI_SCK, PIN_SPI_MISO, PIN_SPI_MOSI);
    Serial.println(F("[Main] SPI initialized"));
    
    // Initialize display first for visual feedback
    if (displayMgr.begin()) {
        displayMgr.showSplash();
        Serial.println(F("[Main] Display: OK"));
    } else {
        Serial.println(F("[Main] Display: FAILED"));
        initErrors++;
    }
    
    // Alarm self-test
    alarmMgr.begin();
    alarmMgr.selfTest();
    
    // Button inputs
    pinMode(PIN_BUTTON_1, INPUT);
    pinMode(PIN_BUTTON_2, INPUT);
    pinMode(PIN_BUTTON_3, INPUT);
    
    delay(1000); // Show splash
    
    // I2C scan for debugging
    sensorMgr.scanI2C();
    
    // Initialize storage (needed before config)
    if (storageMgr.begin()) {
        Serial.println(F("[Main] Storage: OK"));
    } else {
        Serial.println(F("[Main] Storage: FAILED — data will not be logged"));
        initErrors++;
    }
    
    // Load configuration
    configMgr.begin();
    const SystemConfig& cfg = configMgr.getConfig();
    
    // Initialize sensors
    if (sensorMgr.begin()) {
        Serial.println(F("[Main] Sensors: OK"));
    } else {
        Serial.println(F("[Main] Sensors: FAILED — no sensors detected"));
        initErrors++;
    }
    
    // Initialize RTC
    if (timeMgr.begin()) {
        Serial.println(F("[Main] Time: OK"));
    } else {
        Serial.println(F("[Main] Time: FAILED — using millis() fallback"));
        initErrors++;
    }
    
    // Initialize GPS
    if (gpsMgr.begin()) {
        Serial.println(F("[Main] GPS: OK (waiting for fix)"));
    } else {
        Serial.println(F("[Main] GPS: FAILED"));
        initErrors++;
    }
    
    // Initialize risk engine
    riskEngine.begin();
    riskEngine.setThresholds(cfg.riskThresholds);
    
    // Initialize network (optional)
    if (cfg.wifiSSID.length() > 0) {
        networkMgr.begin(cfg.wifiSSID.c_str(), cfg.wifiPassword.c_str());
    } else {
        Serial.println(F("[Main] WiFi: Not configured — offline mode"));
    }
    
    // Initialize sync
    if (cfg.serverUrl.length() > 0) {
        syncMgr.begin(cfg.serverUrl, cfg.apiKey);
    }
    
    // Enable Task Watchdog Timer (30s)
#if defined(ESP_IDF_VERSION_MAJOR) && ESP_IDF_VERSION_MAJOR >= 5
    esp_task_wdt_config_t twdt_config = {
        .timeout_ms = WATCHDOG_TIMEOUT_S * 1000,
        .idle_core_mask = 0,
        .trigger_panic = true
    };
    esp_task_wdt_init(&twdt_config);
#else
    esp_task_wdt_init(WATCHDOG_TIMEOUT_S, true);
#endif
    esp_task_wdt_add(NULL);
    Serial.printf("[Main] Watchdog enabled (%ds timeout)\n", WATCHDOG_TIMEOUT_S);
    
    systemReady = true;
    
    Serial.println(F(""));
    Serial.printf("[Main] Initialization complete — %d error(s)\n", initErrors);
    Serial.printf("[Main] Sensor interval: %u ms\n", cfg.sensorIntervalMs);
    Serial.println(F("[Main] Entering main loop..."));
    Serial.println(F(""));
    
    displayMgr.forceRedraw();
}

void loop() {
    unsigned long now = millis();
    const SystemConfig& cfg = configMgr.getConfig();
    
    // === GPS update (continuous) ===
    gpsMgr.update();
    
    // GPS time sync to RTC
    if (gpsMgr.hasValidTime() && !timeMgr.isTimeValid()) {
        const GPSData& gps = gpsMgr.getData();
        timeMgr.syncFromGPS(gps.year, gps.month, gps.day,
                           gps.hour, gps.minute, gps.second);
    }
    
    // === Sensor reading ===
    if (now - lastSensorReadMs >= cfg.sensorIntervalMs) {
        lastSensorReadMs = now;
        
        // Read all sensors
        sensorMgr.readAll();
        const SensorReading& reading = sensorMgr.getReading();
        
        // Evaluate risk
        RiskResult risk = riskEngine.evaluate(reading);
        
        // Update alarms
        alarmMgr.update(risk.level, sensorMgr.hasErrors());
        
        // Log to SD card
        if (storageMgr.isAvailable()) {
            DataRecord record;
            record.deviceId = cfg.deviceId;
            record.shipmentId = cfg.shipmentId.length() > 0 ? cfg.shipmentId : "UNASSIGNED";
            record.timestamp = timeMgr.getTimestamp();
            
            record.tempProbe1 = reading.probes[0].status == SENSOR_OK ? reading.probes[0].temperature : NAN;
            record.tempProbe2 = reading.probes[1].status == SENSOR_OK ? reading.probes[1].temperature : NAN;
            record.tempProbe3 = reading.probes[2].status == SENSOR_OK ? reading.probes[2].temperature : NAN;
            record.ambientTemp = reading.environment.status == SENSOR_OK ? reading.environment.temperature : NAN;
            record.humidity = reading.environment.status == SENSOR_OK ? reading.environment.humidity : NAN;
            record.accelX = reading.motion.status == SENSOR_OK ? reading.motion.accelX : NAN;
            record.accelY = reading.motion.status == SENSOR_OK ? reading.motion.accelY : NAN;
            record.accelZ = reading.motion.status == SENSOR_OK ? reading.motion.accelZ : NAN;
            record.doorStatus = reading.door.status == SENSOR_OK ? (reading.door.isOpen ? "OPEN" : "CLOSED") : "UNKNOWN";
            
            const GPSData& gps = gpsMgr.getData();
            record.latitude = gps.hasFix ? gps.latitude : NAN;
            record.longitude = gps.hasFix ? gps.longitude : NAN;
            record.gpsFixStatus = gps.hasFix ? "FIX" : "NO_FIX";
            
            record.sensorHealth = sensorMgr.getHealthSummary();
            record.riskLevel = RiskEngine::levelToString(risk.level);
            record.riskReasons = risk.reasons;
            record.syncStatus = SYNC_PENDING;
            
            uint32_t id = storageMgr.writeRecord(record);
            if (id > 0) {
                // Log every 10th record to avoid serial flooding
                if (id % 10 == 0) {
                    Serial.printf("[Main] Record %u saved\n", id);
                }
            }
        }
    }
    
    // === Network management ===
    networkMgr.update();
    
    // === Sync management ===
    syncMgr.update();
    
    // === Display update ===
    if (now - lastDisplayUpdateMs >= cfg.displayRefreshMs) {
        lastDisplayUpdateMs = now;
        
        displayMgr.update(
            sensorMgr.getReading(),
            gpsMgr.getData(),
            riskEngine.getLastResult(),
            timeMgr.getTimestamp(),
            networkMgr,
            storageMgr,
            syncMgr.getStats()
        );
    }
    
    // === Touch handling (polling) ===
    // XPT2046 touch via TFT_eSPI
    uint16_t tx, ty;
    if (displayMgr.getTFT().getTouch(&tx, &ty)) {
        if (!touchActive && (now - lastTouchMs > 300)) { // Debounce
            touchActive = true;
            lastTouchMs = now;
            displayMgr.processTouch(tx, ty);
        }
    } else {
        touchActive = false;
    }
    
    // === Button handling ===
    // Button 1: Next page
    if (digitalRead(PIN_BUTTON_1) == LOW) {
        delay(BUTTON_DEBOUNCE_MS);
        if (digitalRead(PIN_BUTTON_1) == LOW) {
            displayMgr.nextPage();
            displayMgr.forceRedraw();
            while (digitalRead(PIN_BUTTON_1) == LOW) { delay(10); }
        }
    }
    
    // Button 2: Previous page
    if (digitalRead(PIN_BUTTON_2) == LOW) {
        delay(BUTTON_DEBOUNCE_MS);
        if (digitalRead(PIN_BUTTON_2) == LOW) {
            displayMgr.prevPage();
            displayMgr.forceRedraw();
            while (digitalRead(PIN_BUTTON_2) == LOW) { delay(10); }
        }
    }
    
    // Button 3: Silence buzzer / Force sync
    if (digitalRead(PIN_BUTTON_3) == LOW) {
        delay(BUTTON_DEBOUNCE_MS);
        if (digitalRead(PIN_BUTTON_3) == LOW) {
            if (alarmMgr.isBuzzerSilenced()) {
                syncMgr.syncNow();
            } else {
                alarmMgr.silenceBuzzer();
            }
            while (digitalRead(PIN_BUTTON_3) == LOW) { delay(10); }
        }
    }
    
    // Feed watchdog — must happen every loop iteration
    esp_task_wdt_reset();
    
    // Small yield for WiFi stack
    delay(1);
}
