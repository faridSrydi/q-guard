# Q-GUARD — IoT and AI-Based Cold-Chain Risk Monitoring for Smart Quarantine

> Sistem prototipe untuk memantau kondisi lingkungan selama distribusi produk perikanan beku.

## Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Q-GUARD SYSTEM                              │
│                                                                     │
│  ┌──────────────────┐     ┌──────────────────┐    ┌──────────────┐ │
│  │   ESP32 + Sensors │────▶│   Backend API    │───▶│  Dashboard   │ │
│  │   (Firmware)      │     │   (Node.js)      │    │  (Web UI)    │ │
│  │                   │     │                   │    │              │ │
│  │  ┌─────────────┐  │     │  ┌─────────────┐  │    │  ┌────────┐  │ │
│  │  │  MicroSD    │  │     │  │  SQLite DB   │  │    │  │Charts  │  │ │
│  │  │  (Offline)  │  │     │  │              │  │    │  │Maps    │  │ │
│  │  └─────────────┘  │     │  └─────────────┘  │    │  │Tables  │  │ │
│  └──────────────────┘     └──────────────────┘    └──────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Komponen

| Komponen | Direktori | Teknologi |
|----------|-----------|-----------|
| Firmware | `firmware/` | PlatformIO + Arduino Framework |
| Backend | `backend/` | Node.js + Express + SQLite |
| Dashboard | `dashboard/` | Vite + Vanilla JS + Chart.js |

## Quick Start

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
npm run migrate
npm run dev
```

Backend berjalan di `http://localhost:3000`

### 2. Dashboard

```bash
cd dashboard
npm install
npm run dev
```

Dashboard berjalan di `http://localhost:5173`

### 3. Firmware

```bash
cd firmware
# Edit src/config.h sesuai konfigurasi Wi-Fi dan server
pio run                    # Build
pio run -t upload          # Upload ke ESP32
pio device monitor         # Serial monitor
```

## Hardware

- ESP32 DevKit V1 (30 pin)
- TFT 2.8" ILI9341 + XPT2046
- 3× DS18B20 Waterproof
- BME280 (I²C)
- MPU6050 (I²C, AD0 → HIGH untuk alamat 0x69)
- MC-38 Magnetic Door Sensor
- DS3231 RTC (I²C)
- NEO-6M GPS Module
- MicroSD SPI Module
- 3× LED (Merah, Kuning, Hijau)
- Active Buzzer + Transistor Driver
- 3× Push Button

## GPIO Mapping

Lihat [firmware/src/config.h](firmware/src/config.h) untuk mapping GPIO lengkap.

> **PENTING**: GPIO0, GPIO2, GPIO12, GPIO15 adalah pin strapping. Mapping telah direvisi untuk menghindari konflik boot. Lihat dokumentasi di `docs/gpio_mapping.md`.

## Konfigurasi I²C

| Device | Alamat Default | Alamat Digunakan |
|--------|---------------|-----------------|
| DS3231 | 0x68 | 0x68 |
| MPU6050 | 0x68 | 0x69 (AD0 → HIGH) |
| BME280 | 0x76 | 0x76 |

## Environment Variables

Lihat `.env.example` di masing-masing direktori.

## Dokumentasi Lengkap

1. [Arsitektur Sistem (docs/architecture.md)](docs/architecture.md)
2. [Spesifikasi Hardware & Pinout GPIO (docs/gpio_mapping.md)](docs/gpio_mapping.md)
3. [API Reference & Schema Endpoint (docs/api_reference.md)](docs/api_reference.md)
4. [Model Risiko Cold-Chain & MKT (docs/risk_model.md)](docs/risk_model.md)
5. [Keterbatasan Teknis & Fail-Safe (docs/limitations.md)](docs/limitations.md)

## Lisensi

Proyek prototipe untuk keperluan riset dan pengembangan.

## Disclaimer

Sistem ini adalah alat bantu monitoring dan peringatan dini, **bukan** pengganti keputusan resmi petugas karantina. Data simulasi diberi label `SIMULATED`. Laporan yang dihasilkan bukan merupakan sertifikat kelayakan komoditas.
