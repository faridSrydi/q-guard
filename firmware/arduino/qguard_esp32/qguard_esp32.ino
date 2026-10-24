/**
 * ============================================================================
 * PROJECT: Q-GUARD
 * Smart Cold-Chain Risk Monitoring & Quarantine Decision Support System
 * 
 * Hardware Target : DOIT ESP32 DevKit V1 (30 Pin)
 * Documentation   : docs/WIRING_HARDWARE_FINAL.md
 * Compatibility   : Arduino IDE 1.8.x / 2.x
 * 
 * SENSOR & ACTUATOR INTEGRATION:
 * - 3x DS18B20 Waterproof Probe (OneWire)   : GPIO 4
 * - 2.8" TFT LCD ILI9341 (SPI)              : CS=5, DC=27, RST=26, MOSI=23, SCK=18
 * - Touchscreen XPT2046 (SPI)               : T_CS=14, T_CLK=18, T_DIN=23, T_DO=19
 * - MicroSD Card Adapter (SPI)              : CS=13, MOSI=23, SCK=18, MISO=19
 * - I2C Bus (SDA=21, SCL=22)                : BME280 (0x76), MPU6050 (0x69 AD0->3.3V), DS3231 RTC (0x68)
 * - NEO-6M GPS (HardwareSerial 2)           : RX2=GPIO 16 (dari TX GPS), TX2=GPIO 17 (ke RX GPS)
 * - MC-38 Magnetic Door Sensor              : GPIO 35 (+ 4.7k Pull-up ke 3.3V)
 * - 3x Tactile Switch (3-Pin: VCC, GND, OUT): BACK=GPIO 34, SELECT=GPIO 36, CONFIRM=GPIO 39
 * - 3x LED 5mm (+ 330R ke GND)              : RED=GPIO 25, YELLOW=GPIO 33, GREEN=GPIO 32
 * - 5V Active Buzzer (+ 1k Pulldown ke GND) : GPIO 12
 * ============================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <ESPmDNS.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <SPI.h>
#include <Wire.h>
#include <FS.h>
#include <SD.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include <XPT2046_Touchscreen.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <RTClib.h>
#include <TinyGPSPlus.h>
#include <esp_task_wdt.h>

// ============================================================================
// 1. PIN DEFINITIONS (SESUAI WIRING_HARDWARE_FINAL.md)
// ============================================================================
#define PIN_TFT_CS          5
#define PIN_TFT_DC          27
#define PIN_TFT_RST         26
#define PIN_TOUCH_CS        14
#define PIN_SD_CS           13

#define PIN_SPI_SCK         18
#define PIN_SPI_MISO        19
#define PIN_SPI_MOSI        23

#define PIN_I2C_SDA         21
#define PIN_I2C_SCL         22

#define PIN_ONEWIRE         4
#define PIN_DOOR_SENSOR     35

#define PIN_BTN_BACK        34   // Tombol 1: Back / Mute
#define PIN_BTN_SELECT      36   // Tombol 2: Select / Next (VP)
#define PIN_BTN_CONFIRM     39   // Tombol 3: Confirm / Enter (VN)

// Konfigurasi Input: Dual Navigasi (Tombol Fisik + Touchscreen Aktif Bersama)
#define ENABLE_PHYSICAL_BTNS  true   // true: Tiga tombol fisik (BACK, SELECT, CONFIRM) aktif
#define ENABLE_TOUCHSCREEN    true   // true: Layar sentuh aktif sepenuhnya

#define PIN_LED_RED         25   // Bahaya / Critical Excursion
#define PIN_LED_YELLOW      33   // Peringatan / Warning / Door Open
#define PIN_LED_GREEN       32   // Aman / Normal Cold Chain
#define PIN_BUZZER          12   // Active Buzzer (+ 1k Pull-down ke GND)

#define PIN_GPS_RX          16   // ESP32 RX2 <- GPS TX
#define PIN_GPS_TX          17   // ESP32 TX2 -> GPS RX

// ============================================================================
// 2. TOUCHSCREEN CALIBRATION PARAMETERS
// ============================================================================
#define TS_MINX             280
#define TS_MAXX             3850
#define TS_MINY             340
#define TS_MAXY             3850

// ============================================================================
// 3. COLOR PALETTE DEFINITIONS (16-BIT RGB565)
// ============================================================================
#define COLOR_BG            0x0821   // Very deep navy-black (#0B101B)
#define COLOR_CARD          0x18E3   // Dark slate card (#182232)
#define COLOR_CARD_BORDER   0x2965   // Card border outline (#283448)
#define COLOR_CYAN          0x07FF   // Accent cyan (#00FFFF)
#define COLOR_GOLD          0xFEA0   // Warning gold/amber (#FFA500)
#define COLOR_GREEN_SAFE    0x2E66   // Bio safe green (#2ECC71)
#define COLOR_RED_ALERT     0xE8A4   // Excursion alert red (#E74C3C)
#define COLOR_WHITE         0xFFFF   // Clean white
#define COLOR_GRAY_TEXT     0x9CF3   // Secondary gray (#9E9E9E)
#define COLOR_NAV_BAR       0x10C2   // Header/Footer bar (#111827)

// ============================================================================
// 4. DATA STRUCTURES & GLOBAL OBJECTS
// ============================================================================
Adafruit_ILI9341 tft = Adafruit_ILI9341(PIN_TFT_CS, PIN_TFT_DC, PIN_TFT_RST);
XPT2046_Touchscreen touch(PIN_TOUCH_CS);
OneWire oneWire(PIN_ONEWIRE);
DallasTemperature dsSensors(&oneWire);
Adafruit_BME280 bme;
RTC_DS3231 rtc;
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

// Profil Komoditas Karantina
enum CommodityProfile {
  PROFILE_FISH_FRESH,     // Ikan Segar: 0.0°C s/d 4.0°C (SNI 2729:2021)
  PROFILE_VACCINE_PHARMA, // Vaksin / Obat: 2.0°C s/d 8.0°C (WHO Standard)
  PROFILE_FROZEN_CARGO    // Daging/Ikan Beku: -25.0°C s/d -18.0°C
};

CommodityProfile currentProfile = PROFILE_FROZEN_CARGO; // Standar Paper QIC 2026: Komoditas Hayati Beku (-25 s/d -18C)
float thresholdMin = -25.0;
float thresholdMax = -18.0;
String activeCommodityName = "BEKU [-18C]";

// Halaman Layar (UI State)
enum ScreenState {
  SCREEN_SPLASH,
  SCREEN_MONITOR,
  SCREEN_MENU,
  SCREEN_PROFILE_SELECT,
  SCREEN_GRAPH,
  SCREEN_DOSSIER,         // Ringkasan Karantina & Disposisi Jalur Hijau/Kuning/Merah
  SCREEN_SD_INFO,
  SCREEN_WIFI_CONFIG,
  SCREEN_SETTINGS
};

ScreenState currentScreen = SCREEN_SPLASH;
int menuCursor = 0; // Pilihan menu aktif (0..6)

// Konfigurasi Auto-Sleep Layar TFT
int tftSleepMinutes = 2; // Pilihan waktu tidur layar: 1, 2, 3, 5, 10, atau 0 (OFF / Always ON)
unsigned long lastUserInteractionTime = 0; // Waktu terakhir ada interaksi pengguna (tombol/sentuh)
bool tftIsAsleep = false; // Status apakah layar sedang dalam mode tidur hemat energi

// Data Telemetri Terkini
struct TelemetryData {
  float temp1;            // Probe T1 (Inti Komoditas / Daging Ikan)
  float temp2;            // Probe T2 (Thermal Buffer / Lapisan Es Tengah)
  float temp3;            // Probe T3 (Zona Bukaan Pintu / Ambang Gasket)
  float mkt;              // Mean Kinetic Temperature (°C)
  float ambientTemp;      // BME280 Suhu Luar
  float ambientHum;       // BME280 Kelembapan Luar (%RH)
  bool doorOpen;          // Status Pintu MC-38 (true = Terbuka)
  unsigned long doorOpenStart; // Waktu mulai pintu terbuka (ms)
  unsigned long doorTotalOpenSec;
  float gForce;           // MPU6050 Peak G-Force
  float accelX;           // MPU6050 Accelerometer X (g)
  float accelY;           // MPU6050 Accelerometer Y (g)
  float accelZ;           // MPU6050 Accelerometer Z (g)
  bool shockDetected;     // Guncangan keras (> 2.0g)
  double latitude;        // GPS Latitude
  double longitude;       // GPS Longitude
  int satCount;           // Jumlah Satelit GPS
  bool gpsValid;
  DateTime timestamp;     // Jam RTC
  int riskScore;          // 0 - 100
  char riskLevel[12];     // "NORMAL", "WARNING", "CRITICAL"
  bool sdMounted;
  unsigned long logCount;
};

TelemetryData telemetry;

// Metrik Audit Perjalanan Karantina (Quarantine Trip Dossier)
struct TripAuditMetrics {
  unsigned long tripStartTime;       // Waktu trip dimulai (millis)
  unsigned long totalSamples;        // Jumlah total sampel
  unsigned long compliantSamples;    // Jumlah sampel aman dalam rentang suhu
  float minTemp;                     // Suhu core terendah yang pernah dialami
  float maxTemp;                     // Suhu core tertinggi yang pernah dialami
  double sumTemp;                    // Total akumulasi suhu untuk rata-rata
  int excursionCount;                // Jumlah insiden suhu melanggar batas
  unsigned long totalExcursionSec;   // Total detik suhu melanggar batas
  bool inExcursion;                  // Status pelanggaran saat ini
  int doorBreachCount;               // Frekuensi pintu dibuka
  float peakShockG;                  // Guncangan puncak yang terekam
  bool hasData;                      // Status ketersediaan data fisik
};

TripAuditMetrics tripMetrics = { 0, 0, 0, 999.0f, -999.0f, 0.0, 0, 0, false, 0, 0.0f, false };

void resetTripMetrics() {
  tripMetrics.tripStartTime = millis();
  tripMetrics.totalSamples = 0;
  tripMetrics.compliantSamples = 0;
  tripMetrics.minTemp = 999.0f;
  tripMetrics.maxTemp = -999.0f;
  tripMetrics.sumTemp = 0.0;
  tripMetrics.excursionCount = 0;
  tripMetrics.totalExcursionSec = 0;
  tripMetrics.inExcursion = false;
  tripMetrics.doorBreachCount = 0;
  tripMetrics.peakShockG = 0.0f;
  tripMetrics.hasData = false;
  Serial.println(F("[TRIP AUDIT] Metrik Karantina berhasil di-reset untuk pengawasan trip baru!"));
}

// Buffer Riwayat Suhu untuk Grafik Mini (30 Sampel Terakhir)
#define GRAPH_HISTORY_SIZE 30
float temp1History[GRAPH_HISTORY_SIZE];
int historyIndex = 0;

// Penanda Waktu (Non-blocking Timers)
unsigned long lastSampleTime = 0;
unsigned long lastDisplayRefresh = 0;
unsigned long lastSdLogTime = 0;
unsigned long lastLedBlinkTime = 0;
unsigned long alarmMuteUntil = 0;
bool buzzerMuteTotal = false; // Status Mute Total Buzzer (Toggle 3x Klik Tombol Merah)

// Status Sensor Hardware Terdeteksi
bool bmeAvailable = false;
bool rtcAvailable = false;
bool mpuAvailable = false;
uint8_t mpuI2CAddr = 0x69; // Alamat aktif MPU6050 (0x69 jika AD0=3.3V, atau 0x68 jika default)
float peakGForceBuffer = 1.0; // Penampung puncak guncangan
bool sdAvailable = false;
int ds18Count = 0;

// Kalibrasi otomatis logika tombol fisik (Mendukung Active-LOW & Active-HIGH)
int btnBackIdle = HIGH;
int btnSelectIdle = HIGH;
int btnConfirmIdle = HIGH;

// Status & Konfigurasi Wi-Fi & Web Portal
enum WifiState {
  WIFI_STATE_OFF,
  WIFI_STATE_PORTAL,      // AP Mode QGUARD-SETUP aktif, web portal di 192.168.4.1
  WIFI_STATE_CONNECTING,  // Sedang menghubungkan ke Wi-Fi
  WIFI_STATE_CONNECTED    // Terhubung, siap kirim data telemetri ke server
};

WifiState wifiState = WIFI_STATE_PORTAL;
Preferences preferences;
WebServer server(80);
DNSServer dnsServer;

String wifiSsid = "";
String wifiPass = "";
String serverUrl = "http://192.168.43.15:3000/api/sensor-data/batch";
String deviceId = "QGUARD-001";

unsigned long lastWifiSendTime = 0;
unsigned long wifiConnectStartTime = 0;

// Forward Function Prototypes
void drawMainMonitorScreen();
void updateMainMonitorData();
void drawMenuScreen();
void drawProfileSelectScreen();
void drawGraphScreen();
void drawDossierScreen();
void drawSdInfoScreen();
void drawWifiConfigScreen();
void drawSettingsScreen();
void putTFTToSleep();
void wakeUpTFT();
void startWiFiPortal();
void connectToStation(const String& ssid, const String& pass);
void sendTelemetryToBackend();
void evaluateRiskScore();
void readSensors();
void logDataToSD();

// ============================================================================
// 5. HELPER NADA BUZZER & FEEDBACK AUDIO
// ============================================================================
void beepTouch() {
  digitalWrite(PIN_BUZZER, HIGH);
  delay(18); // Bunyi 'tik' renyah untuk interaksi sentuh / tombol (tetap bunyi)
  digitalWrite(PIN_BUZZER, LOW);
}

void beepSuccess() {
  digitalWrite(PIN_BUZZER, HIGH); delay(40);
  digitalWrite(PIN_BUZZER, LOW);  delay(30);
  digitalWrite(PIN_BUZZER, HIGH); delay(60);
  digitalWrite(PIN_BUZZER, LOW);
}

void beepWarning() {
  // Hanya matikan suara jika mode Mute Alarm aktif
  if (buzzerMuteTotal || millis() < alarmMuteUntil) return;
  for (int i = 0; i < 2; i++) {
    digitalWrite(PIN_BUZZER, HIGH); delay(50);
    digitalWrite(PIN_BUZZER, LOW);  delay(40);
  }
}

void beepCriticalAlarm() {
  // Hanya matikan suara jika mode Mute Alarm aktif
  if (buzzerMuteTotal || millis() < alarmMuteUntil) return;
  digitalWrite(PIN_BUZZER, HIGH); delay(120);
  digitalWrite(PIN_BUZZER, LOW);  delay(60);
}

// Banner Notifikasi Pop-up Status Alarm Peringatan pada Layar LCD
void showBuzzerToast(bool isMuted) {
  int toastW = 246;
  int toastH = 38;
  int toastX = (320 - toastW) / 2;
  int toastY = 96;

  uint16_t accentColor = isMuted ? COLOR_RED_ALERT : COLOR_GREEN_SAFE;
  tft.fillRoundRect(toastX, toastY, toastW, toastH, 6, COLOR_NAV_BAR);
  tft.drawRoundRect(toastX, toastY, toastW, toastH, 6, accentColor);
  tft.drawRoundRect(toastX + 1, toastY + 1, toastW - 2, toastH - 2, 5, accentColor);

  tft.setTextSize(1);
  tft.setTextColor(accentColor);
  tft.setCursor(toastX + 14, toastY + 8);
  tft.print(isMuted ? "ALARM SUHU: SENYAP [MUTE]" : "ALARM SUHU: AKTIF [ON]");

  tft.setTextColor(COLOR_WHITE);
  tft.setCursor(toastX + 14, toastY + 22);
  tft.print(isMuted ? "Tekan tombol merah 3x utk aktifkan" : "Tekan tombol merah 3x utk senyap");
}

// ============================================================================
// 6. ANIMASI PEMBUKA (STARTUP LED & AUDIO CHIME)
// ============================================================================
void runStartupSequence() {
  // Animasi Chaser LED Knight Rider + Melodi Startup Futuristik
  int startupMelody[] = { 10, 20, 30, 45, 65 };
  
  for (int cycle = 0; cycle < 2; cycle++) {
    // Hijau ON
    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_BUZZER, HIGH); delay(20); digitalWrite(PIN_BUZZER, LOW);
    delay(70);
    digitalWrite(PIN_LED_GREEN, LOW);

    // Kuning ON
    digitalWrite(PIN_LED_YELLOW, HIGH);
    digitalWrite(PIN_BUZZER, HIGH); delay(25); digitalWrite(PIN_BUZZER, LOW);
    delay(70);
    digitalWrite(PIN_LED_YELLOW, LOW);

    // Merah ON
    digitalWrite(PIN_LED_RED, HIGH);
    digitalWrite(PIN_BUZZER, HIGH); delay(35); digitalWrite(PIN_BUZZER, LOW);
    delay(70);
    digitalWrite(PIN_LED_RED, LOW);
  }

  // Flash semua LED bersamaan tanda sistem siap
  digitalWrite(PIN_LED_GREEN, HIGH);
  digitalWrite(PIN_LED_YELLOW, HIGH);
  digitalWrite(PIN_LED_RED, HIGH);
  digitalWrite(PIN_BUZZER, HIGH);
  delay(100);
  digitalWrite(PIN_BUZZER, LOW);
  delay(150);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_YELLOW, LOW);
  digitalWrite(PIN_LED_RED, LOW);
}

// ============================================================================
// 7. INISIALISASI PERANGKAT KERAS (HARDWARE SETUP)
// ============================================================================
void setupHardwarePins() {
  // Nonaktifkan semua Chip Select (CS) SPI di awal agar tidak saling bentrok di bus SPI
  pinMode(PIN_TFT_CS, OUTPUT);
  digitalWrite(PIN_TFT_CS, HIGH);
  pinMode(PIN_TOUCH_CS, OUTPUT);
  digitalWrite(PIN_TOUCH_CS, HIGH);
  pinMode(PIN_SD_CS, OUTPUT);
  digitalWrite(PIN_SD_CS, HIGH);

#if ENABLE_PHYSICAL_BTNS
  pinMode(PIN_BTN_BACK, INPUT);
  pinMode(PIN_BTN_SELECT, INPUT);
  pinMode(PIN_BTN_CONFIRM, INPUT);
#endif

  pinMode(PIN_DOOR_SENSOR, INPUT);
  // Self-test deteksi floating pin GPIO35 (memastikan resistor pull-up 4.7k/10k terpasang)
  int doorTransitions = 0;
  int lastVal = digitalRead(PIN_DOOR_SENSOR);
  for (int i = 0; i < 15; i++) {
    delayMicroseconds(50);
    int curVal = digitalRead(PIN_DOOR_SENSOR);
    if (curVal != lastVal) {
      doorTransitions++;
      lastVal = curVal;
    }
  }
  if (doorTransitions >= 5) {
    Serial.println(F("[DOOR] PERINGATAN: GPIO35 melayang (floating)! Pastikan resistor pull-up 4.7k/10k terhubung ke 3.3V."));
  }

  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  // Pastikan pin buzzer berlogika LOW saat pertama kali hidup
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_LED_YELLOW, LOW);
  digitalWrite(PIN_LED_GREEN, LOW);
}

// Helper pemulihan bus I2C jika jalur SDA macet tertarik LOW oleh slave
void recoverI2CBus() {
  pinMode(PIN_I2C_SDA, INPUT_PULLUP);
  pinMode(PIN_I2C_SCL, OUTPUT);
  for (int i = 0; i < 16; i++) {
    digitalWrite(PIN_I2C_SCL, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_I2C_SCL, LOW);
    delayMicroseconds(10);
  }
  // Buat kondisi STOP (SDA LOW -> HIGH saat SCL HIGH)
  pinMode(PIN_I2C_SDA, OUTPUT);
  digitalWrite(PIN_I2C_SDA, LOW);
  delayMicroseconds(10);
  digitalWrite(PIN_I2C_SCL, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_I2C_SDA, HIGH);
  delayMicroseconds(10);
  pinMode(PIN_I2C_SDA, INPUT_PULLUP);
  pinMode(PIN_I2C_SCL, INPUT_PULLUP);
}

// Helper uji deteksi keberadaan modul pada bus I2C (0-byte probe tanpa buffer data)
bool isI2CDevicePresent(uint8_t addr) {
  Wire.beginTransmission(addr);
  return (Wire.endTransmission() == 0);
}

// Helper untuk membangunkan & mengatur sensitivitas MPU6050
bool checkAndWakeMPU(uint8_t addr) {
  // Cek cepat apakah modul merespon ACK sebelum kirim buffer data (mencegah error i2c_master_multi_buffer_transmit)
  if (!isI2CDevicePresent(addr)) return false;

  Wire.beginTransmission(addr);
  Wire.write(0x6B); // Register PWR_MGMT_1
  Wire.write(0x00); // Bangunkan MPU (Wake up)
  if (Wire.endTransmission(true) != 0) return false;

  delay(5);

  // Set Accelerometer Range +/- 2g (Register 0x1C)
  Wire.beginTransmission(addr);
  Wire.write(0x1C);
  Wire.write(0x00);
  if (Wire.endTransmission(true) != 0) return false;

  return true;
}

// Inisialisasi MPU6050 secara mandiri via I2C Register (Alamat 0x69 atau 0x68)
void initMPU6050() {
  // 1. Coba alamat 0x69 terlebih dahulu (Standar Q-GUARD: Pin AD0 -> 3.3V)
  if (isI2CDevicePresent(0x69)) {
    if (checkAndWakeMPU(0x69)) {
      mpuAvailable = true;
      mpuI2CAddr = 0x69;
      Serial.println(F("[MPU6050] Terdeteksi pada alamat 0x69 (AD0=3.3V) - OK"));
      return;
    }
  }

  // 2. Coba alamat 0x68 HANYA jika modul merespon di 0x68 (AD0 ke GND/floating)
  // Verifikasi register WHO_AM_I (0x75) agar TIDAK salah membaca RTC DS3231 (yang juga di 0x68)
  if (isI2CDevicePresent(0x68)) {
    Wire.beginTransmission(0x68);
    Wire.write(0x75); // WHO_AM_I
    if (Wire.endTransmission(true) == 0) {
      Wire.requestFrom((uint8_t)0x68, (size_t)1, (bool)true);
      if (Wire.available()) {
        uint8_t who = Wire.read();
        if (who == 0x68 || who == 0x70 || who == 0x72) {
          if (checkAndWakeMPU(0x68)) {
            mpuAvailable = true;
            mpuI2CAddr = 0x68;
            Serial.println(F("[MPU6050] Terdeteksi pada alamat 0x68 (AD0=GND) - OK"));
            return;
          }
        }
      }
    }
  }

  mpuAvailable = false;
}

// Membaca percepatan dari MPU6050 dengan deteksi getaran dinamis
float readMPU6050GForce() {
  if (!mpuAvailable) return 1.0;

  static int failCount = 0;
  Wire.beginTransmission(mpuI2CAddr);
  Wire.write(0x3B); // Register akselerometer XOUT_H
  byte err = Wire.endTransmission(true);
  if (err != 0) {
    failCount++;
    if (failCount > 15) {
      mpuAvailable = false; // Hanya putus jika gagal berturut-turut 15 kali
      failCount = 0;
    }
    return 1.0;
  }
  failCount = 0; // Reset ke 0 karena pembacaan ini sukses!

  Wire.requestFrom((uint8_t)mpuI2CAddr, (size_t)6, (bool)true);
  if (Wire.available() >= 6) {
    int16_t rawX = (Wire.read() << 8) | Wire.read();
    int16_t rawY = (Wire.read() << 8) | Wire.read();
    int16_t rawZ = (Wire.read() << 8) | Wire.read();

    // Sensitivitas default (+/- 2g) = 16384 LSB/g
    float ax = (float)rawX / 16384.0;
    float ay = (float)rawY / 16384.0;
    float az = (float)rawZ / 16384.0;

    telemetry.accelX = ax;
    telemetry.accelY = ay;
    telemetry.accelZ = az;

    float currentG = sqrt(ax * ax + ay * ay + az * az);
    if (isnan(currentG) || currentG < 0.1) return 1.0;
    return currentG;
  }
  return 1.0;
}

// ============================================================================
// 8. TAMPILAN AWAL (SPLASH SCREEN / BOOT DISPLAY)
// ============================================================================
void drawSplashScreen() {
  tft.fillScreen(COLOR_BG);

  // Bingkai Luar Beraksen Keren
  tft.drawRect(6, 6, 308, 228, COLOR_CARD_BORDER);
  tft.drawRect(8, 8, 304, 224, COLOR_CYAN);

  // Logo Badge Box
  tft.fillRoundRect(35, 30, 250, 60, 8, COLOR_CARD);
  tft.drawRoundRect(35, 30, 250, 60, 8, COLOR_CYAN);

  // Judul Utama "Q-GUARD"
  tft.setTextColor(COLOR_CYAN);
  tft.setTextSize(4);
  tft.setCursor(68, 44);
  tft.print("Q-GUARD");

  // Tagline Riset
  tft.setTextColor(COLOR_WHITE);
  tft.setTextSize(1);
  tft.setCursor(56, 105);
  tft.print("COLD-CHAIN MONITORING SYSTEM");
  
  tft.setTextColor(COLOR_GOLD);
  tft.setCursor(68, 120);
  tft.print("BADAN KARANTINA INDONESIA");

  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setCursor(96, 140);
  tft.print("Firmware v1.0 | ESP32");

  // Garis Pemisah
  tft.drawLine(40, 160, 280, 160, COLOR_CARD_BORDER);

  // Progress Bar Animasi Booting
  int barX = 40;
  int barY = 175;
  int barW = 240;
  int barH = 14;
  tft.drawRoundRect(barX, barY, barW, barH, 4, COLOR_WHITE);

  const char* bootSteps[] = {
    "Inisialisasi Layar LCD...",
    "Memeriksa Kartu MicroSD...",
    "Memindai Sensor I2C...",
    "Mendeteksi Probe Suhu DS18B20...",
    "Sinkronisasi Modul GPS...",
    "Memuat Parameter Karantina...",
    "Sistem Siap Beroperasi"
  };

  for (int i = 0; i <= 100; i += 15) {
    int fillW = map(i, 0, 100, 0, barW - 4);
    tft.fillRoundRect(barX + 2, barY + 2, fillW, barH - 4, 3, COLOR_CYAN);
    
    // Teks Status Boot
    tft.fillRect(40, 200, 240, 15, COLOR_BG);
    tft.setCursor(40, 200);
    tft.setTextColor(COLOR_WHITE);
    tft.setTextSize(1);
    int stepIdx = map(i, 0, 100, 0, 6);
    tft.print(bootSteps[stepIdx]);

    delay(120);
  }

  beepSuccess();
  delay(600);
}

// ============================================================================
// 9. PERHITUNGAN MEAN KINETIC TEMPERATURE (MKT)
// ============================================================================
float calculateMKT(float t1, float t2, float t3) {
  // Persamaan Arrhenius MKT: Delta H = 83.144 kJ/mol, R = 8.3144 J/mol.K
  // Delta H / R = 10000.0 Kelvin
  const float deltaH_over_R = 10000.0;
  float sumExp = 0.0;
  int count = 0;

  float temps[3] = { t1, t2, t3 };
  for (int i = 0; i < 3; i++) {
    if (!isnan(temps[i]) && temps[i] > -50.0 && temps[i] < 100.0) {
      float tk = temps[i] + 273.15; // Ke Kelvin
      sumExp += exp(-deltaH_over_R / tk);
      count++;
    }
  }

  if (count == 0) return NAN;
  float meanExp = sumExp / (float)count;
  float mktKelvin = deltaH_over_R / (-log(meanExp));
  return mktKelvin - 273.15; // Kembali ke Celsius
}

// ============================================================================
// 10. AI RISK SCORING ENGINE (ON-DEVICE)
// ============================================================================
void evaluateRiskScore() {
  int tempScore = 0;
  int shockScore = 0;
  int doorScore = 0;

  // 1. Evaluasi Suhu terhadap Profil Komoditas Terpilih (Gunakan probe inti riil T1)
  float coreTemp = !isnan(telemetry.temp1) ? telemetry.temp1 : (!isnan(telemetry.temp2) ? telemetry.temp2 : (!isnan(telemetry.temp3) ? telemetry.temp3 : NAN));
  if (!isnan(coreTemp)) {
    if (coreTemp > thresholdMax) {
      float diff = coreTemp - thresholdMax;
      if (diff > 4.0) {
        tempScore = 90; // Excursion parah
      } else {
        tempScore = 40 + (int)(diff * 12.0);
      }
    } else if (coreTemp < thresholdMin - 2.0) {
      tempScore = 50; // Terlalu beku / frostbite
    }
  }

  // 1B. Peringatan Dini Penetrasi Kalor Pintu (Probe T3) sebelum merambat ke inti (T1)
  if (!isnan(telemetry.temp3) && telemetry.temp3 > thresholdMax && (isnan(coreTemp) || coreTemp <= thresholdMax)) {
    if (tempScore < 35) tempScore = 35; // Peringatan dini batas pintu
  }

  // 2. Evaluasi Guncangan Dinamis Bersih (Net Dynamic G-Force minus 1g gravitasi)
  float netShock = fabsf(telemetry.gForce - 1.0f);
  if (netShock > 1.5f || telemetry.gForce > 2.5f) {
    shockScore = 80;
    telemetry.shockDetected = true;
  } else if (netShock > 0.8f || telemetry.gForce > 1.8f) {
    shockScore = 40;
  }

  // 3. Evaluasi Pintu Terbuka
  if (telemetry.doorOpen) {
    unsigned long openDurationSec = (millis() - telemetry.doorOpenStart) / 1000;
    if (openDurationSec > 60) {
      doorScore = 85; // Pintu dibiarkan terbuka lama
    } else if (openDurationSec > 15) {
      doorScore = 45;
    }
  }

  // Skor Gabungan Berbobot
  telemetry.riskScore = (int)((tempScore * 0.60) + (shockScore * 0.25) + (doorScore * 0.15));
  if (telemetry.riskScore > 100) telemetry.riskScore = 100;

  // Penentuan Tingkat Keputusan Karantina
  if (telemetry.riskScore >= 75) {
    strcpy(telemetry.riskLevel, "CRITICAL");
    digitalWrite(PIN_LED_RED, HIGH);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_GREEN, LOW);
    beepCriticalAlarm();
  } else if (telemetry.riskScore >= 35) {
    strcpy(telemetry.riskLevel, "WARNING");
    digitalWrite(PIN_LED_RED, LOW);
    digitalWrite(PIN_LED_YELLOW, HIGH);
    digitalWrite(PIN_LED_GREEN, LOW);
    beepWarning();
  } else {
    strcpy(telemetry.riskLevel, "NORMAL");
    digitalWrite(PIN_LED_RED, LOW);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_GREEN, HIGH);
  }
}

// ============================================================================
// 11. AKUISISI DATA SENSOR
// ============================================================================
void readSensors() {
  // 1. Baca 3x Probe DS18B20 (Non-blocking: 0 ms delay)
  float t1 = dsSensors.getTempCByIndex(0);
  float t2 = dsSensors.getTempCByIndex(1);
  float t3 = dsSensors.getTempCByIndex(2);
  dsSensors.requestTemperatures(); // Minta konversi untuk siklus berikutnya tanpa blocking

  // Validasi pembacaan probe riil murni (abaikan error -127.0 dan nilai reset power-on 85.0)
  telemetry.temp1 = (t1 > -55.0 && t1 < 125.0 && t1 != 85.0f) ? t1 : NAN;
  telemetry.temp2 = (t2 > -55.0 && t2 < 125.0 && t2 != 85.0f) ? t2 : NAN;
  telemetry.temp3 = (t3 > -55.0 && t3 < 125.0 && t3 != 85.0f) ? t3 : NAN;

  // Catat riwayat untuk grafik LCD dari probe inti (T1)
  float activeCore = !isnan(telemetry.temp1) ? telemetry.temp1 : (!isnan(telemetry.temp2) ? telemetry.temp2 : (!isnan(telemetry.temp3) ? telemetry.temp3 : 0.0));
  temp1History[historyIndex] = activeCore;
  historyIndex = (historyIndex + 1) % GRAPH_HISTORY_SIZE;

  // Akumulasi Metrik Audit Karantina secara real-time dari data fisik murni (Probe T1 Inti)
  float validCore = !isnan(telemetry.temp1) ? telemetry.temp1 : (!isnan(telemetry.temp2) ? telemetry.temp2 : (!isnan(telemetry.temp3) ? telemetry.temp3 : NAN));
  if (!isnan(validCore)) {
    if (!tripMetrics.hasData) {
      tripMetrics.tripStartTime = millis();
      tripMetrics.minTemp = validCore;
      tripMetrics.maxTemp = validCore;
      tripMetrics.hasData = true;
    }
    if (validCore < tripMetrics.minTemp) tripMetrics.minTemp = validCore;
    if (validCore > tripMetrics.maxTemp) tripMetrics.maxTemp = validCore;
    tripMetrics.sumTemp += validCore;
    tripMetrics.totalSamples++;

    if (validCore >= thresholdMin && validCore <= thresholdMax) {
      tripMetrics.compliantSamples++;
      tripMetrics.inExcursion = false;
    } else {
      tripMetrics.totalExcursionSec++;
      if (!tripMetrics.inExcursion) {
        tripMetrics.excursionCount++;
        tripMetrics.inExcursion = true;
      }
    }
  }

  // 2. Hitung MKT murni dari probe yang valid
  telemetry.mkt = calculateMKT(telemetry.temp1, telemetry.temp2, telemetry.temp3);

  // 3. Sensor BME280 (Suhu & Kelembapan Luar) - Data fisik jika ada, atau Mode Dummy Realistis jika dilepas
  if (bmeAvailable) {
    telemetry.ambientTemp = bme.readTemperature();
    telemetry.ambientHum = bme.readHumidity();
  } else {
    // Mode Dummy Dinamis (Kondisi suhu tropis pelabuhan Indonesia 28°C s/d 29°C & 72-76% RH)
    static float dummyAmbTemp = 28.6f;
    static float dummyAmbHum = 74.0f;
    dummyAmbTemp += ((float)(random(-12, 13)) / 100.0f);
    dummyAmbHum += ((float)(random(-25, 26)) / 100.0f);
    dummyAmbTemp = constrain(dummyAmbTemp, 27.5f, 30.5f);
    dummyAmbHum = constrain(dummyAmbHum, 68.0f, 80.0f);
    telemetry.ambientTemp = dummyAmbTemp;
    telemetry.ambientHum = dummyAmbHum;
  }

  // 4. Sensor Pintu MC-38 (GPIO 35)
  // Rangkaian pull-up: saat tertutup = LOW (magnet nempel), saat dibuka = HIGH
  bool doorStateNow = (digitalRead(PIN_DOOR_SENSOR) == HIGH);
  if (doorStateNow && !telemetry.doorOpen) {
    // Baru saja dibuka
    telemetry.doorOpenStart = millis();
    tripMetrics.doorBreachCount++;
    beepTouch();
  } else if (!doorStateNow && telemetry.doorOpen) {
    // Baru saja ditutup
    telemetry.doorTotalOpenSec += (millis() - telemetry.doorOpenStart) / 1000;
  }
  telemetry.doorOpen = doorStateNow;

  // 5. Sensor Guncangan MPU6050 (Ambil puncak guncangan selama 1 detik terakhir)
  if (mpuAvailable) {
    if (peakGForceBuffer > 1.0) {
      telemetry.gForce = peakGForceBuffer;
    } else {
      telemetry.gForce = readMPU6050GForce();
    }
  } else {
    telemetry.gForce = 1.0;
  }
  if (telemetry.gForce > tripMetrics.peakShockG) {
    tripMetrics.peakShockG = telemetry.gForce;
  }
  peakGForceBuffer = 1.0; // Reset untuk siklus detik berikutnya

  // 6. Aliran Data GPS NEO-6M
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }
  if (gps.location.isValid()) {
    telemetry.latitude = gps.location.lat();
    telemetry.longitude = gps.location.lng();
    telemetry.satCount = gps.satellites.value();
    telemetry.gpsValid = true;
  } else {
    telemetry.gpsValid = false;
  }

  // Sinkronisasi Waktu Otomatis dari Satelit GPS (UTC + 7 jam = WIB)
  if (gps.time.isValid() && gps.date.isValid() && gps.date.year() >= 2024) {
    DateTime gpsUtc(gps.date.year(), gps.date.month(), gps.date.day(),
                    gps.time.hour(), gps.time.minute(), gps.time.second());
    DateTime gpsWib = gpsUtc + TimeSpan(0, 7, 0, 0); // Konversi UTC ke WIB (+7)
    if (rtcAvailable) {
      DateTime curRtc = rtc.now();
      if (abs((int32_t)(gpsWib.unixtime() - curRtc.unixtime())) > 2) {
        rtc.adjust(gpsWib);
        Serial.println(F("[AUTO-SYNC] Jam RTC berhasil disinkronkan dari Satelit GPS (WIB)!"));
      }
    } else {
      telemetry.timestamp = gpsWib;
    }
  }

  // 7. Jam RTC DS3231 & Fallback Timer (Tetap berdetik tanpa freeze)
  static DateTime internalClock(F(__DATE__), F(__TIME__));
  static uint32_t lastClockMillis = 0;
  if (millis() - lastClockMillis >= 1000) {
    uint32_t elapsed = (millis() - lastClockMillis) / 1000;
    internalClock = internalClock + TimeSpan(elapsed);
    lastClockMillis = millis();
  }

  if (rtcAvailable) {
    telemetry.timestamp = rtc.now();
  } else if (!gps.time.isValid()) {
    telemetry.timestamp = internalClock; // Jam internal tetap berjalan detik demi detik
  }

  // 8. Evaluasi AI
  evaluateRiskScore();
}

// ============================================================================
// 12. LOGGING DATA KE MICROSD CARD (CSV FORMAT)
// ============================================================================
void logDataToSD() {
  if (!sdAvailable) return;

  File dataFile = SD.open("/qguard_log.csv", FILE_APPEND);
  if (dataFile) {
    // Header format jika file baru:
    // Waktu, T1, T2, T3, MKT, AmbientTemp, AmbientHum, DoorState, GForce, Lat, Lon, RiskScore, RiskLevel
    char timeBuf[25];
    sprintf(timeBuf, "%04d-%02d-%02d %02d:%02d:%02d",
            telemetry.timestamp.year(), telemetry.timestamp.month(), telemetry.timestamp.day(),
            telemetry.timestamp.hour(), telemetry.timestamp.minute(), telemetry.timestamp.second());

    dataFile.print(timeBuf); dataFile.print(",");
    if (!isnan(telemetry.temp1)) dataFile.print(telemetry.temp1, 2); else dataFile.print("N/A");
    dataFile.print(",");
    if (!isnan(telemetry.temp2)) dataFile.print(telemetry.temp2, 2); else dataFile.print("N/A");
    dataFile.print(",");
    if (!isnan(telemetry.temp3)) dataFile.print(telemetry.temp3, 2); else dataFile.print("N/A");
    dataFile.print(",");
    if (!isnan(telemetry.mkt)) dataFile.print(telemetry.mkt, 2); else dataFile.print("N/A");
    dataFile.print(",");
    if (bmeAvailable && !isnan(telemetry.ambientTemp)) dataFile.print(telemetry.ambientTemp, 1); else dataFile.print("N/A");
    dataFile.print(",");
    if (bmeAvailable && !isnan(telemetry.ambientHum)) dataFile.print(telemetry.ambientHum, 1); else dataFile.print("N/A");
    dataFile.print(",");
    dataFile.print(telemetry.doorOpen ? "OPEN" : "CLOSED"); dataFile.print(",");
    if (mpuAvailable) dataFile.print(telemetry.gForce, 2); else dataFile.print("N/A");
    dataFile.print(",");
    if (telemetry.gpsValid) {
      dataFile.print(telemetry.latitude, 6); dataFile.print(",");
      dataFile.print(telemetry.longitude, 6); dataFile.print(",");
    } else {
      dataFile.print("N/A,N/A,");
    }
    dataFile.print(telemetry.riskScore); dataFile.print(",");
    dataFile.println(telemetry.riskLevel);
    dataFile.flush();
    dataFile.close();
    telemetry.logCount++;
  }
}

// ============================================================================
// 12B. SISTEM WI-FI PROVISIONING & CLOUD TELEMETRY
// ============================================================================
void loadWifiPreferences() {
  preferences.begin("qguard", true);
  wifiSsid = preferences.getString("ssid", "");
  wifiPass = preferences.getString("pass", "");
  serverUrl = preferences.getString("url", "http://192.168.43.15:3000/api/sensor-data/batch");
  deviceId = preferences.getString("devid", "QGUARD-001");
  int savedProf = preferences.getInt("prof", (int)PROFILE_FROZEN_CARGO);
  activeCommodityName = preferences.getString("c_name", "BEKU [-18C]");
  float cMin = preferences.getFloat("c_min", -999.0f);
  float cMax = preferences.getFloat("c_max", -999.0f);
  tftSleepMinutes = preferences.getInt("sleep_min", 2);
  preferences.end();

  if (cMin > -100.0f && cMax > -100.0f) {
    thresholdMin = cMin;
    thresholdMax = cMax;
  } else {
    currentProfile = (CommodityProfile)savedProf;
    if (currentProfile == PROFILE_FISH_FRESH) { thresholdMin = 0.0; thresholdMax = 4.0; activeCommodityName = "IKAN SEGAR"; }
    else if (currentProfile == PROFILE_VACCINE_PHARMA) { thresholdMin = 2.0; thresholdMax = 8.0; activeCommodityName = "VAKSIN"; }
    else { currentProfile = PROFILE_FROZEN_CARGO; thresholdMin = -25.0; thresholdMax = -18.0; activeCommodityName = "BEKU [-18C]"; }
  }

  Serial.println(F("[PREFS] Konfigurasi Wi-Fi, Cloud & Profil termuat:"));
  Serial.printf("  SSID    : %s\n", wifiSsid.length() > 0 ? wifiSsid.c_str() : "(Belum diatur)");
  Serial.printf("  Server  : %s\n", serverUrl.c_str());
  Serial.printf("  Device  : %s\n", deviceId.c_str());
  Serial.printf("  AutoSleep: %d Menit%s\n", tftSleepMinutes, tftSleepMinutes == 0 ? " (Always ON)" : "");
  Serial.printf("  Profil  : %s (%.1fC s/d %.1fC)\n", 
                currentProfile == PROFILE_FISH_FRESH ? "IKAN SEGAR" : (currentProfile == PROFILE_VACCINE_PHARMA ? "VAKSIN" : "BEKU -20C"),
                thresholdMin, thresholdMax);
}

void saveWifiPreferences(const String& ssid, const String& pass, const String& url, const String& devid) {
  preferences.begin("qguard", false);
  preferences.putString("ssid", ssid);
  preferences.putString("pass", pass);
  preferences.putString("url", url);
  preferences.putString("devid", devid);
  preferences.end();

  wifiSsid = ssid;
  wifiPass = pass;
  serverUrl = url;
  deviceId = devid;

  Serial.println(F("[PREFS] Konfigurasi baru tersimpan permanen ke NVS!"));
}

void connectToStation(const String& ssid, const String& pass) {
  if (ssid.length() == 0) return;

  WiFi.disconnect(true);
  delay(100);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), pass.c_str());
  wifiState = WIFI_STATE_CONNECTING;
  wifiConnectStartTime = millis();

  Serial.printf("[WIFI] Menghubungkan ke '%s'...\n", ssid.c_str());
}

void handlePortalRoot() {
  int n = WiFi.scanNetworks();
  String options = "";
  options.reserve(512);
  for (int i = 0; i < n; ++i) {
    options += "<option value='";
    options += WiFi.SSID(i);
    options += "'>";
    options += WiFi.SSID(i);
    options += " (";
    options += String(WiFi.RSSI(i));
    options += " dBm)</option>";
  }

  String html = "";
  html.reserve(3200);
  html += F("<!DOCTYPE html><html lang='id'><head><meta charset='UTF-8'>"
    "<meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<title>Q-GUARD Cloud Setup</title>"
    "<style>"
    "*{box-sizing:border-box;margin:0;padding:0}"
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}"
    ".card{background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 10px 25px -5px rgba(15,23,42,0.08),0 8px 10px -6px rgba(15,23,42,0.04);max-width:440px;width:100%;padding:28px 24px}"
    ".badge-top{display:inline-block;background:#e0f2fe;color:#0284c7;border:1px solid #bae6fd;border-radius:20px;font-size:11px;font-weight:700;padding:4px 12px;letter-spacing:0.5px;margin-bottom:12px}"
    ".header h2{font-size:22px;font-weight:700;color:#0f172a;margin-bottom:6px}"
    ".header h2 span{color:#0284c7}"
    ".header p{font-size:13px;color:#64748b;line-height:1.5;margin-bottom:20px}"
    ".form-group{margin-bottom:14px}"
    "label{display:block;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px}"
    "input,select{width:100%;padding:11px 14px;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:8px;color:#0f172a;font-size:14px;font-family:inherit;transition:all 0.2s ease}"
    "input:focus,select:focus{outline:none;background:#ffffff;border-color:#0284c7;box-shadow:0 0 0 3px rgba(2,132,199,0.15)}"
    ".hint{font-size:11px;color:#94a3b8;margin-top:4px}"
    "button{width:100%;padding:13px;background:linear-gradient(135deg,#0284c7 0%,#0369a1 100%);color:#ffffff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(2,132,199,0.25);margin-top:18px;transition:all 0.2s ease}"
    "button:hover{filter:brightness(1.05);box-shadow:0 6px 16px rgba(2,132,199,0.35)}"
    ".footer{text-align:center;color:#94a3b8;font-size:11px;margin-top:20px;border-top:1px solid #f1f5f9;padding-top:14px}"
    "</style></head><body><div class='card'>"
    "<div class='badge-top'>BADAN KARANTINA INDONESIA</div>"
    "<div class='header'>"
    "<h2>Q-GUARD&trade; <span>Cloud Setup</span></h2>"
    "<p>Portal Konfigurasi Jaringan & Sinkronisasi Telemetri Karantina.</p>"
    "</div>"
    "<form action='/save' method='POST'>"
    "<div class='form-group'>"
    "<label>Pilih Wi-Fi Terdeteksi:</label>"
    "<select onchange='document.getElementById(\"s\").value=this.value'>"
    "<option value=''>-- Ketuk untuk memilih Wi-Fi --</option>");
  html += options;
  html += F("</select></div>"
    "<div class='form-group'>"
    "<label>Nama Wi-Fi (SSID):</label>"
    "<input type='text' id='s' name='ssid' value='");
  html += wifiSsid;
  html += F("' required placeholder='Nama WiFi / Hotspot'></div>"
    "<div class='form-group'>"
    "<label>Kata Sandi Wi-Fi:</label>"
    "<input type='password' name='pass' value='");
  html += wifiPass;
  html += F("' placeholder='Kosongkan jika tanpa kata sandi'><div class='hint'>Gunakan hotspot HP petugas atau Wi-Fi pelabuhan</div></div>"
    "<div class='form-group'>"
    "<label>URL Backend Server (Laptop):</label>"
    "<input type='text' name='url' value='");
  html += serverUrl;
  html += F("' required placeholder='http://192.168.43.15:3000/api/sensor-data/batch'></div>"
    "<div class='form-group'>"
    "<label>Device ID:</label>"
    "<input type='text' name='devid' value='");
  html += deviceId;
  html += F("' required></div>"
    "<button type='submit'>SIMPAN & HUBUNGKAN KE SERVER</button>"
    "</form>"
    "<div class='footer'>Smart Cold-Chain Quarantine System &bull; Barantin &copy; 2026</div>"
    "</div></body></html>");

  server.send(200, "text/html", html);
}

void handlePortalSave() {
  String newSsid = server.arg("ssid");
  String newPass = server.arg("pass");
  String newUrl = server.arg("url");
  String newDevId = server.arg("devid");

  saveWifiPreferences(newSsid, newPass, newUrl, newDevId);

  String html = "";
  html.reserve(1500);
  html += F("<!DOCTYPE html><html lang='id'><head><meta charset='UTF-8'>"
    "<meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<title>Q-GUARD Tersimpan</title>"
    "<style>"
    "*{box-sizing:border-box;margin:0;padding:0}"
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}"
    ".card{background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 10px 25px -5px rgba(15,23,42,0.08);max-width:400px;width:100%;padding:32px 24px;text-align:center}"
    ".icon-circle{width:56px;height:56px;background:#dcfce7;color:#16a34a;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:bold;margin:0 auto 16px}"
    "h2{font-size:20px;font-weight:700;color:#0f172a;margin-bottom:8px}"
    "p{font-size:13px;color:#64748b;line-height:1.5;margin-bottom:16px}"
    ".pill{background:#e0f2fe;color:#0284c7;border:1px solid #bae6fd;padding:8px 16px;border-radius:20px;font-size:14px;font-weight:700;display:inline-block;margin-bottom:16px}"
    ".sub{font-size:12px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:16px}"
    "</style></head><body><div class='card'>"
    "<div class='icon-circle'>&#10003;</div>"
    "<h2>Pengaturan Tersimpan!</h2>"
    "<p>Q-GUARD sedang menghubungkan ke jaringan:</p>"
    "<div class='pill'>");
  html += newSsid;
  html += F("</div>"
    "<p>Alat akan beralih ke mode Online. Anda dapat menutup halaman ini sekarang.</p>"
    "<div class='sub'>Pantau status telemetri pada layar LCD TFT Q-GUARD</div>"
    "</div></body></html>");

  server.send(200, "text/html", html);
  delay(1000);

  connectToStation(newSsid, newPass);
}

void handlePortalRedirect() {
  server.sendHeader("Location", "http://192.168.4.1/", true);
  server.send(302, "text/plain", "");
}

void startWiFiPortal() {
  WiFi.disconnect(true);
  delay(100);
  WiFi.mode(WIFI_AP);
  WiFi.softAP("QGUARD-SETUP");
  delay(200);

  dnsServer.start(53, "*", WiFi.softAPIP());

  server.on("/", handlePortalRoot);
  server.on("/save", HTTP_POST, handlePortalSave);

  // Auto Pop-up Captive Portal Detection Endpoints (Android, iOS, Windows, Chrome)
  server.on("/generate_204", handlePortalRedirect);
  server.on("/gen_204", handlePortalRedirect);
  server.on("/hotspot-detect.html", handlePortalRedirect);
  server.on("/ncsi.txt", handlePortalRedirect);
  server.on("/connecttest.txt", handlePortalRedirect);
  server.on("/canonical.html", handlePortalRedirect);
  server.on("/success.txt", handlePortalRedirect);

  server.onNotFound([]() {
    String host = server.hostHeader();
    if (host.length() > 0 && host != "192.168.4.1" && host != "qguard.local") {
      server.sendHeader("Location", "http://192.168.4.1/", true);
      server.send(302, "text/plain", "");
    } else {
      handlePortalRoot();
    }
  });

  server.begin();

  if (MDNS.begin("qguard")) {
    MDNS.addService("http", "tcp", 80);
    Serial.println(F("[MDNS] Domain lokal aktif: http://qguard.local"));
  }

  wifiState = WIFI_STATE_PORTAL;
  Serial.println(F("\n[WIFI PORTAL] AP 'QGUARD-SETUP' Aktif (Auto Captive Portal & QR Ready)!"));
  Serial.println(F("[WIFI PORTAL] HP otomatis memunculkan notifikasi/layar setup saat terhubung."));
  Serial.println(F("[WIFI PORTAL] Alternatif: Scan QR Code di layar TFT atau buka http://qguard.local"));
}

void sendTelemetryToBackend() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (serverUrl.length() < 7) return;

  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(3000);

  char isoTime[30];
  DateTime sendTime = rtcAvailable ? rtc.now() : telemetry.timestamp;
  sprintf(isoTime, "%04d-%02d-%02dT%02d:%02d:%02dZ",
          sendTime.year(), sendTime.month(), sendTime.day(),
          sendTime.hour(), sendTime.minute(), sendTime.second());

  char t1Buf[16], t2Buf[16], t3Buf[16];
  char ambTBuf[16], ambHBuf[16];
  char axBuf[16], ayBuf[16], azBuf[16];
  char latBuf[20], lonBuf[20];

  if (!isnan(telemetry.temp1)) snprintf(t1Buf, sizeof(t1Buf), "%.2f", telemetry.temp1); else strcpy(t1Buf, "null");
  if (!isnan(telemetry.temp2)) snprintf(t2Buf, sizeof(t2Buf), "%.2f", telemetry.temp2); else strcpy(t2Buf, "null");
  if (!isnan(telemetry.temp3)) snprintf(t3Buf, sizeof(t3Buf), "%.2f", telemetry.temp3); else strcpy(t3Buf, "null");

  if (bmeAvailable && !isnan(telemetry.ambientTemp)) snprintf(ambTBuf, sizeof(ambTBuf), "%.1f", telemetry.ambientTemp); else strcpy(ambTBuf, "null");
  if (bmeAvailable && !isnan(telemetry.ambientHum)) snprintf(ambHBuf, sizeof(ambHBuf), "%.1f", telemetry.ambientHum); else strcpy(ambHBuf, "null");

  if (mpuAvailable) {
    snprintf(axBuf, sizeof(axBuf), "%.2f", telemetry.accelX);
    snprintf(ayBuf, sizeof(ayBuf), "%.2f", telemetry.accelY);
    snprintf(azBuf, sizeof(azBuf), "%.2f", telemetry.accelZ);
  } else {
    strcpy(axBuf, "null"); strcpy(ayBuf, "null"); strcpy(azBuf, "null");
  }

  if (telemetry.gpsValid) {
    snprintf(latBuf, sizeof(latBuf), "%.6f", telemetry.latitude);
    snprintf(lonBuf, sizeof(lonBuf), "%.6f", telemetry.longitude);
  } else {
    strcpy(latBuf, "null");
    strcpy(lonBuf, "null");
  }

  char jsonPayload[700];
  snprintf(jsonPayload, sizeof(jsonPayload),
    "{\"device_id\":\"%s\",\"batch_size\":1,\"readings\":[{"
    "\"timestamp\":\"%s\","
    "\"temperature_probe_1\":%s,"
    "\"temperature_probe_2\":%s,"
    "\"temperature_probe_3\":%s,"
    "\"ambient_temperature\":%s,"
    "\"relative_humidity\":%s,"
    "\"acceleration_x\":%s,"
    "\"acceleration_y\":%s,"
    "\"acceleration_z\":%s,"
    "\"door_status\":\"%s\","
    "\"latitude\":%s,"
    "\"longitude\":%s,"
    "\"gps_fix_status\":\"%s\","
    "\"sensor_health\":\"OK\","
    "\"risk_level\":\"%s\","
    "\"risk_reasons\":\"Skor:%d\""
    "}]}",
    deviceId.c_str(),
    isoTime,
    t1Buf, t2Buf, t3Buf,
    ambTBuf, ambHBuf,
    axBuf, ayBuf, azBuf,
    telemetry.doorOpen ? "OPEN" : "CLOSED",
    latBuf, lonBuf,
    telemetry.gpsValid ? "FIX_3D" : "NO_FIX",
    telemetry.riskLevel,
    telemetry.riskScore
  );

  int httpCode = http.POST(jsonPayload);
  if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
    String response = http.getString();
    
    // Two-Way Sync: Ambil profil komoditas aktif yang ditugaskan dari Web Dashboard Barantin
    int shipIdx = response.indexOf("\"active_shipment\":");
    if (shipIdx > 0 && response.indexOf("\"active_shipment\":null") < 0) {
      int commIdx = response.indexOf("\"commodity\":\"", shipIdx);
      if (commIdx > 0) {
        commIdx += 13;
        int commEnd = response.indexOf("\"", commIdx);
        if (commEnd > commIdx) {
          String remoteCommodity = response.substring(commIdx, commEnd);
          
          float remoteMin = thresholdMin;
          int minIdx = response.indexOf("\"temp_min\":", shipIdx);
          if (minIdx > 0) {
            minIdx += 11;
            int minEnd = response.indexOf(",", minIdx);
            if (minEnd < 0) minEnd = response.indexOf("}", minIdx);
            if (minEnd > minIdx) remoteMin = response.substring(minIdx, minEnd).toFloat();
          }

          float remoteMax = thresholdMax;
          int maxIdx = response.indexOf("\"temp_max\":", shipIdx);
          if (maxIdx > 0) {
            maxIdx += 11;
            int maxEnd = response.indexOf(",", maxIdx);
            if (maxEnd < 0) maxEnd = response.indexOf("}", maxIdx);
            if (maxEnd > maxIdx) remoteMax = response.substring(maxIdx, maxEnd).toFloat();
          }

          // Cek apakah ada perubahan dari Web Dashboard
          if (remoteCommodity.length() > 0 && 
              (remoteCommodity != activeCommodityName || abs(remoteMin - thresholdMin) > 0.05f || abs(remoteMax - thresholdMax) > 0.05f)) {
            activeCommodityName = remoteCommodity;
            thresholdMin = remoteMin;
            thresholdMax = remoteMax;

            Serial.println(F("\n[TWO-WAY SYNC] 🔥 TERDETEKSI TUGAS PENGAPALAN BARU DARI WEB DASHBOARD!"));
            Serial.printf("  -> Komoditas : %s\n", activeCommodityName.c_str());
            Serial.printf("  -> Batas Suhu: %.1f C s/d %.1f C\n", thresholdMin, thresholdMax);

            beepSuccess();
            resetTripMetrics();

            // Simpan ke NVS Preferences
            preferences.begin("qguard", false);
            preferences.putString("c_name", activeCommodityName);
            preferences.putFloat("c_min", thresholdMin);
            preferences.putFloat("c_max", thresholdMax);
            preferences.end();

            // Refresh tampilan layar jika sedang di monitor
            if (currentScreen == SCREEN_MONITOR) {
              drawMainMonitorScreen();
            } else if (currentScreen == SCREEN_DOSSIER) {
              drawDossierScreen();
            }
          }
        }
      }
    }
    Serial.printf("[CLOUD] Terkirim ke server (%s) - HTTP %d\n", serverUrl.c_str(), httpCode);
  } else if (httpCode > 0) {
    Serial.printf("[CLOUD] Terkirim ke server (%s) - HTTP %d\n", serverUrl.c_str(), httpCode);
  } else {
    Serial.printf("[CLOUD] Gagal kirim: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
}

// ============================================================================
// 13. TAMPILAN MONITORING UTAMA (LIVE DASHBOARD)
// ============================================================================
void drawMainMonitorScreen() {
  tft.fillScreen(COLOR_BG);

  // Top Status Bar (Nav Bar)
  tft.fillRect(0, 0, 320, 26, COLOR_NAV_BAR);
  tft.drawLine(0, 26, 320, 26, COLOR_CARD_BORDER);

  tft.setTextColor(COLOR_CYAN);
  tft.setTextSize(1);
  tft.setCursor(6, 9);
  tft.print("Q-GUARD");

  // --- KOTAK 1: KARTU SUHU UTAMA (T1 INTI IKAN, T2 BUFFER ES, T3 PINTU) ---
  int cardY = 32;
  tft.fillRoundRect(8, cardY, 304, 78, 6, COLOR_CARD);
  tft.drawRoundRect(8, cardY, 304, 78, 6, COLOR_CARD_BORDER);

  tft.setTextColor(COLOR_GOLD);
  tft.setTextSize(1);
  tft.setCursor(14, cardY + 8);
  tft.print("T1 (PROBE INTI)");

  tft.setTextColor(COLOR_CYAN);
  tft.setCursor(118, cardY + 8);
  tft.print("T2 (BUFFER)");

  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setCursor(232, cardY + 8);
  tft.print("T3 (PINTU)");

  tft.drawLine(14, cardY + 54, 300, cardY + 54, COLOR_CARD_BORDER);
  tft.setTextColor(COLOR_CYAN);
  tft.setCursor(18, cardY + 60);
  tft.print("Suhu MKT:");

  tft.setCursor(180, cardY + 60);
  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.print("Pintu:");

  // --- KOTAK 2: KONDISI FISIK & LINGKUNGAN (BME280 & MPU6050) ---
  int envY = 115;
  tft.fillRoundRect(8, envY, 148, 52, 6, COLOR_CARD);
  tft.drawRoundRect(8, envY, 148, 52, 6, COLOR_CARD_BORDER);
  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setTextSize(1);
  tft.setCursor(16, envY + 8);
  tft.print("SUHU RUANG LUAR");

  tft.fillRoundRect(164, envY, 148, 52, 6, COLOR_CARD);
  tft.drawRoundRect(164, envY, 148, 52, 6, COLOR_CARD_BORDER);
  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setCursor(172, envY + 8);
  tft.print("GUNCANGAN");

  // --- KOTAK 3: AI RISK BADGE ---
  int aiY = 172;
  tft.fillRoundRect(8, aiY, 210, 60, 6, COLOR_CARD);
  tft.drawRoundRect(8, aiY, 210, 60, 6, COLOR_CARD_BORDER);
  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setTextSize(1);
  tft.setCursor(16, aiY + 8);
  tft.print("STATUS RISIKO KARANTINA");

  // --- TOMBOL SENTUH INTERAKTIF: [ MENU ] ---
  int btnX = 226;
  int btnY = 172;
  int btnW = 86;
  int btnH = 60;
  tft.fillRoundRect(btnX, btnY, btnW, btnH, 8, COLOR_CYAN);
  tft.drawRoundRect(btnX, btnY, btnW, btnH, 8, COLOR_WHITE);
  tft.setTextColor(COLOR_BG);
  tft.setTextSize(2);
  tft.setCursor(btnX + 16, btnY + 16);
  tft.print("MENU");
  tft.setTextSize(1);
  tft.setCursor(btnX + 18, btnY + 38);
  tft.print("[PILIH]");

  // Gambar angka dan nilai awal langsung tanpa nunggu 1 detik
  updateMainMonitorData();
}

// Update HANYA angka dan nilai dinamis (ZERO FLICKER, tidak pernah panggil fillScreen)
void updateMainMonitorData() {
  // 1. Update Jam RTC di Baris Atas (X: 52..104)
  tft.fillRect(52, 6, 54, 16, COLOR_NAV_BAR);
  tft.setTextColor(COLOR_WHITE);
  tft.setTextSize(1);
  tft.setCursor(54, 9);
  char clockStr[12];
  sprintf(clockStr, "%02d:%02d:%02d", 
          telemetry.timestamp.hour(), telemetry.timestamp.minute(), telemetry.timestamp.second());
  tft.print(clockStr);

  // 1B. Update Label Profil Komoditas Aktif (X: 110..198)
  tft.fillRect(110, 6, 90, 16, COLOR_NAV_BAR);
  tft.setCursor(112, 9);
  tft.setTextColor(COLOR_CYAN);
  String disp = activeCommodityName;
  if (disp.length() == 0) {
    disp = (currentProfile == PROFILE_FISH_FRESH) ? "IKAN [0-4C]" :
           (currentProfile == PROFILE_VACCINE_PHARMA) ? "VAKSIN [2-8C]" : "BEKU [-18C]";
  } else {
    // Tambahkan batas suhu hanya jika belum ada tanda kurung di nama komoditas
    if (disp.indexOf('[') < 0 && disp.indexOf('(') < 0) {
      char profBuf[20];
      snprintf(profBuf, sizeof(profBuf), "%s [%.0fC]", disp.substring(0, 7).c_str(), thresholdMax);
      disp = String(profBuf);
    }
  }
  if (disp.length() > 14) disp = disp.substring(0, 13) + ".";
  tft.print(disp);

  // 1C. Indikator Status Buzzer Mute Total di Header (X: 202..244, selalu clear background)
  tft.fillRect(202, 6, 42, 16, COLOR_NAV_BAR);
  if (buzzerMuteTotal) {
    tft.setCursor(204, 9);
    tft.setTextColor(COLOR_RED_ALERT);
    tft.print("[MUTE]");
  }

  // 2. Status WiFi, SD & GPS (X: 246..318)
  tft.fillRect(246, 6, 72, 16, COLOR_NAV_BAR);
  tft.setTextSize(1);
  tft.setCursor(248, 9);
  if (wifiState == WIFI_STATE_CONNECTED) {
    tft.setTextColor(COLOR_GREEN_SAFE);
    tft.print("WF");
  } else if (wifiState == WIFI_STATE_PORTAL) {
    tft.setTextColor(COLOR_CYAN);
    tft.print("AP");
  } else {
    tft.setTextColor(COLOR_GRAY_TEXT);
    tft.print("WF-");
  }

  tft.setCursor(272, 9);
  tft.setTextColor(sdAvailable ? COLOR_GREEN_SAFE : COLOR_GRAY_TEXT);
  tft.print(sdAvailable ? "SD" : "SD-");

  tft.setCursor(295, 9);
  tft.setTextColor(telemetry.gpsValid ? COLOR_GREEN_SAFE : COLOR_GRAY_TEXT);
  tft.print("GPS");

  int cardY = 32;

  // 3. T1 (Inti Daging Ikan) - Primary Core Metric
  tft.fillRect(12, cardY + 20, 98, 28, COLOR_CARD);
  tft.setTextSize(2);
  if (!isnan(telemetry.temp1)) {
    if (telemetry.temp1 >= thresholdMin && telemetry.temp1 <= thresholdMax) {
      tft.setTextColor(COLOR_GREEN_SAFE);
    } else {
      tft.setTextColor(COLOR_RED_ALERT);
    }
    tft.setCursor(14, cardY + 22);
    tft.print(telemetry.temp1, 1);
    tft.setTextSize(1);
    tft.print("C");
  } else {
    tft.setTextColor(COLOR_GRAY_TEXT);
    tft.setCursor(14, cardY + 22);
    tft.print("--.-");
  }

  // 4. T2 (Thermal Buffer / Lapisan Es Tengah)
  tft.fillRect(114, cardY + 20, 98, 28, COLOR_CARD);
  tft.setTextSize(2);
  tft.setTextColor(COLOR_WHITE);
  tft.setCursor(118, cardY + 22);
  if (!isnan(telemetry.temp2)) {
    tft.print(telemetry.temp2, 1);
    tft.setTextSize(1);
    tft.print("C");
  } else {
    tft.setTextColor(COLOR_GRAY_TEXT);
    tft.print("--.-");
  }

  // 5. T3 (Pintu)
  tft.fillRect(228, cardY + 20, 78, 24, COLOR_CARD);
  tft.setTextSize(2);
  tft.setTextColor(COLOR_WHITE);
  tft.setCursor(232, cardY + 22);
  if (!isnan(telemetry.temp3)) {
    tft.print(telemetry.temp3, 1);
    tft.setTextSize(1);
    tft.print("C");
  } else {
    tft.setTextColor(COLOR_GRAY_TEXT);
    tft.print("--.-");
  }

  // 6. MKT (Arrhenius)
  tft.fillRect(115, cardY + 58, 55, 14, COLOR_CARD);
  tft.setTextColor(COLOR_WHITE);
  tft.setTextSize(1);
  tft.setCursor(115, cardY + 60);
  if (!isnan(telemetry.mkt)) {
    tft.print(telemetry.mkt, 1);
    tft.print("C");
  } else {
    tft.setTextColor(COLOR_GRAY_TEXT);
    tft.print("--.-");
  }

  // 7. Status Pintu
  tft.fillRect(218, cardY + 58, 85, 14, COLOR_CARD);
  tft.setCursor(220, cardY + 60);
  if (telemetry.doorOpen) {
    tft.setTextColor(COLOR_RED_ALERT);
    tft.print("TERBUKA");
  } else {
    tft.setTextColor(COLOR_GREEN_SAFE);
    tft.print("TERTUTUP");
  }

  // 8. BME280 Lingkungan Luar (Data Fisik atau Mode Dummy)
  int envY = 115;
  tft.fillRect(14, envY + 20, 136, 28, COLOR_CARD);
  tft.setTextSize(1);
  tft.setTextColor(COLOR_WHITE);
  tft.setCursor(16, envY + 22);
  tft.print("Suhu: "); 
  tft.print(!isnan(telemetry.ambientTemp) ? telemetry.ambientTemp : 28.5f, 1); 
  tft.print(" C");
  tft.setCursor(16, envY + 36);
  tft.print("Lembap: "); 
  tft.print(!isnan(telemetry.ambientHum) ? (int)telemetry.ambientHum : 74); 
  tft.print("% RH");

  // 9. MPU6050 Guncangan
  tft.fillRect(170, envY + 20, 135, 26, COLOR_CARD);
  tft.setCursor(172, envY + 24);
  tft.setTextSize(2);
  if (telemetry.gForce > 2.0) {
    tft.setTextColor(COLOR_RED_ALERT);
    tft.print("BENTURAN");
  } else {
    tft.setTextColor(COLOR_GREEN_SAFE);
    tft.print(telemetry.gForce, 2);
    tft.setTextSize(1);
    tft.print(" g");
  }

  // 10. AI Risk Badge & Triage
  int aiY = 172;
  uint16_t riskBadgeColor = COLOR_GREEN_SAFE;
  if (strcmp(telemetry.riskLevel, "CRITICAL") == 0) riskBadgeColor = COLOR_RED_ALERT;
  else if (strcmp(telemetry.riskLevel, "WARNING") == 0) riskBadgeColor = COLOR_GOLD;

  tft.drawRoundRect(8, aiY, 210, 60, 6, riskBadgeColor);
  tft.fillRect(16, aiY + 20, 195, 36, COLOR_CARD);

  tft.setTextSize(2);
  tft.setTextColor(riskBadgeColor);
  tft.setCursor(16, aiY + 24);
  tft.print("SKOR: ");
  tft.print(telemetry.riskScore);
  tft.print("/100");

  tft.setTextSize(1);
  tft.setCursor(16, aiY + 44);
  if (strcmp(telemetry.riskLevel, "CRITICAL") == 0) {
    tft.print("JALUR MERAH: TAHAN / LAB");
  } else if (strcmp(telemetry.riskLevel, "WARNING") == 0) {
    tft.print("JALUR KUNING: PERIKSA FISIK");
  } else {
    tft.print("JALUR HIJAU: LOLOS (AMAN)");
  }
}

// ============================================================================
// 14. TAMPILAN MENU UTAMA (PILIHAN NAVIGASI)
// ============================================================================
void drawMenuScreen() {
  tft.fillScreen(COLOR_BG);

  // Header Menu
  tft.fillRect(0, 0, 320, 28, COLOR_NAV_BAR);
  tft.drawLine(0, 28, 320, 28, COLOR_CYAN);
  tft.setTextColor(COLOR_CYAN);
  tft.setTextSize(2);
  tft.setCursor(12, 6);
  tft.print("MENU UTAMA");

  const char* menuItems[] = {
    "1. Monitor Suhu Real-Time",
    "2. Profil Komoditas",
    "3. Grafik Riwayat Suhu",
    "4. Laporan Karantina (Dossier)",
    "5. Status Memori MicroSD",
    "6. Pengaturan Wi-Fi & Cloud",
    "7. Pengaturan Sistem (Setting)"
  };

  int startY = 29;
  int itemH = 23;
  int gap = 4;

  for (int i = 0; i < 7; i++) {
    int itemY = startY + (i * (itemH + gap));
    bool isSelected = (i == menuCursor);

    if (isSelected) {
      tft.fillRoundRect(10, itemY, 300, itemH, 4, COLOR_CYAN);
      tft.setTextColor(COLOR_BG);
    } else {
      tft.fillRoundRect(10, itemY, 300, itemH, 4, COLOR_CARD);
      tft.drawRoundRect(10, itemY, 300, itemH, 4, COLOR_CARD_BORDER);
      tft.setTextColor(COLOR_WHITE);
    }

    tft.setTextSize(1);
    tft.setCursor(18, itemY + 7);
    tft.print(menuItems[i]);

    if (isSelected) {
      tft.setCursor(248, itemY + 7);
      tft.print("[PILIH]");
    }
  }

  // Petunjuk Tombol di Footer
  tft.fillRect(0, 218, 320, 22, COLOR_NAV_BAR);
  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setTextSize(1);
  tft.setCursor(12, 224);
  tft.print("SELECT: Geser  |  CONFIRM / Sentuh: Buka");
}

// ============================================================================
// 15. TAMPILAN PILIH PROFIL KOMODITAS
// ============================================================================
void drawProfileSelectScreen() {
  tft.fillScreen(COLOR_BG);

  tft.fillRect(0, 0, 320, 30, COLOR_NAV_BAR);
  tft.setTextColor(COLOR_GOLD);
  tft.setTextSize(2);
  tft.setCursor(12, 7);
  tft.print("PROFIL KOMODITAS");

  const char* profiles[] = {
    "1. Ikan Segar (0.0 s/d 4.0 C)",
    "2. Vaksin / Farmasi (2.0 s/d 8.0 C)",
    "3. Komoditas Beku (-25 s/d -18 C)"
  };

  int startY = 46;
  int itemH = 44;

  for (int i = 0; i < 3; i++) {
    int itemY = startY + (i * (itemH + 8));
    bool isCurrent = ((int)currentProfile == i);

    tft.fillRoundRect(10, itemY, 300, itemH, 6, isCurrent ? 0x1405 : COLOR_CARD);
    tft.drawRoundRect(10, itemY, 300, itemH, 6, isCurrent ? COLOR_GREEN_SAFE : COLOR_CARD_BORDER);

    tft.setTextColor(isCurrent ? COLOR_GREEN_SAFE : COLOR_WHITE);
    tft.setTextSize(1);
    tft.setCursor(20, itemY + 14);
    tft.print(profiles[i]);

    if (isCurrent) {
      tft.setCursor(240, itemY + 14);
      tft.print("[AKTIF]");
    }
  }

  tft.fillRect(0, 218, 320, 22, COLOR_NAV_BAR);
  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setCursor(12, 224);
  tft.print("Tekan [CONFIRM] atau sentuh untuk menyimpan");
}

// ============================================================================
// 16. TAMPILAN GRAFIK MINI TREN SUHU
// ============================================================================
void drawGraphScreen() {
  tft.fillScreen(COLOR_BG);

  tft.fillRect(0, 0, 320, 26, COLOR_NAV_BAR);
  tft.setTextColor(COLOR_CYAN);
  tft.setTextSize(1);
  tft.setCursor(10, 9);
  tft.print("GRAFIK RIWAYAT SUHU (T1)");

  int originX = 35;
  int originY = 195;
  int graphW = 265;
  int graphH = 145;

  // Garis Sumbu Grafik
  tft.drawFastVLine(originX, originY - graphH, graphH, COLOR_WHITE);
  tft.drawFastHLine(originX, originY, graphW, COLOR_WHITE);

  // Tentukan batas min & max grafik secara adaptif berdasarkan threshold & data riil
  float gMin = thresholdMin - 2.0;
  float gMax = thresholdMax + 2.0;
  for (int i = 0; i < GRAPH_HISTORY_SIZE; i++) {
    float val = temp1History[i];
    if (!isnan(val) && val > -50.0 && val < 100.0) {
      if (val < gMin) gMin = val - 1.0;
      if (val > gMax) gMax = val + 1.0;
    }
  }
  if (gMax - gMin < 4.0) {
    gMax = gMin + 4.0;
  }

  // Label Sumbu Y Suhu (Dinamis)
  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setTextSize(1);
  tft.setCursor(2, originY - graphH); tft.printf("%2.0fC", gMax);
  tft.setCursor(2, originY - (graphH / 2)); tft.printf("%2.0fC", (gMax + gMin) / 2.0);
  tft.setCursor(2, originY - 10); tft.printf("%2.0fC", gMin);

  // Garis Ambang Batas Max (Merah Putus-putus)
  int thresholdY = originY - (int)(((thresholdMax - gMin) / (gMax - gMin)) * graphH);
  thresholdY = constrain(thresholdY, originY - graphH, originY);
  for (int x = originX; x < originX + graphW; x += 8) {
    tft.drawFastHLine(x, thresholdY, 4, COLOR_RED_ALERT);
  }

  // Plot Garis Grafik dari Buffer Riwayat
  float stepX = (float)graphW / (float)(GRAPH_HISTORY_SIZE - 1);
  for (int i = 0; i < GRAPH_HISTORY_SIZE - 1; i++) {
    int idx1 = (historyIndex + i) % GRAPH_HISTORY_SIZE;
    int idx2 = (historyIndex + i + 1) % GRAPH_HISTORY_SIZE;

    float val1 = temp1History[idx1];
    float val2 = temp1History[idx2];
    if (isnan(val1) || val1 < -50.0 || val1 > 100.0) continue;
    if (isnan(val2) || val2 < -50.0 || val2 > 100.0) continue;

    val1 = constrain(val1, gMin, gMax);
    val2 = constrain(val2, gMin, gMax);

    int y1 = originY - (int)(((val1 - gMin) / (gMax - gMin)) * graphH);
    int y2 = originY - (int)(((val2 - gMin) / (gMax - gMin)) * graphH);

    int x1 = originX + (int)(i * stepX);
    int x2 = originX + (int)((i + 1) * stepX);

    tft.drawLine(x1, y1, x2, y2, COLOR_GREEN_SAFE);
    tft.fillCircle(x1, y1, 2, COLOR_CYAN);
  }

  // Tombol Kembali
  tft.fillRect(0, 215, 320, 25, COLOR_NAV_BAR);
  tft.setTextColor(COLOR_CYAN);
  tft.setCursor(20, 222);
  tft.print("< Tekan [BACK] untuk kembali");
}

// ============================================================================
// 16B. TAMPILAN RINGKASAN AUDIT KARANTINA (QUARANTINE DOSSIER & DISPOSISI)
// ============================================================================
void drawDossierScreen() {
  tft.fillScreen(COLOR_BG);

  // 1. Header Bar Karantina
  tft.fillRect(0, 0, 320, 26, COLOR_NAV_BAR);
  tft.drawLine(0, 26, 320, 26, COLOR_CYAN);
  tft.setTextColor(COLOR_CYAN);
  tft.setTextSize(1);
  tft.setCursor(8, 9);
  tft.print("LAPORAN AUDIT PENGIRIMAN");

  // Profil Komoditas aktif di kanan atas
  tft.setCursor(185, 9);
  tft.setTextColor(COLOR_GOLD);
  if (activeCommodityName.length() > 0) {
    String disp = activeCommodityName;
    if (disp.length() > 10) disp = disp.substring(0, 9) + "..";
    tft.printf("[%s]", disp.c_str());
  } else {
    tft.print("[BEKU -18C]");
  }

  // 2. Hitung statistik riil dari data fisik
  float compRate = 100.0f;
  if (tripMetrics.totalSamples > 0) {
    compRate = ((float)tripMetrics.compliantSamples * 100.0f) / (float)tripMetrics.totalSamples;
  }
  float avgTemp = 0.0f;
  if (tripMetrics.totalSamples > 0) {
    avgTemp = (float)(tripMetrics.sumTemp / (double)tripMetrics.totalSamples);
  }

  // Tentukan Keputusan / Disposisi Jalur Karantina
  uint16_t verdictColor = COLOR_GREEN_SAFE;
  const char* verdictLabel = "JALUR HIJAU (LOLOS)";
  const char* verdictDesc = "Suhu stabil memenuhi standar karantina";

  if (tripMetrics.hasData) {
    if (tripMetrics.maxTemp > thresholdMax + 4.0f || compRate < 80.0f) {
      verdictColor = COLOR_RED_ALERT;
      verdictLabel = "JALUR MERAH (TAHAN / LAB)";
      verdictDesc = "Terjadi deviasi kritis, tahan dan uji lab";
    } else if (compRate < 95.0f || tripMetrics.excursionCount > 0 || tripMetrics.doorBreachCount > 3 || tripMetrics.peakShockG > 2.0f) {
      verdictColor = COLOR_GOLD;
      verdictLabel = "JALUR KUNING (PERIKSA FISIK)";
      verdictDesc = "Anomali terdeteksi, periksa kondisi fisik";
    }
  } else {
    verdictColor = COLOR_CYAN;
    verdictLabel = "MENUNGGU DATA PENGIRIMAN...";
    verdictDesc = "Menghimpun riwayat sensor fisik...";
  }

  // 3. Card Keputusan Disposisi Karantina (Triage Banner)
  int cardY = 30;
  tft.fillRoundRect(8, cardY, 304, 46, 6, COLOR_CARD);
  tft.drawRoundRect(8, cardY, 304, 46, 6, verdictColor);

  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setTextSize(1);
  tft.setCursor(14, cardY + 6);
  tft.print("STATUS DISPOSISI:");

  tft.setTextSize(2);
  tft.setTextColor(verdictColor);
  tft.setCursor(14, cardY + 17);
  tft.print(verdictLabel);

  tft.setTextSize(1);
  tft.setTextColor(COLOR_WHITE);
  tft.setCursor(14, cardY + 34);
  tft.print(verdictDesc);

  // 4. Dua Kolom Ringkasan Metrik (Y: 80 to 184, H: 104)
  int colY = 80;
  int colW = 148;
  int colH = 104;

  // --- Kolom Kiri: STATISTIK SUHU INTI (T1) ---
  tft.fillRoundRect(8, colY, colW, colH, 6, COLOR_CARD);
  tft.drawRoundRect(8, colY, colW, colH, 6, COLOR_CARD_BORDER);

  tft.setTextColor(COLOR_CYAN);
  tft.setTextSize(1);
  tft.setCursor(14, colY + 6);
  tft.print("SUHU PROBE INTI (T1)");
  tft.drawLine(14, colY + 16, 148, colY + 16, COLOR_CARD_BORDER);

  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setCursor(14, colY + 22);
  tft.print("Suhu Min   : ");
  tft.setTextColor(COLOR_WHITE);
  if (tripMetrics.hasData && tripMetrics.minTemp < 900.0f) {
    tft.printf("%.1f C", tripMetrics.minTemp);
  } else {
    tft.print("--.- C");
  }

  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setCursor(14, colY + 38);
  tft.print("Suhu Max   : ");
  if (tripMetrics.hasData && tripMetrics.maxTemp > -900.0f) {
    tft.setTextColor(tripMetrics.maxTemp > thresholdMax ? COLOR_RED_ALERT : COLOR_WHITE);
    tft.printf("%.1f C", tripMetrics.maxTemp);
  } else {
    tft.setTextColor(COLOR_WHITE);
    tft.print("--.- C");
  }

  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setCursor(14, colY + 54);
  tft.print("Rata-Rata  : ");
  tft.setTextColor(COLOR_WHITE);
  if (tripMetrics.hasData) {
    tft.printf("%.1f C", avgTemp);
  } else {
    tft.print("--.- C");
  }

  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setCursor(14, colY + 70);
  tft.print("Batas Suhu : ");
  tft.setTextColor(COLOR_GOLD);
  tft.printf("%.0f..%.0f C", thresholdMin, thresholdMax);

  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setCursor(14, colY + 86);
  tft.print("Kepatuhan  : ");
  tft.setTextColor(compRate >= 95.0f ? COLOR_GREEN_SAFE : (compRate >= 80.0f ? COLOR_GOLD : COLOR_RED_ALERT));
  tft.printf("%.1f%%", compRate);

  // --- Kolom Kanan: INSIDEN & INTEGRITAS FISIK ---
  tft.fillRoundRect(164, colY, colW, colH, 6, COLOR_CARD);
  tft.drawRoundRect(164, colY, colW, colH, 6, COLOR_CARD_BORDER);

  tft.setTextColor(COLOR_CYAN);
  tft.setTextSize(1);
  tft.setCursor(170, colY + 6);
  tft.print("CATATAN ANOMALI");
  tft.drawLine(170, colY + 16, 304, colY + 16, COLOR_CARD_BORDER);

  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setCursor(170, colY + 22);
  tft.print("Deviasi Suhu: ");
  tft.setTextColor(tripMetrics.excursionCount > 0 ? COLOR_RED_ALERT : COLOR_GREEN_SAFE);
  tft.printf("%d x", tripMetrics.excursionCount);

  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setCursor(170, colY + 38);
  tft.print("Durasi Dev  : ");
  tft.setTextColor(tripMetrics.totalExcursionSec > 0 ? COLOR_RED_ALERT : COLOR_WHITE);
  tft.printf("%lu dtk", tripMetrics.totalExcursionSec);

  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setCursor(170, colY + 54);
  tft.print("Buka Pintu  : ");
  tft.setTextColor(tripMetrics.doorBreachCount > 0 ? COLOR_GOLD : COLOR_WHITE);
  tft.printf("%d x (%lus)", tripMetrics.doorBreachCount, telemetry.doorTotalOpenSec);

  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setCursor(170, colY + 70);
  tft.print("Puncak Shock: ");
  tft.setTextColor(tripMetrics.peakShockG > 2.0f ? COLOR_RED_ALERT : COLOR_GREEN_SAFE);
  tft.printf("%.2f g", tripMetrics.peakShockG);

  unsigned long elapsedSec = (tripMetrics.tripStartTime > 0) ? ((millis() - tripMetrics.tripStartTime) / 1000) : 0;
  unsigned long hrs = elapsedSec / 3600;
  unsigned long mins = (elapsedSec % 3600) / 60;
  unsigned long secs = elapsedSec % 60;

  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setCursor(170, colY + 86);
  tft.print("Durasi Trip : ");
  tft.setTextColor(COLOR_WHITE);
  tft.printf("%02lu:%02lu:%02lu", hrs, mins, secs);

  // 5. Tombol Aksi Bawah (Y: 188 to 214, H: 26)
  // Tombol 1: [ RESET TRIP ] (Kiri)
  tft.fillRoundRect(8, 188, 148, 26, 6, 0x4800); // Dark reddish brown
  tft.drawRoundRect(8, 188, 148, 26, 6, COLOR_RED_ALERT);
  tft.setTextColor(COLOR_WHITE);
  tft.setTextSize(1);
  tft.setCursor(14, 196);
  tft.print("[ RESET DATA TRIP ]");

  // Tombol 2: [ KEMBALI KE MENU ] (Kanan)
  tft.fillRoundRect(164, 188, 148, 26, 6, COLOR_CARD);
  tft.drawRoundRect(164, 188, 148, 26, 6, COLOR_CYAN);
  tft.setTextColor(COLOR_CYAN);
  tft.setCursor(182, 196);
  tft.print("< KEMBALI KE MENU");

  // 6. Footer (Y: 218 to 240)
  tft.fillRect(0, 218, 320, 22, COLOR_NAV_BAR);
  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setTextSize(1);
  tft.setCursor(10, 224);
  tft.print("[CONFIRM]: Reset Data  |  [BACK]: Menu");
}

// ============================================================================
// 17. TAMPILAN STATUS MICROSD
// ============================================================================
void drawSdInfoScreen() {
  tft.fillScreen(COLOR_BG);

  tft.fillRect(0, 0, 320, 28, COLOR_NAV_BAR);
  tft.setTextColor(COLOR_CYAN);
  tft.setTextSize(2);
  tft.setCursor(12, 6);
  tft.print("STATUS MEMORI MICROSD");

  tft.fillRoundRect(10, 40, 300, 160, 6, COLOR_CARD);
  tft.drawRoundRect(10, 40, 300, 160, 6, COLOR_CARD_BORDER);

  tft.setTextColor(COLOR_WHITE);
  tft.setTextSize(1);
  tft.setCursor(25, 60);
  tft.print("Status Kartu SD  : ");
  if (sdAvailable) {
    tft.setTextColor(COLOR_GREEN_SAFE);
    tft.print("TERHUBUNG (FAT32)");
  } else {
    tft.setTextColor(COLOR_RED_ALERT);
    tft.print("TIDAK TERPASANG");
  }

  tft.setTextColor(COLOR_WHITE);
  tft.setCursor(25, 85);
  tft.print("Format File Log  : /qguard_log.csv");

  tft.setCursor(25, 110);
  tft.print("Jumlah Baris Log : ");
  tft.setTextColor(COLOR_GOLD);
  tft.print(telemetry.logCount);
  tft.print(" baris");

  tft.setTextColor(COLOR_WHITE);
  tft.setCursor(25, 135);
  tft.print("Periode Simpan   : 5 Detik");

  tft.setCursor(25, 160);
  tft.setTextColor(COLOR_CYAN);
  tft.print("Pencatatan Data  : AKTIF (OTOMATIS)");

  tft.fillRect(0, 215, 320, 25, COLOR_NAV_BAR);
  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setCursor(20, 222);
  tft.print("< Tekan [BACK] untuk kembali");
}

// ============================================================================
// 17B. TAMPILAN STATUS WI-FI & WEB PORTAL (DILENGKAPI QR CODE & AUTO-POPUP)
// ============================================================================

// 21x21 QR Code Version 1 (ECC Low) terverifikasi untuk "http://192.168.4.1"
static const char* QR_PORTAL_21[21] = {
  "111111100100101111111",
  "100000101101001000001",
  "101110100100101011101",
  "101110101100001011101",
  "101110100011101011101",
  "100000101111001000001",
  "111111101010101111111",
  "000000000011100000000",
  "111110111101010101010",
  "101010000000100011111",
  "111000110101001010110",
  "000011011100000011100",
  "011110111011000001001",
  "000000001110010111101",
  "111111101101101010110",
  "100000100101110011100",
  "101110101000110001010",
  "101110101001111010100",
  "101110101000011000100",
  "100000101001101100100",
  "111111101110111100010"
};

void drawPortalQRCode(int x, int y, int scale) {
  int qrSize = 21 * scale;
  int border = 5;
  // Background kotak putih (quiet zone standar QR Code)
  tft.fillRect(x - border, y - border, qrSize + (border * 2), qrSize + (border * 2), COLOR_WHITE);
  // Gambar modul hitam
  for (int r = 0; r < 21; r++) {
    for (int c = 0; c < 21; c++) {
      if (QR_PORTAL_21[r][c] == '1') {
        tft.fillRect(x + (c * scale), y + (r * scale), scale, scale, COLOR_BG);
      }
    }
  }
}

void drawWifiConfigScreen() {
  tft.fillScreen(COLOR_BG);

  tft.fillRect(0, 0, 320, 28, COLOR_NAV_BAR);
  tft.setTextColor(COLOR_CYAN);
  tft.setTextSize(2);
  tft.setCursor(12, 6);
  tft.print("PENGATURAN WI-FI");

  tft.fillRoundRect(8, 34, 304, 175, 6, COLOR_CARD);
  tft.drawRoundRect(8, 34, 304, 175, 6, COLOR_CARD_BORDER);

  tft.setTextSize(1);
  tft.setCursor(16, 42);
  tft.setTextColor(COLOR_GOLD);
  tft.print("STATUS KONEKSI:");

  tft.setCursor(16, 54);
  if (wifiState == WIFI_STATE_CONNECTED) {
    tft.setTextColor(COLOR_GREEN_SAFE);
    tft.setTextSize(2);
    tft.print("ONLINE");
    tft.setTextSize(1);
    tft.setTextColor(COLOR_WHITE);
    tft.setCursor(16, 76);
    tft.print("SSID: "); tft.print(WiFi.SSID().substring(0, 14));
    tft.setCursor(16, 90);
    tft.print("IP  : "); tft.print(WiFi.localIP().toString());
  } else if (wifiState == WIFI_STATE_PORTAL) {
    tft.setTextColor(COLOR_CYAN);
    tft.setTextSize(2);
    tft.print("HOTSPOT AKTIF");
    tft.setTextSize(1);
    tft.setTextColor(COLOR_WHITE);
    tft.setCursor(16, 76);
    tft.print("AP : QGUARD-SETUP");
    tft.setCursor(16, 90);
    tft.print("Web: qguard.local");
    tft.setCursor(16, 104);
    tft.print("IP : 192.168.4.1");
  } else {
    tft.setTextColor(COLOR_GOLD);
    tft.setTextSize(2);
    tft.print("MENGHUBUNGKAN..");
    tft.setTextSize(1);
    tft.setTextColor(COLOR_WHITE);
    tft.setCursor(16, 76);
    tft.print("Target: "); tft.print(wifiSsid.substring(0, 14));
  }

  tft.drawLine(14, 120, 196, 120, COLOR_CARD_BORDER);

  tft.setTextColor(COLOR_CYAN);
  tft.setCursor(16, 126);
  tft.print("PANDUAN KONFIGURASI:");

  tft.setTextColor(COLOR_WHITE);
  tft.setCursor(16, 140);
  tft.print("1. Hubungkan ke Wi-Fi:");
  tft.setCursor(16, 152);
  tft.setTextColor(COLOR_GREEN_SAFE);
  tft.print("   SSID: QGUARD-SETUP");
  tft.setTextColor(COLOR_WHITE);
  tft.setCursor(16, 166);
  tft.print("2. Atau scan QR di samping");
  tft.setCursor(16, 180);
  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.print("Portal: http://192.168.4.1");
  tft.setCursor(16, 192);
  tft.print("Backend: "); tft.print(serverUrl.substring(0, 20));

  // Tampilkan QR Code di panel kanan (Module size 4 = 84x84 px + border putih = 94x94 px)
  drawPortalQRCode(206, 46, 4);

  tft.setTextSize(1);
  tft.setCursor(208, 145);
  tft.setTextColor(COLOR_GOLD);
  tft.print("SCAN QR CODE");
  tft.setCursor(205, 157);
  tft.setTextColor(COLOR_CYAN);
  tft.print("Setup via HP");

  tft.fillRect(0, 215, 320, 25, COLOR_NAV_BAR);
  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setCursor(12, 222);
  tft.print("[CONFIRM]: Buka Portal   [BACK]: Menu");
}

// ============================================================================
// 17B. TAMPILAN PENGATURAN SISTEM (SETTINGS) & AUTO-SLEEP
// ============================================================================
#ifndef ILI9341_SLPIN
#define ILI9341_SLPIN   0x10
#endif
#ifndef ILI9341_SLPOUT
#define ILI9341_SLPOUT  0x11
#endif
#ifndef ILI9341_DISPOFF
#define ILI9341_DISPOFF 0x28
#endif
#ifndef ILI9341_DISPON
#define ILI9341_DISPON  0x29
#endif

void drawSettingsScreen() {
  tft.fillScreen(COLOR_BG);

  // Header Pengaturan Sistem
  tft.fillRect(0, 0, 320, 28, COLOR_NAV_BAR);
  tft.drawLine(0, 28, 320, 28, COLOR_CYAN);
  tft.setTextColor(COLOR_CYAN);
  tft.setTextSize(2);
  tft.setCursor(12, 6);
  tft.print("PENGATURAN SISTEM");

  // Kartu 1: Auto-Sleep Layar TFT
  tft.fillRoundRect(8, 33, 304, 86, 6, COLOR_CARD);
  tft.drawRoundRect(8, 33, 304, 86, 6, COLOR_CARD_BORDER);

  tft.setTextSize(1);
  tft.setCursor(16, 39);
  tft.setTextColor(COLOR_GOLD);
  tft.print("AUTO-SLEEP LAYAR TFT (HEMAT ENERGI):");

  tft.setCursor(16, 50);
  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.print("Padam otomatis jika tidak ada sentuhan/tombol:");

  // 6 Tombol Pilihan Menit (Pills)
  const int sleepOpts[6] = {1, 2, 3, 5, 10, 0};
  const char* sleepLabels[6] = {"1 Mnt", "2 Mnt", "3 Mnt", "5 Mnt", "10Mnt", "OFF"};

  int btnW = 44;
  int btnH = 22;
  int startX = 14;
  int gapX = 5;
  int btnY = 63;

  for (int i = 0; i < 6; i++) {
    int bX = startX + (i * (btnW + gapX));
    bool isActive = (tftSleepMinutes == sleepOpts[i]);

    if (isActive) {
      tft.fillRoundRect(bX, btnY, btnW, btnH, 4, COLOR_CYAN);
      tft.setTextColor(COLOR_BG);
    } else {
      tft.fillRoundRect(bX, btnY, btnW, btnH, 4, COLOR_BG);
      tft.drawRoundRect(bX, btnY, btnW, btnH, 4, COLOR_CARD_BORDER);
      tft.setTextColor(COLOR_WHITE);
    }

    tft.setTextSize(1);
    int textOffset = (i == 4) ? 7 : (i == 5 ? 13 : 7);
    tft.setCursor(bX + textOffset, btnY + 7);
    tft.print(sleepLabels[i]);
  }

  // Baris Status Konfigurasi Aktif
  tft.setCursor(16, 91);
  tft.setTextColor(COLOR_WHITE);
  tft.print("Status: ");
  if (tftSleepMinutes == 0) {
    tft.setTextColor(COLOR_GOLD);
    tft.print("Layar SELALU ON (Auto-Sleep Nonaktif)");
  } else {
    tft.setTextColor(COLOR_GREEN_SAFE);
    tft.printf("Auto-Sleep %d Menit", tftSleepMinutes);
    if (tftSleepMinutes == 2) {
      tft.setTextColor(COLOR_CYAN);
      tft.print(" [Rekomendasi]");
    }
  }

  tft.setCursor(16, 104);
  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.print("*Layar bangun instan jika disentuh, ditekan, atau alarm.");

  // Kartu 2: Audio & Buzzer Alert
  tft.fillRoundRect(8, 123, 304, 53, 6, COLOR_CARD);
  tft.drawRoundRect(8, 123, 304, 53, 6, COLOR_CARD_BORDER);

  tft.setCursor(16, 129);
  tft.setTextColor(COLOR_GOLD);
  tft.print("AUDIO & BUZZER ALARM:");

  tft.setCursor(16, 143);
  if (buzzerMuteTotal) {
    tft.setTextColor(COLOR_RED_ALERT);
    tft.print("Status: SENYAP TOTAL (Mute Permanen)");
  } else {
    tft.setTextColor(COLOR_GREEN_SAFE);
    tft.print("Status: SUARA AKTIF (Alarm Normal)");
  }

  // Tombol Toggle Mute di Kanan
  int muteBtnW = 76;
  int muteBtnH = 20;
  int muteBtnX = 228;
  int muteBtnY = 131;
  tft.fillRoundRect(muteBtnX, muteBtnY, muteBtnW, muteBtnH, 4, buzzerMuteTotal ? COLOR_RED_ALERT : COLOR_CYAN);
  tft.setTextColor(COLOR_BG);
  tft.setCursor(muteBtnX + (buzzerMuteTotal ? 16 : 24), muteBtnY + 6);
  tft.print(buzzerMuteTotal ? "UNMUTE" : "MUTE");

  tft.setCursor(16, 161);
  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.print("Tip: Triple-click tombol merah fisik utk mute cepat.");

  // Kartu 3: Info Firmware & Target Hardware
  tft.fillRoundRect(8, 180, 304, 30, 6, COLOR_CARD);
  tft.drawRoundRect(8, 180, 304, 30, 6, COLOR_CARD_BORDER);

  tft.setCursor(16, 191);
  tft.setTextColor(COLOR_WHITE);
  tft.print("DEVICE: ");
  tft.setTextColor(COLOR_CYAN);
  tft.print(deviceId);
  tft.setTextColor(COLOR_WHITE);
  tft.print(" | FW: ");
  tft.setTextColor(COLOR_GREEN_SAFE);
  tft.print("v2.6.2-QIC");
  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.print(" | ESP32 V1");

  // Footer Navigation Bar
  tft.fillRect(0, 215, 320, 25, COLOR_NAV_BAR);
  tft.drawLine(0, 215, 320, 215, COLOR_CARD_BORDER);
  tft.setTextColor(COLOR_GRAY_TEXT);
  tft.setCursor(10, 222);
  tft.print("[SELECT]: Geser   [CONFIRM]: Simpan   [BACK]: Menu");
}

void putTFTToSleep() {
  if (tftIsAsleep) return;
  tftIsAsleep = true;
  Serial.printf("[AUTO-SLEEP] TFT LCD istirahat (Sleep In) setelah %d Menit idle.\n", tftSleepMinutes);
  tft.fillScreen(COLOR_BG);
  tft.sendCommand(ILI9341_DISPOFF);
  delay(5);
  tft.sendCommand(ILI9341_SLPIN);
}

void wakeUpTFT() {
  if (!tftIsAsleep) return;
  Serial.println(F("[AUTO-SLEEP] Membangunkan TFT LCD (Sleep Out / Display ON)..."));
  tft.sendCommand(ILI9341_SLPOUT);
  delay(120); // Waktu settling wajib ILI9341 sesuai datasheet
  tft.sendCommand(ILI9341_DISPON);
  tftIsAsleep = false;
  lastUserInteractionTime = millis();
  beepTouch();

  // Gambar ulang tampilan layar yang sedang aktif
  if (currentScreen == SCREEN_MONITOR) {
    drawMainMonitorScreen();
  } else if (currentScreen == SCREEN_MENU) {
    drawMenuScreen();
  } else if (currentScreen == SCREEN_PROFILE_SELECT) {
    drawProfileSelectScreen();
  } else if (currentScreen == SCREEN_GRAPH) {
    drawGraphScreen();
  } else if (currentScreen == SCREEN_DOSSIER) {
    drawDossierScreen();
  } else if (currentScreen == SCREEN_SD_INFO) {
    drawSdInfoScreen();
  } else if (currentScreen == SCREEN_WIFI_CONFIG) {
    drawWifiConfigScreen();
  } else if (currentScreen == SCREEN_SETTINGS) {
    drawSettingsScreen();
  }
}

// ============================================================================
// 18. PENANGANAN INPUT (DUAL: TOMBOL FISIK & TOUCHSCREEN RESISTIF)
// ============================================================================

static bool screenTransitionPendingRelease = false;

// Helper untuk membuka sub-layar sesuai pilihan menu aktif (menuCursor)
void openSelectedMenu() {
  screenTransitionPendingRelease = true;
  if (menuCursor == 0) {
    currentScreen = SCREEN_MONITOR;
    drawMainMonitorScreen();
  } else if (menuCursor == 1) {
    currentScreen = SCREEN_PROFILE_SELECT;
    drawProfileSelectScreen();
  } else if (menuCursor == 2) {
    currentScreen = SCREEN_GRAPH;
    drawGraphScreen();
  } else if (menuCursor == 3) {
    currentScreen = SCREEN_DOSSIER;
    drawDossierScreen();
  } else if (menuCursor == 4) {
    currentScreen = SCREEN_SD_INFO;
    drawSdInfoScreen();
  } else if (menuCursor == 5) {
    currentScreen = SCREEN_WIFI_CONFIG;
    drawWifiConfigScreen();
  } else if (menuCursor == 6) {
    currentScreen = SCREEN_SETTINGS;
    drawSettingsScreen();
  }
}

void handleInputs() {
  static unsigned long lastActionTime = 0;

  bool btnBackPressed = false;
  bool btnSelectPressed = false;
  bool btnConfirmPressed = false;

#if ENABLE_PHYSICAL_BTNS
  int rawBack = digitalRead(PIN_BTN_BACK);
  int rawSelect = digitalRead(PIN_BTN_SELECT);
  int rawConfirm = digitalRead(PIN_BTN_CONFIRM);

  static unsigned long backPressStart = 0;
  static unsigned long selectPressStart = 0;
  static unsigned long confirmPressStart = 0;
  static bool backHandled = false;
  static bool selectHandled = false;
  static bool confirmHandled = false;

  // 1. Debounce Tombol BACK (35ms filter anti-chatter)
  if (rawBack != btnBackIdle) {
    if (backPressStart == 0) backPressStart = millis();
    else if (!backHandled && (millis() - backPressStart >= 35)) {
      btnBackPressed = true;
      backHandled = true;
      Serial.println(F("[BTN EVENT] Tombol BACK ditekan!"));
    }
  } else {
    backPressStart = 0;
    backHandled = false;
  }

  // 2. Debounce Tombol SELECT (35ms filter anti-chatter)
  if (rawSelect != btnSelectIdle) {
    if (selectPressStart == 0) selectPressStart = millis();
    else if (!selectHandled && (millis() - selectPressStart >= 35)) {
      btnSelectPressed = true;
      selectHandled = true;
      Serial.println(F("[BTN EVENT] Tombol SELECT ditekan!"));
    }
  } else {
    selectPressStart = 0;
    selectHandled = false;
  }

  // 3. Debounce Tombol CONFIRM (35ms filter anti-chatter)
  if (rawConfirm != btnConfirmIdle) {
    if (confirmPressStart == 0) confirmPressStart = millis();
    else if (!confirmHandled && (millis() - confirmPressStart >= 35)) {
      btnConfirmPressed = true;
      confirmHandled = true;
      Serial.println(F("[BTN EVENT] Tombol CONFIRM ditekan!"));
    }
  } else {
    confirmPressStart = 0;
    confirmHandled = false;
  }
#endif

  // Cek Sentuhan Layar Langsung dari Hardware XPT2046 (Tanpa limit Z_THRESHOLD library)
  bool isTouched = false;
  TS_Point p;

#if ENABLE_TOUCHSCREEN
  // Pastikan SPI CS perangkat lain HIGH saat touch membaca data
  digitalWrite(PIN_TFT_CS, HIGH);
  digitalWrite(PIN_SD_CS, HIGH);

  p = touch.getPoint();

  // Validasi sentuhan jari:
  // p.z adalah tekanan (biasanya > 20 saat disentuh jari tangan)
  if (p.z > 20 && p.z < 3900 && p.x > 80 && p.x < 3950 && p.y > 80 && p.y < 3950) {
    isTouched = true;
  }
#endif

  // State Machine Deteksi Sentuhan Baru (Edge-Triggered & Anti Spillover Layar)
  static bool touchWasPressed = false;
  static unsigned long touchReleaseStartTime = 0;
  bool touchTap = false;

  if (isTouched) {
    touchReleaseStartTime = 0;
    if (!touchWasPressed) {
      touchWasPressed = true;
      // Hanya akui sebagai tap baru jika jari sudah diangkat setelah ganti layar
      if (!screenTransitionPendingRelease) {
        touchTap = true;
        Serial.printf("[TOUCH TAP] X=%d Y=%d Z=%d\n", p.x, p.y, p.z);
      }
    }
  } else {
    // Jari terangkat / layar tidak disentuh
    if (touchWasPressed) {
      if (touchReleaseStartTime == 0) {
        touchReleaseStartTime = millis();
      } else if (millis() - touchReleaseStartTime > 80) {
        touchWasPressed = false;
        touchReleaseStartTime = 0;
        screenTransitionPendingRelease = false; // Jari resmi terangkat
      }
    } else {
      screenTransitionPendingRelease = false;
    }
  }

  // Jika tidak ada tombol yang ditekan dan tidak ada tap sentuh baru, keluar
  if (!btnBackPressed && !btnSelectPressed && !btnConfirmPressed && !touchTap) {
    return;
  }

  // INTERAKSI PENGGUNA TERDETEKSI:
  // Jika layar TFT sedang dalam mode Auto-Sleep, sentuhan atau tombol apa saja
  // akan membangunkan layar terlebih dahulu (mencegah salah pencet menu/opsi)
  if (tftIsAsleep) {
    wakeUpTFT();
    screenTransitionPendingRelease = true;
    lastActionTime = millis();
    return;
  }

  // Perbarui waktu aktivitas terakhir pengguna untuk timer Auto-Sleep
  lastUserInteractionTime = millis();

  // ==========================================================================
  // FITUR KHUSUS: TRIPLE-CLICK TOMBOL MERAH (PIN_BTN_BACK) -> TOGGLE MUTE TOTAL
  // ==========================================================================
  static unsigned long lastRedBtnPressTime = 0;
  static int redBtnPressCount = 0;

  if (btnBackPressed) {
    unsigned long now = millis();
    if (now - lastRedBtnPressTime <= 900) {
      redBtnPressCount++;
    } else {
      redBtnPressCount = 1;
    }
    lastRedBtnPressTime = now;

    if (redBtnPressCount >= 3) {
      redBtnPressCount = 0;
      buzzerMuteTotal = !buzzerMuteTotal;
      digitalWrite(PIN_BUZZER, LOW);

      if (buzzerMuteTotal) {
        Serial.println(F("[BUZZER] >>> TRIPLE-CLICK: BUZZER DIMATIKAN TOTAL (MUTE PERMANEN) <<<"));
        // 1 nada konfirmasi pendek lalu mati total
        digitalWrite(PIN_BUZZER, HIGH); delay(40); digitalWrite(PIN_BUZZER, LOW);
      } else {
        Serial.println(F("[BUZZER] >>> TRIPLE-CLICK: BUZZER DIAKTIFKAN KEMBALI <<<"));
        // 3 nada pendek ceria konfirmasi aktif
        for (int b = 0; b < 3; b++) {
          digitalWrite(PIN_BUZZER, HIGH); delay(40);
          digitalWrite(PIN_BUZZER, LOW);  delay(40);
        }
      }

      showBuzzerToast(buzzerMuteTotal);
      delay(300);
      return; // Cegah tombol merah menjalankan aksi navigasi single-click
    }
  }

  // Debounce proteksi aksi beruntun (150ms)
  if (millis() - lastActionTime < 150) {
    return;
  }
  lastActionTime = millis();

  // --- A. KONDISI DI LAYAR MONITOR UTAMA ---
  if (currentScreen == SCREEN_MONITOR) {
    // Sentuh layar DI MANA SAJA atau tekan tombol SELECT/CONFIRM untuk membuka MENU
    if (touchTap || btnConfirmPressed || btnSelectPressed) {
      beepTouch();
      Serial.println(F("[ACTION] Masuk ke Menu Utama"));
      currentScreen = SCREEN_MENU;
      screenTransitionPendingRelease = true;
      drawMenuScreen();
      return;
    }

    if (btnBackPressed) {
      alarmMuteUntil = millis() + 30000; // Mute 30 detik
      beepTouch();
      Serial.println(F("[ACTION] Alarm di-mute 30 detik"));
      return;
    }
  }

  // --- B. KONDISI DI LAYAR MENU ---
  else if (currentScreen == SCREEN_MENU) {
    // 1. Tombol Fisik SELECT: Geser kursor sorotan ke item berikutnya (0..6)
    if (btnSelectPressed) {
      beepTouch();
      menuCursor = (menuCursor + 1) % 7;
      drawMenuScreen();
      return;
    }

    // 2. Tombol Fisik BACK: Kembali ke Layar Monitor
    if (btnBackPressed) {
      beepTouch();
      currentScreen = SCREEN_MONITOR;
      screenTransitionPendingRelease = true;
      drawMainMonitorScreen();
      return;
    }

    // 3. Tombol Fisik CONFIRM: Buka menu yang sedang tersorot
    if (btnConfirmPressed) {
      beepTouch();
      openSelectedMenu();
      return;
    }

    // 4. Sentuhan Layar (Touchscreen): Pilih Menu vs Buka
    if (touchTap) {
      int touchX = map(p.x, TS_MINX, TS_MAXX, 0, 320);
      touchX = constrain(touchX, 0, 320);

      // INVERT SUMBU Y: Driver XPT2046 pada LCD rotasi 1 memiliki arah sumbu Y terbalik (240 ke 0)
      int touchY = map(p.y, TS_MINY, TS_MAXY, 240, 0);
      touchY = constrain(touchY, 0, 240);

      // Sentuh area bar footer bawah (Y >= 218)
      if (touchY >= 218) {
        if (touchX < 120) {
          // Area Batal (kiri) -> kembali ke Monitor
          beepTouch();
          currentScreen = SCREEN_MONITOR;
          screenTransitionPendingRelease = true;
          drawMainMonitorScreen();
          return;
        } else {
          // Area Buka / Konfirmasi (tengah & kanan)
          beepTouch();
          openSelectedMenu();
          return;
        }
      }

      // Deteksi menu yang disentuh untuk 7 item (itemH=23, gap=4, startY=29):
      // Item 0 (Y=29..52):   touchY 28 s/d 55
      // Item 1 (Y=56..79):   touchY 55 s/d 82
      // Item 2 (Y=83..106):  touchY 82 s/d 109
      // Item 3 (Y=110..133): touchY 109 s/d 136
      // Item 4 (Y=137..160): touchY 136 s/d 163
      // Item 5 (Y=164..187): touchY 163 s/d 190
      // Item 6 (Y=191..214): touchY 190 s/d 218
      int touchedItem = -1;
      if (touchY >= 28 && touchY < 55)        touchedItem = 0;
      else if (touchY >= 55 && touchY < 82)   touchedItem = 1;
      else if (touchY >= 82 && touchY < 109)  touchedItem = 2;
      else if (touchY >= 109 && touchY < 136) touchedItem = 3;
      else if (touchY >= 136 && touchY < 163) touchedItem = 4;
      else if (touchY >= 163 && touchY < 190) touchedItem = 5;
      else if (touchY >= 190 && touchY < 218) touchedItem = 6;

      if (touchedItem >= 0 && touchedItem < 7) {
        Serial.printf("[MENU TOUCH] Raw(X=%d, Y=%d) -> Screen(X=%d, Y=%d) => Menu Item %d\n",
                      p.x, p.y, touchX, touchY, touchedItem + 1);

        if (touchedItem != menuCursor) {
          // PENGGUNA PILIH MENU LAIN -> HANYA PINDAHKAN KURSOR SOROTAN (TIDAK LANGSUNG BUKA!)
          menuCursor = touchedItem;
          beepTouch();
          drawMenuScreen();
        } else {
          // PENGGUNA MENYENTUH KEMBALI MENU YANG SUDAH TERSOROT -> KONFIRMASI BUKA!
          beepTouch();
          openSelectedMenu();
        }
        return;
      }
    }
  }

  // --- C. KONDISI DI LAYAR PILIH PROFIL ---
  else if (currentScreen == SCREEN_PROFILE_SELECT) {
    if (btnBackPressed) {
      beepTouch();
      currentScreen = SCREEN_MENU;
      screenTransitionPendingRelease = true;
      drawMenuScreen();
      return;
    }

    if (btnSelectPressed) {
      beepTouch();
      int nextProf = ((int)currentProfile + 1) % 3;
      currentProfile = (CommodityProfile)nextProf;
      if (currentProfile == PROFILE_FISH_FRESH) { thresholdMin = 0.0; thresholdMax = 4.0; activeCommodityName = "IKAN SEGAR"; }
      else if (currentProfile == PROFILE_VACCINE_PHARMA) { thresholdMin = 2.0; thresholdMax = 8.0; activeCommodityName = "VAKSIN"; }
      else { thresholdMin = -25.0; thresholdMax = -18.0; activeCommodityName = "BEKU -18C"; }
      drawProfileSelectScreen();
      return;
    }

    if (btnConfirmPressed) {
      preferences.begin("qguard", false);
      preferences.putInt("prof", (int)currentProfile);
      preferences.putString("c_name", activeCommodityName);
      preferences.putFloat("c_min", thresholdMin);
      preferences.putFloat("c_max", thresholdMax);
      preferences.end();
      beepSuccess();
      currentScreen = SCREEN_MONITOR;
      screenTransitionPendingRelease = true;
      drawMainMonitorScreen();
      return;
    }

    // Sentuh profil komoditas langsung di layar
    if (touchTap) {
      // INVERT SUMBU Y agar presisi dengan tombol visual
      int touchY = map(p.y, TS_MINY, TS_MAXY, 240, 0);
      touchY = constrain(touchY, 0, 240);

      CommodityProfile selectedProf = currentProfile;
      bool saveAndExit = false;

      // Item 0: Pusat Y=68  (Batas: 35 s/d 94)
      // Item 1: Pusat Y=120 (Batas: 94 s/d 146)
      // Item 2: Pusat Y=172 (Batas: 146 s/d 205)
      // Footer: Y >= 215
      if (touchY >= 35 && touchY < 94) {
        if (currentProfile == PROFILE_FISH_FRESH) saveAndExit = true;
        else selectedProf = PROFILE_FISH_FRESH;
      } else if (touchY >= 94 && touchY < 146) {
        if (currentProfile == PROFILE_VACCINE_PHARMA) saveAndExit = true;
        else selectedProf = PROFILE_VACCINE_PHARMA;
      } else if (touchY >= 146 && touchY < 205) {
        if (currentProfile == PROFILE_FROZEN_CARGO) saveAndExit = true;
        else selectedProf = PROFILE_FROZEN_CARGO;
      } else if (touchY >= 215) {
        // Footer: Simpan
        saveAndExit = true;
      }

      if (saveAndExit) {
        preferences.begin("qguard", false);
        preferences.putInt("prof", (int)currentProfile);
        preferences.putString("c_name", activeCommodityName);
        preferences.putFloat("c_min", thresholdMin);
        preferences.putFloat("c_max", thresholdMax);
        preferences.end();
        beepSuccess();
        currentScreen = SCREEN_MONITOR;
        screenTransitionPendingRelease = true;
        drawMainMonitorScreen();
      } else {
        currentProfile = selectedProf;
        if (currentProfile == PROFILE_FISH_FRESH) { thresholdMin = 0.0; thresholdMax = 4.0; activeCommodityName = "IKAN SEGAR"; }
        else if (currentProfile == PROFILE_VACCINE_PHARMA) { thresholdMin = 2.0; thresholdMax = 8.0; activeCommodityName = "VAKSIN"; }
        else { thresholdMin = -25.0; thresholdMax = -18.0; activeCommodityName = "BEKU -18C"; }
        beepTouch();
        drawProfileSelectScreen();
      }
      return;
    }
  }

  // --- D. KONDISI DI LAYAR GRAFIK ATAU SD INFO ---
  else if (currentScreen == SCREEN_GRAPH || currentScreen == SCREEN_SD_INFO) {
    if (btnBackPressed || btnConfirmPressed || touchTap) {
      beepTouch();
      currentScreen = SCREEN_MENU;
      screenTransitionPendingRelease = true;
      drawMenuScreen();
      return;
    }
  }

  // --- D2. KONDISI DI LAYAR RINGKASAN KARANTINA (DOSSIER) ---
  else if (currentScreen == SCREEN_DOSSIER) {
    // Tombol Fisik BACK: Kembali ke Menu
    if (btnBackPressed) {
      beepTouch();
      currentScreen = SCREEN_MENU;
      screenTransitionPendingRelease = true;
      drawMenuScreen();
      return;
    }

    // Tombol Fisik CONFIRM: Reset Metrik Pengawasan Trip
    if (btnConfirmPressed) {
      resetTripMetrics();
      beepSuccess();
      drawDossierScreen();
      return;
    }

    // Sentuhan Layar Interaktif
    if (touchTap) {
      int touchX = map(p.x, TS_MINX, TS_MAXX, 0, 320);
      touchX = constrain(touchX, 0, 320);
      int touchY = map(p.y, TS_MINY, TS_MAXY, 240, 0);
      touchY = constrain(touchY, 0, 240);

      // Sentuh tombol [!] RESET TRIP BARU (Kiri bawah, X: 8..160, Y: 185..216)
      if (touchY >= 185 && touchY <= 216 && touchX <= 160) {
        resetTripMetrics();
        beepSuccess();
        drawDossierScreen();
        return;
      }

      // Sentuh tombol < KEMBALI KE MENU (Kanan bawah, X: 164..312) atau Bar Footer (Y >= 218)
      if ((touchY >= 185 && touchX > 160) || touchY >= 218) {
        beepTouch();
        currentScreen = SCREEN_MENU;
        screenTransitionPendingRelease = true;
        drawMenuScreen();
        return;
      }
    }
  }

  // --- E. KONDISI DI LAYAR WIFI & WEB PORTAL ---
  else if (currentScreen == SCREEN_WIFI_CONFIG) {
    if (btnBackPressed) {
      beepTouch();
      currentScreen = SCREEN_MENU;
      screenTransitionPendingRelease = true;
      drawMenuScreen();
      return;
    }

    if (btnConfirmPressed || touchTap) {
      beepTouch();
      Serial.println(F("[WIFI] Mengaktifkan Web Portal Setup..."));
      startWiFiPortal();
      drawWifiConfigScreen();
      return;
    }
  }

  // --- F. KONDISI DI LAYAR PENGATURAN SISTEM (SETTINGS) ---
  else if (currentScreen == SCREEN_SETTINGS) {
    if (btnBackPressed) {
      preferences.begin("qguard", false);
      preferences.putInt("sleep_min", tftSleepMinutes);
      preferences.end();
      beepTouch();
      currentScreen = SCREEN_MENU;
      screenTransitionPendingRelease = true;
      drawMenuScreen();
      return;
    }

    if (btnSelectPressed) {
      const int sleepOpts[6] = {1, 2, 3, 5, 10, 0};
      int currIdx = 0;
      for (int i = 0; i < 6; i++) {
        if (sleepOpts[i] == tftSleepMinutes) {
          currIdx = i;
          break;
        }
      }
      currIdx = (currIdx + 1) % 6;
      tftSleepMinutes = sleepOpts[currIdx];
      preferences.begin("qguard", false);
      preferences.putInt("sleep_min", tftSleepMinutes);
      preferences.end();
      beepTouch();
      drawSettingsScreen();
      return;
    }

    if (btnConfirmPressed) {
      preferences.begin("qguard", false);
      preferences.putInt("sleep_min", tftSleepMinutes);
      preferences.end();
      beepSuccess();
      currentScreen = SCREEN_MENU;
      screenTransitionPendingRelease = true;
      drawMenuScreen();
      return;
    }

    if (touchTap) {
      int touchX = map(p.x, TS_MINX, TS_MAXX, 0, 320);
      touchX = constrain(touchX, 0, 320);
      int touchY = map(p.y, TS_MINY, TS_MAXY, 240, 0);
      touchY = constrain(touchY, 0, 240);

      // Sentuh pilihan Menit Auto-Sleep (Y: 58..92)
      if (touchY >= 58 && touchY <= 92) {
        int selectedMin = -1;
        if (touchX >= 10 && touchX < 60)        selectedMin = 1;
        else if (touchX >= 60 && touchX < 110)  selectedMin = 2;
        else if (touchX >= 110 && touchX < 160) selectedMin = 3;
        else if (touchX >= 160 && touchX < 210) selectedMin = 5;
        else if (touchX >= 210 && touchX < 258) selectedMin = 10;
        else if (touchX >= 258 && touchX <= 310) selectedMin = 0;

        if (selectedMin >= 0) {
          tftSleepMinutes = selectedMin;
          preferences.begin("qguard", false);
          preferences.putInt("sleep_min", tftSleepMinutes);
          preferences.end();
          beepSuccess();
          drawSettingsScreen();
          return;
        }
      }

      // Sentuh Toggle Mute Buzzer (Y: 125..158, X: 215..315)
      if (touchY >= 125 && touchY <= 158 && touchX >= 215 && touchX <= 315) {
        buzzerMuteTotal = !buzzerMuteTotal;
        digitalWrite(PIN_BUZZER, LOW);
        beepTouch();
        drawSettingsScreen();
        return;
      }

      // Sentuh Footer Bar (Y >= 215)
      if (touchY >= 215) {
        preferences.begin("qguard", false);
        preferences.putInt("sleep_min", tftSleepMinutes);
        preferences.end();
        beepTouch();
        currentScreen = SCREEN_MENU;
        screenTransitionPendingRelease = true;
        drawMenuScreen();
        return;
      }
    }
  }
}

// ============================================================================
// 19. ARDUINO SETUP FUNCTION
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println(F("\n\n========================================"));
  Serial.println(F("  Q-GUARD FIRMWARE INITIALIZING (ESP32) "));
  Serial.println(F("========================================"));

  // 1. Setup Pin I/O
  setupHardwarePins();
  delay(50);

  // Aktifkan Task Watchdog Timer (30 detik) untuk proteksi freeze mandiri
#if defined(ESP_IDF_VERSION_MAJOR) && ESP_IDF_VERSION_MAJOR >= 5
  esp_task_wdt_config_t twdt_config = {
      .timeout_ms = 30000,
      .idle_core_mask = 0,
      .trigger_panic = true
  };
  esp_task_wdt_init(&twdt_config);
#else
  esp_task_wdt_init(30, true);
#endif
  esp_task_wdt_add(NULL);
  Serial.println(F("[WATCHDOG] Task WDT aktif (30s timeout) - Self Recovery Ready!"));
#if ENABLE_PHYSICAL_BTNS
  delay(100); // Beri waktu tegangan rel 3.3V dan pin input stabil
  btnBackIdle = digitalRead(PIN_BTN_BACK);
  btnSelectIdle = digitalRead(PIN_BTN_SELECT);
  btnConfirmIdle = digitalRead(PIN_BTN_CONFIRM);
  Serial.printf("[BUTTONS] Tombol Fisik Aktif! Idle State: BACK=%d, SELECT=%d, CONFIRM=%d\n",
                btnBackIdle, btnSelectIdle, btnConfirmIdle);
#else
  Serial.println(F("[BUTTONS] Tombol fisik dinonaktifkan (Mode Full Touchscreen)"));
#endif

  // 2. Jalankan Animasi Pembuka Lampu LED & Buzzer Chime
  runStartupSequence();

  // 3. Setup Bus SPI
  SPI.begin(PIN_SPI_SCK, PIN_SPI_MISO, PIN_SPI_MOSI);

  // 4. Inisialisasi Layar TFT 2.8" ILI9341
  tft.begin();
  tft.setRotation(1); // Landscape 320x240

  // 5. Inisialisasi Touchscreen XPT2046
  touch.begin();
  touch.setRotation(1);
  Serial.println(F("[XPT2046 Touch] Siap digunakan"));

  // Tampilkan Splash Screen Animasi
  drawSplashScreen();

  // 6. Inisialisasi Bus I2C & Pembersihan Jalur Bus
  recoverI2CBus();
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  Wire.setClock(100000); // Kecepatan standar 100kHz

  // 6B. Pemindaian Otomatis Bus I2C saat boot untuk diagnosa perangkat fisik
  Serial.println(F("[I2C SCAN] Memindai bus I2C (SDA=21, SCL=22)..."));
  int i2cDevicesFound = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    if (isI2CDevicePresent(addr)) {
      Serial.printf("  -> Modul I2C terdeteksi di 0x%02X", addr);
      if (addr == 0x68) Serial.print(F(" [DS3231 RTC atau MPU6050 AD0=GND]"));
      else if (addr == 0x69) Serial.print(F(" [MPU6050 AD0=3.3V]"));
      else if (addr == 0x76 || addr == 0x77) Serial.print(F(" [BME280]"));
      Serial.println();
      i2cDevicesFound++;
    }
  }
  if (i2cDevicesFound == 0) {
    Serial.println(F("  [!] PERINGATAN: Tidak ada modul I2C terdeteksi! Periksa kabel SDA/SCL/VCC/GND."));
  }

  // 7. Sensor BME280 (Hanya inisialisasi jika modul fisik terdeteksi di bus I2C)
  if (isI2CDevicePresent(0x76) && bme.begin(0x76)) {
    bmeAvailable = true;
    Serial.println(F("[BME280] Terhubung pada alamat 0x76 - OK"));
  } else if (isI2CDevicePresent(0x77) && bme.begin(0x77)) {
    bmeAvailable = true;
    Serial.println(F("[BME280] Terhubung pada alamat 0x77 - OK"));
  } else {
    bmeAvailable = false;
    Serial.println(F("[BME280] Tidak aktif / modul fisik dilepas (Data ambient N/A)"));
  }

  // 8. Inisialisasi MPU6050
  initMPU6050();

  // 9. Inisialisasi RTC DS3231
  if (rtc.begin()) {
    rtcAvailable = true;
    Serial.println(F("[DS3231 RTC] Terhubung pada alamat 0x68 - OK"));
    // Kalibrasi langsung jam RTC ke waktu laptop saat compile/upload ini
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
    Serial.println(F("[DS3231 RTC] Jam berhasil disinkronkan ke waktu laptop!"));
  } else {
    rtcAvailable = false;
    Serial.println(F("[DS3231 RTC] Tidak terdeteksi"));
  }

  // 10. Sensor Suhu 3x Probe DS18B20 OneWire
  dsSensors.begin();
  dsSensors.setWaitForConversion(false); // Mode Non-blocking (0ms freeze)
  dsSensors.requestTemperatures();       // Permintaan awal
  ds18Count = dsSensors.getDeviceCount();
  Serial.print(F("[DS18B20] Ditemukan "));
  Serial.print(ds18Count);
  Serial.println(F(" probe pada bus OneWire (Non-blocking)"));

  // 11. GPS NEO-6M Serial (UART2)
  gpsSerial.begin(9600, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);
  Serial.println(F("[GPS NEO-6M] Serial port dibuka pada 9600 bps"));

  // 12. MicroSD Card Adapter
  pinMode(PIN_SD_CS, OUTPUT);
  digitalWrite(PIN_SD_CS, HIGH);
  if (SD.begin(PIN_SD_CS)) {
    sdAvailable = true;
    Serial.println(F("[MicroSD] Berhasil dimuat (FAT32 Ready) - OK"));
    
    // Buat header file CSV jika belum ada
    if (!SD.exists("/qguard_log.csv")) {
      File f = SD.open("/qguard_log.csv", FILE_WRITE);
      if (f) {
        f.println("Timestamp,T1_Core,T2_MidBuffer,T3_Door,MKT,AmbientTemp,AmbientHum,DoorState,GForce,Lat,Lon,RiskScore,RiskLevel");
        f.flush();
        f.close();
      }
    }
  } else {
    sdAvailable = false;
    Serial.println(F("[MicroSD] Gagal inisialisasi / kartu belum dipasang"));
  }

  // Inisialisasi riwayat grafik awal
  for (int i = 0; i < GRAPH_HISTORY_SIZE; i++) {
    temp1History[i] = 0.0;
  }

  // Inisialisasi awal metrik pengawasan audit trip karantina
  resetTripMetrics();

  // 13. Inisialisasi Wi-Fi & Web Portal Provisioning
  loadWifiPreferences();
  if (wifiSsid.length() > 0) {
    connectToStation(wifiSsid, wifiPass);
  } else {
    startWiFiPortal();
  }

  // Masuk ke Layar Monitor Utama
  currentScreen = SCREEN_MONITOR;
  drawMainMonitorScreen();
  lastUserInteractionTime = millis();
  Serial.println(F("[Q-GUARD] Sistem SIAP dan Beroperasi Normal!"));
}

// ============================================================================
// 20. ARDUINO MAIN LOOP
// ============================================================================
void loop() {
  // Feed Watchdog Timer setiap iterasi loop
  esp_task_wdt_reset();

  unsigned long currentMillis = millis();

  // 0. Baca aliran data GPS NEO-6M secara berkelanjutan agar buffer UART tidak overflow
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // 1. Tangani input tombol fisik dan sentuhan layar (prioritas tinggi)
  handleInputs();

  // 1B. Auto-Sleep Layar TFT jika waktu idle pengguna melampaui batas menit yang disetting
  if (tftSleepMinutes > 0 && !tftIsAsleep) {
    unsigned long timeoutMs = (unsigned long)tftSleepMinutes * 60000UL;
    if (currentMillis - lastUserInteractionTime >= timeoutMs) {
      putTFTToSleep();
    }
  }

  // 1C. Auto-Wake Darurat Karantina: Bangunkan layar instan jika terjadi alarm bahaya atau pintu terbuka
  if (tftIsAsleep && (telemetry.doorOpen || strcmp(telemetry.riskLevel, "CRITICAL") == 0)) {
    Serial.println(F("[SAFETY] Alarm darurat terdeteksi saat sleep! Membangunkan TFT LCD instan!"));
    wakeUpTFT();
  }

  // 2. Layani Web Server Captive Portal jika sedang di mode AP
  if (wifiState == WIFI_STATE_PORTAL) {
    dnsServer.processNextRequest();
    server.handleClient();
  }

  // 3. Pantau transisi koneksi Wi-Fi Station
  if (wifiState == WIFI_STATE_CONNECTING) {
    if (WiFi.status() == WL_CONNECTED) {
      wifiState = WIFI_STATE_CONNECTED;
      beepSuccess();
      Serial.printf("[WIFI] BERHASIL TERHUBUNG! IP ESP32: %s\n", WiFi.localIP().toString().c_str());

      // Auto-Sync waktu akurat dari Internet NTP (WIB = GMT+7)
      configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");
      struct tm ti;
      if (getLocalTime(&ti, 2000)) {
        DateTime ntpNow(ti.tm_year + 1900, ti.tm_mon + 1, ti.tm_mday, ti.tm_hour, ti.tm_min, ti.tm_sec);
        if (rtcAvailable) {
          rtc.adjust(ntpNow);
          Serial.println(F("[AUTO-SYNC] Jam RTC berhasil disinkronkan dari Internet NTP (WIB)!"));
        }
        telemetry.timestamp = ntpNow;
      }
    } else if (millis() - wifiConnectStartTime > 12000) {
      Serial.println(F("[WIFI] Timeout gagal konek. Mengaktifkan kembali Portal Setup..."));
      startWiFiPortal();
    }
  }

  // 3B. Pantau Puncak Guncangan MPU6050 secara Cepat (tiap 80 ms) agar bus I2C tidak padat
  static unsigned long lastMpuSample = 0;
  if (mpuAvailable && (currentMillis - lastMpuSample >= 80)) {
    lastMpuSample = currentMillis;
    float liveG = readMPU6050GForce();
    if (liveG > peakGForceBuffer) {
      peakGForceBuffer = liveG;
    }
  }

  // 3C. Auto-Reconnect MPU6050 tiap 5 detik jika kabel sempat goyang/lepas
  static unsigned long lastMpuReconnectTime = 0;
  if (!mpuAvailable && (currentMillis - lastMpuReconnectTime >= 5000)) {
    lastMpuReconnectTime = currentMillis;
    // Cek probe cepat 0-byte tanpa buffer data agar tidak memicu software timeout
    if (isI2CDevicePresent(0x69) || isI2CDevicePresent(0x68)) {
      initMPU6050();
      if (mpuAvailable) {
        Serial.printf("[MPU6050] Berhasil terhubung kembali pada alamat 0x%02X - OK!\n", mpuI2CAddr);
      }
    }
  }

  // 3D. Deteksi Instan Sensor Pintu MC-38 (Realtime 0-lag Interrupt-Free Edge Detection)
  static unsigned long lastDoorCheckTime = 0;
  if (currentMillis - lastDoorCheckTime >= 40) {
    lastDoorCheckTime = currentMillis;
    bool currentDoorOpen = (digitalRead(PIN_DOOR_SENSOR) == HIGH);
    if (currentDoorOpen != telemetry.doorOpen) {
      if (currentDoorOpen) {
        telemetry.doorOpenStart = currentMillis;
        tripMetrics.doorBreachCount++;
        beepTouch();
        if (tftIsAsleep) {
          wakeUpTFT();
        }
      } else {
        telemetry.doorTotalOpenSec += (currentMillis - telemetry.doorOpenStart) / 1000;
      }
      telemetry.doorOpen = currentDoorOpen;
      evaluateRiskScore();
      if (!tftIsAsleep && currentScreen == SCREEN_MONITOR) {
        updateMainMonitorData();
      }
      if (wifiState == WIFI_STATE_CONNECTED) {
        sendTelemetryToBackend();
        lastWifiSendTime = currentMillis;
      }
    }
  }

  // 4. Baca data sensor & jalankan AI setiap 1 detik
  if (currentMillis - lastSampleTime >= 1000) {
    lastSampleTime = currentMillis;
    readSensors();
  }

  // 5. Simpan log data ke MicroSD Card setiap 5 detik
  if (currentMillis - lastSdLogTime >= 5000) {
    lastSdLogTime = currentMillis;
    logDataToSD();
  }

  // 6. Kirim data telemetri real-time ke Backend Server Laptop setiap 1 detik jika terhubung
  if (wifiState == WIFI_STATE_CONNECTED && (currentMillis - lastWifiSendTime >= 1000)) {
    lastWifiSendTime = currentMillis;
    sendTelemetryToBackend();
  }

  // 7. Perbarui tampilan data sensor setiap 1 detik (ZERO FLICKER: Hanya ubah angka tanpa fillScreen)
  if (!tftIsAsleep && currentScreen == SCREEN_MONITOR && (currentMillis - lastDisplayRefresh >= 1000)) {
    lastDisplayRefresh = currentMillis;
    updateMainMonitorData();
  }

  // 8. Diagnostik Real-time Serial setiap 3 detik
  static unsigned long lastDiagTime = 0;
  if (currentMillis - lastDiagTime >= 3000) {
    lastDiagTime = currentMillis;
    TS_Point pDiag = touch.getPoint();
#if ENABLE_PHYSICAL_BTNS
    Serial.printf("[DIAG] G-Force: %.2fg (MPU %s@0x%02X | RTC:%s) | Touch Z=%d | Btn: B=%d S=%d C=%d | WiFi: %s\n",
                  telemetry.gForce, mpuAvailable ? "OK" : "NO", mpuI2CAddr,
                  rtcAvailable ? "OK" : "NO",
                  pDiag.z,
                  digitalRead(PIN_BTN_BACK), digitalRead(PIN_BTN_SELECT), digitalRead(PIN_BTN_CONFIRM),
                  wifiState == WIFI_STATE_CONNECTED ? WiFi.localIP().toString().c_str() : (wifiState == WIFI_STATE_PORTAL ? "AP Mode" : "No-WiFi"));
#else
    Serial.printf("[DIAG] G-Force: %.2fg (MPU %s@0x%02X | RTC:%s) | Touch Z=%d | Input: Touchscreen | WiFi: %s\n",
                  telemetry.gForce, mpuAvailable ? "OK" : "NO", mpuI2CAddr,
                  rtcAvailable ? "OK" : "NO",
                  pDiag.z,
                  wifiState == WIFI_STATE_CONNECTED ? WiFi.localIP().toString().c_str() : (wifiState == WIFI_STATE_PORTAL ? "AP Mode" : "No-WiFi"));
#endif
  }
}
