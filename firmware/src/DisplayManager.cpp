/**
 * Q-GUARD DisplayManager Implementation
 * 
 * Page-based UI for TFT ILI9341 320×240.
 * Uses TFT_eSPI library.
 */

#include "DisplayManager.h"

DisplayManager::DisplayManager()
    : _currentPage(PAGE_DASHBOARD),
      _previousPage(PAGE_DASHBOARD),
      _needsFullRedraw(true),
      _lastUpdateMs(0) {
}

bool DisplayManager::begin() {
    Serial.println(F("[DisplayManager] Initializing TFT ILI9341..."));
    
    _tft.init();
    _tft.setRotation(TFT_ROTATION);
    _tft.fillScreen(COLOR_BG);
    _tft.setTextColor(COLOR_TEXT, COLOR_BG);
    
    Serial.printf("[DisplayManager] TFT ready: %dx%d\n", _tft.width(), _tft.height());
    return true;
}

void DisplayManager::setPage(DisplayPage page) {
    if (page >= PAGE_COUNT) return;
    _previousPage = _currentPage;
    _currentPage = page;
    _needsFullRedraw = true;
}

DisplayPage DisplayManager::getPage() const {
    return _currentPage;
}

void DisplayManager::nextPage() {
    int next = ((int)_currentPage + 1) % PAGE_COUNT;
    setPage((DisplayPage)next);
}

void DisplayManager::prevPage() {
    int prev = ((int)_currentPage - 1 + PAGE_COUNT) % PAGE_COUNT;
    setPage((DisplayPage)prev);
}

void DisplayManager::update(const SensorReading& sensors,
                            const GPSData& gps,
                            const RiskResult& risk,
                            const String& timestamp,
                            const NetworkManager& network,
                            const StorageManager& storage,
                            const SyncStats& sync) {
    
    if (_needsFullRedraw) {
        _tft.fillScreen(COLOR_BG);
        _drawHeader(timestamp, network.isConnected());
        _needsFullRedraw = false;
    }
    
    // Draw page title
    _tft.setTextSize(1);
    _tft.setTextColor(COLOR_ACCENT, COLOR_HEADER_BG);
    _tft.fillRect(0, 0, 320, 18, COLOR_HEADER_BG);
    _tft.setCursor(4, 4);
    _tft.print("Q-GUARD | ");
    _tft.print(_getPageTitle(_currentPage));
    
    // Status indicators in header
    _tft.setCursor(220, 4);
    _tft.setTextColor(network.isConnected() ? COLOR_SUCCESS : COLOR_DANGER, COLOR_HEADER_BG);
    _tft.print(network.isConnected() ? "WiFi" : "----");
    
    _tft.setCursor(260, 4);
    _tft.setTextColor(storage.isAvailable() ? COLOR_SUCCESS : COLOR_DANGER, COLOR_HEADER_BG);
    _tft.print(storage.isAvailable() ? "SD" : "--");
    
    _tft.setCursor(285, 4);
    _tft.setTextColor(COLOR_TEXT_DIM, COLOR_HEADER_BG);
    String ts = timestamp;
    if (ts.length() > 8) ts = ts.substring(11, 19); // Extract time portion
    _tft.print(ts);
    
    // Draw current page content
    switch (_currentPage) {
        case PAGE_DASHBOARD:
            _drawDashboard(sensors, risk, network.isConnected(), storage.isAvailable());
            break;
        case PAGE_LIVE_SENSORS:
            _drawLiveSensors(sensors);
            break;
        case PAGE_SHIPMENT:
            _drawShipment();
            break;
        case PAGE_GPS:
            _drawGPS(gps);
            break;
        case PAGE_RISK:
            _drawRisk(risk);
            break;
        case PAGE_SYSTEM:
            _drawSystem(storage, sync);
            break;
        case PAGE_DATA_LOG:
            _drawDataLog(storage);
            break;
        case PAGE_NETWORK:
            _drawNetwork(network, sync);
            break;
        case PAGE_SETTINGS:
            _drawSettings();
            break;
        case PAGE_DEVICE_INFO:
            _drawDeviceInfo();
            break;
        default:
            break;
    }
    
    // Navigation bar at bottom
    _drawNavBar();
    
    _lastUpdateMs = millis();
}

