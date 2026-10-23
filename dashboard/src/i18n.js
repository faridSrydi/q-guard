/**
 * Q-GUARD Internationalization (i18n) Engine
 * Supports Indonesian ('id') and English ('en')
 * Automatically updates DOM elements with data-i18n attributes
 * and provides t(key, fallback) helper for dynamic JavaScript templates.
 */

export const translations = {
  id: {
    meta: {
      title: "Q-GUARD | Pemantauan Rantai Dingin",
      desc: "Pemantauan kondisi kargo beku untuk mendukung inspeksi karantina berbasis data."
    },
    nav: {
      brand_alt: "Logo Q-GUARD - Cold-Chain Risk Monitoring",
      home: "Beranda",
      challenges: "Tantangan",
      workflow: "Alur Kerja",
      tri_probe: "Tri-Probe",
      simulator: "Simulator",
      benefits: "Manfaat",
      architecture: "Arsitektur",
      login_btn: "Masuk Dashboard"
    },
    hero: {
      eyebrow_org: "BADAN KARANTINA INDONESIA",
      eyebrow_sub: "MONITORING RANTAI DINGIN",
      title: "Pengawasan <span class=\"hero-title-highlight\">Rantai Dingin Maritim</span> Berbasis IoT &amp; AI",
      lead: "Pemantauan suhu komoditas dan integritas kontainer selama pelayaran untuk menjamin mutu kargo hingga pelepasan karantina.",
      btn_dashboard: "Masuk Dashboard",
      btn_simulator: "Simulator",
      stat1_meta: "Data Hilang (Offline MicroSD)",
      stat2_meta: "Sensor Suhu (Inti, Buffer, Pintu)",
      stat3_meta: "Verifikasi Jalur Hijau",
      hint_3d: "Model 3D Interaktif Perangkat Q-GUARD"
    },
    sec1: {
      kicker: "01 / TANTANGAN LOGISTIK MARITIM",
      heading: "Titik Buta Laut Lepas &amp; Risiko Pembekuan Ulang",
      subtext: "Pemeriksaan manual saat kargo tiba di dermaga tidak dapat merekam fluktuasi suhu yang terjadi selama hari-hari pelayaran di laut lepas.",
      card1_title: "Ketiadaan Sinyal di Laut Lepas (Blank-Spot)",
      card1_desc: "Jalur pelayaran antarpulau tidak terjangkau jaringan seluler. Ketika suplai daya pendingin terganggu di laut lepas, ketiadaan data riwayat menyebabkan kerusakan baru disadari saat kargo tiba di pelabuhan tujuan.",
      card1_tag: "Keterbatasan Jaringan",
      card2_title: "Risiko Pembekuan Ulang (Re-Freezing)",
      card2_desc: "Komoditas yang sempat mencair dapat dibekukan kembali sebelum tiba di pelabuhan. Pengukuran suhu luar sesaat tidak dapat mendeteksi degradasi mutu biologis dan akumulasi bakteri pada kargo.",
      card2_tag: "Keamanan Pangan",
      card3_title: "Waktu Singgah Pelabuhan (Dwelling Time)",
      card3_desc: "Ketiadaan riwayat suhu perjalanan yang valid mengharuskan pengambilan sampel acak untuk uji laboratorium, sehingga memperpanjang waktu singgah kargo dan meningkatkan biaya penumpukan.",
      card3_tag: "Efisiensi Logistik"
    },
    sec2: {
      kicker: "02 / ALUR OPERASIONAL",
      heading: "Prosedur Pemantauan dari Pelabuhan Asal ke Tujuan",
      subtext: "Alur kerja terstandarisasi yang beroperasi mandiri saat kapal berlayar dan tersinkronisasi otomatis saat bersandar di pelabuhan.",
      step1_title: "1. Pemasangan &amp; Segel Asal",
      step1_desc: "Petugas karantina memasang sensor pada inti komoditas, buffer es, dan area pintu kontainer di pelabuhan muat, kemudian menguncinya dengan segel bernomor seri resmi.",
      step2_title: "2. Perekaman Data Offline",
      step2_desc: "Perangkat membaca seluruh sensor secara periodik dan menyimpannya ke penyimpanan lokal MicroSD tanpa bergantung pada koneksi internet di laut lepas.",
      step3_title: "3. Sinkronisasi Data Pelabuhan",
      step3_desc: "Saat kargo tiba di pelabuhan tujuan, perangkat otomatis mengunggah seluruh log perjalanan ke server melalui jaringan Wi-Fi dermaga atau seluler.",
      step4_title: "4. Evaluasi &amp; Rekomendasi",
      step4_desc: "Sistem menghitung parameter Mean Kinetic Temperature (MKT) dan evaluasi risiko, lalu menerbitkan rekomendasi jalur karantina (Hijau/Kuning/Merah)."
    },
    sec3: {
      kicker: "03 / SPESIFIKASI SENSOR",
      heading: "Konfigurasi Sensor Tri-Probe &amp; Telemetri",
      subtext: "Pengukuran suhu multi-titik untuk mendeteksi deviasi termal sebelum merambat ke komoditas inti kargo.",
      showcase_pill: "SKEMA PENEMPATAN SENSOR • KONTAINER PENDINGIN REEFER",
      showcase_zoom: "Perbesar Gambar",
      showcase_caption: "Penempatan <strong>Probe T1</strong> (inti kargo), <strong>T2</strong> (buffer tengah), <strong>T3</strong> (ambang pintu), sensor lingkungan <strong>BME280</strong>, dan sensor pintu <strong>MC-38</strong>.",
      showcase_note: "<strong>Catatan:</strong> Gambar merupakan skema representasi. Penempatan aktual mengikuti regulasi dan SOP Barantin.",
      t1_badge: "PROBE T1 • INTI KOMODITAS",
      t1_depth: "Penetrasi pada kedalaman komoditas",
      t1_title: "Suhu Inti Kargo (DS18B20)",
      t1_desc: "Memantau suhu bagian dalam komoditas untuk memastikan kondisi beku stabil sesuai standar batas kelayakan biologis (&le; -18.0°C).",
      t1_std: "Standar Codex CAC/RCP 8-1976",
      t2_badge: "PROBE T2 • THERMAL BUFFER",
      t2_depth: "Lapisan es / ruang tengah kontainer",
      t2_title: "Kapasitas Buffer Termal",
      t2_desc: "Mengukur ketahanan termal media es penyangga di sekitar produk saat terjadi jeda pasokan daya listrik pada kontainer.",
      t2_std: "Buffer Termal Laten",
      t3_badge: "PROBE T3 • AMBANG PINTU",
      t3_depth: "Perimeter karet paking &amp; aliran udara",
      t3_title: "Deteksi Celah &amp; Kebocoran",
      t3_desc: "Mendeteksi kebocoran udara hangat atau bukaan pintu lebih awal sebelum perubahan suhu merambat ke inti komoditas.",
      t3_std: "Deteksi Gradien Suhu Dini",
      door_title: "Sensor Pintu Magnetik (MC-38)",
      door_desc: "Mencatat waktu dan durasi bukaan pintu kontainer selama perjalanan.",
      shock_title: "Sensor Akselerasi &amp; Guncangan (MPU6050)",
      shock_desc: "Memonitor guncangan dan benturan fisik selama proses transportasi dan bongkar muat.",
      bme_title: "Sensor Lingkungan &amp; Kelembaban (BME280)",
      bme_desc: "Memantau suhu dan kelembaban udara ruang kontainer (% RH) untuk deteksi kondensasi.",
      gps_title: "Geolokasi Maritim (NEO-6M GPS)",
      gps_desc: "Mencatat titik koordinat rute pelayaran dan pelabuhan transit."
    },
    sec4: {
      kicker: "04 / SIMULASI KEPUTUSAN",
      heading: "Simulasi Rekomendasi Karantina",
      subtext: "Pilih skenario pelayaran untuk melihat respon kurva suhu dan penerbitan rekomendasi karantina secara otomatis.",
      scenario_01: "SKENARIO 01",
      scenario_02: "SKENARIO 02",
      scenario_03: "SKENARIO 03",
      tab1_title: "Rantai Dingin Normal (Jalur Hijau)",
      tab2_title: "Fluktuasi Suhu Pintu (Jalur Kuning)",
      tab3_title: "Kerusakan Kompresor (Jalur Merah)",
      chart_heading: "Kurva Suhu Tri-Probe (24 Jam)",
      chart_caption: "Sensor DS18B20 (T1, T2, T3) vs Batas Kritis -18°C",
      live_pill: "SIMULATOR AKTIF",
      panel_heading: "Telemetri &amp; Rekomendasi",
      lbl_t1: "T1 (Inti Komoditas)",
      lbl_t2: "T2 (Buffer Es)",
      lbl_t3: "T3 (Ambang Pintu)",
      lbl_mkt: "Mean Kinetic Temp",
      lbl_door: "Status Pintu (MC-38)",
      lbl_shock: "Guncangan (MPU6050)",
      lbl_risk_score: "Skor Risiko Rantai Dingin",
      verdict_kicker: "REKOMENDASI KARANTINA"
    },
    sec5: {
      kicker: "05 / EFISIENSI &amp; DAMPAK",
      heading: "Manfaat bagi Pengawasan Karantina &amp; Logistik",
      subtext: "Meningkatkan akurasi pengawasan karantina dan kelancaran arus barang di pelabuhan.",
      card1_title: "Pelepasan Kargo Lebih Cepat",
      card1_desc: "Kontainer dengan riwayat rantai dingin normal dapat langsung dirilis melalui Jalur Hijau tanpa harus menunggu hasil uji laboratorium berhari-hari.",
      card1_tag: "Efisiensi Dwelling Time",
      card2_title: "Pemeriksaan Laboratorium Terarah",
      card2_desc: "Pengujian laboratorium difokuskan hanya pada kargo yang mengalami deviasi suhu di atas ambang batas kritis selama pelayaran.",
      card2_tag: "Optimalisasi Uji Sampel",
      card3_title: "Validasi Data &amp; Audit Trail",
      card3_desc: "Catatan telemetri terenkripsi menyediakan bukti objektif dan terverifikasi untuk verifikasi kepatuhan dan penyelesaian audit logistik.",
      card3_tag: "Akuntabilitas Data"
    },
    sec6: {
      kicker: "06 / ARSITEKTUR TEKNOLOGI",
      heading: "Integrasi Sistem dari Perangkat Keras ke Dashboard",
      subtext: "Arsitektur modular yang dirancang untuk keandalan pencatatan data di laut dan kemudahan analisis di pelabuhan.",
      layer1_num: "LAPISAN 01",
      layer1_title: "Perangkat Keras (Edge Device)",
      layer1_desc: "Mikrokontroler ESP32 membaca sensor suhu DS18B20, sensor lingkungan BME280, sensor pintu MC-38, akselerometer MPU6050, dan modul GPS NEO-6M secara simultan.",
      layer2_num: "LAPISAN 02",
      layer2_title: "Penyimpanan Offline (MicroSD)",
      layer2_desc: "Penyimpanan lokal dengan skema checksum menjamin integritas data selama kapal melintasi perairan tanpa jaringan seluler.",
      layer2_chip: "Penyimpanan Lokal",
      layer3_num: "LAPISAN 03",
      layer3_title: "Sinkronisasi REST API",
      layer3_desc: "Mengunggah log data tertunda ke server secara otomatis begitu perangkat mendeteksi koneksi Wi-Fi pelabuhan atau seluler.",
      layer3_chip: "Sinkronisasi Otomatis",
      layer4_num: "LAPISAN 04",
      layer4_title: "Dashboard Monitoring",
      layer4_desc: "Antarmuka web untuk inspeksi data telemetri, evaluasi suhu MKT, visualisasi rute perjalanan, dan status kepatuhan kargo.",
      layer4_chip: "Dashboard Web"
    },
    cta: {
      eyebrow: "PORTAL PETUGAS KARANTINA",
      heading: "Akses Dashboard Monitoring",
      lead: "Masuk ke dashboard untuk memantau data kargo aktif, verifikasi riwayat suhu, dan penerbitan rekomendasi karantina.",
      btn: "Masuk ke Dashboard"
    },
    footer: {
      tagline: "Sistem Pemantauan Rantai Dingin Komoditas Ekspor-Impor Berbasis IoT &amp; Analisis Risiko.",
      org: "Badan Karantina Indonesia (Barantin) &copy; 2026",
      nav_title: "Navigasi",
      standards_title: "Standar Regulasi",
      copyright: "&copy; 2026 Q-GUARD • Sistem Pemantauan Rantai Dingin Karantina. Seluruh Hak Cipta Dilindungi."
    },
    login: {
      title: "Portal Petugas Barantin",
      subtitle: "Sistem Pemantauan Rantai Dingin Karantina",
      username_label: "Email / Nama Pengguna",
      password_label: "Kata Sandi",
      hint_title: "Kredensial Pengujian:",
      hint_email: "Email:",
      hint_pwd: "Sandi:",
      btn_submit: "Masuk ke Dashboard",
      btn_back: "Kembali ke Beranda",
      copyright: "Badan Karantina Indonesia &copy; 2026"
    },
    sidebar: {
      portal: "Halaman Utama",
      overview: "Ringkasan",
      monitoring: "Monitoring Telemetri",
      shipments: "Daftar Pengiriman",
      gps: "Pelacakan GPS",
      risk: "Evaluasi Risiko",
      alerts: "Riwayat Peringatan",
      reports: "Laporan & Disposisi",
      settings: "Pengaturan Parameter"
    },
    topbar: {
      active_device: "Unit:",
      wifi_title: "Wi-Fi",
      wifi_connected: "Terhubung",
      wifi_disconnected: "Terputus",
      refresh: "Segarkan",
      refresh_title: "Perbarui Data",
      user_name: "Petugas Barantin",
      logout: "Keluar",
      logout_title: "Keluar dari Sistem"
    },
    view: {
      overview_title: "Ringkasan Monitoring",
      overview_bc: "Monitoring Rantai Dingin • Barantin",
      monitoring_title: "Monitoring Telemetri",
      monitoring_bc: "Telemetri Sensor Tri-Probe",
      shipments_title: "Daftar Pengiriman",
      shipments_bc: "Data Kargo & Kontainer",
      gps_title: "Pelacakan GPS",
      gps_bc: "Rute Pelayaran & Koordinat",
      risk_title: "Evaluasi Risiko Mutu",
      risk_bc: "Analisis Kinetika MKT",
      alerts_title: "Riwayat Peringatan",
      alerts_bc: "Daftar Kejadian & Deviasi",
      reports_title: "Laporan & Disposisi",
      reports_bc: "Dokumen Pelepasan Karantina",
      settings_title: "Pengaturan Parameter",
      settings_bc: "Ambang Batas Telemetri"
    },
    overview: {
      active_cargo: "Kargo Aktif",
      container_unit: "kontainer",
      monitored: "Dipantau",
      cold_chain_stable: "Rantai dingin stabil",
      critical_alerts: "Peringatan Kritis",
      incident_unit: "insiden",
      action_required: "Perlu Tindakan",
      safe: "Aman",
      unconfirmed: "belum dikonfirmasi",
      active_devices: "Perangkat Aktif",
      unit: "unit",
      quality_compliance: "Kepatuhan Mutu",
      standard_compliant: "Parameter Sesuai Standar",
      fleet_temp_history: "Riwayat Suhu Armada",
      safe_limit_label: "Batas Aman: -25°C s/d -18°C",
      quick_quarantine_status: "Status Karantina Cepat",
      risk_donut_title: "Distribusi Risiko Kargo",
      recent_shipments: "Pengiriman Terbaru",
      col_device: "Perangkat",
      col_commodity: "Komoditas",
      col_route: "Rute Pelayaran",
      col_temp: "Suhu Inti",
      col_mkt: "Suhu MKT",
      col_risk: "Risiko",
      col_verdict: "Rekomendasi",
      col_action: "Aksi"
    },
    mon: {
      wifi_strip_title: "Status Wi-Fi",
      data_transmission: "Transmisi Data",
      last_update: "Pembaruan Terakhir",
      storage: "Penyimpanan",
      waiting_data: "Menunggu data telemetri...",
      probe1_label: "Probe 1 (Inti Komoditas)",
      probe2_label: "Probe 2 (Buffer Es)",
      probe3_label: "Probe 3 (Ambang Pintu)",
      env_label: "Sensor Lingkungan BME280",
      accel_label: "Akselerasi & Guncangan (MPU6050)",
      door_label: "Sensor Pintu (MC-38)",
      gps_label: "Geolokasi Maritim (NEO-6M GPS)",
      mkt_analysis: "Analisis Kinetika Mean Kinetic Temperature (MKT)",
      verdict_badge: "Rekomendasi Karantina Otomatis"
    },
    common: {
      loading: "Memuat data...",
      loading_fleet: "Memuat data armada...",
      save: "Simpan",
      cancel: "Batal",
      close: "Tutup",
      detail: "Detail",
      export: "Ekspor",
      action: "Aksi",
      status: "Status",
      date: "Tanggal",
      time: "Waktu",
      temperature: "Suhu",
      humidity: "Kelembaban",
      shock: "Guncangan",
      door_open: "TERBUKA",
      door_closed: "TERTUTUP",
      normal: "NORMAL",
      warning: "PERINGATAN",
      critical: "KRITIS",
      release: "PELEPASAN",
      hold: "PENAHANAN",
      inspection: "PEMERIKSAAN FISIK"
    }
  },

  en: {
    meta: {
      title: "Q-GUARD | Cold-Chain Monitoring",
      desc: "Frozen cargo monitoring supporting data-driven quarantine inspections."
    },
    nav: {
      brand_alt: "Q-GUARD Logo - Cold-Chain Risk Monitoring",
      home: "Home",
      challenges: "Challenges",
      workflow: "Workflow",
      tri_probe: "Tri-Probe",
      simulator: "Simulator",
      benefits: "Benefits",
      architecture: "Architecture",
      login_btn: "Dashboard Login"
    },
    hero: {
      eyebrow_org: "INDONESIAN QUARANTINE AGENCY",
      eyebrow_sub: "COLD-CHAIN RISK MONITORING",
      title: "IoT &amp; AI-Based <span class=\"hero-title-highlight\">Maritime Cold-Chain</span> Surveillance",
      lead: "Real-time monitoring of cargo core temperature and container integrity during maritime voyage to ensure quality clearance.",
      btn_dashboard: "Open Dashboard",
      btn_simulator: "Simulator",
      stat1_meta: "Data Loss (Offline MicroSD)",
      stat2_meta: "Temperature Probes (Core, Buffer, Door)",
      stat3_meta: "Green Channel Verification",
      hint_3d: "Interactive 3D Model of Q-GUARD Device"
    },
    sec1: {
      kicker: "01 / MARITIME LOGISTICS CHALLENGES",
      heading: "High-Seas Blind Spots &amp; Re-Freezing Risks",
      subtext: "Manual arrival spot-checks cannot verify the continuous thermal stability maintained over multi-day voyage on the high seas.",
      card1_title: "High-Seas Signal Blind Spots (Blank-Spot)",
      card1_desc: "Inter-island maritime routes lack cellular coverage. When refrigeration power fails at sea, the absence of continuous historical logs leaves spoilage undetected until arrival at destination.",
      card1_tag: "Network Limitations",
      card2_title: "Re-Freezing Risks",
      card2_desc: "Cargo that thawed mid-voyage can be refrozen prior to docking. Surface temperature spot-checks fail to detect biological protein degradation and bacterial proliferation.",
      card2_tag: "Food Safety",
      card3_title: "Port Dwelling Time",
      card3_desc: "Without verified voyage temperature records, quarantine officials are forced into random sampling and multi-day lab cultures, inflating port congestion and storage demurrage.",
      card3_tag: "Logistics Efficiency"
    },
    sec2: {
      kicker: "02 / OPERATIONAL WORKFLOW",
      heading: "Monitoring Procedures from Origin to Destination Port",
      subtext: "A standardized workflow operating autonomously during vessel voyages and synchronizing automatically upon docking.",
      step1_title: "1. Installation &amp; Origin Seal",
      step1_desc: "Quarantine officers insert sensors at commodity core, ice buffer, and container door at origin port, then lock the unit with official serialized seals.",
      step2_title: "2. Offline Data Logging",
      step2_desc: "The device periodically polls all sensors and saves records to local MicroSD flash storage, fully independent of cellular connectivity at sea.",
      step3_title: "3. Portside Synchronization",
      step3_desc: "Upon arrival at destination harbor, the device automatically uploads all voyage logs to cloud servers via dockside Wi-Fi or cellular uplink.",
      step4_title: "4. Risk Evaluation &amp; Verdict",
      step4_desc: "The system computes Mean Kinetic Temperature (MKT) and multi-factor risk scores, instantly generating quarantine lane recommendations (Green/Yellow/Red)."
    },
    sec3: {
      kicker: "03 / SENSOR SPECIFICATIONS",
      heading: "Tri-Probe Sensor &amp; Telemetry Architecture",
      subtext: "Multi-point thermal mapping designed to capture gradient shifts before heat penetrates inner cargo core.",
      showcase_pill: "SENSOR PLACEMENT SCHEMATIC • REEFER CONTAINER",
      showcase_zoom: "Enlarge Image",
      showcase_caption: "Placement of <strong>Probe T1</strong> (cargo core), <strong>T2</strong> (ice buffer), <strong>T3</strong> (door perimeter), <strong>BME280</strong> environmental sensor, and <strong>MC-38</strong> door switch.",
      showcase_note: "<strong>Note:</strong> Illustration is representative. Physical installation follows official Barantin quarantine standards.",
      t1_badge: "PROBE T1 • COMMODITY CORE",
      t1_depth: "Penetrated inside core commodity",
      t1_title: "Core Cargo Temp (DS18B20)",
      t1_desc: "Continuously tracks deep internal product temperature to ensure compliance with biological frozen food safety limits (&le; -18.0°C).",
      t1_std: "Codex Standard CAC/RCP 8-1976",
      t2_badge: "PROBE T2 • THERMAL BUFFER",
      t2_depth: "Ice layer / container center volume",
      t2_title: "Thermal Buffer Capacity",
      t2_desc: "Measures thermal resilience of ice buffer surrounding product during reefer power disruptions.",
      t2_std: "Latent Thermal Buffer",
      t3_badge: "PROBE T3 • DOOR PERIMETER",
      t3_depth: "Gasket perimeter &amp; air circulation",
      t3_title: "Gap &amp; Leakage Detection",
      t3_desc: "Detects warm ambient air ingress or door seal breach early before thermal changes reach cargo core.",
      t3_std: "Early Thermal Gradient",
      door_title: "Magnetic Door Sensor (MC-38)",
      door_desc: "Logs timestamp and duration of container door openings during voyage.",
      shock_title: "Acceleration &amp; Shock Sensor (MPU6050)",
      shock_desc: "Monitors physical impacts and handling shocks during transit and unloading.",
      bme_title: "Environmental &amp; Humidity Sensor (BME280)",
      bme_desc: "Monitors container ambient temperature and relative humidity (% RH) for condensation risk.",
      gps_title: "Maritime Geolocation (NEO-6M GPS)",
      gps_desc: "Records vessel voyage coordinates and transit harbor checkpoints."
    },
    sec4: {
      kicker: "04 / DECISION SIMULATION",
      heading: "Quarantine Recommendation Simulation",
      subtext: "Select a shipping scenario to observe temperature curves and automated quarantine recommendations.",
      scenario_01: "SCENARIO 01",
      scenario_02: "SCENARIO 02",
      scenario_03: "SCENARIO 03",
      tab1_title: "Normal Cold Chain (Green Channel)",
      tab2_title: "Door Thermal Spike (Yellow Channel)",
      tab3_title: "Compressor Failure (Red Channel)",
      chart_heading: "Tri-Probe Temperature Curve (24 Hours)",
      chart_caption: "DS18B20 Sensors (T1, T2, T3) vs Critical Limit -18°C",
      live_pill: "SIMULATOR ACTIVE",
      panel_heading: "Telemetry &amp; Recommendation",
      lbl_t1: "T1 (Commodity Core)",
      lbl_t2: "T2 (Ice Buffer)",
      lbl_t3: "T3 (Door Threshold)",
      lbl_mkt: "Mean Kinetic Temp",
      lbl_door: "Door Status (MC-38)",
      lbl_shock: "Shock Impact (MPU6050)",
      lbl_risk_score: "Cold Chain Risk Score",
      verdict_kicker: "QUARANTINE RECOMMENDATION"
    },
    sec5: {
      kicker: "05 / EFFICIENCY &amp; IMPACT",
      heading: "Benefits for Quarantine Inspection &amp; Logistics",
      subtext: "Enhances quarantine inspection precision and port cargo velocity.",
      card1_title: "Accelerated Cargo Clearance",
      card1_desc: "Containers maintaining compliant temperature profiles are cleared immediately via Green Lane without waiting days for lab culture results.",
      card1_tag: "Dwell Time Efficiency",
      card2_title: "Targeted Laboratory Testing",
      card2_desc: "Lab testing resources are precisely focused on cargo that breached critical thermal thresholds during voyage.",
      card2_tag: "Sampling Optimization",
      card3_title: "Data Validation &amp; Audit Trail",
      card3_desc: "Encrypted telemetry records provide tamper-evident proof for regulatory compliance verification and logistics audits.",
      card3_tag: "Data Accountability"
    },
    sec6: {
      kicker: "06 / TECHNOLOGY ARCHITECTURE",
      heading: "System Integration from Edge Hardware to Dashboard",
      subtext: "Modular architecture designed for rugged maritime data persistence and streamlined portside analysis.",
      layer1_num: "LAYER 01",
      layer1_title: "Edge Hardware Device",
      layer1_desc: "ESP32 microcontroller concurrently samples DS18B20 temperature probes, BME280 environment, MC-38 door switch, MPU6050 accelerometer, and NEO-6M GPS.",
      layer2_num: "LAYER 02",
      layer2_title: "Offline Storage (MicroSD)",
      layer2_desc: "Local high-endurance storage with checksum validation ensures zero data loss while vessels navigate disconnected high seas.",
      layer2_chip: "Local Storage",
      layer3_num: "LAYER 03",
      layer3_title: "REST API Synchronization",
      layer3_desc: "Automatically batches and syncs pending voyage records to cloud servers upon detecting harbor Wi-Fi or cellular uplink.",
      layer3_chip: "Automated Sync",
      layer4_num: "LAYER 04",
      layer4_title: "Monitoring Dashboard",
      layer4_desc: "Web application for real-time telemetry inspection, MKT kinetics calculation, vessel route mapping, and regulatory disposition.",
      layer4_chip: "Web Dashboard"
    },
    cta: {
      eyebrow: "QUARANTINE OFFICER PORTAL",
      heading: "Access Monitoring Dashboard",
      lead: "Sign in to dashboard to monitor active shipments, verify historical cold profiles, and issue quarantine release decisions.",
      btn: "Sign in to Dashboard"
    },
    footer: {
      tagline: "IoT &amp; Risk-Based Cold Chain Monitoring System for Export-Import Perishables.",
      org: "Indonesian Quarantine Agency (Barantin) &copy; 2026",
      nav_title: "Navigation",
      standards_title: "Regulatory Standards",
      copyright: "&copy; 2026 Q-GUARD • Quarantine Cold Chain Monitoring System. All Rights Reserved."
    },
    login: {
      title: "Barantin Officer Portal",
      subtitle: "Quarantine Cold-Chain Monitoring System",
      username_label: "Email / Username",
      password_label: "Password",
      hint_title: "Testing Credentials:",
      hint_email: "Email:",
      hint_pwd: "Password:",
      btn_submit: "Sign in to Dashboard",
      btn_back: "Back to Home",
      copyright: "Indonesian Quarantine Agency &copy; 2026"
    },
    sidebar: {
      portal: "Home Portal",
      overview: "Overview",
      monitoring: "Telemetry Monitoring",
      shipments: "Shipment List",
      gps: "GPS Tracking",
      risk: "Risk Evaluation",
      alerts: "Alert History",
      reports: "Reports & Disposition",
      settings: "Parameter Settings"
    },
    topbar: {
      active_device: "Unit:",
      wifi_title: "Wi-Fi",
      wifi_connected: "Connected",
      wifi_disconnected: "Disconnected",
      refresh: "Refresh",
      refresh_title: "Refresh Data",
      user_name: "Quarantine Officer",
      logout: "Sign Out",
      logout_title: "Sign out of system"
    },
    view: {
      overview_title: "Monitoring Overview",
      overview_bc: "Cold Chain Monitoring • Barantin",
      monitoring_title: "Telemetry Monitoring",
      monitoring_bc: "Tri-Probe Sensor Telemetry",
      shipments_title: "Shipment Directory",
      shipments_bc: "Cargo & Container Data",
      gps_title: "GPS Tracking",
      gps_bc: "Voyage Route & Coordinates",
      risk_title: "Quality Risk Evaluation",
      risk_bc: "MKT Kinetic Analysis",
      alerts_title: "Alert History",
      alerts_bc: "Events & Deviation Log",
      reports_title: "Reports & Disposition",
      reports_bc: "Quarantine Release Documents",
      settings_title: "Parameter Settings",
      settings_bc: "Telemetry Thresholds"
    },
    overview: {
      active_cargo: "Active Cargo",
      container_unit: "containers",
      monitored: "Monitored",
      cold_chain_stable: "Cold chain stable",
      critical_alerts: "Critical Alerts",
      incident_unit: "incidents",
      action_required: "Action Required",
      safe: "Safe",
      unconfirmed: "unconfirmed",
      active_devices: "Active Devices",
      unit: "units",
      quality_compliance: "Quality Compliance",
      standard_compliant: "Standard Compliant",
      fleet_temp_history: "Fleet Temperature History",
      safe_limit_label: "Safe Limit: -25°C to -18°C",
      quick_quarantine_status: "Quick Quarantine Status",
      risk_donut_title: "Cargo Risk Distribution",
      recent_shipments: "Recent Shipments",
      col_device: "Device",
      col_commodity: "Commodity",
      col_route: "Voyage Route",
      col_temp: "Core Temp",
      col_mkt: "MKT Temp",
      col_risk: "Risk",
      col_verdict: "Recommendation",
      col_action: "Action"
    },
    mon: {
      wifi_strip_title: "Wi-Fi Status",
      data_transmission: "Data Transmission",
      last_update: "Last Update",
      storage: "Storage",
      waiting_data: "Awaiting telemetry...",
      probe1_label: "Probe 1 (Commodity Core)",
      probe2_label: "Probe 2 (Ice Buffer)",
      probe3_label: "Probe 3 (Door Perimeter)",
      env_label: "BME280 Environmental Sensor",
      accel_label: "Acceleration & Shock (MPU6050)",
      door_label: "Door Sensor (MC-38)",
      gps_label: "Maritime Geolocation (NEO-6M GPS)",
      mkt_analysis: "Mean Kinetic Temperature (MKT) Kinetics",
      verdict_badge: "Automated Quarantine Recommendation"
    },
    common: {
      loading: "Loading data...",
      loading_fleet: "Loading fleet data...",
      save: "Save",
      cancel: "Cancel",
      close: "Close",
      detail: "Details",
      export: "Export",
      action: "Action",
      status: "Status",
      date: "Date",
      time: "Time",
      temperature: "Temperature",
      humidity: "Humidity",
      shock: "Shock Impact",
      door_open: "OPEN",
      door_closed: "CLOSED",
      normal: "NORMAL",
      warning: "WARNING",
      critical: "CRITICAL",
      release: "RELEASE",
      hold: "HOLD",
      inspection: "PHYSICAL INSPECTION"
    }
  }
};

