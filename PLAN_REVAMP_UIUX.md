# 📘 MASTER PLAN: PEROMBAKAN TOTAL UI/UX Q-GUARD

Dokumen perencanaan arsitektur, visual, dan teknis untuk perombakan total antarmuka web **Q-GUARD (Smart Cold-Chain Risk Monitoring & Quarantine Decision Support System)**.

---

## 🎯 1. Ringkasan Visi & Prinsip Desain

### A. Karakter Visual (Anthropic Editorial Style)
- **Dominan Terang & Bersih**: Palet putih dan slate terang (`#ffffff`, `#f8fafc`, `#f1f5f9`), dipadukan dengan tipografi gelap berkarakter tegas (`#0f172a`, `#334155`) serta aksen biru karantina presisi (`#0284c7`, `#0369a1`).
- **Lapang & Bernapas (*Generous Whitespace*)**: Jarak vertikal dan horizontal yang lega antar seksi (`padding: 96px 0`), menghilangkan kesan sesak dan menonjolkan substansi ilmiah.
- **Desain Kartu (*Cards*)**: Border tipis (`1px solid #e2e8f0`), sudut membulat modern (`border-radius: 14px`), dan bayangan bertingkat sangat halus (`box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 10px 24px -4px rgba(0,0,0,0.03)`).
- **Tipografi Editorial**: Menggunakan *Plus Jakarta Sans* / *Inter* dengan rasio kontras tinggi, teks isi yang nyaman dibaca (`font-size: 15px - 16px`, `line-height: 1.65`), serta *eyebrow section tags* teknis yang rapi.

### B. Karakter Objek 3D Hero (Floating & Borderless)
- **Tanpa Border / Non-Boxed**: Canvas Three.js menyatu 100% transparan dengan latar belakang halaman tanpa garis batas kartu (*no bounding box*).
- **Efek Melayang (*Floating Object*)**: Kontainer reefer dan perangkat Q-GUARD melayang lembut di udara dengan bayangan lantai halus (*soft ambient occlusion floor shadow*).
- **Interaktivitas Bebas**: Pengunjung dapat memutar sudut pandang (360° orbit) dengan klik/sentuh dan drag kursor.

---

## 🗺️ 2. Arsitektur Halaman & Struktur Navigasi

Aplikasi dibagi secara tegas menjadi dua ranah pengalaman pengguna:
1. **Landing Page Publik (`/` atau `#home`)**: Satu halaman utuh yang bisa discroll (*single-page narrative scrollable*), memuat 7 seksi lengkap + Hero 3D.
2. **Dashboard Operasional Petugas (`/admin/*`)**: Workspace terpisah khusus petugas Karantina Barantin dengan sidebar ramping dan sub-halaman fungsional berbasis URL.

```mermaid
graph TD
    A[Pengunjung Web] --> B[Landing Page: /]
    B --> B0[Hero 3D: Kontainer Melayang & Q-GUARD]
    B --> B1[1. Masalah Rantai Dingin Karantina]
    B --> B2[2. Cara Kerja 4 Langkah Q-GUARD]
    B --> B3[3. Tri-Probe & Ekosistem Sensor Fisik]
    B --> B4[4. Simulator Skenario Karantina Interaktif]
    B --> B5[5. Manfaat Nyata Barantin & Pelaku Usaha]
    B --> B6[6. Arsitektur Sistem Berlapis]
    B --> B7[7. Ajakan Tindakan / Akses Petugas]

    B7 --> C[Login Petugas Barantin]
    C --> D[Dashboard Workspace: /admin/*]
    D --> D1[/admin/overview - Ringkasan Utama]
    D --> D2[/admin/monitoring - Telemetri 3 Probe Langsung]
    D --> D3[/admin/shipments - Data Pengiriman & Penugasan]
    D --> D4[/admin/gps-track - Peta Rute Pelayaran GPS]
    D --> D5[/admin/risk-engine - Analisis Risiko AI & MKT]
    D --> D6[/admin/alerts - Log Kronologis Peringatan]
    D --> D7[/admin/reports - Dokumen Dossier Karantina]
    D --> D8[/admin/settings - Konfigurasi Regulasi]
```

---