void DisplayManager::forceRedraw() {
    _needsFullRedraw = true;
}

void DisplayManager::showSplash() {
    _tft.fillScreen(COLOR_BG);
    
    // Q-GUARD logo text
    _tft.setTextColor(COLOR_ACCENT);
    _tft.setTextSize(3);
    _tft.setCursor(60, 60);
    _tft.print("Q-GUARD");
    
    _tft.setTextSize(1);
    _tft.setTextColor(COLOR_TEXT);
    _tft.setCursor(35, 100);
    _tft.print("Cold-Chain Risk Monitoring");
    
    _tft.setTextColor(COLOR_TEXT_DIM);
    _tft.setCursor(55, 120);
    _tft.print("for Smart Quarantine");
    
    _tft.setCursor(85, 160);
    _tft.setTextColor(COLOR_INFO);
    _tft.print("Initializing...");
    
    _tft.setCursor(80, 220);
    _tft.setTextColor(COLOR_TEXT_DIM);
    _tft.print("v");
    _tft.print(FIRMWARE_VERSION);
}

void DisplayManager::showError(const String& title, const String& message) {
    _tft.fillScreen(COLOR_BG);
    _tft.setTextColor(COLOR_DANGER);
    _tft.setTextSize(2);
    _tft.setCursor(10, 30);
    _tft.print(title);
    
    _tft.setTextSize(1);
    _tft.setTextColor(COLOR_TEXT);
    _tft.setCursor(10, 70);
    
    // Word wrap the message
    int x = 10, y = 70;
    for (unsigned int i = 0; i < message.length(); i++) {
        if (x > 300 || message.charAt(i) == '\n') {
            x = 10;
            y += 12;
        }
        if (message.charAt(i) != '\n') {
            _tft.setCursor(x, y);
            _tft.print(message.charAt(i));
            x += 6;
        }
    }
}

bool DisplayManager::processTouch(int x, int y) {
    // Bottom nav bar area (y > 220)
    if (y > 220) {
        int section = x / 64; // 5 sections across 320px
        switch (section) {
            case 0: setPage(PAGE_DASHBOARD); return true;
            case 1: setPage(PAGE_LIVE_SENSORS); return true;
            case 2: setPage(PAGE_RISK); return true;
            case 3: setPage(PAGE_GPS); return true;
            case 4: setPage(PAGE_SYSTEM); return true;
        }
    }
    return false;
}

TFT_eSPI& DisplayManager::getTFT() {
    return _tft;
}

void DisplayManager::_drawHeader(const String& timestamp, bool wifiConnected) {
    _tft.fillRect(0, 0, 320, 18, COLOR_HEADER_BG);
}

void DisplayManager::_drawNavBar() {
    int y = 225;
    _tft.fillRect(0, y, 320, 15, COLOR_NAV_BG);
    
    const char* labels[] = {"Home", "Sens", "Risk", "GPS", "Sys"};
    int pages[] = {PAGE_DASHBOARD, PAGE_LIVE_SENSORS, PAGE_RISK, PAGE_GPS, PAGE_SYSTEM};
    
    _tft.setTextSize(1);
    for (int i = 0; i < 5; i++) {
        int x = i * 64 + 10;
        uint16_t color = (_currentPage == (DisplayPage)pages[i]) ? COLOR_NAV_ACTIVE : COLOR_TEXT_DIM;
        _tft.setTextColor(color, COLOR_NAV_BG);
        _tft.setCursor(x, y + 3);
        _tft.print(labels[i]);
    }
}

