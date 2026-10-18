/**
 * Q-GUARD ConfigManager
 * 
 * Runtime configuration management.
 * Stores/loads config from MicroSD JSON file.
 */

#ifndef CONFIG_MANAGER_H
#define CONFIG_MANAGER_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include "config.h"
#include "RiskEngine.h"

struct SystemConfig {
    // Device
    String deviceId;
    String firmwareVersion;
    
    // Network
    String wifiSSID;
    String wifiPassword;
    String serverUrl;
    String apiKey;
    
    // Sampling
    uint32_t sensorIntervalMs;
    uint32_t displayRefreshMs;
    uint32_t syncIntervalMs;
    uint32_t gpsIntervalMs;
    int syncBatchSize;
    
    // Shipment
    String shipmentId;
    String commodity;
    
    // Risk thresholds
    RiskThresholds riskThresholds;
    
    // Buzzer
    bool buzzerEnabled;
};

class ConfigManager {
public:
    ConfigManager();
    
    /**
     * Load configuration from SD card or use defaults.
     */
    bool begin();
    
    /**
     * Save current configuration to SD card.
     */
    bool save();
    
    /**
     * Get current configuration.
     */
    const SystemConfig& getConfig() const;
    
    /**
     * Get mutable reference for modification.
     */
    SystemConfig& getConfigMut();
    
    /**
     * Reset to defaults.
     */
    void resetDefaults();
    
    /**
     * Update a specific setting.
     */
    void setShipmentId(const String& id);
    void setWiFiCredentials(const String& ssid, const String& password);
    void setServerUrl(const String& url);
    void setSensorInterval(uint32_t ms);

private:
    SystemConfig _config;
    bool _loaded;
    
    void _loadDefaults();
    bool _loadFromSD();
    bool _saveToSD();
};

#endif // CONFIG_MANAGER_H
