/**
 * Q-GUARD DisplayManager
 * 
 * TFT ILI9341 display management with page-based UI.
 * Resolution: 320×240 (landscape)
 */

#ifndef DISPLAY_MANAGER_H
#define DISPLAY_MANAGER_H

#include <Arduino.h>
#include <TFT_eSPI.h>
#include "config.h"
#include "SensorManager.h"
#include "GPSManager.h"
#include "TimeManager.h"
#include "RiskEngine.h"
#include "NetworkManager.h"
#include "StorageManager.h"
#include "SyncManager.h"

// Color palette
#define COLOR_BG            0x1082  // Dark blue-gray
#define COLOR_CARD_BG       0x2124  // Slightly lighter
#define COLOR_TEXT           0xFFFF  // White
#define COLOR_TEXT_DIM       0xAD55  // Gray
#define COLOR_ACCENT         0x07FF  // Cyan
#define COLOR_SUCCESS        0x07E0  // Green
#define COLOR_WARNING        0xFD20  // Orange
#define COLOR_DANGER         0xF800  // Red
#define COLOR_INFO           0x5D1F  // Blue
#define COLOR_HEADER_BG     0x0010  // Very dark blue
#define COLOR_NAV_BG        0x18E3  // Nav background
#define COLOR_NAV_ACTIVE    0x03EF  // Nav active item

enum DisplayPage {
    PAGE_DASHBOARD = 0,
    PAGE_LIVE_SENSORS,
    PAGE_SHIPMENT,
    PAGE_GPS,
    PAGE_RISK,
    PAGE_SYSTEM,
    PAGE_DATA_LOG,
    PAGE_NETWORK,
    PAGE_SETTINGS,
    PAGE_DEVICE_INFO,
    PAGE_COUNT
};

class DisplayManager {
public:
    DisplayManager();
    
    bool begin();
    
    /**
     * Set the current page.
     */
    void setPage(DisplayPage page);
    
    /**
     * Get current page.
     */
    DisplayPage getPage() const;
    
    /**
     * Navigate to next/previous page.
     */
    void nextPage();
    void prevPage();
    
    /**
     * Update the display with latest data.
     * Only redraws changed elements.
     */
    void update(const SensorReading& sensors,
                const GPSData& gps,
                const RiskResult& risk,
                const String& timestamp,
                const NetworkManager& network,
                const StorageManager& storage,
                const SyncStats& sync);
    
    /**
     * Force full redraw of current page.
     */
    void forceRedraw();
    
    /**
     * Show startup splash screen.
     */
    void showSplash();
    
    /**
     * Show error screen.
     */
    void showError(const String& title, const String& message);
    
    /**
     * Process touch input. Returns true if a touch was handled.
     */
    bool processTouch(int x, int y);
    
    /**
     * Get the TFT instance for direct access if needed.
     */
    TFT_eSPI& getTFT();

private:
    TFT_eSPI _tft;
    DisplayPage _currentPage;
    DisplayPage _previousPage;
    bool _needsFullRedraw;
    unsigned long _lastUpdateMs;
    
    // Page drawing functions
    void _drawHeader(const String& timestamp, bool wifiConnected);
    void _drawNavBar();
    void _drawDashboard(const SensorReading& s, const RiskResult& r, bool wifi, bool sd);
    void _drawLiveSensors(const SensorReading& s);
    void _drawShipment();
    void _drawGPS(const GPSData& gps);
    void _drawRisk(const RiskResult& r);
    void _drawSystem(const StorageManager& storage, const SyncStats& sync);
    void _drawDataLog(const StorageManager& storage);
    void _drawNetwork(const NetworkManager& network, const SyncStats& sync);
    void _drawSettings();
    void _drawDeviceInfo();
    
    // UI helpers
    void _drawCard(int x, int y, int w, int h, const String& label, const String& value, uint16_t valueColor);
    void _drawStatusBadge(int x, int y, const String& text, uint16_t color);
    void _drawProgressBar(int x, int y, int w, int h, float progress, uint16_t color);
    String _getPageTitle(DisplayPage page);
};

#endif // DISPLAY_MANAGER_H
