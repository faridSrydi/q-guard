/**
 * Q-GUARD ConfigManager Implementation
 */

#include "ConfigManager.h"
#include <SD.h>

ConfigManager::ConfigManager() : _loaded(false) {
    _loadDefaults();
}

bool ConfigManager::begin() {
    Serial.println(F("[ConfigManager] Loading configuration..."));
    
    if (_loadFromSD()) {
        _loaded = true;
        Serial.println(F("[ConfigManager] Loaded from SD card"));
    } else {
        _loaded = true; // Use defaults
        Serial.println(F("[ConfigManager] Using default configuration"));
    }
    
    return true;
}

bool ConfigManager::save() {
    return _saveToSD();
}

const SystemConfig& ConfigManager::getConfig() const {
    return _config;
}

SystemConfig& ConfigManager::getConfigMut() {
    return _config;
}

void ConfigManager::resetDefaults() {
    _loadDefaults();
    Serial.println(F("[ConfigManager] Reset to defaults"));
}

void ConfigManager::setShipmentId(const String& id) {
    _config.shipmentId = id;
}

void ConfigManager::setWiFiCredentials(const String& ssid, const String& password) {
    _config.wifiSSID = ssid;
    _config.wifiPassword = password;
}

void ConfigManager::setServerUrl(const String& url) {
    _config.serverUrl = url;
}

void ConfigManager::setSensorInterval(uint32_t ms) {
    if (ms >= 1000 && ms <= 60000) {
        _config.sensorIntervalMs = ms;
    }
}

void ConfigManager::_loadDefaults() {
    _config.deviceId = DEVICE_ID;
    _config.firmwareVersion = FIRMWARE_VERSION;
    _config.wifiSSID = WIFI_SSID;
    _config.wifiPassword = WIFI_PASSWORD;
    _config.serverUrl = BACKEND_URL;
    _config.apiKey = BACKEND_API_KEY;
    _config.sensorIntervalMs = SENSOR_SAMPLE_INTERVAL_MS;
    _config.displayRefreshMs = DISPLAY_REFRESH_INTERVAL_MS;
    _config.syncIntervalMs = SYNC_INTERVAL_MS;
    _config.gpsIntervalMs = GPS_READ_INTERVAL_MS;
    _config.syncBatchSize = SYNC_BATCH_SIZE;
    _config.shipmentId = "";
    _config.commodity = "Frozen Fish";
    _config.buzzerEnabled = true;
    
    _config.riskThresholds.tempMin = TEMP_MIN_DEFAULT;
    _config.riskThresholds.tempMax = TEMP_MAX_DEFAULT;
    _config.riskThresholds.tempDeviationDurationS = TEMP_DEVIATION_DURATION_S;
    _config.riskThresholds.humidityMin = HUMIDITY_MIN_DEFAULT;
    _config.riskThresholds.humidityMax = HUMIDITY_MAX_DEFAULT;
    _config.riskThresholds.shockThresholdG = SHOCK_THRESHOLD_G;
    _config.riskThresholds.doorOpenMaxS = DOOR_OPEN_MAX_S;
}

bool ConfigManager::_loadFromSD() {
    File file = SD.open(SD_CONFIG_FILE, FILE_READ);
    if (!file) return false;
    
    StaticJsonDocument<1024> doc;
    DeserializationError error = deserializeJson(doc, file);
    file.close();
    
    if (error) {
        Serial.printf("[ConfigManager] JSON parse error: %s\n", error.c_str());
        return false;
    }
    
    // Load values, keeping defaults for missing fields
    if (doc.containsKey("device_id")) _config.deviceId = doc["device_id"].as<String>();
    if (doc.containsKey("wifi_ssid")) _config.wifiSSID = doc["wifi_ssid"].as<String>();
    if (doc.containsKey("wifi_password")) _config.wifiPassword = doc["wifi_password"].as<String>();
    if (doc.containsKey("server_url")) _config.serverUrl = doc["server_url"].as<String>();
    if (doc.containsKey("api_key")) _config.apiKey = doc["api_key"].as<String>();
    if (doc.containsKey("sensor_interval_ms")) _config.sensorIntervalMs = doc["sensor_interval_ms"];
    if (doc.containsKey("sync_interval_ms")) _config.syncIntervalMs = doc["sync_interval_ms"];
    if (doc.containsKey("shipment_id")) _config.shipmentId = doc["shipment_id"].as<String>();
    if (doc.containsKey("commodity")) _config.commodity = doc["commodity"].as<String>();
    if (doc.containsKey("buzzer_enabled")) _config.buzzerEnabled = doc["buzzer_enabled"];
    
    if (doc.containsKey("thresholds")) {
        JsonObject t = doc["thresholds"];
        if (t.containsKey("temp_min")) _config.riskThresholds.tempMin = t["temp_min"];
        if (t.containsKey("temp_max")) _config.riskThresholds.tempMax = t["temp_max"];
        if (t.containsKey("temp_deviation_s")) _config.riskThresholds.tempDeviationDurationS = t["temp_deviation_s"];
        if (t.containsKey("humidity_min")) _config.riskThresholds.humidityMin = t["humidity_min"];
        if (t.containsKey("humidity_max")) _config.riskThresholds.humidityMax = t["humidity_max"];
        if (t.containsKey("shock_g")) _config.riskThresholds.shockThresholdG = t["shock_g"];
        if (t.containsKey("door_open_max_s")) _config.riskThresholds.doorOpenMaxS = t["door_open_max_s"];
    }
    
    return true;
}

bool ConfigManager::_saveToSD() {
    StaticJsonDocument<1024> doc;
    
    doc["device_id"] = _config.deviceId;
    doc["wifi_ssid"] = _config.wifiSSID;
    // Don't save password to prevent accidental exposure in logs
    doc["server_url"] = _config.serverUrl;
    doc["sensor_interval_ms"] = _config.sensorIntervalMs;
    doc["sync_interval_ms"] = _config.syncIntervalMs;
    doc["shipment_id"] = _config.shipmentId;
    doc["commodity"] = _config.commodity;
    doc["buzzer_enabled"] = _config.buzzerEnabled;
    
    JsonObject t = doc.createNestedObject("thresholds");
    t["temp_min"] = _config.riskThresholds.tempMin;
    t["temp_max"] = _config.riskThresholds.tempMax;
    t["temp_deviation_s"] = _config.riskThresholds.tempDeviationDurationS;
    t["humidity_min"] = _config.riskThresholds.humidityMin;
    t["humidity_max"] = _config.riskThresholds.humidityMax;
    t["shock_g"] = _config.riskThresholds.shockThresholdG;
    t["door_open_max_s"] = _config.riskThresholds.doorOpenMaxS;
    
    File file = SD.open(SD_CONFIG_FILE, FILE_WRITE);
    if (!file) {
        Serial.println(F("[ConfigManager] Failed to save config"));
        return false;
    }
    
    serializeJsonPretty(doc, file);
    file.close();
    
    Serial.println(F("[ConfigManager] Config saved to SD"));
    return true;
}
