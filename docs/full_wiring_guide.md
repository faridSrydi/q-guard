# Q-GUARD: Panduan Lengkap Wiring & Skema Rangkaian Hardware

Dokumen ini berisi panduan perkabelan (*full wiring guide*) dari awal untuk merakit perangkat IoT **Q-GUARD** menggunakan **ESP32 DevKit V1 (30 Pin)**.

---

## 1. Daftar Komponen & Material

| No | Komponen | Tipe / Spesifikasi | Jumlah | Keterangan |
|:--:|---|---|:--:|---|
| 1 | **Microcontroller** | ESP32 DevKit V1 (30-Pin DOIT) | 1 | Otak utama sistem |
| 2 | **Sensor Suhu Inti** | DS18B20 Waterproof Probe | 3 | $T_1$ (Atas), $T_2$ (Tengah), $T_3$ (Pintu) |
| 3 | **Sensor Lingkungan** | BME280 Module | 1 | Suhu & Kelembapan ruang luar (I²C) |
| 4 | **Sensor Guncangan** | MPU6050 (GY-521) 6-DOF | 1 | Akselerometer & Giroskop (I²C) |
| 5 | **Sensor Pintu** | MC-38 Magnetic Reed Switch | 1 | Sakelar magnetik kontak pintu |
| 6 | **Modul Waktu (RTC)** | DS3231 Precision RTC | 1 | Pewaktu presisi tinggi baterai CR2032 |
| 7 | **Modul Lokasi** | NEO-6M GPS Module + Antena | 1 | Pelacak koordinat NMEA (UART) |
| 8 | **Penyimpanan Offline**| MicroSD Card Adapter Module | 1 | SPI Interface (FAT32) |
| 9 | **Layar & Sentuh** | 2.8" TFT SPI ILI9341 + XPT2046 | 1 | Resolusi 320×240 piksel |
| 10 | **Indikator LED** | LED 5mm (Merah, Kuning, Hijau) | 3 | Indikator status visual |
| 11 | **Alarm Suara** | Active Buzzer 5V/3.3V | 1 | Alarm darurat audio |
| 12 | **Tombol Navigasi** | Push Button 4-pin (Tactile Switch) | 3 | Navigasi menu layar fisik |
| 13 | **Transistor** | NPN 2N2222 / S8050 | 1 | Driver penguat arus Buzzer |
| 14 | **Resistor** | 4.7 kΩ (1×), 10 kΩ (4×), 330 Ω (3×), 1 kΩ (1×) | 9 | Pull-up, pull-down, & pembatas arus LED |

---

## 2. Diagram Distribusi Daya & Jalur Bus

```
                        ┌───────────────────────────────┐
                        │      POWER SUPPLY (5V DC)     │
                        └───────┬───────────────┬───────┘
                                │ 5V            │ GND
             ┌──────────────────┴──┐         ┌──┴──────────────────┐
             │ ESP32 VIN (5V Rail) │         │    COMMON GROUND    │
             └──────────┬──────────┘         └─────────────────────┘
                        │ 3.3V LDO Output
             ┌──────────┴──────────┐
             │     3.3V Rail       │ (Untuk DS18B20, BME280, MPU6050, RTC, TFT)
             └─────────────────────┘
```

> **PERINGATAN TEGANGAN PENTING:**
> - ESP32 bekerja pada logika **3.3V**. 
> - Semua pin data sensor (OneWire, I²C, SPI, UART) **harus terhubung ke rel 3.3V**, BUKAN 5V.
> - Modul GPS NEO-6M dan Backlight TFT (LED pin) dapat ditenagai dari **VIN (5V)** agar penerimaan sinyal GPS dan cahaya layar optimal.

---

## 3. Tabel Koneksi Pin-ke-Pin Lengkap

### A. Bus I²C Bersama (Shared I²C Bus)
Ketiga modul ini dihubungkan secara paralel ke pin I²C ESP32 yang sama:

| Modul | Pin Modul | Terhubung ke ESP32 | Keterangan Khusus |
|---|---|---|---|
| **BME280** | VCC | **3.3V** | Daya sensor |
| | GND | **GND** | Ground |
| | SCL | **GPIO 22** | I²C Clock |
| | SDA | **GPIO 21** | I²C Data |
| **MPU6050** | VCC | **3.3V** | Daya sensor |
| | GND | **GND** | Ground |
| | SCL | **GPIO 22** | I²C Clock bersama |
| | SDA | **GPIO 21** | I²C Data bersama |
| | **AD0** | **3.3V** | **WAJIB:** Dihubungkan ke 3.3V agar alamat berubah jadi `0x69`! |
| **DS3231 RTC** | VCC | **3.3V** | Daya modul RTC |
| | GND | **GND** | Ground |
| | SCL | **GPIO 22** | I²C Clock bersama |
| | SDA | **GPIO 21** | I²C Data bersama (Alamat tetap `0x68`) |

---

