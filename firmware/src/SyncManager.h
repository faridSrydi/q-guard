/**
 * Q-GUARD SyncManager
 * 
 * Synchronizes locally stored data with backend server.
 * Non-blocking with exponential backoff retry.
 */

#ifndef SYNC_MANAGER_H
#define SYNC_MANAGER_H

#include <Arduino.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"
#include "StorageManager.h"
#include "NetworkManager.h"

enum SyncState {
    SYNC_IDLE = 0,
    SYNC_UPLOADING,
    SYNC_WAITING_RETRY,
    SYNC_DISABLED
};

struct SyncStats {
    uint32_t totalSynced;
    uint32_t totalFailed;
    uint32_t pendingRecords;
    unsigned long lastSyncMs;
    String lastError;
    int consecutiveFailures;
};

class SyncManager {
public:
    SyncManager(StorageManager& storage, NetworkManager& network);
    
    bool begin(const String& serverUrl, const String& apiKey);
    
    /**
     * Non-blocking sync update. Call in main loop.
     */
    void update();
    
    /**
     * Force a sync attempt now.
     */
    void syncNow();
    
    /**
     * Get sync statistics.
     */
    const SyncStats& getStats() const;
    
    /**
     * Get current sync state.
     */
    SyncState getState() const;
    
    /**
     * Get state as human-readable string.
     */
    String getStateString() const;
    
    /**
     * Check if sync is actively working.
     */
    bool isSyncing() const;

private:
    StorageManager& _storage;
    NetworkManager& _network;
    
    SyncState _state;
    SyncStats _stats;
    String _serverUrl;
    String _apiKey;
    
    unsigned long _lastSyncAttemptMs;
    unsigned long _nextRetryMs;
    int _retryCount;
    
    bool _uploadBatch();
    unsigned long _getBackoffDelay() const;
    String _buildPayload(DataRecord* records, int count);
};

#endif // SYNC_MANAGER_H
