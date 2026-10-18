/**
 * Q-GUARD NetworkManager
 * 
 * Manages Wi-Fi connectivity. Wi-Fi is optional —
 * monitoring continues without it.
 */

#ifndef NETWORK_MANAGER_H
#define NETWORK_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include "config.h"

enum NetworkState {
    NET_DISCONNECTED = 0,
    NET_CONNECTING,
    NET_CONNECTED,
    NET_ERROR
};

class NetworkManager {
public:
    NetworkManager();
    
    bool begin(const char* ssid, const char* password);
    
    /**
     * Non-blocking connection management.
     * Call in main loop.
     */
    void update();
    
    /**
     * Check if connected to Wi-Fi.
     */
    bool isConnected() const;
    
    /**
     * Get current network state.
     */
    NetworkState getState() const;
    
    /**
     * Get signal strength (RSSI).
     */
    int getRSSI() const;
    
    /**
     * Get IP address as string.
     */
    String getIP() const;
    
    /**
     * Get connection state as human-readable string.
     */
    String getStateString() const;
    
    /**
     * Disconnect from Wi-Fi.
     */
    void disconnect();
    
    /**
     * Force reconnection attempt.
     */
    void reconnect();

private:
    NetworkState _state;
    String _ssid;
    String _password;
    unsigned long _lastAttemptMs;
    unsigned long _connectStartMs;
    int _retryCount;
};

#endif // NETWORK_MANAGER_H