let currentLanguage = 'id';

// Initialize from storage or browser setting
try {
  const saved = localStorage.getItem('qguard_lang');
  if (saved && (saved === 'en' || saved === 'id')) {
    currentLanguage = saved;
  }
} catch (_) {}

/**
 * Get current active language code ('id' | 'en')
 */
export function getLang() {
  return currentLanguage;
}

/**
 * Get translation by nested key path (e.g. 'nav.challenges' or 'login.title')
 */
export function t(key, fallback = '') {
  if (!key) return fallback;
  const langObj = translations[currentLanguage] || translations.id;
  const parts = key.split('.');
  let curr = langObj;
  for (const p of parts) {
    if (curr && typeof curr === 'object' && p in curr) {
      curr = curr[p];
    } else {
      curr = null;
      break;
    }
  }

  if (curr !== null && curr !== undefined) {
    return curr;
  }

  // Fallback to Indonesian if missing in English
  if (currentLanguage !== 'id') {
    let fallbackCurr = translations.id;
    for (const p of parts) {
      if (fallbackCurr && typeof fallbackCurr === 'object' && p in fallbackCurr) {
        fallbackCurr = fallbackCurr[p];
      } else {
        fallbackCurr = null;
        break;
      }
    }
    if (fallbackCurr !== null && fallbackCurr !== undefined) {
      return fallbackCurr;
    }
  }

  return fallback || key;
}