void DisplayManager::_drawDashboard(const SensorReading& s, const RiskResult& r, bool wifi, bool sd) {
    int y = 22;
    
    // Risk level banner
    uint16_t riskColor = RiskEngine::levelToColor(r.level);
    _tft.fillRect(0, y, 320, 24, riskColor);
    _tft.setTextColor(COLOR_TEXT, riskColor);
    _tft.setTextSize(1);
    _tft.setCursor(4, y + 4);
    _tft.print("Risk: ");
    _tft.print(RiskEngine::levelToString(r.level));
    _tft.setCursor(4, y + 14);
    _tft.print("Score: ");
    _tft.print(r.score);
    _tft.print("  Evidence: ");
    _tft.print(r.evidenceConfidence);
    y += 28;
    
    // Temperature cards (2 columns, 3 rows)
    for (int i = 0; i < 3; i++) {
        String label = "Probe " + String(i + 1);
        String value;
        uint16_t color;
        
        if (s.probes[i].status == SENSOR_OK) {
            value = String(s.probes[i].temperature, 1) + "C";
            color = COLOR_SUCCESS;
        } else if (s.probes[i].status == SENSOR_ERROR) {
            value = "ERROR";
            color = COLOR_DANGER;
        } else {
            value = "N/A";
            color = COLOR_TEXT_DIM;
        }
        
        _drawCard(2, y + i * 40, 102, 36, label, value, color);
    }
    
    // Right column: ambient, humidity, door
    String ambVal = s.environment.status == SENSOR_OK ? 
        String(s.environment.temperature, 1) + "C" : "N/A";
    _drawCard(108, y, 102, 36, "Ambient", ambVal,
        s.environment.status == SENSOR_OK ? COLOR_SUCCESS : COLOR_TEXT_DIM);
    
    String humVal = (s.environment.status == SENSOR_OK && !isnan(s.environment.humidity)) ?
        String(s.environment.humidity, 0) + "%" : "N/A";
    _drawCard(108, y + 40, 102, 36, "Humidity", humVal,
        s.environment.status == SENSOR_OK ? COLOR_INFO : COLOR_TEXT_DIM);
    
    String doorVal = s.door.status == SENSOR_OK ? 
        (s.door.isOpen ? "OPEN" : "CLOSED") : "N/A";
    uint16_t doorColor = s.door.status == SENSOR_OK ? 
        (s.door.isOpen ? COLOR_WARNING : COLOR_SUCCESS) : COLOR_TEXT_DIM;
    _drawCard(108, y + 80, 102, 36, "Door", doorVal, doorColor);
    
    // Far right column: system status
    _drawCard(214, y, 104, 36, "WiFi", wifi ? "OK" : "OFF",
        wifi ? COLOR_SUCCESS : COLOR_TEXT_DIM);
    _drawCard(214, y + 40, 104, 36, "SD Card", sd ? "OK" : "FAIL",
        sd ? COLOR_SUCCESS : COLOR_DANGER);
    _drawCard(214, y + 80, 104, 36, "Health", s.sensorHealthSummary,
        s.sensorHealthSummary.indexOf("ERR") >= 0 ? COLOR_WARNING : COLOR_SUCCESS);
}