### B. Bus SPI Bersama (TFT LCD, Touch, & MicroSD)
Jalur Clock (SCK), MISO, dan MOSI digunakan bersama oleh layar TFT, touchscreen, dan kartu SD. Setiap perangkat dibedakan oleh pin **Chip Select (CS)** masing-masing:

| Modul | Pin Modul | Terhubung ke ESP32 | Keterangan |
|---|---|---|---|
| **Jalur SPI Utama** | **SCK / CLK** | **GPIO 18** | Terhubung paralel ke TFT SCK, T_CLK, SD SCK |
| | **MISO / SDO** | **GPIO 19** | Terhubung paralel ke TFT SDO, T_DO, SD MISO |
| | **MOSI / SDI** | **GPIO 23** | Terhubung paralel ke TFT SDI, T_DIN, SD MOSI |
| **TFT ILI9341** | VCC | **3.3V** (atau 5V jika ada regulator) | Daya modul layar |
| | GND | **GND** | Ground |
| | CS | **GPIO 5** | Dedicated TFT Chip Select |
| | RESET / RST | **GPIO 26** | Reset hardware TFT |
| | DC / RS | **GPIO 27** | Data/Command selector |
| | LED / BL | **3.3V** atau **VIN 5V via resistor 100Ω** | Backlight layar LCD |
| **Touch XPT2046** | T_CS | **GPIO 14** | Dedicated Touch Chip Select |
| | T_IRQ | *Tidak disambung* | Touchscreen memakai metode *software polling* |
| **MicroSD Module** | VCC | **5V (VIN)** atau **3.3V** | Tergantung tipe adaptor MicroSD |
| | GND | **GND** | Ground |
| | CS | **GPIO 13** | Dedicated MicroSD Chip Select |

---

### C. 3× Sensor Suhu DS18B20 (OneWire Paralel)
Ketiga sensor DS18B20 disambungkan secara paralel pada 1 kabel data yang sama:

```
Rel 3.3V ───┬────────────────────────────────────────┐
            │                                        │
           [4.7 kΩ Resistor Pull-up]                 │
            │                                        │
ESP32 GPIO 4 ┴── Kabel KUNING (Data) 3x DS18B20      │
                 Kabel MERAH  (VCC)  3x DS18B20 ─────┘
                 Kabel HITAM  (GND)  3x DS18B20 ───── Rel GND
```

| Warna Kabel DS18B20 | Fungsi | Terhubung ke |
|---|---|---|
| **Merah (VDD)** | VCC Daya | **Rel 3.3V ESP32** |
| **Hitam/Biru (GND)**| Ground | **Rel GND ESP32** |
| **Kuning/Putih (DQ)**| Data OneWire | **GPIO 4** *(Diberi resistor 4.7 kΩ ke 3.3V)* |

---

### D. GPS NEO-6M (Serial UART2)

| Pin GPS NEO-6M | Terhubung ke ESP32 | Keterangan |
|---|---|---|
| VCC | **VIN (5V)** | Daya GPS (modul memiliki LDO 3.3V internal) |
| GND | **GND** | Ground bersama |
| **TX** | **GPIO 16 (RX2)** | Data NMEA dari GPS masuk ke ESP32 |
| **RX** | **GPIO 17 (TX2)** | Perintah dari ESP32 ke GPS |

---

### E. Sensor Pintu MC-38 & Tombol Fisik

| Sakelar / Tombol | Pin Komponen | Terhubung ke ESP32 | Rangkaian Eksternal |
|---|---|---|---|
| **MC-38 Pintu** | Kabel 1 | **GPIO 35** | Tambahkan **resistor 10 kΩ ke 3.3V** (Pull-up) |
| | Kabel 2 | **GND** | Menghubungkan ke GND saat magnet rapat |
| **Button 1 (Nav)** | Pin 1 | **GPIO 39 (VN)** | Tambahkan **resistor 10 kΩ ke 3.3V** (Pull-up) |
| | Pin 2 | **GND** | Menghubungkan ke GND saat tombol ditekan |
| **Button 2 (Sel)** | Pin 1 | **GPIO 36 (VP)** | Tambahkan **resistor 10 kΩ ke 3.3V** (Pull-up) |
| | Pin 2 | **GND** | Menghubungkan ke GND saat tombol ditekan |
| **Button 3 (Back)**| Pin 1 | **GPIO 34** | Tambahkan **resistor 10 kΩ ke 3.3V** (Pull-up) |
| | Pin 2 | **GND** | Menghubungkan ke GND saat tombol ditekan |

> *Catatan:* GPIO 34, 35, 36, 39 adalah pin **Input-Only** murni pada ESP32 tanpa internal pull-up/pull-down, sehingga **wajib** menggunakan resistor eksternal 10 kΩ ke 3.3V.

---

### F. Indikator LED & Active Buzzer

