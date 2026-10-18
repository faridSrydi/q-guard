# PANDUAN PENGGUNAAN FIRMWARE ARDUINO (Q-GUARD ESP32)

File firmware berekstensi `.ino` telah dibuat di folder:
**`firmware/arduino/qguard_esp32/qguard_esp32.ino`**

Panduan ini menjelaskan cara membuka, menginstal library yang diperlukan, dan mengunggah (*flash*) program ke ESP32 kamu melalui **Arduino IDE**.

---

## 1. DAFTAR LIBRARY YANG PERLU DIINSTAL DI ARDUINO IDE

Buka Arduino IDE, klik menu **Tools > Manage Libraries...** (atau tekan `Ctrl + Shift + I`), lalu cari dan instal library resmi berikut satu per satu:

| No | Nama Library di Library Manager | Penulis (Author) | Fungsi |
|:--:|---|---|---|
| 1 | **Adafruit GFX Library** | Adafruit | Engine grafis dasar layar TFT |
| 2 | **Adafruit ILI9341** | Adafruit | Driver display LCD 2.8" SPI |
| 3 | **XPT2046_Touchscreen** | Paul Stoffregen | Driver sentuhan (*touchscreen*) |
| 4 | **OneWire** | Paul Stoffregen / Jim Studt | Protokol 1-Wire untuk sensor suhu |
| 5 | **DallasTemperature** | Miles Burton | Pembaca suhu probe DS18B20 |
| 6 | **Adafruit BME280 Library** | Adafruit | Suhu & Kelembapan lingkungan luar |
| 7 | **Adafruit Unified Sensor** | Adafruit | Dependensi sensor Adafruit |
| 8 | **RTClib** | Adafruit | Jam presisi modul RTC DS3231 |
| 9 | **TinyGPSPlus** | Mikal Hart | Parser koordinat modul GPS NEO-6M |

*(Library bawaan seperti `SPI.h`, `Wire.h`, `FS.h`, dan `SD.h` sudah otomatis terinstal bersama board package ESP32).*

---

## 2. PENGATURAN BOARD DI ARDUINO IDE

1. Sambungkan kabel USB dari laptop ke port USB ESP32.
   > **INGAT ATURAN EMAS:** Pastikan **Saklar Baterai pada modul dalam posisi OFF** saat kabel USB laptop dicolok!
2. Buka menu **Tools** dan sesuaikan pengaturannya:
   - **Board:** `DOIT ESP32 DEVKIT V1` *(atau `ESP32 Dev Module`)*
   - **Upload Speed:** `921600` *(atau `115200` jika laptop lambat)*
   - **Flash Frequency:** `80MHz`
   - **Port:** Pilih nomor port COM ESP32 kamu (misal `COM3`, `COM4`, dsb.)

---

## 3. FITUR-FITUR KEREN YANG SUDAH DITANAMKAN DI FIRMWARE

### A. Animasi Startup Lampu LED & Audio Chime
* Saat pertama kali saklar dinyalakan, sistem menjalankan animasi *Knight Rider / LED Chaser*:
  - Lampu **Hijau -> Kuning -> Merah** menyala bergantian diiringi nada *chirp* buzzer futuristik.
  - Diakhiri dengan kedipan serentak 3 LED dan nada sukses bertingkat (*startup chime*).

### B. Tampilan Awal (Splash Screen) Berkelas
* Menampilkan bingkai teknologi beraksen Cyan.
* Logo besar **"Q-GUARD"** dengan tagline resmi:
  - *"SMART COLD-CHAIN RISK MONITOR"*
  - *"BIO-SECURITY & QUARANTINE PROTOCOL"*
* Animasi *Progress Bar* loading bertahap (0% s/d 100%) yang mengecek kesiapan modul hardware.