void DisplayManager::_drawLiveSensors(const SensorReading& s) {
    int y = 22;
    _tft.setTextSize(1);
    
    // Temperature probes
    for (int i = 0; i < 3; i++) {
        _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
        _tft.setCursor(4, y + i * 30);
        _tft.printf("Temperature Probe %d:", i + 1);
        
        _tft.setTextSize(2);
        _tft.setCursor(4, y + i * 30 + 10);
        if (s.probes[i].status == SENSOR_OK) {
            _tft.setTextColor(COLOR_SUCCESS, COLOR_BG);
            _tft.printf("%.1f", s.probes[i].temperature);
            _tft.setTextSize(1);
            _tft.print(" C  ");
        } else {
            _tft.setTextColor(COLOR_DANGER, COLOR_BG);
            _tft.print(s.probes[i].status == SENSOR_ERROR ? "ERROR " : "N/A   ");
        }
        _tft.setTextSize(1);
    }
    
    y += 95;
    // BME280
    _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
    _tft.setCursor(4, y);
    _tft.print("Ambient:");
    _tft.setCursor(60, y);
    if (s.environment.status == SENSOR_OK) {
        _tft.setTextColor(COLOR_TEXT, COLOR_BG);
        _tft.printf("%.1fC  %.0f%%  %.0fhPa", 
            s.environment.temperature, s.environment.humidity, s.environment.pressure);
    } else {
        _tft.setTextColor(COLOR_DANGER, COLOR_BG);
        _tft.print("UNAVAILABLE");
    }
    
    y += 15;
    // MPU6050
    _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
    _tft.setCursor(4, y);
    _tft.print("Motion:");
    _tft.setCursor(60, y);
    if (s.motion.status == SENSOR_OK) {
        _tft.setTextColor(COLOR_TEXT, COLOR_BG);
        _tft.printf("X:%.2f Y:%.2f Z:%.2f g", 
            s.motion.accelX, s.motion.accelY, s.motion.accelZ);
        _tft.setCursor(60, y + 10);
        _tft.printf("Shock: %.2fg", s.motion.shockMagnitude);
    } else {
        _tft.setTextColor(COLOR_DANGER, COLOR_BG);
        _tft.print("UNAVAILABLE");
    }
    
    y += 30;
    // Door
    _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
    _tft.setCursor(4, y);
    _tft.print("Door:");
    _tft.setCursor(60, y);
    if (s.door.status == SENSOR_OK) {
        _tft.setTextColor(s.door.isOpen ? COLOR_WARNING : COLOR_SUCCESS, COLOR_BG);
        _tft.print(s.door.isOpen ? "OPEN    " : "CLOSED  ");
    }
}

void DisplayManager::_drawShipment() {
    _tft.setTextColor(COLOR_TEXT, COLOR_BG);
    _tft.setTextSize(1);
    _tft.setCursor(10, 30);
    _tft.print("Shipment info loaded from config.");
    _tft.setCursor(10, 50);
    _tft.print("See Settings to configure.");
}

void DisplayManager::_drawGPS(const GPSData& gps) {
    int y = 25;
    _tft.setTextSize(1);
    
    _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
    _tft.setCursor(4, y);
    _tft.print("GPS Fix: ");
    _tft.setTextColor(gps.hasFix ? COLOR_SUCCESS : COLOR_WARNING, COLOR_BG);
    _tft.print(gps.fixQuality);
    
    y += 15;
    _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
    _tft.setCursor(4, y);
    _tft.print("Satellites: ");
    _tft.setTextColor(COLOR_TEXT, COLOR_BG);
    _tft.print(gps.satellites);
    
    y += 20;
    if (gps.hasFix) {
        _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
        _tft.setCursor(4, y);
        _tft.print("Latitude:");
        _tft.setTextSize(2);
        _tft.setTextColor(COLOR_ACCENT, COLOR_BG);
        _tft.setCursor(4, y + 10);
        _tft.printf("%.6f", gps.latitude);
        
        _tft.setTextSize(1);
        _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
        _tft.setCursor(4, y + 35);
        _tft.print("Longitude:");
        _tft.setTextSize(2);
        _tft.setTextColor(COLOR_ACCENT, COLOR_BG);
        _tft.setCursor(4, y + 45);
        _tft.printf("%.6f", gps.longitude);
        
        _tft.setTextSize(1);
        _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
        _tft.setCursor(4, y + 70);
        _tft.printf("Alt: %.1fm  Spd: %.1fkm/h  HDOP: %.1f",
            gps.altitude, gps.speed, gps.hdop);
    } else {
        _tft.setTextColor(COLOR_WARNING, COLOR_BG);
        _tft.setCursor(4, y);
        _tft.print("Waiting for GPS fix...");
        _tft.setCursor(4, y + 15);
        _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
        _tft.print("Ensure antenna has sky view.");
        _tft.setCursor(4, y + 30);
        _tft.print("Cold start may take 1-5 min.");
    }
}

