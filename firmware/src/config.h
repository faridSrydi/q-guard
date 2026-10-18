/**
 * Q-GUARD Configuration File
 * 
 * GPIO Mapping, sensor addresses, and system parameters.
 * 
 * IMPORTANT: GPIO0, GPIO2, GPIO12, GPIO15 are strapping pins.
 * This mapping has been revised to avoid boot conflicts.
 * See docs/gpio_mapping.md for detailed analysis.
 */

#ifndef QGUARD_CONFIG_H
#define QGUARD_CONFIG_H

// ============================================================
// DEVICE IDENTITY
// ============================================================
#define DEVICE_ID           "QGUARD-001"
#define FIRMWARE_VERSION    "1.0.0"

// ============================================================
// NETWORK CONFIGURATION
// ============================================================
#define WIFI_SSID           ""          // Set via ConfigManager or hardcode for testing
#define WIFI_PASSWORD       ""          // Set via ConfigManager or hardcode for testing
#define BACKEND_URL         "http://192.168.1.100:3000"
#define BACKEND_API_KEY     ""          // Set via ConfigManager
#define WIFI_CONNECT_TIMEOUT_MS   15000
#define WIFI_RETRY_INTERVAL_MS    30000

// ============================================================
// SAMPLING AND TIMING
// ============================================================
#define SENSOR_SAMPLE_INTERVAL_MS   5000    // 5 seconds for prototype
#define DISPLAY_REFRESH_INTERVAL_MS 1000    // 1 second
#define SYNC_INTERVAL_MS            30000   // 30 seconds
#define GPS_READ_INTERVAL_MS        2000    // 2 seconds
#define SYNC_BATCH_SIZE             20      // Records per batch upload
#define SYNC_RETRY_MAX              5
#define SYNC_RETRY_BASE_MS          1000    // Base for exponential backoff

// ============================================================
// SPI BUS (shared: TFT, Touch, MicroSD)
// ============================================================
#define PIN_SPI_SCK         18
#define PIN_SPI_MOSI        23
#define PIN_SPI_MISO        19

// TFT ILI9341
#define PIN_TFT_CS          5
#define PIN_TFT_DC          27
#define PIN_TFT_RST         26

// XPT2046 Touchscreen
#define PIN_TOUCH_CS        14
// Touch IRQ removed — using polling to free GPIO34 for button

// MicroSD
#define PIN_SD_CS           13

// ============================================================
// I2C BUS (shared: BME280, MPU6050, DS3231)
// ============================================================
#define PIN_I2C_SDA         21
#define PIN_I2C_SCL         22

// I2C Addresses
// DS3231 RTC: fixed at 0x68
// MPU6050:    default 0x68, set AD0 HIGH for 0x69
// BME280:     default 0x76
#define I2C_ADDR_DS3231     0x68
#define I2C_ADDR_MPU6050    0x69    // AD0 must be pulled HIGH on hardware
#define I2C_ADDR_BME280     0x76

// ============================================================
// SENSOR PINS
// ============================================================
#define PIN_DS18B20_DATA    4       // OneWire bus, requires 4.7kΩ pull-up to 3.3V

// GPS (UART2)
#define PIN_GPS_RX          16      // ESP32 RX2 ← GPS TX
#define PIN_GPS_TX          17      // ESP32 TX2 → GPS RX
#define GPS_BAUD            9600

// Door sensor MC-38
#define PIN_DOOR_SENSOR     35      // Input-only, requires external pull-up

// ============================================================
// USER INTERFACE — REVISED PIN MAPPING
// ============================================================
// Buttons (input-only GPIOs — no boot conflicts)
#define PIN_BUTTON_1        39      // VN — input only, safe
#define PIN_BUTTON_2        36      // VP — input only, safe  
#define PIN_BUTTON_3        34      // Input only, safe (touch IRQ freed by polling)

// LEDs (non-strapping GPIOs)
#define PIN_LED_RED         25      // Safe output
#define PIN_LED_YELLOW      33      // Safe output
#define PIN_LED_GREEN       32      // Safe output

// Buzzer (GPIO12 — strapping pin, but safe as output after boot)
// IMPORTANT: Ensure external pull-down on GPIO12 to keep LOW during boot
// This prevents flash voltage misconfiguration (MTDI must be LOW for 3.3V flash)
#define PIN_BUZZER          12

// Button debounce
#define BUTTON_DEBOUNCE_MS  50

// ============================================================
// TFT DISPLAY
// ============================================================
#define TFT_WIDTH           320
#define TFT_HEIGHT          240
#define TFT_ROTATION        1       // Landscape

// ============================================================
// RISK ENGINE DEFAULTS
// ============================================================
// Temperature thresholds (°C) — configurable per commodity
#define TEMP_MIN_DEFAULT    -25.0f
#define TEMP_MAX_DEFAULT    -18.0f
#define TEMP_DEVIATION_DURATION_S   300     // 5 minutes before escalation

// Humidity thresholds (%)
#define HUMIDITY_MIN_DEFAULT    30.0f
#define HUMIDITY_MAX_DEFAULT    80.0f

// Shock threshold (g-force)
#define SHOCK_THRESHOLD_G       2.0f

// Door open duration threshold (seconds)
#define DOOR_OPEN_MAX_S         60

// ============================================================
// STORAGE
// ============================================================
#define SD_LOG_DIR          "/qguard"
#define SD_DATA_FILE        "/qguard/data.csv"
#define SD_CONFIG_FILE      "/qguard/config.json"
#define SD_MAX_FILE_SIZE_MB 100

// ============================================================
// SYSTEM
// ============================================================
#define WATCHDOG_TIMEOUT_S  30
#define SERIAL_BAUD         115200

#endif // QGUARD_CONFIG_H
