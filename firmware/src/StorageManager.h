/**
 * Q-GUARD StorageManager
 * 
 * Manages MicroSD card for offline data logging.
 * Uses CSV format for data records.
 */

#ifndef STORAGE_MANAGER_H
#define STORAGE_MANAGER_H

#include <Arduino.h>
#include <SD.h>
#include <SPI.h>
#include "config.h"

enum SyncStatus {
    SYNC_PENDING = 0,
    SYNC_SUCCESS,
    SYNC_FAILED
};

struct DataRecord {
    uint32_t recordId;
    String deviceId;
    String shipmentId;
    String timestamp;
    float tempProbe1;
    float tempProbe2;
    float tempProbe3;
    float ambientTemp;
    float humidity;
    float accelX;
    float accelY;
    float accelZ;
    String doorStatus;     // "OPEN", "CLOSED", "UNKNOWN"
    double latitude;
    double longitude;
    String gpsFixStatus;   // "FIX", "NO_FIX"
    String sensorHealth;
    String riskLevel;
    String riskReasons;
    SyncStatus syncStatus;
};

class StorageManager {
public:
    StorageManager();
    
    /**
     * Initialize MicroSD card.
     */
    bool begin();
    
    /**
     * Write a data record to CSV file.
     * Returns the record ID, or 0 on failure.
     */
    uint32_t writeRecord(const DataRecord& record);
    
    /**
     * Get unsynchronized records for batch upload.
     * Returns number of records read.
     */
    int getUnsyncedRecords(DataRecord* records, int maxRecords);
    
    /**
     * Mark records as synchronized.
     */
    bool markSynced(uint32_t fromId, uint32_t toId);
    
    /**
     * Get total number of records.
     */
    uint32_t getTotalRecords() const;
    
    /**
     * Get number of unsynced records.
     */
    uint32_t getUnsyncedCount() const;
    
    /**
     * Check if SD card is available.
     */
    bool isAvailable() const;
    
    /**
     * Get free space in MB (approximate).
     */
    float getFreeSpaceMB() const;
    
    /**
     * Get used space in MB.
     */
    float getUsedSpaceMB() const;
    
    /**
     * Get the next record ID.
     */
    uint32_t getNextRecordId() const;
    
    bool isInitialized() const { return _initialized; }

private:
    bool _initialized;
    uint32_t _nextRecordId;
    uint32_t _totalRecords;
    uint32_t _unsyncedCount;
    String _currentFile;
    
    bool _ensureDirectory();
    bool _writeCSVHeader();
    String _recordToCSV(const DataRecord& record);
    bool _parseCSVLine(const String& line, DataRecord& record);
    uint32_t _loadLastRecordId();
    void _updateSyncFile(uint32_t lastSyncedId);
    uint32_t _getLastSyncedId();
};

#endif // STORAGE_MANAGER_H