void DisplayManager::_drawRisk(const RiskResult& r) {
    int y = 22;
    
    // Risk level
    uint16_t riskColor = RiskEngine::levelToColor(r.level);
    _tft.fillRect(0, y, 320, 30, riskColor);
    _tft.setTextColor(COLOR_TEXT, riskColor);
    _tft.setTextSize(2);
    _tft.setCursor(10, y + 6);
    _tft.print(RiskEngine::levelToString(r.level));
    _tft.setTextSize(1);
    _tft.setCursor(200, y + 4);
    _tft.printf("Score: %d", r.score);
    _tft.setCursor(200, y + 16);
    _tft.printf("Rules: %d/%d", r.rulesTriggered, r.rulesEvaluated);
    
    y += 34;
    // Evidence
    _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
    _tft.setCursor(4, y);
    _tft.printf("Data: %.0f%%  Evidence: %s", 
        r.dataCompleteness * 100.0f, r.evidenceConfidence.c_str());
    
    y += 15;
    // Reasons
    _tft.setTextColor(COLOR_TEXT, COLOR_BG);
    _tft.setCursor(4, y);
    _tft.print("Reasons:");
    y += 10;
    
    if (r.reasons.length() == 0) {
        _tft.setTextColor(COLOR_SUCCESS, COLOR_BG);
        _tft.setCursor(4, y);
        _tft.print("No issues detected");
    } else {
        _tft.setTextColor(COLOR_WARNING, COLOR_BG);
        // Split reasons by semicolon and display
        String reasons = r.reasons;
        int startPos = 0;
        int lineY = y;
        while (startPos < (int)reasons.length() && lineY < 210) {
            int endPos = reasons.indexOf(';', startPos);
            if (endPos < 0) endPos = reasons.length();
            
            String reason = reasons.substring(startPos, endPos);
            reason.trim();
            if (reason.length() > 0) {
                _tft.setCursor(8, lineY);
                // Truncate long reasons for display
                if (reason.length() > 48) reason = reason.substring(0, 45) + "...";
                _tft.print("- " + reason);
                lineY += 10;
            }
            startPos = endPos + 1;
        }
    }
}

void DisplayManager::_drawSystem(const StorageManager& storage, const SyncStats& sync) {
    int y = 25;
    _tft.setTextSize(1);
    
    _tft.setTextColor(COLOR_ACCENT, COLOR_BG);
    _tft.setCursor(4, y);
    _tft.print("SYSTEM STATUS");
    y += 15;
    
    _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
    _tft.setCursor(4, y); _tft.print("SD Card:");
    _tft.setTextColor(COLOR_TEXT, COLOR_BG);
    _tft.setCursor(80, y);
    _tft.print(storage.isAvailable() ? "Available" : "NOT AVAILABLE");
    y += 12;
    
    _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
    _tft.setCursor(4, y); _tft.print("Records:");
    _tft.setTextColor(COLOR_TEXT, COLOR_BG);
    _tft.setCursor(80, y);
    _tft.printf("%u total, %u unsynced", storage.getTotalRecords(), storage.getUnsyncedCount());
    y += 12;
    
    _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
    _tft.setCursor(4, y); _tft.print("Storage:");
    _tft.setTextColor(COLOR_TEXT, COLOR_BG);
    _tft.setCursor(80, y);
    _tft.printf("%.1f MB used / %.1f MB free", storage.getUsedSpaceMB(), storage.getFreeSpaceMB());
    y += 12;
    
    _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
    _tft.setCursor(4, y); _tft.print("Synced:");
    _tft.setTextColor(COLOR_TEXT, COLOR_BG);
    _tft.setCursor(80, y);
    _tft.printf("%u OK, %u failed", sync.totalSynced, sync.totalFailed);
    y += 12;
    
    _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
    _tft.setCursor(4, y); _tft.print("Uptime:");
    _tft.setTextColor(COLOR_TEXT, COLOR_BG);
    _tft.setCursor(80, y);
    unsigned long sec = millis() / 1000;
    _tft.printf("%luh %lum %lus", sec / 3600, (sec % 3600) / 60, sec % 60);
    y += 12;
    
    _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
    _tft.setCursor(4, y); _tft.print("Heap:");
    _tft.setTextColor(COLOR_TEXT, COLOR_BG);
    _tft.setCursor(80, y);
    _tft.printf("%u bytes free", ESP.getFreeHeap());
}

