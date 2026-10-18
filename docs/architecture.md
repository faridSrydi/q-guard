# Q-GUARD System Architecture

## 1. Executive Summary

**Q-GUARD** (IoT and AI-Based Cold-Chain Risk Monitoring for Smart Quarantine) is an end-to-end industrial IoT solution designed to monitor the cold-chain integrity of high-value perishable goods (such as frozen seafood, vaccines, biological reagents) from point of origin through maritime/ground transit to quarantine clearance inspection.

The system combines edge sensing, offline-resilient local logging, reliable multi-batch synchronization, an Arrhenius kinetic deterioration engine, and an interactive real-time inspection dashboard.

---

## 2. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EDGE SENSING LAYER                              │
│                                                                             │
│   [3× DS18B20]   [BME280]   [MPU6050]   [MC-38]   [NEO-6M]   [DS3231 RTC]   │
│    (OneWire)      (I²C)      (I²C)      (GPIO)     (UART)       (I²C)       │
│         │           │          │          │          │            │         │
│         └───────────┼──────────┴──────────┼──────────┴────────────┘         │
│                     ▼                     ▼                                 │
│             ┌───────────────────────────────────┐                           │
│             │        ESP32 Microcontroller      │                           │
│             │      (Dual-Core Xtensa 240MHz)    │                           │
│             └─────────────────┬─────────────────┘                           │
│                               │                                             │
│                 ┌─────────────┴─────────────┐                               │
│                 ▼                           ▼                               │
│     ┌───────────────────────┐   ┌───────────────────────────┐               │
│     │   MicroSD SPI Module   │   │  TFT ILI9341 + XPT2046   │               │
│     │ (Offline CSV Storage) │   │ (Local Diagnostic Screen) │               │
│     └───────────┬───────────┘   └───────────────────────────┘               │
└─────────────────┼───────────────────────────────────────────────────────────┘
                  │ Wi-Fi Sync (Exponential Backoff + Batching)
                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND & ANALYTICS LAYER                         │
│                                                                             │
│                         Node.js + Express API Engine                        │
│                                       │                                     │
│             ┌─────────────────────────┼─────────────────────────┐           │
│             ▼                         ▼                         ▼           │
│     ┌───────────────┐         ┌───────────────┐         ┌───────────────┐   │
│     │ SQLite Engine │         │  MKT & Risk   │         │  Quarantine   │   │
│     │ (WAL Mode)    │         │  Evaluator    │         │  Audit Log    │   │
│     └───────────────┘         └───────────────┘         └───────────────┘   │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │ REST API + JSON
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION & CONTROL LAYER                        │
│                                                                             │
│                       Q-GUARD Operations Web Dashboard                      │
│                                                                             │
│  [Fleet Telemetry]  [Interactive Map]  [Time-Series Charts]  [Audit Dossier] │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Communication Protocols

| Component | Interface | Baud / Frequency | Pins (ESP32) | Notes |
|-----------|-----------|------------------|--------------|-------|
| 3× DS18B20 | OneWire | ~16.3 kbps | GPIO4 | 4.7kΩ pull-up to 3.3V |
| BME280 | I²C | 400 kHz (Fast) | SDA: 21, SCL: 22 | Address `0x76` |
| MPU6050 | I²C | 400 kHz (Fast) | SDA: 21, SCL: 22 | Address `0x69` (AD0 tied to 3.3V) |
| DS3231 RTC | I²C | 400 kHz (Fast) | SDA: 21, SCL: 22 | Address `0x68` (Fixed) |
| NEO-6M GPS | UART | 9600 bps | RX: 16, TX: 17 | NMEA Sentence Parser |
| MicroSD Card | SPI (VSPI) | 20 MHz | SCK: 18, MISO: 19, MOSI: 23, CS: 5 | FAT32 format, append-only CSV |
| TFT ILI9341 | SPI (VSPI) | 40 MHz | Shared SPI, CS: 14, DC: 27, RST: 13 | 320×240 Color Display |
| XPT2046 Touch | SPI (VSPI) | 2.5 MHz | Shared SPI, CS: 26 (Polling) | Touch input navigation |
| MC-38 Sensor | Digital Input | Polling 100ms | GPIO35 | Internal pull-up |
| LEDs & Buzzer | Digital Output | Immediate | LED-R: 25, LED-Y: 33, LED-G: 32, BZ: 12 | Status indication |

---

## 4. Offline Storage & Synchronization Protocol

1. **Continuous Sampling**: Every 5 seconds, all sensors are polled and aggregated into a `DataRecord`.
2. **Local Write**: The record is written as a CSV row to `/logs/data_YYYYMMDD.csv` on the MicroSD card.
3. **Sync Marker**: StorageManager maintains a high-water mark (`last_synced_id`) in non-volatile EEPROM/NVS.
4. **Network Availability**: When Wi-Fi connectivity is established:
   - SyncManager requests up to 20 un-synced records from MicroSD.
   - Formats a JSON payload matching the batch contract.
   - Sends `POST /api/sensor-data/batch` with `X-API-Key`.
   - On HTTP 200/201 response, advances the `last_synced_id` mark.
   - If the request fails, applies exponential backoff ($2^n \times 1000\text{ms}$) up to 60 seconds without dropping samples.
