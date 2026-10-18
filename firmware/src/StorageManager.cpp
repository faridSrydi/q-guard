/**
 * Q-GUARD StorageManager Implementation
 */

#include "StorageManager.h"

static const char* CSV_HEADER = "record_id,device_id,shipment_id,timestamp,"
    "temp_probe_1,temp_probe_2,temp_probe_3,ambient_temp,humidity,"
    "accel_x,accel_y,accel_z,door_status,latitude,longitude,"
    "gps_fix_status,sensor_health,risk_level,risk_reasons,sync_status";

StorageManager::StorageManager()
    : _initialized(false),
      _nextRecordId(1),
      _totalRecords(0),
      _unsyncedCount(0),
      _currentFile(SD_DATA_FILE) {
}

bool StorageManager::begin() {
    Serial.println(F("[StorageManager] Initializing MicroSD..."));
    
    // Initialize SPI for SD card
    if (!SD.begin(PIN_SD_CS)) {
        Serial.println(F("[StorageManager] MicroSD: FAILED — card not detected or SPI error"));
        Serial.println(F("[StorageManager] Check: card inserted, CS pin, SPI wiring"));
        return false;
    }
    
    uint8_t cardType = SD.cardType();
    if (cardType == CARD_NONE) {
        Serial.println(F("[StorageManager] MicroSD: No card detected"));
        return false;
    }
    
    const char* typeStr = "UNKNOWN";
    switch (cardType) {
        case CARD_MMC: typeStr = "MMC"; break;
        case CARD_SD: typeStr = "SD"; break;
        case CARD_SDHC: typeStr = "SDHC"; break;
    }
    
    Serial.printf("[StorageManager] Card type: %s, Size: %.1f MB\n",
        typeStr, SD.totalBytes() / (1024.0 * 1024.0));
    
    if (!_ensureDirectory()) {
        Serial.println(F("[StorageManager] Failed to create data directory"));
        return false;
    }
    
    // Check if data file exists; if not, create with header
    if (!SD.exists(_currentFile.c_str())) {
        if (!_writeCSVHeader()) {
            Serial.println(F("[StorageManager] Failed to write CSV header"));
            return false;
        }
    }
    
    // Load last record ID to continue sequence
    _nextRecordId = _loadLastRecordId() + 1;
    _unsyncedCount = _nextRecordId - 1 - _getLastSyncedId();
    _totalRecords = _nextRecordId - 1;
    
    _initialized = true;
    
    Serial.printf("[StorageManager] Ready — next ID: %u, unsynced: %u\n",
        _nextRecordId, _unsyncedCount);
    
    return true;
}

uint32_t StorageManager::writeRecord(const DataRecord& record) {
    if (!_initialized) {
        Serial.println(F("[StorageManager] Cannot write — not initialized"));
        return 0;
    }
    
    File file = SD.open(_currentFile.c_str(), FILE_APPEND);
    if (!file) {
        Serial.println(F("[StorageManager] Failed to open file for writing"));
        return 0;
    }
    
    // Check file size
    if (file.size() > (SD_MAX_FILE_SIZE_MB * 1024UL * 1024UL)) {
        file.close();
        Serial.println(F("[StorageManager] WARNING: Data file exceeds max size"));
        // Rotate file — rename current and start new
        String archiveName = String(SD_LOG_DIR) + "/data_" + String(_nextRecordId) + ".csv";
        SD.rename(_currentFile.c_str(), archiveName.c_str());
        _writeCSVHeader();
        file = SD.open(_currentFile.c_str(), FILE_APPEND);
        if (!file) return 0;
    }
    
    DataRecord rec = record;
    rec.recordId = _nextRecordId;
    
    String csv = _recordToCSV(rec);
    size_t written = file.println(csv);
    file.close();
    
    if (written == 0) {
        Serial.printf("[StorageManager] Write failed for record %u\n", _nextRecordId);
        return 0;
    }
    
    uint32_t id = _nextRecordId;
    _nextRecordId++;
    _totalRecords++;
    _unsyncedCount++;
    
    return id;
}