## 📐 3. Rincian 7 Seksi Landing Page

### 🌟 Hero Section: Floating 3D Reefer & Q-GUARD Device
- **Viewport 3D**:
  - Kontainer pendingin maritim 40ft/20ft dengan panel corrugated khas pelayaran.
  - Sisi samping/depan memiliki potongan transparan (*frosted/wireframe cutaway*) yang memperlihatkan isi interior: palet boks kargo beku, aliran udara dingin, dan kabel sensor.
  - Perangkat Q-GUARD terpasang di dinding kontainer:
    - Casing abu-abu terang (*light gray rugged enclosure*), orientasi vertikal (lebih tinggi daripada lebar).
    - Layar TFT di bagian depan atas dengan tampilan telemetri visual (angka suhu, status jalur).
    - 3 tombol berwarna (Back merah, Select kuning, Confirm hijau) dan 3 LED indikator di bawah layar.
    - Gland kabel hitam di bagian bawah yang memancarkan kabel probe fleksibel ke lapisan es, inti kargo, dan pintu.
  - Tidak ada border atau kotak pembungkus; bayangan lembut di dasar memberikan ilusi melayang anggun di kanvas putih hero.
- **Teks Pendamping**:
  - *Eyebrow Tag*: `BADAN KARANTINA INDONESIA • TEKNOLOGI SMART BORDER`
  - *Headline*: **"Integritas Rantai Dingin Tanpa Celah dari Titik Muat hingga Pelabuhan"**
  - *Subheadline*: Pemantauan kontinyu komoditas ekspor-impor menggunakan Edge-AI mandiri dan diferensial termal tiga titik, menjamin keamanan hayati tanpa kompromi.
  - *Tombol Aksi*: `Buka Dashboard Petugas` (Primary Blue) dan `Uji Coba Simulator` (Secondary Outlined).

---

### 1️⃣ Seksi 1: Masalah yang Ingin Diselesaikan (*The Problem*)
- **Fokus Konten**: Mengapa pemeriksaan saat tiba di pelabuhan saja (*point-of-arrival testing*) membuka celah risiko besar:
  - **Fenomena Kotak Hitam di Tengah Laut**: Insiden kerusakan pendingin (genset mati, defrost gagal, atau kebocoran segel) di perairan lepas tidak pernah tercatat jika hanya mengandalkan termometer tusuk saat sandar.
  - **Manipulasi Re-Freezing**: Kargo yang sempat mencair dan mengalami pembusukan bakteri bisa dibekukan kembali sebelum bersandar. Suhu luarnya tampak beku (-18°C), tetapi kerusakan seluler dan toksin bakteri di inti sudah terbentuk.
  - **Sengketa Dagang & Klaim Asuransi**: Tanpa rekam jejak obyektif, sulit membuktikan di pelabuhan mana atau di kapal siapa kerusakan terjadi.

---

### 2️⃣ Seksi 2: Cara Kerja Q-GUARD (*How It Works*)
Disajikan dalam alur 4 tahap progresif horizontal/vertikal dengan nomor tegas `01` - `04`:
1. **01. Pemasangan & Kalibrasi Profil (Origin)**: Perangkat dipasang di kontainer asal, 3 probe ditancapkan, dan profil komoditas (misal Daging Beku -18°C atau Vaksin 2-8°C) diaktifkan.
2. **02. Pengawasan Offline Mandiri di Laut (In-Transit)**: ESP32 membaca data tiap 1 detik, menyaring guncangan dinamis, menghitung kinetika Arrhenius MKT, dan menyimpan 100% data ke MicroSD FAT32 secara mandiri tanpa internet.
3. **03. Sinkronisasi Otomatis Tanpa Sentuh (Arrival)**: Saat merapat ke dermaga atau jangkauan WiFi/AP/LTE, alat otomatis mengunggah seluruh telemetri ke server Barantin.
4. **04. Terbitnya Quarantine Dossier Instan (Clearance)**: Pejabat karantina menerima putusan jalur (Hijau/Kuning/Merah) dalam hitungan detik, memangkas proses inspeksi dari berjam-jam menjadi instan.

---