void DisplayManager::_drawDataLog(const StorageManager& storage) {
    int y = 25;
    _tft.setTextSize(1);
    _tft.setTextColor(COLOR_ACCENT, COLOR_BG);
    _tft.setCursor(4, y);
    _tft.print("DATA LOGGING");
    y += 15;
    
    _tft.setTextColor(COLOR_TEXT, COLOR_BG);
    _tft.setCursor(4, y);
    _tft.printf("Total records: %u", storage.getTotalRecords());
    y += 12;
    _tft.setCursor(4, y);
    _tft.printf("Pending sync: %u", storage.getUnsyncedCount());
    y += 12;
    _tft.setCursor(4, y);
    _tft.printf("Next ID: %u", storage.getNextRecordId());
}

void DisplayManager::_drawNetwork(const NetworkManager& network, const SyncStats& sync) {
    int y = 25;
    _tft.setTextSize(1);
    _tft.setTextColor(COLOR_ACCENT, COLOR_BG);
    _tft.setCursor(4, y);
    _tft.print("NETWORK & SYNC");
    y += 15;
    
    _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
    _tft.setCursor(4, y); _tft.print("WiFi:");
    _tft.setTextColor(network.isConnected() ? COLOR_SUCCESS : COLOR_WARNING, COLOR_BG);
    _tft.setCursor(80, y);
    _tft.print(network.getStateString());
    y += 12;
    
    if (network.isConnected()) {
        _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
        _tft.setCursor(4, y); _tft.print("IP:");
        _tft.setTextColor(COLOR_TEXT, COLOR_BG);
        _tft.setCursor(80, y);
        _tft.print(network.getIP());
        y += 12;
        
        _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
        _tft.setCursor(4, y); _tft.print("RSSI:");
        _tft.setTextColor(COLOR_TEXT, COLOR_BG);
        _tft.setCursor(80, y);
        _tft.printf("%d dBm", network.getRSSI());
        y += 12;
    }
    
    y += 5;
    if (sync.lastError.length() > 0) {
        _tft.setTextColor(COLOR_DANGER, COLOR_BG);
        _tft.setCursor(4, y);
        _tft.print("Last error:");
        y += 10;
        _tft.setCursor(4, y);
        String err = sync.lastError;
        if (err.length() > 50) err = err.substring(0, 47) + "...";
        _tft.print(err);
    }
}

void DisplayManager::_drawSettings() {
    _tft.setTextSize(1);
    _tft.setTextColor(COLOR_ACCENT, COLOR_BG);
    _tft.setCursor(4, 25);
    _tft.print("SETTINGS");
    _tft.setTextColor(COLOR_TEXT, COLOR_BG);
    _tft.setCursor(4, 45);
    _tft.print("Configure via SD card config.json");
    _tft.setCursor(4, 60);
    _tft.print("or web dashboard Settings page.");
}