int StorageManager::getUnsyncedRecords(DataRecord* records, int maxRecords) {
    if (!_initialized || _unsyncedCount == 0) return 0;
    
    uint32_t lastSyncedId = _getLastSyncedId();
    
    File file = SD.open(_currentFile.c_str(), FILE_READ);
    if (!file) return 0;
    
    // Skip header
    file.readStringUntil('\n');
    
    int count = 0;
    while (file.available() && count < maxRecords) {
        String line = file.readStringUntil('\n');
        line.trim();
        if (line.length() == 0) continue;
        
        DataRecord rec;
        if (_parseCSVLine(line, rec)) {
            if (rec.recordId > lastSyncedId) {
                records[count] = rec;
                count++;
            }
        }
    }
    
    file.close();
    return count;
}

bool StorageManager::markSynced(uint32_t fromId, uint32_t toId) {
    if (!_initialized) return false;
    
    _updateSyncFile(toId);
    
    uint32_t synced = toId - fromId + 1;
    if (_unsyncedCount >= synced) {
        _unsyncedCount -= synced;
    } else {
        _unsyncedCount = 0;
    }
    
    Serial.printf("[StorageManager] Marked synced: %u to %u (%u remaining)\n",
        fromId, toId, _unsyncedCount);
    
    return true;
}

uint32_t StorageManager::getTotalRecords() const {
    return _totalRecords;
}

uint32_t StorageManager::getUnsyncedCount() const {
    return _unsyncedCount;
}

bool StorageManager::isAvailable() const {
    return _initialized;
}

float StorageManager::getFreeSpaceMB() const {
    if (!_initialized) return 0;
    return (SD.totalBytes() - SD.usedBytes()) / (1024.0 * 1024.0);
}

float StorageManager::getUsedSpaceMB() const {
    if (!_initialized) return 0;
    return SD.usedBytes() / (1024.0 * 1024.0);
}

uint32_t StorageManager::getNextRecordId() const {
    return _nextRecordId;
}

bool StorageManager::_ensureDirectory() {
    if (!SD.exists(SD_LOG_DIR)) {
        return SD.mkdir(SD_LOG_DIR);
    }
    return true;
}

bool StorageManager::_writeCSVHeader() {
    File file = SD.open(_currentFile.c_str(), FILE_WRITE);
    if (!file) return false;
    file.println(CSV_HEADER);
    file.close();
    return true;
}

String StorageManager::_recordToCSV(const DataRecord& record) {
    String csv;
    csv.reserve(300);
    
    csv += String(record.recordId);
    csv += ",";
    csv += record.deviceId;
    csv += ",";
    csv += record.shipmentId;
    csv += ",";
    csv += record.timestamp;
    csv += ",";
    
    // Temperature probes — use empty string for NAN, not zero
    if (!isnan(record.tempProbe1)) csv += String(record.tempProbe1, 2); 
    csv += ",";
    if (!isnan(record.tempProbe2)) csv += String(record.tempProbe2, 2);
    csv += ",";
    if (!isnan(record.tempProbe3)) csv += String(record.tempProbe3, 2);
    csv += ",";
    if (!isnan(record.ambientTemp)) csv += String(record.ambientTemp, 2);
    csv += ",";
    if (!isnan(record.humidity)) csv += String(record.humidity, 2);
    csv += ",";
    
    // Accelerometer
    if (!isnan(record.accelX)) csv += String(record.accelX, 3);
    csv += ",";
    if (!isnan(record.accelY)) csv += String(record.accelY, 3);
    csv += ",";
    if (!isnan(record.accelZ)) csv += String(record.accelZ, 3);
    csv += ",";
    
    csv += record.doorStatus;
    csv += ",";
    
    // GPS
    if (!isnan(record.latitude)) csv += String(record.latitude, 6);
    csv += ",";
    if (!isnan(record.longitude)) csv += String(record.longitude, 6);
    csv += ",";
    
    csv += record.gpsFixStatus;
    csv += ",";
    csv += record.sensorHealth;
    csv += ",";
    csv += record.riskLevel;
    csv += ",\"";
    csv += record.riskReasons;
    csv += "\",";
    csv += String((int)record.syncStatus);
    
    return csv;
}

