/**
 * Q-GUARD SyncManager Implementation
 */

#include "SyncManager.h"

SyncManager::SyncManager(StorageManager& storage, NetworkManager& network)
    : _storage(storage),
      _network(network),
      _state(SYNC_IDLE),
      _lastSyncAttemptMs(0),
      _nextRetryMs(0),
      _retryCount(0) {
    memset(&_stats, 0, sizeof(_stats));
}

bool SyncManager::begin(const String& serverUrl, const String& apiKey) {
    _serverUrl = serverUrl;
    _apiKey = apiKey;
    
    if (_serverUrl.length() == 0) {
        Serial.println(F("[SyncManager] No server URL configured — sync disabled"));
        _state = SYNC_DISABLED;
        return false;
    }
    
    _state = SYNC_IDLE;
    Serial.printf("[SyncManager] Ready — server: %s\n", _serverUrl.c_str());
    return true;
}

void SyncManager::update() {
    if (_state == SYNC_DISABLED) return;
    if (!_network.isConnected()) return;
    
    unsigned long now = millis();
    
    switch (_state) {
        case SYNC_IDLE:
            if (_storage.getUnsyncedCount() > 0 &&
                (now - _lastSyncAttemptMs) > SYNC_INTERVAL_MS) {
                _state = SYNC_UPLOADING;
                _uploadBatch();
            }
            break;
            
        case SYNC_UPLOADING:
            // uploadBatch is synchronous but bounded
            _state = SYNC_IDLE;
            break;
            
        case SYNC_WAITING_RETRY:
            if (now > _nextRetryMs) {
                _state = SYNC_UPLOADING;
                _uploadBatch();
            }
            break;
            
        default:
            break;
    }
}

void SyncManager::syncNow() {
    if (_state == SYNC_DISABLED) return;
    if (!_network.isConnected()) {
        Serial.println(F("[SyncManager] Cannot sync — no network"));
        return;
    }
    
    _state = SYNC_UPLOADING;
    _uploadBatch();
    _state = SYNC_IDLE;
}

const SyncStats& SyncManager::getStats() const {
    return _stats;
}

SyncState SyncManager::getState() const {
    return _state;
}

String SyncManager::getStateString() const {
    switch (_state) {
        case SYNC_IDLE:           return "Idle";
        case SYNC_UPLOADING:      return "Uploading...";
        case SYNC_WAITING_RETRY:  return "Waiting retry";
        case SYNC_DISABLED:       return "Disabled";
        default:                  return "Unknown";
    }
}

bool SyncManager::isSyncing() const {
    return _state == SYNC_UPLOADING;
}

bool SyncManager::_uploadBatch() {
    _lastSyncAttemptMs = millis();
    
    DataRecord records[SYNC_BATCH_SIZE];
    int count = _storage.getUnsyncedRecords(records, SYNC_BATCH_SIZE);
    
    if (count == 0) {
        return true;
    }
    
    Serial.printf("[SyncManager] Uploading batch of %d records...\n", count);
    
    String payload = _buildPayload(records, count);
    
    HTTPClient http;
    String url = _serverUrl + "/api/sensor-data/batch";
    
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    if (_apiKey.length() > 0) {
        http.addHeader("X-API-Key", _apiKey);
    }
    http.setTimeout(10000); // 10 second timeout
    
    int httpCode = http.POST(payload);
    
    if (httpCode == 200 || httpCode == 201) {
        // Success — mark records as synced
        uint32_t fromId = records[0].recordId;
        uint32_t toId = records[count - 1].recordId;
        _storage.markSynced(fromId, toId);
        
        _stats.totalSynced += count;
        _stats.lastSyncMs = millis();
        _stats.consecutiveFailures = 0;
        _retryCount = 0;
        
        String response = http.getString();
        int shipIdx = response.indexOf("\"active_shipment\":");
        if (shipIdx > 0 && response.indexOf("\"active_shipment\":null") < 0) {
            int commIdx = response.indexOf("\"commodity\":\"", shipIdx);
            if (commIdx > 0) {
                commIdx += 13;
                int commEnd = response.indexOf("\"", commIdx);
                if (commEnd > commIdx) {
                    String remoteCommodity = response.substring(commIdx, commEnd);
                    Serial.printf("[SyncManager] Active shipment from server: %s\n", remoteCommodity.c_str());
                }
            }
        }
        
        http.end();
        return true;
    } else {
        // Failure
        _stats.totalFailed += count;
        _stats.consecutiveFailures++;
        _retryCount++;
        
        String errorMsg = http.errorToString(httpCode);
        _stats.lastError = "HTTP " + String(httpCode) + ": " + errorMsg;
        
        Serial.printf("[SyncManager] Upload failed: %s (retry %d)\n",
            _stats.lastError.c_str(), _retryCount);
        
        http.end();
        
        if (_retryCount < SYNC_RETRY_MAX) {
            _nextRetryMs = millis() + _getBackoffDelay();
            _state = SYNC_WAITING_RETRY;
        } else {
            Serial.println(F("[SyncManager] Max retries reached — will try next cycle"));
            _retryCount = 0;
            _state = SYNC_IDLE;
        }
        
        return false;
    }
}

unsigned long SyncManager::_getBackoffDelay() const {
    // Exponential backoff: base * 2^retry, capped at 60 seconds
    unsigned long delay = SYNC_RETRY_BASE_MS * (1UL << min(_retryCount, 6));
    if (delay > 60000UL) delay = 60000UL;
    return delay;
}

String SyncManager::_buildPayload(DataRecord* records, int count) {
    DynamicJsonDocument doc(count * 512 + 256);
    
    doc["device_id"] = records[0].deviceId;
    doc["batch_size"] = count;
    
    JsonArray arr = doc.createNestedArray("readings");
    
    for (int i = 0; i < count; i++) {
        JsonObject obj = arr.createNestedObject();
        obj["record_id"] = records[i].recordId;
        obj["shipment_id"] = records[i].shipmentId;
        obj["timestamp"] = records[i].timestamp;
        
        if (!isnan(records[i].tempProbe1)) obj["temperature_probe_1"] = records[i].tempProbe1;
        if (!isnan(records[i].tempProbe2)) obj["temperature_probe_2"] = records[i].tempProbe2;
        if (!isnan(records[i].tempProbe3)) obj["temperature_probe_3"] = records[i].tempProbe3;
        if (!isnan(records[i].ambientTemp)) obj["ambient_temperature"] = records[i].ambientTemp;
        if (!isnan(records[i].humidity)) obj["relative_humidity"] = records[i].humidity;
        if (!isnan(records[i].accelX)) obj["acceleration_x"] = records[i].accelX;
        if (!isnan(records[i].accelY)) obj["acceleration_y"] = records[i].accelY;
        if (!isnan(records[i].accelZ)) obj["acceleration_z"] = records[i].accelZ;
        obj["door_status"] = records[i].doorStatus;
        if (!isnan(records[i].latitude)) obj["latitude"] = records[i].latitude;
        if (!isnan(records[i].longitude)) obj["longitude"] = records[i].longitude;
        obj["gps_fix_status"] = records[i].gpsFixStatus;
        obj["sensor_health"] = records[i].sensorHealth;
        obj["risk_level"] = records[i].riskLevel;
        obj["risk_reasons"] = records[i].riskReasons;
    }
    
    String output;
    serializeJson(doc, output);
    return output;
}