### 3️⃣ Seksi 3: Tri-Probe & Ekosistem Sensor Fisik (*Physical Sensing*)
Visual kartu interaktif 3 kolom yang mengulas logika spasial suhu dan sensor pelengkap:
- **Probe $T_1$ (Permukaan / Lapisan Es)**:
  - Memantau konveksi udara pendingin atas dan stabilitas suhu luar kargo.
- **Probe $T_2$ (Inti Biomassa Daging / Sampel)**:
  - Mengukur suhu titik terdalam kargo. Suhu inti memiliki inersia termal tinggi dan menjadi parameter mutlak keselamatan pangan biologis.
- **Probe $T_3$ (Zona Perbatasan Pintu)**:
  - Sensor garis depan yang mendeteksi intrusi kalor dini sebelum panas sempat merambat masuk ke inti kargo.
- **Sensor Bukaan Pintu MC-38**:
  - Rekam jejak magnetik anti-tamper untuk mendeteksi pencurian atau bukaan kontainer ilegal di luar jadwal.
- **Akselerometer MPU6050**:
  - Mengukur percepatan dinamis bersih ($G_{\text{net}} = |\sqrt{a_x^2+a_y^2+a_z^2}-1.0|$) untuk melacak benturan ombak atau benturan crane saat bongkar muat.
- **GPS NEO-6M**:
  - Validasi koordinat pelayaran maritim dan sinkronisasi waktu satelit atomik.

---

### 4️⃣ Seksi 4: Simulator Skenario Karantina Interaktif (*Interactive Simulator*)
Komponen langsung di landing page yang memungkinkan pengunjung menguji 3 skenario nyata:
- **Tab Pemilih Skenario**:
  - 🟢 **Skenario A: Rantai Dingin Normal**: Suhu inti stabil -20°C, pintu terkunci, guncangan tenang.
  - 🟡 **Skenario B: Defrost / Pintu Terbuka Sementara**: Pintu terbuka 3 menit saat pemeriksaan transit, probe $T_3$ melonjak duluan.
  - 🔴 **Skenario C: Kegagalan Unit Pendingin (Kompresor Mati)**: Genset mati di laut lepas, suhu ketiga probe naik drastis melampaui ambang batas.
- **Komponen Interaktif Real-Time**:
  - Grafik tren dinamis menampilkan kurva $T_1$, $T_2$, dan $T_3$.
  - Gauge Skor Risiko AI (0 - 100) bereaksi langsung.
  - Badge Disposisi Resmi:
    - *Jalur Hijau*: Lolos Pelepasan Karantina (KH-1 / KT-2).
    - *Jalur Kuning*: Rekomendasi Pemeriksaan Fisik & Organoleptik.
    - *Jalur Merah*: Rekomendasi Penahanan Kargo & Pengujian Mikrobiologi Laboratorium.

---

### 5️⃣ Seksi 5: Manfaat untuk Karantina & Pelaku Usaha (*Value Proposition*)
Dua pilar komparasi manfaat berbasis data:
- **Bagi Badan Karantina Indonesia (Barantin)**:
  - *Dwelling Time Reduction*: Pembebasan cepat kontainer Jalur Hijau tanpa hambatan birokrasi.
  - *Targeted Resource Allocation*: Penghematan jam kerja analis laboratorium karena hanya kontainer anomali (Jalur Merah) yang diambil sampelnya.
  - *Legalitas Hukum Kokoh*: Berlandaskan UU No. 21 Tahun 2019 dan standar Codex Alimentarius CAC/RCP 8-1976.
- **Bagi Eksportir & Logistik Rantai Dingin**:
  - *Zero Loss Guarantee*: Deteksi dini sebelum komoditas rusak permanen.
  - *Asuransi & Anti-Dispute*: Bukti log digital tak terbantahkan untuk klaim klausa asuransi kargo maritim.

---

### 6️⃣ Seksi 6: Arsitektur Sistem (*System Architecture*)
Diagram visual modular minimalis memperlihatkan siklus end-to-end:
```
[Perangkat Keras Edge]       [Penyimpanan Lokal]       [Sinkronisasi Dua Arah]       [Platform Barantin]
  - 3x Probe DS18B20    -->     - FAT32 MicroSD   -->     - WiFi AP / Station    -->    - Web Dashboard
  - MC-38 Door Switch           - Flash NVS Buffer          - Batch REST Payload          - AI Risk Engine
  - MPU6050 Accelerometer                                   - Auto-Profile Update         - Quarantine Dossier
```