bool StorageManager::_parseCSVLine(const String& line, DataRecord& record) {
    // Simple CSV parsing (no embedded commas except in quoted risk_reasons)
    int fieldStart = 0;
    int fieldIndex = 0;
    String fields[20];
    bool inQuotes = false;
    
    for (int i = 0; i <= (int)line.length(); i++) {
        char c = (i < (int)line.length()) ? line.charAt(i) : ',';
        
        if (c == '"') {
            inQuotes = !inQuotes;
        } else if (c == ',' && !inQuotes) {
            if (fieldIndex < 20) {
                fields[fieldIndex] = line.substring(fieldStart, i);
                fields[fieldIndex].replace("\"", "");
                fields[fieldIndex].trim();
            }
            fieldIndex++;
            fieldStart = i + 1;
        }
    }
    
    if (fieldIndex < 19) return false; // Not enough fields
    
    record.recordId = fields[0].toInt();
    record.deviceId = fields[1];
    record.shipmentId = fields[2];
    record.timestamp = fields[3];
    record.tempProbe1 = fields[4].length() > 0 ? fields[4].toFloat() : NAN;
    record.tempProbe2 = fields[5].length() > 0 ? fields[5].toFloat() : NAN;
    record.tempProbe3 = fields[6].length() > 0 ? fields[6].toFloat() : NAN;
    record.ambientTemp = fields[7].length() > 0 ? fields[7].toFloat() : NAN;
    record.humidity = fields[8].length() > 0 ? fields[8].toFloat() : NAN;
    record.accelX = fields[9].length() > 0 ? fields[9].toFloat() : NAN;
    record.accelY = fields[10].length() > 0 ? fields[10].toFloat() : NAN;
    record.accelZ = fields[11].length() > 0 ? fields[11].toFloat() : NAN;
    record.doorStatus = fields[12];
    record.latitude = fields[13].length() > 0 ? fields[13].toDouble() : NAN;
    record.longitude = fields[14].length() > 0 ? fields[14].toDouble() : NAN;
    record.gpsFixStatus = fields[15];
    record.sensorHealth = fields[16];
    record.riskLevel = fields[17];
    record.riskReasons = fields[18];
    record.syncStatus = (SyncStatus)fields[19].toInt();
    
    return record.recordId > 0;
}

uint32_t StorageManager::_loadLastRecordId() {
    File file = SD.open(_currentFile.c_str(), FILE_READ);
    if (!file) return 0;
    
    uint32_t lastId = 0;
    // Skip header
    file.readStringUntil('\n');
    
    while (file.available()) {
        String line = file.readStringUntil('\n');
        line.trim();
        if (line.length() == 0) continue;
        
        int commaPos = line.indexOf(',');
        if (commaPos > 0) {
            uint32_t id = line.substring(0, commaPos).toInt();
            if (id > lastId) lastId = id;
        }
    }
    
    file.close();
    return lastId;
}

void StorageManager::_updateSyncFile(uint32_t lastSyncedId) {
    String syncFile = String(SD_LOG_DIR) + "/sync.txt";
    File file = SD.open(syncFile.c_str(), FILE_WRITE);
    if (file) {
        file.println(lastSyncedId);
        file.close();
    }
}

uint32_t StorageManager::_getLastSyncedId() {
    String syncFile = String(SD_LOG_DIR) + "/sync.txt";
    File file = SD.open(syncFile.c_str(), FILE_READ);
    if (!file) return 0;
    
    String line = file.readStringUntil('\n');
    file.close();
    line.trim();
    return line.toInt();
}