### C. Layar Monitoring Utama (Live Telemetry)
* **Header Bar:** Menampilkan Jam RTC akurat, Profil Komoditas aktif, indikator MicroSD aktif (`SD`), dan indikator satelit (`GPS`).
* **Kartu Suhu 3 Titik:**
  - $T_1$ (Suhu Udara Atas / Es)
  - $T_2$ (Suhu Inti Daging Ikan / Sampel Vaksin) -> Angka besar dengan warna hijau saat 0–4°C atau merah saat terjadi *excursion*.
  - $T_3$ (Suhu Zona Bukaan Pintu)
* **Nilai MKT (Mean Kinetic Temperature):** Dihitung otomatis secara matematis berdasarkan persamaan Arrhenius.
* **Status Pintu:** Mendeteksi `CLOSED (Rapat)` atau `OPEN (Buka)` dari sensor magnet MC-38.
* **Indikator Guncangan MPU6050:** Menampilkan angka $g$ secara real-time dan peringatan *"SHOCK!"* jika boks terbanting.
* **Badge Skor Risiko AI:** Kotak skor risiko (0–100) dengan rekomendasi status karantina:
  - *FAST-TRACK RELEASE* (Aman / Normal)
  - *INSPECT CORE* (Peringatan)
  - *QUARANTINE HOLD* (Bahaya / Ditahan Karantina)

### D. Audio Feedback (Bunyi Sentuhan & Alarm)
* **Audio-Haptic Click:** Setiap kali tombol fisik ditekan atau tombol di layar TFT disentuh, buzzer mengeluarkan suara klik pendek yang renyah (*tactile audio feedback*).
* **Warning Alarm:** 2 kali bunyi bip pendek jika pintu dibiarkan terbuka terlalu lama.
* **Critical Alarm:** Bunyi bip cepat terus-menerus jika suhu inti $T_2$ melebihi ambang batas aman.
* **Fitur Mute:** Menekan **Tombol 1 (BACK)** akan mematikan bunyi alarm sementara selama 30 detik agar tidak bising saat inspeksi.

### E. Navigasi Ganda: Sentuh Layar (Touch) ATAU 3 Tombol Fisik
* Kamu bisa memilih menu langsung dengan menyentuh layar TFT.
* Jika tangan basah atau memakai sarung tangan lab tebal, kamu bisa menggunakan 3 tombol fisik:
  - **Tombol 2 (SELECT / GPIO 36):** Menggeser kursor pilihan menu ke bawah.
  - **Tombol 3 (CONFIRM / GPIO 39):** Membuka menu yang dipilih / Konfirmasi profil.
  - **Tombol 1 (BACK / GPIO 34):** Kembali ke layar monitor utama / Mute alarm.

### F. Pilihan Menu di Dalam Layar
1. **Live Telemetry Monitor:** Kembali ke dashboard pemantau utama.
2. **Ganti Profil Komoditas:** Memilih batas suhu antara:
   - *Ikan Segar (0.0°C s/d 4.0°C)* -> Khusus pengujian boks isi ikan!
   - *Vaksin / Obat (2.0°C s/d 8.0°C)*
   - *Daging / Ikan Beku (-20.0°C)*
3. **Grafik Mini Tren Suhu:** Menampilkan grafik garis kurva fluktuasi suhu 30 sampel terakhir lengkap dengan garis batas merah.
4. **Status MicroSD & Log:** Menampilkan jumlah baris log yang sudah tersimpan di kartu memori dalam format `/qguard_log.csv`.

---

## 4. LANGKAH UPLOAD
1. Buka file `firmware/arduino/qguard_esp32/qguard_esp32.ino` di Arduino IDE.
2. Klik tombol centang (**Verify**) untuk memastikan semua library sudah terpasang.
3. Klik tombol panah ke kanan (**Upload**).
4. Jika muncul tulisan `Connecting......`, tekan tombol **BOOT** pada ESP32 selama 1 detik (jika board kamu memerlukan penekanan tombol boot).
5. Tunggu hingga proses upload mencapai 100% (*Done uploading*).
6. ESP32 akan langsung menyala dengan animasi startup lampu LED yang keren, suara *chime*, dan splash screen Q-GUARD!