---

### 7️⃣ Seksi 7: Ajakan Tindakan (CTA) & Footer Karantina
- **Banner CTA Elegan**: *"Siap Mengoptimalkan Pengawasan Rantai Dingin Komoditas Karantina?"*
  - Tombol: `Akses Portal Petugas Barantin` & `Pelajari Panduan Teknis`.
- **Footer Formal**:
  - Logo resmi Q-GUARD & Barantin.
  - Informasi kepatuhan standar internasional (Codex Alimentarius, SNI 2729:2021, ISO/IEC 17025).
  - Identitas inovasi *Quarantine Innovation Challenge (QIC) 2026*.

---

## 💻 4. Perombakan Dashboard Admin Petugas (`/admin/*`)

### A. Perbaikan Segera HTML Sidebar
- Memulihkan dan merapikan kembali tag penutup dan elemen `<nav class="sidebar-menu">` di [index.html](file:///c:/Users/LENOVO/Desktop/QGUARD/dashboard/index.html) yang sempat terpotong.
- Memastikan navigasi URL sinkron dengan modul tampilan:
  - `/admin/overview` $\rightarrow$ View Ringkasan Eksekutif
  - `/admin/monitoring` $\rightarrow$ View Telemetri Langsung 3 Probe
  - `/admin/shipments` $\rightarrow$ View Manajemen Pengapalan & Sinkronisasi Dua Arah
  - `/admin/gps-track` $\rightarrow$ View Peta Pelayaran Maritim
  - `/admin/risk-engine` $\rightarrow$ View Dekomposisi Risiko AI & Arrhenius
  - `/admin/alerts` $\rightarrow$ View Log Peringatan Insiden
  - `/admin/reports` $\rightarrow$ View Cetak Quarantine Dossier Resmi
  - `/admin/settings` $\rightarrow$ View Pengaturan Regulasi

### B. Konsistensi Gaya Visual Dashboard
- Mengadopsi tema terang yang senada dengan landing page:
  - Latar belakang putih slate (`#f8fafc`).
  - Sidebar ramping dengan ikon SVG outline presisi.
  - Kartu metrik dengan border halus, nilai angka tegas, dan badge status warna biologis.
  - Grafik Chart.js memakai palet lembut: Cyan untuk $T_1$, Biru Laut untuk $T_2$, Amber untuk $T_3$, dan garis batas ambang merah putus-putus.

---

## 🛠️ 5. Rencana Tahapan Eksekusi Teknis

```
[Tahap 1: Desain Token & CSS Fondasi]
  → Memperbarui style.css dengan sistem token warna terang, tipografi, dan utilitas kartu modern.
  
[Tahap 2: Canvas 3D Floating Hero]
  → Mengimplementasikan Three.js di src/hero3d.js (reefer container cutaway, alat Q-GUARD vertikal, orbit drag, tanpa border).

[Tahap 3: Restrukturisasi index.html Landing Page]
  → Menulis ulang seksi 1 sampai 7 secara berurutan sesuai alur narasi.

[Tahap 4: Modul Simulator Interaktif]
  → Menyambungkan logika skenario A/B/C di src/simulator.js dengan pembaruan kurva dan disposisi otomatis.

[Tahap 5: Pemulihan & Penataan Dashboard Admin]
  → Memperbaiki sidebar index.html dan menyesuaikan styling admin agar selaras dengan tema terang baru.

[Tahap 6: Pengujian & Validasi]
  → Verifikasi dev server Vite, responsivitas mobile/tablet/desktop, dan keterhubungan data live backend.
```

---

> [!TIP]
> **Keputusan Arsitektur**: Tidak ada kode lama fungsional yang dihapus (fungsi API, koneksi backend, dan logika sensor tetap 100% utuh). Perombakan berfokus penuh pada **penyempurnaan estetika UI/UX, penataan ulang seksi landing page, penambahan model 3D floating, dan pemisahan navigasi URL admin** secara profesional.