/**
 * Apply translations to all DOM elements with data-i18n attributes
 */
export function applyTranslations(root = document) {
  // Update document language & title
  document.documentElement.lang = currentLanguage;
  if (translations[currentLanguage]?.meta?.title) {
    document.title = translations[currentLanguage].meta.title;
  }

  // Update text/html elements
  const elements = root.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val) {
      if (val.includes('<') && val.includes('>')) {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    }
  });

  // Update placeholder attributes
  const placeholders = root.querySelectorAll('[data-i18n-placeholder]');
  placeholders.forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = t(key);
    if (val) el.setAttribute('placeholder', val);
  });

  // Update title attributes
  const titles = root.querySelectorAll('[data-i18n-title]');
  titles.forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const val = t(key);
    if (val) el.setAttribute('title', val);
  });

  // Update aria-label attributes
  const arias = root.querySelectorAll('[data-i18n-aria]');
  arias.forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    const val = t(key);
    if (val) el.setAttribute('aria-label', val);
  });

  // Update active state on language switchers
  document.querySelectorAll('.lang-opt-btn').forEach(btn => {
    const btnLang = btn.getAttribute('data-lang');
    if (btnLang === currentLanguage) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Set and switch the active language
 */
export function setLanguage(lang) {
  if (lang !== 'id' && lang !== 'en') return;
  currentLanguage = lang;
  try {
    localStorage.setItem('qguard_lang', lang);
  } catch (_) {}

  applyTranslations(document);

  // Dispatch custom event for JavaScript views/charts to re-render
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
}

/**
 * Initialize language switch listeners and initial translations
 */
export function initI18n() {
  applyTranslations(document);

  // Delegated click handler for all language switch buttons
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.lang-opt-btn');
    if (btn) {
      const lang = btn.getAttribute('data-lang');
      if (lang && lang !== currentLanguage) {
        setLanguage(lang);
      }
    }
  });
}

// Make accessible to window for debugging or inline onclicks if needed
if (typeof window !== 'undefined') {
  window.qguardI18n = {
    getLang,
    setLanguage,
    t,
    applyTranslations
  };
}
