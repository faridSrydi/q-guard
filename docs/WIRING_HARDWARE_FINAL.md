# Q-GUARD: PANDUAN WIRING HARDWARE LENGKAP & DETAIL (KABEL-DEMI-KABEL)

Panduan ini dibuat secara **sangat detail, langkah demi langkah, kabel demi kabel (pin-ke-pin)** berdasarkan komponen riil yang kamu miliki. 

Ikuti panduan ini secara berurutan dari Bagian 1 sampai Bagian 11 sebelum menyalakan alat.

---

## DAFTAR ISI
1. [Prinsip Jalur Daya (Breadboard Rail)](#1-prinsip-jalur-daya-breadboard-rail)
2. [Sistem Daya UPS: Adaptor USB 5V 3A, TP4056, 2x 18650, Saklar, & MT3608](#2-sistem-daya-ups-adaptor-usb-5v-3a-tp4056-2x-18650-saklar--mt3608)
3. [Daftar Penggunaan Resistor (Sesuai Stok Kamu)](#3-daftar-penggunaan-resistor-sesuai-stok-kamu)
4. [TFT LCD 2.8" ILI9341 + Touchscreen XPT2046 (Pin-demi-Pin)](#4-tft-lcd-28-ili9341--touchscreen-xpt2046-pin-demi-pin)
5. [Modul MicroSD Card Adapter (SPI)](#5-modul-microsd-card-adapter-spi)
6. [Tiga Sensor I2C: BME280, MPU6050, & DS3231 RTC](#6-tiga-sensor-i2c-bme280-mpu6050--ds3231-rtc)
7. [Tiga Sensor Suhu Probe DS18B20 (T1, T2, T3)](#7-tiga-sensor-suhu-probe-ds18b20-t1-t2-t3)
8. [Modul GPS NEO-6M (UART2)](#8-modul-gps-neo-6m-uart2)
9. [Tiga Tombol 3-Pin, Sensor Pintu MC-38, 3 LED, & Buzzer 5V](#9-tiga-tombol-3-pin-sensor-pintu-mc-38-3-led--buzzer-5v)
10. [Master Pinout Map ESP32 (Diagram Posisi Pin Fisik 30-Pin)](#10-master-pinout-map-esp32-diagram-posisi-pin-fisik-30-pin)
11. [Urutan Tes Penyalaan Pertama Kali & Aturan Aman Colok Laptop](#11-urutan-tes-penyalaan-pertama-kali--aturan-aman-colok-laptop)

---

## 1. PRINSIP JALUR DAYA (BREADBOARD RAIL)

Karena modul dan sensor kamu cukup banyak, kita membagi distribusi listrik menjadi **3 Jalur Rel Utama** pada breadboard / PCB:

```
[ Rel 5.0V ] ======================================= (Kabel MERAH dari MT3608 VOUT+)
[ Rel 3.3V ] ======================================= (Kabel ORANYE dari ESP32 Pin 3V3)
[ Rel GND  ] ======================================= (Kabel HITAM - Ground Bersama)
```

* **Rel 5.0V (Daya Input Utama):** Menyuplai daya ke pin **VIN ESP32**, modul **GPS NEO-6M**, modul **MicroSD Adapter**, dan modul **Active Buzzer 5V** (jika pakai tipe PCB 3-pin).
* **Rel 3.3V (Logika Sensor Aman):** Dikeluarkan langsung dari regulator internal ESP32 melalui pin **3V3**. Menyuplai daya logika ke **BME280**, **MPU6050**, **DS3231 RTC**, **3x Probe DS18B20**, **TFT LCD 2.8"**, dan **3 Tombol Navigasi**.
* **Rel GND (Wajib Common Ground):** SEMUA kutub negatif (-) dari adaptor, TP4056, MT3608, baterai, ESP32, dan seluruh sensor **wajib tersambung bersama** ke rel ini agar tidak terjadi perbedaan tegangan referensi (floating ground).

---

## 2. SISTEM DAYA UPS: ADAPTOR USB 5V 3A, TP4056, 2x 18650, SAKLAR, & MT3608

Rangkaian ini berfungsi ganda sebagai **catu daya UPS (Uninterruptible Power Supply)**:
1. Ketika adaptor 5V 3A dicolok ke port TP4056, adaptor langsung menyalakan alat sekaligus mengisi (charge) 2 baterai 18650.
2. Ketika adaptor dicabut / listrik PLN mati, baterai langsung mem-backup daya secara otomatis tanpa membuat ESP32 restart (*zero switchover delay*).

```
                    [ 2x Baterai 18650 Paralel ]
                      (+) Kutub Positif Bersama
                      (-) Kutub Negatif Bersama
                                |       |
                                |       |
      Adaptor 5V 3A            v       v
    (Colokan Type-C/Micro)   +---+   +---+
            |                |B+ |   |B- |
            v                +---+   +---+
    +----------------------------------------------+
    |          MODUL CHARGER TP4056                |
    |   (Dilengkapi proteksi DW01A + 8205A)        |
    |                                              |
    |     OUT+                          OUT-       |
    +------|-----------------------------|---------+
           |                             |
     [SAKLAR ON/OFF]                     |
      (Kaki 1 ke OUT+)                   |
      (Kaki 2 lanjut)                    |
           |                             |
           v                             v
       +-------+                     +-------+
       | VIN+  |                     | VIN-  |
       +-------+                     +-------+
    +----------------------------------------------+
    |          MODUL STEP-UP BOOST MT3608          |
    |    [SETEL POTENSIOMETER PERSIS KE 5.0V!]     |
    |                                              |
    |     VOUT+                         VOUT-      |
    +------|-----------------------------|---------+
           |                             |
           v                             v
      Rel 5.0V                      Rel GND
   (Ke ESP32 VIN)                (Ke ESP32 GND)
```

### Langkah Pemasangan Modul Daya:
1. **Memparalelkan 2 Baterai 18650:**
   - Hubungkan kutub positif (+) Baterai 1 ke kutub (+) Baterai 2 -> solder ke pin **B+** TP4056.
   - Hubungkan kutub negatif (-) Baterai 1 ke kutub (-) Baterai 2 -> solder ke pin **B-** TP4056.
   - *Hasil: Tegangan tetap 3.7V nominal (maksimal 4.2V saat penuh), kapasitas daya berlipat ganda (~4000-6000 mAh).*
2. **Kabel Saklar ON/OFF:**
   - Sambungkan pin **OUT+** TP4056 -> ke **Kaki 1 Saklar**.
   - Sambungkan **Kaki 2 Saklar** -> ke pin **VIN+** MT3608.
   - Sambungkan pin **OUT-** TP4056 -> langsung ke pin **VIN-** MT3608.
   - *(Dengan posisi ini, saat saklar OFF, modul MT3608 mati total tanpa membuang daya baterai, tetapi baterai tetap bisa dicas jika adaptor dicolok).*
3. **Penyetelan Tegangan MT3608 (SANGAT PENTING - SEBELUM DISAMBUNG KE ESP32):**
   - Hidupkan Saklar ke posisi **ON**.
   - Siapkan Multimeter pada posisi **DC Volt (20V)**.
   - Tempelkan jarum merah ke `VOUT+` MT3608 dan jarum hitam ke `VOUT-` MT3608.
   - Putar baut kuningan kecil (trimpot) pada MT3608 berlawanan arah jarum jam secara perlahan sampai multimeter membaca **5.00V** pas.
   - Matikan saklar ke **OFF**.
4. **Sambungan ke Rel Utama & ESP32:**
   - Sambungkan **VOUT+ MT3608** -> ke **Rel 5.0V** breadboard -> sambungkan ke pin **VIN ESP32**.
   - Sambungkan **VOUT- MT3608** -> ke **Rel GND** breadboard -> sambungkan ke pin **GND ESP32**.

---

## 3. DAFTAR PENGGUNAAN RESISTOR (SESUAI STOK KAMU)

Kamu memiliki stok resistor: **1k, 4.7k, 220, dan 330 Ohm**. Berikut tabel alokasi persisnya:

| Nilai Resistor | Jumlah Dipakai | Dipasang Di Mana? | Fungsi Resistor |
|:---|:---:|:---|:---|
| **4.7 kOhm** | **1 buah** | Antara **GPIO 4** dan **Rel 3.3V** | Resistor Pull-up jalur data OneWire untuk 3x probe DS18B20 |
| **4.7 kOhm** | **1 buah** | Antara **GPIO 35** dan **Rel 3.3V** | Resistor Pull-up sinyal sensor pintu magnet MC-38 |
| **1 kOhm** | **1 buah** | Antara **GPIO 12** dan **Rel GND** | Resistor Pull-down pengaman booting ESP32 agar tidak bootloop pada buzzer |
| **330 Ohm** *(atau 220 Ohm)* | **1 buah** | Seri antara **GPIO 25** dan kaki (+) **LED Merah** | Pembatas arus pengaman LED Merah (Alarm Excursion) |
| **330 Ohm** *(atau 220 Ohm)* | **1 buah** | Seri antara **GPIO 33** dan kaki (+) **LED Kuning** | Pembatas arus pengaman LED Kuning (Warning / Caution) |
| **330 Ohm** *(atau 220 Ohm)* | **1 buah** | Seri antara **GPIO 32** dan kaki (+) **LED Hijau** | Pembatas arus pengaman LED Hijau (Safe / Normal) |

> **Catatan Tombol Navigasi:** 
> Tiga tombol fisik yang kamu miliki adalah **tipe modul 3-pin (VCC, GND, OUT)**. Modul ini sudah memiliki resistor pull internal di atas papan PCB-nya, sehingga **TIDAK memerlukan resistor tambahan lagi**.

---

## 4. TFT LCD 2.8" ILI9341 + TOUCHSCREEN XPT2046 (PIN-DEMI-PIN)

Modul layar 2.8" memiliki deretan 14 pin (atau 18 pin jika ada slot SD bawaan modul). Gunakan sambungan pin layar dan touch berikut:

```
  +---------------------------------------------------------+
  |                 LAYAR TFT 2.8" ILI9341                  |
  |                                                         |
  | [VCC] [GND] [CS] [RESET] [DC] [MOSI] [SCK] [LED] [MISO] |
  |                                                         |
  |          [T_CLK] [T_CS] [T_DIN] [T_DO] [T_IRQ]          |
  +---------------------------------------------------------+
```

### Tabel Sambungan Layar & Touch ke ESP32:

| Pin pada Layar TFT | Nama Pin | Hubungkan ke Mana? | Keterangan & Catatan Teknis |
|:---|:---|:---|:---|
| **Pin 1** | **VCC** | **Rel 3.3V** | Tegangan logika LCD |
| **Pin 2** | **GND** | **Rel GND** | Ground |
| **Pin 3** | **CS** | **GPIO 5** | Chip Select layar TFT |
| **Pin 4** | **RESET** | **GPIO 26** | Reset Hardware LCD |
| **Pin 5** | **DC / RS**| **GPIO 27** | Data/Command Selection |
| **Pin 6** | **SDI / MOSI**| **GPIO 23** | Jalur bersama SPI MOSI |
| **Pin 7** | **SCK / CLK** | **GPIO 18** | Jalur bersama SPI Clock |
| **Pin 8** | **LED / BL** | **Rel 3.3V** | Lampu latar layar (Backlight ON stabil) |
| **Pin 9** | **SDO / MISO**| **GPIO 19** *(atau Kosong)* | SPI MISO LCD (Opsional, LCD hanya menerima data) |
| **Pin 10** | **T_CLK** | **GPIO 18** | Clock Touchscreen (Jalur bersama SPI SCK) |
| **Pin 11** | **T_CS** | **GPIO 14** | Chip Select Touchscreen |
| **Pin 12** | **T_DIN** | **GPIO 23** | Input Data Touch (Jalur bersama SPI MOSI) |
| **Pin 13** | **T_DO** | **GPIO 19** | Output Data Touch (Jalur bersama SPI MISO) |
| **Pin 14** | **T_IRQ** | *(KOSONGKAN)* | Tidak perlu kabel (Touch dibaca via polling software) |

---

## 5. MODUL MICROSD CARD ADAPTER (SPI)

Gunakan modul MicroSD eksternal mandiri (6 pin). Modul ini berbagi jalur bus SPI yang sama dengan layar:

| Pin Modul MicroSD | Hubungkan ke Mana? | Keterangan |
|:---|:---|:---|
| **CS** | **GPIO 13** | Chip Select mandiri untuk MicroSD |
| **SCK** | **GPIO 18** | Terhubung ke jalur bersama SPI SCK |
| **MOSI** | **GPIO 23** | Terhubung ke jalur bersama SPI MOSI |
| **MISO** | **GPIO 19** | Terhubung ke jalur bersama SPI MISO |
| **VCC** | **Rel 5.0V (VIN)** | Modul MicroSD memiliki chip regulator AMS1117 3.3V sendiri, wajib diberi 5V |
| **GND** | **Rel GND** | Ground |

---

## 6. TIGA SENSOR I2C: BME280, MPU6050, & DS3231 RTC

Semua sensor I2C menggunakan 2 kabel data yang sama (**GPIO 21 untuk SDA**, dan **GPIO 22 untuk SCL**).

```
                      +-------------------+
                      |   ESP32 DevKit    |
                      | GPIO 21   GPIO 22 |
                      +-----|--------|----+
                            | SDA    | SCL
                            +----+---+
                                 |
         +-----------------------+-----------------------+
         |                       |                       |
         v                       v                       v
   +-----------+           +-----------+           +-----------+
   |  BME280   |           |  MPU6050  |           |  DS3231   |
   | (Addr:    |           | [AD0->3V] |           | (Addr:    |
   |  0x76)    |           | (Addr:    |           |  0x68)    |
   |           |           |  0x69)    |           |           |
   +-----------+           +-----------+           +-----------+
```

### A. Modul BME280 (Suhu, Kelembapan, & Tekanan Lingkungan):
* `VCC` -> **Rel 3.3V**
* `GND` -> **Rel GND**
* `SDA` -> **GPIO 21**
* `SCL` -> **GPIO 22**

### B. Modul MPU6050 GY-521 (Akselerometer/Guncangan Kargo):
* `VCC` -> **Rel 3.3V**
* `GND` -> **Rel GND**
* `SDA` -> **GPIO 21**
* `SCL` -> **GPIO 22**
* **PIN AD0 (SANGAT PENTING - JANGAN DILEWATKAN):**
  - Sambungkan pin **AD0 ke Rel 3.3V** menggunakan seutas kabel kecil.
  - *Penjelasan Ilmiah: Modul RTC DS3231 memiliki alamat bawaan 0x68. MPU6050 bawaan juga beralamat 0x68. Dengan menyambungkan pin AD0 ke 3.3V, alamat MPU6050 bergeser menjadi `0x69`, sehingga keduanya bisa aktif bersamaan tanpa bentrok.*

### C. Modul RTC DS3231 (Jam Presisi Real-Time):
* `VCC` -> **Rel 3.3V**
* `GND` -> **Rel GND**
* `SDA` -> **GPIO 21**
* `SCL` -> **GPIO 22**
* Pasang baterai koin CR2032 di wadah baterai modul DS3231 agar jam tidak pernah reset saat saklar dimatikan.

---

## 7. TIGA SENSOR SUHU PROBE DS18B20 (T1, T2, T3)

Ketiga probe anti-air memiliki 3 kabel (Merah, Hitam, Kuning/Putih). Sambungkan ketiga probe secara paralel:

```
                    Kabel MERAH Probe 1 ----+
                    Kabel MERAH Probe 2 ----+---> Ke Rel 3.3V
                    Kabel MERAH Probe 3 ----+

                    Kabel HITAM Probe 1 ----+
                    Kabel HITAM Probe 2 ----+---> Ke Rel GND
                    Kabel HITAM Probe 3 ----+

                    Kabel KUNING Probe 1 ---+
                    Kabel KUNING Probe 2 ---+---> Ke ESP32 GPIO 4
                    Kabel KUNING Probe 3 ---+
                                            |
                                            +---[ Resistor 4.7 kOhm ]---> Ke Rel 3.3V
```

### Langkah Pasang:
1. Satukan 3 kabel Merah -> tancapkan ke **Rel 3.3V**.
2. Satukan 3 kabel Hitam -> tancapkan ke **Rel GND**.
3. Satukan 3 kabel Kuning -> tancapkan ke lubang **GPIO 4**.
4. Ambil **1 buah Resistor 4.7 kOhm**: satu kaki colok ke **GPIO 4** (gabung kabel kuning), satu kakinya lagi colok ke **Rel 3.3V**.

---

## 8. MODUL GPS NEO-6M (GY-GPS6MV2)

Modul GPS memiliki 4 pin:

| Pin GPS NEO-6M | Hubungkan ke Mana? | Keterangan |
|:---|:---|:---|
| **VCC** | **Rel 5.0V (VIN)** | Diberi daya 5V agar LDO modul menyuplai arus antena aktif secara maksimal |
| **GND** | **Rel GND** | Ground |
| **TX** | **GPIO 16 (RX2)** | TX GPS mengirim data NMEA ke pin RX2 ESP32 |
| **RX** | **GPIO 17 (TX2)** | RX GPS menerima konfigurasi baudrate dari pin TX2 ESP32 |

*(Posisikan antena keramik kotak menghadap ke atas / ke arah langit bebas saat pengujian).*

---

## 9. TIGA TOMBOL 3-PIN, SENSOR PINTU MC-38, 3 LED, & BUZZER 5V

### A. Tiga Modul Tombol Tactile (3-Pin: VCC, GND, OUT):
Modul tombol kamu memiliki 3 pin bertuliskan `VCC`, `GND`, dan `OUT` (atau `S`).

```
Modul Tombol 3-Pin:
  [ VCC ] ---------> Ke Rel 3.3V  (PERINGATAN: JANGAN KE 5V!)
  [ GND ] ---------> Ke Rel GND
  [ OUT ] ---------> Ke Pin GPIO ESP32
```

1. **Tombol 1 (BACK / KEMBALI):**
   - `VCC` -> **Rel 3.3V**
   - `GND` -> **Rel GND**
   - `OUT` -> **GPIO 34**
2. **Tombol 2 (SELECT / GESER PILIHAN MENU):**
   - `VCC` -> **Rel 3.3V**
   - `GND` -> **Rel GND**
   - `OUT` -> **GPIO 36 (VP)**
3. **Tombol 3 (CONFIRM / ENTER / OK):**
   - `VCC` -> **Rel 3.3V**
   - `GND` -> **Rel GND**
   - `OUT` -> **GPIO 39 (VN)**

*(Keistimewaan teknis: GPIO 34, 36, dan 39 adalah pin input murni pada ESP32 yang tidak memiliki internal pull-up. Karena modul kamu adalah tipe 3-pin dengan rangkaian pull terintegrasi, pin-pin ini bekerja dengan sangat stabil).*

---

### B. Sensor Pintu Magnetik MC-38 (2 Kabel):
Saklar buluh magnetik pintu tidak memiliki polaritas (+/- bebas):
1. **Kabel 1:** Hubungkan ke **GPIO 35**.
2. **Kabel 2:** Hubungkan ke **Rel GND**.
3. **Resistor Pull-up (4.7 kOhm):** Pasang 1 buah resistor 4.7 kOhm di antara lubang **GPIO 35** dan **Rel 3.3V**.
   *(Saat pintu tertutup/magnet menempel, sensor mengalirkan arus ke GND = logika LOW. Saat pintu dibuka/magnet menjauh, resistor 4.7k menarik tegangan ke 3.3V = logika HIGH).*

---

### C. Tiga Buah LED Indikator 5mm:
Setiap LED memiliki 2 kaki: Kaki Panjang = **Anoda (+)**, Kaki Pendek = **Katoda (-)**.

1. **LED Hijau (Status Aman / Suhu Normal):**
   - Kaki Panjang (+) -> Pasang seri **Resistor 330 Ohm** -> sambung ke **GPIO 32**
   - Kaki Pendek (-) -> Sambung langsung ke **Rel GND**
2. **LED Kuning (Peringatan / Warning / Fluktuasi):**
   - Kaki Panjang (+) -> Pasang seri **Resistor 330 Ohm** -> sambung ke **GPIO 33**
   - Kaki Pendek (-) -> Sambung langsung ke **Rel GND**
3. **LED Merah (Bahaya / Excursion / Pintu Terbuka):**
   - Kaki Panjang (+) -> Pasang seri **Resistor 330 Ohm** -> sambung ke **GPIO 25**
   - Kaki Pendek (-) -> Sambung langsung ke **Rel GND**

*(Jika resistor 330 Ohm habis, gunakan resistor 220 Ohm dari stok kamu).*

---

### D. Active Buzzer 5V:

```
PILIHAN 1: BUZZER TABUNG HITAM 2-PIN (PALING UMUM & REKOMENDASI)

   ESP32 GPIO 12 ─────────┬───────── (+) Kaki Panjang Buzzer
                          │
                   [Resistor 1k]         [TABUNG BUZZER]
                          │
      Rel GND    ─────────┴───────── (-) Kaki Pendek Buzzer
```

1. **Jika Buzzer kamu tipe TABUNG HITAM 2-Pin (+ dan - biasa):**
   - Kaki Panjang bertanda **(+)** -> Sambungkan ke **GPIO 12**.
   - Kaki Pendek bertanda **(-)** -> Sambungkan ke **Rel GND**.
   - Pasang resistor **1 kOhm** di antara **GPIO 12 dan Rel GND** (sebagai pengaman pulldown saat boot).
   - *Buzzer aktif 5V akan berbunyi sangat nyaring pada tegangan 3.3V dari ESP32, dan tidak ada resiko tegangan 5V eksternal yang bocor merusak pin ESP32.*

2. **Jika Buzzer kamu tipe MODUL PCB 3-Pin (bertuliskan VCC, GND, I/O):**
   - `VCC` -> **Rel 5.0V (VIN)**
   - `GND` -> **Rel GND**
   - `I/O` -> **GPIO 12**
   - Pasang resistor **1 kOhm** di antara **GPIO 12 dan Rel GND**.

> **MENGAPA RESISTOR 1 kOhm PADA GPIO 12 WAJIB DIPASANG? (KRUSIAL)**
> Pin GPIO 12 pada ESP32 adalah pin *boot-strapping* (MTDI). Pin ini **WAJIB bernilai LOW (0V) saat ESP32 pertama kali dinyalakan**. Jika terdeteksi tegangan HIGH saat boot, ESP32 akan salah mengatur voltase flash memory internal ke 1.8V dan langsung mengalami *bootloop / brownout crash*. Resistor 1 kOhm ke GND menjamin pin GPIO 12 selalu bertegangan 0V murni saat proses booting berlangsung.

---

## 10. MASTER PINOUT MAP ESP32 (DIAGRAM POSISI PIN FISIK 30-PIN)

Gunakan diagram ini untuk mengecek ulang posisi fisik kabel satu per satu pada board **DOIT ESP32 DevKit V1 (30 Pin)**:

```
                             DOIT ESP32 DEVKIT V1
                                 (30-PIN MAP)
                              ┌────────────────┐
                              │  [Micro USB]   │
                              │                │
            (Kosong / RST) EN │ [ 1]      [30] │ 3V3    -> Rel 3.3V Sensor & Layar
      Tombol 2: SELECT  VP/36 │ [ 2]      [29] │ D15    -> (Kosong / Cadangan)
     Tombol 3: CONFIRM  VN/39 │ [ 3]      [28] │ D0     -> (Kosong / Tombol BOOT)
        Tombol 1: BACK    D34 │ [ 4]      [27] │ D2     -> (Kosong / LED Biru Onboard)
  MC-38 Pintu (+4.7k Pull) D35│ [ 5]      [26] │ D4     -> OneWire 3x DS18B20 (+4.7k Pull)
  LED Hijau (+330R ke GND) D32│ [ 6]      [25] │ RX2/16 -> GPS NEO-6M (Pin TX)
 LED Kuning (+330R ke GND) D33│ [ 7]      [24] │ TX2/17 -> GPS NEO-6M (Pin RX)
  LED Merah (+330R ke GND) D25│ [ 8]      [23] │ D5     -> TFT LCD CS
               TFT LCD RST D26│ [ 9]      [22] │ D18    -> SPI SCK (Layar, Touch, SD)
             TFT LCD DC/RS D27│ [10]      [21] │ D19    -> SPI MISO (Touch, SD)
          Touchscreen T_CS D14│ [11]      [20] │ D21    -> I2C SDA (BME280, MPU, RTC)
   Buzzer (+) (+1k Pulldwn)D12│ [12]      [19] │ RX0/3  -> (Serial USB Programming)
               MicroSD CS  D13│ [13]      [18] │ TX0/1  -> (Serial USB Programming)
       Rel GND (Ground Total) │ [14]      [17] │ D22    -> I2C SCL (BME280, MPU, RTC)
     Rel 5.0V (MT3608 VOUT+)VIN│ [15]     [16] │ D23    -> SPI MOSI (Layar, Touch, SD)
                              └────────────────┘
```

---

## 11. URUTAN TES PENYALAAN PERTAMA KALI & ATURAN AMAN COLOK LAPTOP

### A. Tes Multimeter Sebelum Pasang Daya (Uji Bebas Hubung Singkat / Korslet):
1. **JANGAN COLOK BATERAI ATAU ADAPTOR DULU.**
2. Setel multimeter ke mode **Continuity (Bip)**:
   - Tempelkan tester hitam ke **GND**, tester merah ke **Rel 3.3V** -> **Wajib TIDAK berbunyi bip** (tidak ada jalur yang korslet).
   - Tempelkan tester hitam ke **GND**, tester merah ke **Rel 5.0V** -> **Wajib TIDAK berbunyi bip**.

---

### B. Aturan Emas Saat Colok Kabel USB Laptop untuk Upload Firmware (.ino):
> **PERINGATAN PENTING KELISTRIKAN:**
> Ketika kamu menyambungkan kabel USB dari Laptop ke port USB ESP32 untuk memasukkan program (*flash firmware*):
> 1. **Ubah Saklar ON/OFF modul ke posisi OFF terlebih dahulu!**
> 2. Laptop sudah menyuplai daya 5V langsung lewat port USB ESP32.
> 3. Mematikan saklar baterai mencegah benturan arus (*reverse current*) antara tegangan MT3608 dan port USB laptop kamu.

---

### C. Tes Operasional Mandiri (Tanpa Laptop):
1. Pasang baterai 18650 pada dudukannya (perhatikan kutub + dan - jangan terbalik).
2. Geser Saklar ke posisi **ON**.
3. Lampu power ESP32 menyala merah terang.
4. Layar TFT 2.8" menyala terang dengan lampu latar aktif.
5. Colok adaptor USB 5V 3A ke port TP4056 -> Lampu merah/biru pada modul TP4056 menyala menandakan baterai sedang diisi sambil alat tetap beroperasi penuh.
6. Wiring hardware kamu **100% SELESAI, AMAN, DAN SIAP MEMASUKI TAHAP FIRMWARE!**