void DisplayManager::_drawDeviceInfo() {
    int y = 25;
    _tft.setTextSize(1);
    _tft.setTextColor(COLOR_ACCENT, COLOR_BG);
    _tft.setCursor(4, y);
    _tft.print("DEVICE INFORMATION");
    y += 15;
    
    _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
    _tft.setCursor(4, y); _tft.print("Device ID:");
    _tft.setTextColor(COLOR_TEXT, COLOR_BG);
    _tft.setCursor(80, y); _tft.print(DEVICE_ID);
    y += 12;
    
    _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
    _tft.setCursor(4, y); _tft.print("Firmware:");
    _tft.setTextColor(COLOR_TEXT, COLOR_BG);
    _tft.setCursor(80, y); _tft.print(FIRMWARE_VERSION);
    y += 12;
    
    _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
    _tft.setCursor(4, y); _tft.print("Chip:");
    _tft.setTextColor(COLOR_TEXT, COLOR_BG);
    _tft.setCursor(80, y);
    _tft.printf("ESP32 Rev %d", ESP.getChipRevision());
    y += 12;
    
    _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
    _tft.setCursor(4, y); _tft.print("CPU:");
    _tft.setTextColor(COLOR_TEXT, COLOR_BG);
    _tft.setCursor(80, y);
    _tft.printf("%d MHz", ESP.getCpuFreqMHz());
    y += 12;
    
    _tft.setTextColor(COLOR_TEXT_DIM, COLOR_BG);
    _tft.setCursor(4, y); _tft.print("Flash:");
    _tft.setTextColor(COLOR_TEXT, COLOR_BG);
    _tft.setCursor(80, y);
    _tft.printf("%u KB", ESP.getFlashChipSize() / 1024);
}

void DisplayManager::_drawCard(int x, int y, int w, int h, const String& label, const String& value, uint16_t valueColor) {
    _tft.fillRoundRect(x, y, w, h, 3, COLOR_CARD_BG);
    _tft.drawRoundRect(x, y, w, h, 3, COLOR_TEXT_DIM);
    
    _tft.setTextSize(1);
    _tft.setTextColor(COLOR_TEXT_DIM, COLOR_CARD_BG);
    _tft.setCursor(x + 4, y + 4);
    _tft.print(label);
    
    _tft.setTextColor(valueColor, COLOR_CARD_BG);
    _tft.setCursor(x + 4, y + 18);
    // Use larger text for short values
    if (value.length() <= 8) {
        _tft.setTextSize(2);
        _tft.setCursor(x + 4, y + 16);
    }
    _tft.print(value);
    _tft.setTextSize(1);
}

void DisplayManager::_drawStatusBadge(int x, int y, const String& text, uint16_t color) {
    int w = text.length() * 6 + 8;
    _tft.fillRoundRect(x, y, w, 14, 2, color);
    _tft.setTextColor(COLOR_TEXT, color);
    _tft.setCursor(x + 4, y + 3);
    _tft.print(text);
}

void DisplayManager::_drawProgressBar(int x, int y, int w, int h, float progress, uint16_t color) {
    _tft.drawRect(x, y, w, h, COLOR_TEXT_DIM);
    int fillW = (int)(progress * (w - 2));
    if (fillW > 0) {
        _tft.fillRect(x + 1, y + 1, fillW, h - 2, color);
    }
}

String DisplayManager::_getPageTitle(DisplayPage page) {
    switch (page) {
        case PAGE_DASHBOARD:    return "Dashboard";
        case PAGE_LIVE_SENSORS: return "Live Sensors";
        case PAGE_SHIPMENT:     return "Shipment";
        case PAGE_GPS:          return "GPS Location";
        case PAGE_RISK:         return "Risk Monitor";
        case PAGE_SYSTEM:       return "System Status";
        case PAGE_DATA_LOG:     return "Data Logging";
        case PAGE_NETWORK:      return "Network & Sync";
        case PAGE_SETTINGS:     return "Settings";
        case PAGE_DEVICE_INFO:  return "Device Info";
        default:                return "Unknown";
    }
}
