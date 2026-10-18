/**
 * Q-GUARD NetworkManager Implementation
 */

#include "NetworkManager.h"

NetworkManager::NetworkManager()
    : _state(NET_DISCONNECTED),
      _lastAttemptMs(0),
      _connectStartMs(0),
      _retryCount(0) {
}

bool NetworkManager::begin(const char* ssid, const char* password) {
    _ssid = String(ssid);
    _password = String(password);
    
    if (_ssid.length() == 0) {
        Serial.println(F("[NetworkManager] No SSID configured — WiFi disabled"));
        _state = NET_DISCONNECTED;
        return false;
    }
    
    Serial.printf("[NetworkManager] Connecting to: %s\n", ssid);
    
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.begin(ssid, password);
    
    _state = NET_CONNECTING;
    _connectStartMs = millis();
    _lastAttemptMs = millis();
    
    return true;
}

void NetworkManager::update() {
    wl_status_t wifiStatus = WiFi.status();
    
    switch (_state) {
        case NET_CONNECTING:
            if (wifiStatus == WL_CONNECTED) {
                _state = NET_CONNECTED;
                _retryCount = 0;
                Serial.printf("[NetworkManager] Connected — IP: %s, RSSI: %d dBm\n",
                    WiFi.localIP().toString().c_str(), WiFi.RSSI());
            } else if (millis() - _connectStartMs > WIFI_CONNECT_TIMEOUT_MS) {
                _state = NET_DISCONNECTED;
                _retryCount++;
                Serial.printf("[NetworkManager] Connection timeout (attempt %d)\n", _retryCount);
            }
            break;
            
        case NET_CONNECTED:
            if (wifiStatus != WL_CONNECTED) {
                _state = NET_DISCONNECTED;
                Serial.println(F("[NetworkManager] Connection lost"));
            }
            break;
            
        case NET_DISCONNECTED:
            // Auto-retry
            if (_ssid.length() > 0 && 
                (millis() - _lastAttemptMs) > WIFI_RETRY_INTERVAL_MS) {
                reconnect();
            }
            break;
            
        case NET_ERROR:
            break;
    }
}

bool NetworkManager::isConnected() const {
    return WiFi.status() == WL_CONNECTED;
}

NetworkState NetworkManager::getState() const {
    return _state;
}

int NetworkManager::getRSSI() const {
    if (!isConnected()) return 0;
    return WiFi.RSSI();
}

String NetworkManager::getIP() const {
    if (!isConnected()) return "N/A";
    return WiFi.localIP().toString();
}

String NetworkManager::getStateString() const {
    switch (_state) {
        case NET_DISCONNECTED: return "Disconnected";
        case NET_CONNECTING:   return "Connecting...";
        case NET_CONNECTED:    return "Connected";
        case NET_ERROR:        return "Error";
        default:               return "Unknown";
    }
}

void NetworkManager::disconnect() {
    WiFi.disconnect();
    _state = NET_DISCONNECTED;
    Serial.println(F("[NetworkManager] Disconnected"));
}

void NetworkManager::reconnect() {
    if (_ssid.length() == 0) return;
    
    Serial.printf("[NetworkManager] Reconnecting to %s...\n", _ssid.c_str());
    WiFi.disconnect();
    WiFi.begin(_ssid.c_str(), _password.c_str());
    _state = NET_CONNECTING;
    _connectStartMs = millis();
    _lastAttemptMs = millis();
}
