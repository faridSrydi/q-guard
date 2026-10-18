# PANDUAN PENGUJIAN ALAT Q-GUARD & PEMETAAN HASIL KE FULL PAPER QIC 2026

Panduan ini disusun untuk memandu tim dalam melakukan pengujian eksperimental prototipe fisik **Q-GUARD**, mencatat data pengamatan, mengambil dokumentasi foto/grafik, serta menempatkan hasilnya secara tepat ke dalam dokumen [FULLPAPER_QIC_2026_QGUARD.md](file:///c:/Users/LENOVO/Desktop/QGUARD/docs/FULLPAPER_QIC_2026_QGUARD.md).

---

## BAGIAN 1: PERSIAPAN ALAT & LINGKUNGAN PENGUJIAN

### 1.1 Daftar Perangkat & Bahan yang Dibutuhkan
1. **Unit Instrumen Q-GUARD:**
   - Mikrokontroler ESP32 terprogram firmware Q-GUARD.
   - 3x Sensor suhu digital waterproof Dallas DS18B20 bertanda:
     - **Probe 1 (T1 - Core):** Probe dengan kabel panjang untuk diselipkan ke titik terdalam kargo.
     - **Probe 2 (T2 - Mid):** Probe untuk lapisan tengah tumpukan produk.
     - **Probe 3 (T3 - Door):** Probe di area tepi dekat palka/pintu.
   - 1x Sensor getaran MPU6050 (terpasang di modul utama).
   - 1x Sensor saklar magnetik pintu palka MC-38 (bagian sensor terhubung ke GPIO 34, bagian magnet menempel pada daun pintu).
   - 1x Modul GPS NEO-6M & RTC DS3231.
   - 1x Layar TFT 2.8" ILI9341 & Buzzer.
   - 1x Kartu MicroSD (format FAT32) terpasang di modul SD Card.
   - Catu daya (Baterai Li-Po 5000 mAh atau Powerbank 5V/2A).
2. **Wadah Pendingin Simulasi:**
   - 1x *Cool box* atau wadah berinsulasi styrofoam/polyurethane (kapasitas 30–40 liter).
   - Spesimen beku: Es balok terkontrol, daging ayam beku, atau spesimen ikan beku (target awal $\le -20^\circ\text{C}$).
3. **Perangkat Lunak & Server:**
   - Laptop penguji terhubung ke jaringan Wi-Fi/Hotspot yang sama dengan konfigurasi ESP32.
   - Backend Q-GUARD aktif (`npm start` di folder `backend`, port 3000).
   - Dashboard Web Q-GUARD aktif (`npm run dev` di folder `dashboard`, port 5173).

---

## BAGIAN 2: LANGKAH-LANGKAH PENGUJIAN (5 SKENARIO)

---

### SKENARIO 1: Pengujian Sensitivitas Spasial Gradien Suhu (*Tri-Probe Stratification*)
* **Tujuan:** Membuktikan bahwa susunan tri-probe Q-GUARD mendeteksi bahaya kenaikan suhu lebih cepat daripada sensor titik tunggal biasa.
* **Langkah Kerja:**
  1. Masukkan spesimen kargo beku ke dalam *cool box*.
  2. Pasang sensor:
     - Tancapkan **T1** ke bagian inti/tengah spesimen beku terdalam (*Core*).
     - Letakkan **T2** di antara kemasan bagian tengah (*Mid-Pack*).
     - Letakkan **T3** di permukaan atas dekat celah karet penutup/pintu (*Door Boundary*).
  3. Tutup rapat wadah pendingin dan biarkan suhu stabil pada rentang $-22^\circ\text{C}$ s.d. $-20^\circ\text{C}$.
  4. Lakukan simulasi kegagalan pendingin: Buka sedikit tutup wadah atau cabut pendingin pada suhu ruang $+28^\circ\text{C}$.
  5. Catat pergerakan suhu pada layar TFT atau Dashboard Web setiap 1 menit selama 60–120 menit:
     - Waktu saat **T3** mulai naik.
     - Waktu saat **T3** menembus batas kritis $-18.0^\circ\text{C}$.
     - Waktu saat **T1 (Inti)** menembus $-18.0^\circ\text{C}$.
* **Parameter yang Diambil:**
  - $\Delta t$ selisih waktu: Berapa menit lebih awal T3 mendeteksi bahaya dibanding T1.
  - Gradien suhu $\Delta T = |T_3 - T_1|$ pada saat insiden.

---

### SKENARIO 2: Pengujian Keandalan Protokol *Offline-First Store-and-Forward*
* **Tujuan:** Memvalidasi bahwa saat kapal/truk melintasi zona tanpa sinyal, tidak ada 1 pun data yang hilang (*zero data loss*), dan data tersinkronisasi otomatis saat terhubung kembali.
* **Langkah Kerja:**
  1. Nyalakan Q-GUARD dan pastikan MicroSD terpasang (status SD: OK).
  2. Saat pengujian berjalan, **matikan Wi-Fi / Hotspot laptop/ponsel** selama 60 s.d. 120 menit.
  3. Perhatikan layar Q-GUARD: Indikator koneksi beralih ke mode offline, namun counter data pada MicroSD terus bertambah setiap 5 detik.
  4. Setelah 120 menit, **nyalakan kembali Wi-Fi / Hotspot**.
  5. Amati proses sinkronisasi otomatis pada log terminal backend:
     - Amati pengiriman batch ingestion `/api/sensor-data/batch`.
     - Catat waktu yang diperlukan untuk mengunggah seluruh data yang tertunda.
  6. Periksa basis data: Bandingkan jumlah baris di MicroSD (`.csv`) dengan baris yang masuk ke database SQLite.
* **Parameter yang Diambil:**
  - Jumlah paket tersimpan di SD vs masuk ke server (*Packet Delivery Ratio* / Kelengkapan Data: Target 100%).
  - Durasi waktu pengunggahan massal (*Batch Ingestion Latency*, target: < 10 detik).

---

### SKENARIO 3: Pengujian Deteksi Kejadian Kritis (*Door Tamper & Mechanical Shock*)
* **Tujuan:** Menguji sensitivitas sensor magnetik MC-38 dan akselerometer MPU6050 dalam merekam insiden benturan dan bukaan pintu yang tidak sah.
* **Langkah Kerja:**
  1. **Uji Pintu Palka (MC-38):**
     - Buka penutup/pintu wadah simulasi selama:
       - Uji A: 10 detik (insiden singkat).
       - Uji B: 2 menit (insiden sedang).
       - Uji C: 10 menit (insiden berat).
     - Periksa apakah alarm buzzer berbunyi, status pintu di dashboard langsung berubah `TERBUKA`, dan stempel waktu dicatat.
  2. **Uji Guncangan / Hentakan (MPU6050):**
     - Berikan getaran jalan dan hentakan pada wadah dengan menjatuhkan wadah dari ketinggian 10 cm, 25 cm, dan 50 cm pada bantalan karet uji.
     - Periksa pembacaan nilai percepatan resultan $g_{\text{net}} = \sqrt{a_x^2 + a_y^2 + a_z^2}$.
     - Pastikan hentakan $> 2.0g$ memicu status *Warning* dan $> 3.0g$ memicu status *Critical Drop*.
* **Parameter yang Diambil:**
  - Latensi deteksi saklar magnetik (target: < 500 ms).
  - Nilai puncak $g_{\text{peak}}$ yang terekam pada memori.

---

### SKENARIO 4: Pengujian Deteksi Anomali AI Multivariat (*Isolation Forest vs Rule Engine*)
* **Tujuan:** Membuktikan bahwa model AI Isolation Forest mampu membedakan fluktuasi normal (seperti siklus *defrost* kompresor reefer) dengan kerusakan sistem pendingin sesungguhnya, sehingga menekan angka alarm palsu.
* **Langkah Kerja:**
  1. Buat dua skenario data:
     - **Skenario Defrost Normal:** Suhu udara ambien dan T3 naik sesaat selama 15 menit hingga $-15^\circ\text{C}$, namun suhu inti kargo T1 tetap stabil di bawah $-19^\circ\text{C}$ dan pintu tetap tertutup rapat.
     - **Skenario Kerusakan Pendingin Nyata:** Suhu T3 dan T1 sama-sama naik terus-menerus melebihi $-18^\circ\text{C}$ disertai kenaikan kelembapan.
  2. Jalankan evaluasi model Isolation Forest pada backend (`/api/risk/evaluate`).
  3. Catat klasifikasi model: Apakah siklus *defrost* normal menghasilkan skor anomali rendah (tidak memicu alarm palsu), sedangkan kegagalan nyata menghasilkan skor anomali tinggi ($> 0.60$).
* **Parameter yang Diambil:**
  - *Precision*, *Recall*, dan *F1-Score* model AI.
  - Angka *False Alarm Rate* (FAR) pada siklus defrost.

---

### SKENARIO 5: Pengujian End-to-End Sinkronisasi & Penerbitan *Quarantine Dossier*
* **Tujuan:** Menguji alur menyeluruh dari pembacaan alat hingga penerbitan dokumen sertifikasi digital di dashboard Barantin.
* **Langkah Kerja:**
  1. Daftarkan kargo baru di menu **Data Pengiriman** (misal ID: `SHP-EXP-2026-TUNA`).
  2. Jalankan alat selama siklus simulasi rute pelayaran.
  3. Buka menu **Laporan Karantina** di Dashboard Web (`/#reports`).
  4. Klik tombol **Cetak / Ekspor Berkas Inspeksi Karantina (Dossier)**.
  5. Periksa kelengkapan isi berkas digital: Skor risiko komposit CACCR, kalkulasi MKT, grafik riwayat suhu tri-probe, peta koordinat GPS, dan status rekomendasi karantina (*PASSED / CONDITIONAL / REJECTED*).
* **Parameter yang Diambil:**
  - Waktu respons pembuatan laporan digital (target: < 3 detik).
  - Kesesuaian rekomendasi sistem dengan kondisi fisik sampel.

---

### SKENARIO 6 (SANGAT DIREKOMENDASIKAN): Uji Operasional Lapangan Nyata (Field Trial Sepeda Motor & Komoditas Ikan Asli)
* **Urgensi Ilmiah:** Pengujian ini adalah **nilai plus terbesar bagi juri QIC 2026**. Membuktikan bahwa Q-GUARD bukan sekadar alat di atas meja, melainkan instrumen tangguh yang teruji di kondisi jalanan tropis nyata Indonesia (*real-world archipelagic distribution*).
* **1. Persiapan Komoditas Ikan Asli & Coolbox:**
  - **Wadah:** Coolbox styrofoam atau plastik (kapasitas 15–30 liter) diikat erat pada jok belakang sepeda motor.
  - **Komoditas:** Ikan laut beku (misalnya 1–2 kg ikan tongkol, cakalang, bandeng, atau tuna loin dari pasar/supermarket).
  - **Pendingin:** Es batu balok atau *ice gel packs* secukupnya.
  - **Pemasangan Probe Tri-Probe pada Ikan:**
    - **T1 (Core):** Ditusukkan masuk ke bagian tengah daging ikan terdalam.
    - **T2 (Mid):** Diselipkan di antara ikan dan tumpukan es di tengah boks.
    - **T3 (Door):** Ditaruh di permukaan paling atas dekat celah tutup coolbox (titik yang paling terpapar panas terik matahari dan angin motor).
  - **Sensor Pintu (MC-38):** Dipasang pada bibir boks dan tutupnya.
  - **Power:** Diberi daya baterai Li-Po / Powerbank 5V yang diletakkan aman di dalam boks/saku boks.
* **2. Rekomendasi Jarak & Rute Perjalanan Motor:**
  - **Jarak Ideal:** Cukup **10 s.d. 20 km** (atau rute bolak-balik sekitar 15–25 km).
  - **Durasi Ideal:** **45 s.d. 90 menit** berkendara.
  - **Karakteristik Medan Jalan:** 
    - Lintasi jalan aspal biasa, jalan bergelombang/polisi tidur (untuk membuktikan sensor getaran MPU6050 mendeteksi guncangan nyata $> 1.5g - 2.5g$).
    - Melintasi area terbuka agar modul GPS NEO-6M mengunci sinyal (*3D Fix*) dan merekam rute geospasial lintang & bujur.
    - Lakukan 1 kali simulasi buka tutup coolbox selama 30 detik di tengah jalan (simulasi inspeksi kurir) untuk memicu interupsi sensor MC-38.
* **3. Apa yang Terjadi Selama Perjalanan Motor?**
  - Selama motor berjalan (tanpa ada Wi-Fi), ESP32 mencatat data setiap 5 detik ke **MicroSD** (suhu tri-probe, koordinat GPS, getaran $g$-force, stempel waktu RTC).
  - Indikator Wi-Fi di alat akan menampilkan mode *offline blackbox logging*.
* **4. Langkah Saat Tiba di Tujuan (Gerbang Inspeksi Simulasi):**
  - Bawa boks/alat masuk ke area yang ada Wi-Fi/Hotspot (tempat laptop server Q-GUARD aktif).
  - Begitu terhubung kembali ke Wi-Fi, amati:
    1. ESP32 otomatis mengunggah seluruh rekaman data MicroSD ke peladen cloud (hanya butuh 3–5 detik).
    2. Buka dashboard web menu **Peta Pelayaran GPS** (`/#gps-track`): Rute perjalanan motor Anda langsung terpetakan dari titik awal hingga tujuan!
    3. Buka menu **Telemetri Langsung** (`/#monitoring`): Terlihat grafik suhu asli bagaimana terik panas matahari mulai menghangatkan probe pintu (T3), tetapi probe inti daging ikan (T1) tetap dingin terjaga.
    4. Buka menu **Laporan Karantina** (`/#reports`): Cetak *Quarantine Inspection Dossier* resmi yang mencantumkan nama komoditas ikan asli, rute GPS, dan skor risiko komposit CACCR.
* **5. Dokumentasi Foto Wajib untuk Full Paper:**
  - Foto coolbox berisi ikan asli dan kabel probe tertancap di daging ikan.
  - Foto coolbox dan alat Q-GUARD terpasang di atas motor.
  - Foto layar TFT Q-GUARD saat di jalan (menampilkan grafik suhu & koordinat GPS).
  - Tangkapan layar Peta Pelayaran GPS di dashboard yang menampilkan garis rute perjalanan motor Anda.

---

## BAGIAN 3: PANDUAN PENEMPATAN HASIL UJI KE DALAM FULL PAPER

Buka file [docs/FULLPAPER_QIC_2026_QGUARD.md](file:///c:/Users/LENOVO/Desktop/QGUARD/docs/FULLPAPER_QIC_2026_QGUARD.md), lalu masukkan data hasil pengujian pada **BAB III, Subbab 3.4**:

| No | Pengujian | Lokasi di Full Paper | Data / Format yang Dimasukkan |
|:---:|:---|:---|:---|
| **1** | Uji Sensitivitas Spasial Tri-Probe | **Subbab 3.4.1** (baris ~430–443) | **Tabel:** Kolom Waktu (menit), Suhu T1 Core (°C), T2 Mid (°C), T3 Door (°C), Selisih ΔT (°C).<br>**Grafik:** Kurva garis perbandingan ketiga suhu terhadap waktu.<br>**Narasi:** Jelaskan berapa menit T3 mendeteksi bahaya lebih cepat dibanding sensor tunggal. |
| **2** | Uji Keandalan Offline-First | **Subbab 3.4.2** (baris ~455–465) | **Tabel:** Kolom Durasi Pemutusan Jaringan (menit), Paket Tersimpan di SD, Paket Masuk ke Server, Data Loss (0%), Waktu Sinkronisasi (detik).<br>**Narasi:** Jelaskan integritas data 100% tanpa ada record yang hilang atau duplikat. |
| **3** | Uji Deteksi Anomali AI Multivariat | **Subbab 3.4.3** (baris ~476–490) | **Tabel/Matriks:** Confusion Matrix (True Positive, False Positive, True Negative, False Negative), metrik Precision, Recall, F1-Score.<br>**Grafik:** Sebaran skor anomali saat siklus defrost vs kegagalan pendingin.<br>**Narasi:** Jelaskan kemampuan AI menekan alarm palsu. |
| **4** | Uji Kejadian Kritis (Pintu & Getaran) | **Subbab 3.4.4** (baris ~503–513) | **Tabel:** Kolom Insiden Uji, Nilai Sensor (Durasi Pintu / Nilai g-force), Respon Alarm Buzzer, Skor Penalti Risiko.<br>**Narasi:** Jelaskan keakuratan stempel waktu dan deteksi intrusi fisik. |
| **5** | Uji End-to-End & Penerbitan Dossier | **Subbab 3.4.5** (baris ~520–535) | **Gambar/Tangkapan Layar:** Dashboard Web Q-GUARD saat menampilkan status kargo dan preview berkas *Quarantine Inspection Dossier*.<br>**Narasi:** Jelaskan kecepatan validasi kargo di perbatasan (< 5 menit). |

---

## BAGIAN 4: KETENTUAN & DAFTAR GAMBAR RESMI UNTUK FULL PAPER

> [!IMPORTANT]
> **ATURAN RESMI KOMPETISI QIC 2026:**  
> Sesuai ketentuan panduan *format penulisan Fullpaper QIC 2026.pdf*, jumlah visualisasi dalam naskah utama dibatasi **maksimal 5 kombinasi Gambar/Tabel** agar naskah tetap fokus, padat, dan proporsional (8–10 halaman).

Berikut adalah **5 GAMBER UTAMA** yang direkomendasikan untuk diletakkan di Full Paper:

### 1. GAMBAR 1: Kerangka Konseptual & Model Penilaian Risiko CACCR
* **Lokasi di Naskah:** **BAB II, Subbab 2.1**
* **Bentuk Gambar:** Diagram alir (*Flowchart*) atau skema blok konseptual.
* **Isi Gambar:** Alur penginderaan multi-modal kontainer $\rightarrow$ Edge ESP32 $\rightarrow$ Buffer MicroSD/Cloud $\rightarrow$ Mesin Analitik CACCR (MKT Arrhenius & Isolation Forest) $\rightarrow$ Dashboard Barantin $\rightarrow$ Disposisi Jalur Hijau/Lab.
* **Format Keterangan:** *Gambar 2.1 Kerangka Kerja Konseptual Sistem Q-GUARD untuk Smart Quarantine.*

### 2. GAMBAR 2: Prototipe Perangkat Keras Q-GUARD & Skema Penempatan Tri-Probe
* **Lokasi di Naskah:** **BAB II, Subbab 2.2**
* **Bentuk Gambar:** Foto fisik gabungan (*composite photo*):
  - *Sisi A:* Foto kotak instrumen Q-GUARD (menampilkan layar TFT, casing, probe kabel, dan sensor).
  - *Sisi B:* Skema ilustrasi posisi penempatan probe T1 (Inti), T2 (Tengah), dan T3 (Dekat Pintu) di dalam wadah kargo/coolbox.
* **Format Keterangan:** *Gambar 2.2 Prototipe Fisik Instrumen Q-GUARD dan Skema Penempatan Array Tri-Probe pada Wadah Kargo.*

### 3. GAMBAR 3: Grafik Respon Termal Spasial Tri-Probe terhadap Kegagalan Pendingin
* **Lokasi di Naskah:** **BAB III, Subbab 3.4.1**
* **Bentuk Gambar:** Grafik garis (*multi-line chart*) hasil ekspor pengujian:
  - Garis Biru = Suhu T1 (Core)
  - Garis Hijau = Suhu T2 (Mid)
  - Garis Merah = Suhu T3 (Door Side)
  - Garis Putus-putus Merah = Garis Batas Kritis $-18.0^\circ\text{C}$
* **Pesan Utama Gambar:** Memperlihatkan secara visual bahwa T3 melintasi garis $-18^\circ\text{C}$ jauh lebih awal daripada T1, membuktikan kemampuan deteksi dini.
* **Format Keterangan:** *Gambar 3.2 Profil Dinamika Suhu Tri-Probe pada Skenario Kegagalan Unit Pendingin.*

### 4. GAMBAR 4: Evaluasi Deteksi Anomali AI Multivariat (Isolation Forest)
* **Lokasi di Naskah:** **BAB III, Subbab 3.4.3**
* **Bentuk Gambar:** Grafik sebaran skor anomali (*Scatter Plot*) atau *Confusion Matrix* model AI:
  - Memperlihatkan klaster data siklus *defrost* normal berada di area skor rendah (Aman, $< 0.35$).
  - Klaster data kegagalan sistem pendingin nyata berada di area skor tinggi ($> 0.60$).
* **Format Keterangan:** *Gambar 3.3 Distribusi Skor Anomali Model Isolation Forest pada Kondisi Defrost Normal dan Kegagalan Termal.*

### 5. GAMBAR 5: Antarmuka Dashboard Web Barantin & Berkas Digital Quarantine Inspection Dossier
* **Lokasi di Naskah:** **BAB III, Subbab 3.4.5**
* **Bentuk Gambar:** Tangkapan layar beresolusi tinggi (*high-resolution screenshot*):
  - Tampilan halaman Telemetri Langsung dashboard Q-GUARD yang menampilkan grafik suhu tri-probe, peta GPS, dan status Wi-Fi.
  - Tampilan contoh dokumen cetak *Quarantine Inspection Dossier* yang diterbitkan sistem.
* **Format Keterangan:** *Gambar 3.4 Antarmuka Dashboard Digital Inspection dan Contoh Berkas Rekomendasi Karantina (Quarantine Inspection Dossier).*

---

## BAGIAN 5: PETUNJUK TEKNIS FORMAT GAMBAR (STANDAR ILMIAH)

1. **Resolusi dan Ketajaman:**  
   Gunakan gambar dengan resolusi minimal **300 DPI** agar tidak pecah saat dicetak.
2. **Kesesuaian Teks Keterangan (*Caption*):**  
   - Keterangan gambar diletakkan di **bawah gambar**, posisi rata tengah (*center*), jenis huruf *Times New Roman 10pt*, spasi tunggal.
   - Contoh: `Gambar 3.2 Profil Dinamika Suhu Tri-Probe pada Skenario Kegagalan Pendingin.`
3. **Penyebutan dalam Teks Narasi (*In-Text Reference*):**  
   Setiap gambar wajib dirujuk secara eksplisit dalam paragraf sebelum gambar muncul, misalnya:  
   *"...Sebagaimana disajikan pada Gambar 3.2, kenaikan suhu pada probe perimeter (T3) terdeteksi 18 menit lebih awal..."*
4. **Kejelasan Label & Legenda:**  
   Pastikan label sumbu X (Waktu/Menit), sumbu Y (Suhu/°C), serta legenda garis terbaca dengan jelas tanpa perlu diperbesar.