| Komponen | Terminal Positif (+) | Terminal Negatif (-) | Rangkaian Tambahan |
|---|---|---|---|
| **LED Hijau** (Normal) | **GPIO 32** | **GND** | Seri dengan **resistor 330 Ω** |
| **LED Kuning** (Caution)| **GPIO 33** | **GND** | Seri dengan **resistor 330 Ω** |
| **LED Merah** (Critical)| **GPIO 25** | **GND** | Seri dengan **resistor 330 Ω** |
| **Active Buzzer** | **Rel 5V / 3.3V** | Ke Kolektor Transistor | Lihat skema driver transistor di bawah |

#### Skema Rangkaian Driver Buzzer (Transistor NPN):
GPIO 12 adalah pin *boot strapping* (MTDI). Pin ini **harus berlogika LOW saat ESP32 pertama kali dinyalakan** agar tegangan flash internal tetap 3.3V.

```
          Rel 5V / 3.3V
               │
           [BUZZER] (+)
               │ (-)
           Kolektor (C)
                 │
GPIO 12 ──[1kΩ]──┤ Basis (B)  (NPN 2N2222)
                 │
           Emitor (E)
                 │
                GND
                 │
[10kΩ Resistor Pulldown] ── Terpasang antara GPIO 12 dan GND (Menjaga LOW saat Boot)
```

---

## 4. Ringkasan Seluruh Pin ESP32 (Cheatsheet)

```
                       ┌─────────────────────────┐
                       │     ESP32 DEVKIT V1     │
                       │                         │
            3.3V Power │ [3V3]             [VIN] │ 5V DC Power Input
                   GND │ [GND]             [GND] │ Ground
      OneWire (DS18B20)│ [D4]              [D13] │ SD Card CS
           TFT LCD CS  │ [D5]              [D12] │ Buzzer (via NPN + 10k pulldown)
        GPS RX2 (from) │ [D16]             [D14] │ Touchscreen T_CS
          GPS TX2 (to) │ [D17]             [D27] │ TFT LCD DC/RS
         SPI SCK (Clk) │ [D18]             [D26] │ TFT LCD RST
        SPI MISO (Dat) │ [D19]             [D25] │ LED Merah
        I2C SDA (Dat)  │ [D21]             [D33] │ LED Kuning
        I2C SCL (Clk)  │ [D22]             [D32] │ LED Hijau
        SPI MOSI (Dat) │ [D23]             [D35] │ MC-38 Pintu (Pull-up 10k)
      Button 3 (Back)  │ [D34]             [D36] │ Button 2 (Sel) (Pull-up 10k)
      Button 1 (Nav)   │ [D39]                   │
                       └─────────────────────────┘
```

---

## 5. Langkah-Langkah Perakitan (*Step-by-Step Checklist*)

1. **Jalur Daya & Ground Terlebih Dahulu:**
   - Hubungkan pin `GND` ESP32 ke rel negatif breadboard/PCB.
   - Hubungkan pin `3V3` ESP32 ke rel positif 3.3V.
2. **Rangkai Bus I²C:**
   - Pasang BME280, MPU6050, dan DS3231. Sambungkan seluruh SDA ke GPIO 21 dan SCL ke GPIO 22.
   - **Krusial:** Solder jumper pin `AD0` pada modul MPU6050 ke pin `VCC (3.3V)` agar alamat I²C-nya menjadi `0x69`.
3. **Rangkai 3 Probe Suhu DS18B20:**
   - Gabungkan kabel merah ketiga sensor ke 3.3V.
   - Gabungkan kabel hitam ketiga sensor ke GND.
   - Gabungkan kabel kuning ketiga sensor ke GPIO 4, lalu pasang resistor 4.7 kΩ dari GPIO 4 ke 3.3V.
4. **Rangkai Layar TFT & MicroSD (Jalur SPI):**
   - Sambungkan jalur bersama: SCK (GPIO 18), MISO (GPIO 19), MOSI (GPIO 23).
   - Sambungkan jalur CS terpisah: TFT CS (GPIO 5), Touch CS (GPIO 14), MicroSD CS (GPIO 13).
5. **Rangkai GPS, Sensor Pintu, & Tombol:**
   - Sambungkan GPS TX ke GPIO 16, GPS RX ke GPIO 17.
   - Pasang resistor pull-up 10 kΩ pada pin GPIO 34, 35, 36, dan 39.
6. **Rangkai Buzzer & LED:**
   - Pasang transistor dan resistor pull-down 10 kΩ pada GPIO 12 untuk pengaman buzzer.
   - Pasang LED Merah, Kuning, Hijau dengan resistor pembatas arus 330 Ω.
7. **Pengujian Nyala Awal (Power On Check):**
   - Periksa dengan multimeter: pastikan tidak ada hubungan pendek (*short-circuit*) antara 3.3V dan GND.
   - Colokkan USB ke ESP32. Buka Serial Monitor pada 115200 baud untuk memastikan firmware melakukan inisialisasi modul tanpa error.
