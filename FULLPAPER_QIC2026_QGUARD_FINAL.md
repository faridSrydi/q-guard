# Kode Dokumen: [FP-077] | Full Paper QIC 2026

# Q-GUARD: Continuity-Aware Cold-Chain Risk Monitoring Berbasis IoT dan Multivariate AI untuk Smart Quarantine Komoditas Beku

<div align="center">

### **ABSTRAK**

</div>

Distribusi komoditas hayati beku antarpulau menyisakan kesenjangan informasi (*distribution information gap*): kondisi kargo tidak terpantau sejak segel dipasang di titik asal hingga tiba di pelabuhan ekspor, sehingga kegagalan pendingin baru diketahui setelah komoditas rusak, seperti pada pemusnahan 14,5 ton daging ayam beku di Nabire. Karya ini mengusulkan **Q-GUARD**, instrumen pemantau portabel berbasis *Internet of Things* (IoT) untuk mendukung pengawasan karantina pada subtema *Smart Border & AI-Quarantine*. Inti kebaruannya adalah kontinuitas data: rekaman suhu tiga titik spasial (inti, tengah, pintu), guncangan mekanis, status pintu, lokasi GPS, dan waktu presisi tetap utuh melalui penyimpanan lokal *offline-first* dan sinkronisasi otomatis saat tiba di pelabuhan. Data tersebut dinilai dengan kerangka *Continuity-Aware Cold-Chain Risk* (CACCR) yang memadukan *Mean Kinetic Temperature* (MKT) Arrhenius, skor risiko komposit, dan deteksi anomali *Isolation Forest* yang dibandingkan dengan pemantauan ambang batas tunggal. Keluarannya berupa berkas digital *Quarantine Inspection Dossier* yang menjadi dasar disposisi karantina berbasis risiko (*Risk-Based Inspection*). Validasi fungsional dilakukan melalui pengujian eksperimental prototipe fisik pada wadah pendingin berinsulasi 40 liter berisi spesimen kargo beku (−22 °C): probe pintu mendeteksi kenaikan suhu melewati −18 °C sekitar 112,6 menit lebih awal daripada probe inti (memberikan margin peringatan dini nyata), protokol *store-and-forward* menjaga 1.440 rekaman secara utuh (100% *zero data loss*) selama 120 menit *offline*, dan model anomali AI berhasil menekan alarm palsu siklus pencairan bunga es (*defrost*) hingga 7,8% ($F1\text{-score} = 96{,}4\%$). Biaya prototipe diperkirakan Rp1,2–1,5 juta per unit dengan biaya operasional per pengapalan kurang dari Rp15.000. Rancangan implementasi operasional di Barantin dan rekomendasi kebijakan strategis turut disajikan.

**Kata kunci:** *IoT, Smart Quarantine, deteksi anomali, rantai dingin, inspeksi digital.*

---

<div align="center">

### **Q-GUARD: Continuity-Aware Cold-Chain Risk Monitoring Based on IoT and Multivariate AI for Smart Quarantine of Frozen Commodities**

### **ABSTRACT**

</div>

*Interisland distribution of frozen biological commodities leaves an information gap: cargo condition goes unmonitored from the moment a container is sealed at origin until it reaches the export port, so refrigeration failures are discovered only after the commodity has spoiled, as in the destruction of 14.5 tonnes of frozen chicken in Nabire. This study proposes **Q-GUARD**, a portable Internet of Things (IoT) monitor that supports quarantine surveillance under the Smart Border & AI-Quarantine subtheme. Its core novelty is data continuity: spatial three-point temperature records (core, mid-pack, door), mechanical shock, door status, location, and precision time remain intact through offline-first local storage and automatic synchronization on arrival at the port. The data are scored with the Continuity-Aware Cold-Chain Risk (CACCR) framework, which combines Arrhenius Mean Kinetic Temperature (MKT), a composite risk score, and Isolation Forest anomaly detection compared against single-threshold monitoring. The output is a digital Quarantine Inspection Dossier that supports risk-based quarantine disposition. Functional validation was conducted via physical prototype experimental testing in an insulated 40-liter cool box containing frozen cargo specimens (−22 °C): the door boundary probe crossed −18 °C approximately 112.6 minutes earlier than the core probe (providing a vital early-warning margin), the store-and-forward protocol preserved all 1,440 records (100% zero data loss) across a 120-minute outage, and anomaly detection reduced false alarms during normal defrost cycles to 7.8% (F1-score = 96.4%). Prototype costs are estimated at IDR 1.2–1.5 million per unit with transit costs below IDR 15,000. An operational implementation design for Barantin and policy recommendations are also presented.*

*Keywords:* *IoT, Smart Quarantine, anomaly detection, cold chain, digital inspection.*

---

<div align="center">

## **BAB I**  
## **PENDAHULUAN**

</div>

### **1.1 Latar Belakang**
Komoditas hayati beku seperti tuna loin (*Thunnus albacares*), udang vaname, dan daging unggas merupakan sumber devisa sekaligus penopang ketahanan pangan nasional. Mutunya hanya terjaga bila rantai dingin tidak terputus pada suhu −18 °C atau lebih rendah (Codex Alimentarius Commission, 2020). Kenaikan suhu mempercepat reaksi enzimatis dan mikrobiologis yang menurunkan mutu, serta pada ikan scombroid dapat memicu pembentukan histamin yang berbahaya bagi konsumen (Food and Drug Administration, 2022; Ndraha et al., 2018).

Berdasarkan Undang-Undang Nomor 21 Tahun 2019, Badan Karantina Indonesia (Barantin) berperan ganda: mencegah masuk dan keluarnya hama dan penyakit karantina, sekaligus memfasilitasi perdagangan dengan memastikan komoditas ekspor memenuhi persyaratan negara tujuan (Republik Indonesia, 2019), peran yang kini diperkuat melalui sistem pendukung ekspor (Badan Karantina Indonesia, 2026b).

Tantangan muncul dari logistik kepulauan: komoditas dari Maluku, Papua, atau Sulawesi menempuh perjalanan multimoda 3–14 hari menuju pelabuhan ekspor seperti Tanjung Priok atau Tanjung Perak. Setelah segel dipasang di titik asal, otoritas kehilangan keterlacakan kondisi kargo, sehingga kegagalan kompresor, genset kehabisan bahan bakar, insulasi rusak, atau pintu dibuka tanpa izin baru diketahui saat kontainer tiba. Inilah kesenjangan informasi distribusi (*distribution information gap*), yaitu lemahnya ketertelusuran yang menjadi syarat keamanan pangan modern (Aung & Chang, 2014; International Organization for Standardization, 2018).

### **1.2 State-of-the-Art dan Research Gap**
Pemantauan rantai dingin berbasis sensor berkembang pesat (Badia-Melis et al., 2018), tetapi da Costa et al. (2023) mencatat bahwa sebagian besar solusi hanya menampilkan satu metrik tanpa analisis risiko berbasis kinetika penurunan mutu. *IntelliStore* (Singha et al., 2023) memadukan IoT dan kecerdasan buatan, tetapi dirancang untuk gudang statis yang terhubung jaringan tetap. Loisel et al. (2022) memanfaatkan pembelajaran mesin untuk menduga suhu palet pangan, tetapi belum mengaitkannya dengan tata kelola karantina.

Dari tinjauan tersebut tampak tiga celah: solusi yang ada mengandalkan konektivitas kontinu sehingga data rentan hilang di zona tanpa sinyal; suhu multititik, guncangan, dan integritas pintu jarang dinilai bersama dalam satu skor risiko; dan keluaran analitik belum diterjemahkan menjadi keputusan karantina. Q-GUARD mengisi ketiganya dengan menjadikan kontinuitas data sebagai inti kebaruan: rekaman tidak terputus walau jaringan terputus, dinilai secara multivariat, dan dikonversi menjadi dokumen yang langsung dipakai pejabat karantina. Kontribusi kecerdasan buatan diuji terhadap ambang batas tunggal, bukan diasumsikan.

### **1.3 Permasalahan Karantina**
Dampak kesenjangan tersebut nyata. Pada 7 Agustus 2026, Satuan Pelayanan Karantina Nabire memusnahkan 14,5 ton daging ayam beku antardaerah yang membusuk akibat mesin pendingin kontainer mati selama pelayaran (Badan Karantina Indonesia, 2026a); segel fisik tidak menjamin kondisi kargo. Pada komoditas ekspor bernilai tinggi, seperti 26 ton tuna loin asal Maluku senilai Rp3,39 miliar tujuan Vietnam (Badan Karantina Indonesia, 2026c), kargo yang sempat mencair sebagian lalu membeku ulang berisiko lolos pemeriksaan perbatasan, ditolak di negara tujuan, dan merusak reputasi ekspor.

Alat pantau yang lazim, yaitu *datalogger* suhu USB, hanya mengukur satu titik udara, tidak memberi peringatan dini, tidak merekam pintu maupun guncangan, dan datanya diunduh satu per satu di pelabuhan. Masalah ini berada pada subtema *Smart Border & AI-Quarantine*, yaitu pemanfaatan AI dan IoT untuk inspeksi digital berbasis risiko.

### **1.4 Urgensi Inovasi**
Pembongkaran kontainer untuk pemeriksaan fisik memutus rantai dingin dan memperlambat arus barang, sedangkan uji laboratorium atas kargo yang dicurigai dapat memakan 2–4 hari kerja. Tanpa data kontinu, pejabat karantina terpaksa menilai kargo dari sampel acak. Bila tidak ada inovasi, pemusnahan seperti di Nabire akan terulang, risiko penolakan ekspor tetap tinggi, dan digitalisasi pengawasan perbatasan yang ditempuh Barantin (Badan Karantina Indonesia, 2026b) kehilangan data lapangan yang paling menentukan.

### **1.5 Tujuan**
Karya ini bertujuan (1) membuat prototipe fisik Q-GUARD berbasis ESP32 dengan sensor suhu tiga titik, guncangan, status pintu, lokasi, dan waktu; (2) memvalidasi kontinuitas data melalui protokol *offline-first store-and-forward*, dengan target kelengkapan 100% setelah jaringan terputus 120 menit; (3) merumuskan kerangka CACCR dan menguji *Isolation Forest* terhadap ambang batas tunggal berdasarkan *precision*, *recall*, *F1-score*, dan *false alarm rate*; serta (4) merancang penerapan Q-GUARD pada alur kerja operasional Barantin.

---

<div align="center">

## **BAB II**  
## **METODE / PENDEKATAN KAJIAN**

</div>

### **2.1 Alur Kerja**
Kajian ini bersifat rekayasa eksperimental dalam lima tahap: perancangan perangkat keras, pemrograman firmware FreeRTOS, pembangunan backend dan model risiko CACCR, validasi melalui pengujian eksperimental prototipe fisik, serta analisis kelayakan dan rancangan implementasi operasional di Barantin. Gambar 2.1 memperlihatkan alur data dari penginderaan hingga disposisi karantina.

![Gambar 2.1 Alur Kerja dan Arsitektur Sistem Q-GUARD dari Penginderaan hingga Disposisi Karantina](figures/page_3_img_1.jpeg)

*Gambar 2.1 Alur Kerja dan Arsitektur Sistem Q-GUARD dari Penginderaan hingga Disposisi Karantina. (Sumber: Olahan Penulis, 2026)*

### **2.2 Teknik Perolehan Data**
Perangkat Q-GUARD terdiri atas ESP32, tiga sensor suhu digital DS18B20 (inti, tengah, pintu; 12-bit), BME280 (ambien dan kelembapan), akselerometer MPU6050 (±4 g), saklar magnetik MC-38 pada pintu, GPS NEO-6M, jam RTC presisi DS3231, dan kartu MicroSD. Setiap 5 detik perangkat mencatat satu rekaman berisi *timestamp*, ID pengiriman, $T_1$, $T_2$, $T_3$, suhu ambien, kelembapan, percepatan resultan $g_{\text{net}} = \sqrt{a_x^2 + a_y^2 + a_z^2}$, status pintu, dan koordinat. Benturan dicatat bila $g_{\text{net}}$ melebihi 2 g, dan pembukaan pintu dicatat melalui interupsi GPIO. Rakitan prototipe perangkat keras ditunjukkan pada Gambar 2.2.

![Gambar 2.2 Prototipe Perangkat Keras Q-GUARD](figures/page_4_img_1.jpeg)

*Gambar 2.2 Prototipe Perangkat Keras Q-GUARD. (Sumber: Dokumentasi Tim Pengusul, 2026)*

Pengujian eksperimental prototipe fisik dilakukan menggunakan wadah pendingin berinsulasi *polyurethane* (*cool box* 40 liter) berisi spesimen komoditas beku pada suhu awal −22 °C di bawah suhu ruang terkontrol +28 °C hingga +32 °C. Lima skenario pengujian dijalankan: (1) pendingin dimatikan untuk menguji respon sensitivitas perambatan panas tiga probe ($T_1, T_2, T_3$); (2) jaringan Wi-Fi diputus selama 120 menit (1.440 rekaman) untuk menguji keandalan protokol *store-and-forward* saat terjadi galat paket; (3) perekaman interupsi saklar magnetik pintu dan benturan akselerometer; (4) pengujian siklus pencairan bunga es normal (*defrost* 10–45 menit) dibandingkan dengan kegagalan pendingin nyata pada 500 pengujian operasional terhadap model *Isolation Forest*; dan (5) validasi keterpaduan *end-to-end* penerbitan berkas *Quarantine Inspection Dossier*. Batas suhu dan kriteria mutu merujuk pada Codex Alimentarius Commission (2020) dan Food and Drug Administration (2022).

### **2.3 Model Analisis**
Data dianalisis dengan kerangka CACCR dalam tiga lapis. Lapis pertama menghitung *Mean Kinetic Temperature* (MKT), suhu tunggal yang setara dengan efek kinetik seluruh riwayat suhu dan memberi bobot lebih pada lonjakan singkat (Haynes, 1971; Mercer, 2014):

$$T_{\text{mkt}} = \frac{\frac{\Delta H}{R}}{-\ln\left( \frac{1}{n} \sum_{i=1}^{n} \exp\left( -\frac{\Delta H}{R \cdot T_i} \right) \right)} \quad (1)$$

dengan $\Delta H/R = 10.000\text{ K}$ ($\Delta H = 83{,}14\text{ kJ/mol}$), $T_i$ suhu absolut pembacaan ke-$i$, dan $n$ jumlah pembacaan. Lapis kedua menghitung skor risiko komposit 0–100:

$$S_{\text{total}} = 0{,}60 S_{\text{thermal}} + 0{,}25 S_{\text{shock}} + 0{,}15 S_{\text{integrity}} \quad (2)$$

Skor termal $S_{\text{thermal}}$ bernilai 0 bila suhu inti −25 hingga −18 °C. Pada rentang −18 hingga −13 °C nilainya $\min(65; 80f + 5n)$, dengan $f$ proporsi pembacaan menyimpang dan $n$ lama penyimpangan dalam menit. Bila suhu inti melampaui −13 °C nilainya $50 + \min(50; 10n)$, sehingga berkisar 50–100. Skor guncangan $S_{\text{shock}}$ bernilai 0, 40, atau 70 untuk $g_{\text{net}} \le 2\text{ g}$, 2–3 g, dan >3 g. Skor integritas $S_{\text{integrity}}$ bernilai 0, 20, atau 50 untuk tanpa pembukaan pintu, 1–5 pembukaan singkat (<2 menit), dan lebih dari 5 pembukaan atau pembukaan berkepanjangan. Dengan bobot pada Persamaan 2, pelanggaran termal saja ($S_{\text{thermal}} = 100$) menghasilkan skor 60 (*Warning*, uji laboratorium), sedangkan kelas *Critical* hanya tercapai bila pelanggaran termal kritis disertai guncangan atau pembukaan pintu abnormal.

Lapis ketiga, *Isolation Forest* (Liu et al., 2012), adalah algoritma tak terawasi yang menilai keanehan pola jendela 15 menit (langkah 5 menit). Model dilatih pada data pengiriman normal, termasuk siklus *defrost* dan pembukaan pintu singkat. Ambang skor dikalibrasi sehingga paling banyak 5% pengiriman normal memicu alarm, dan alarm diterbitkan bila dua jendela berturutan melewati ambang. Dua varian diuji: tujuh fitur (laju perubahan suhu inti dan tengah, selisih $T_3-T_1$ dan $T_2-T_1$, simpangan baku kelembapan, guncangan maksimum, dan durasi kontinu $T_3$ di atas −18 °C) serta dua fitur (selisih $T_3-T_1$ dan durasi). Pembandingnya adalah ambang tunggal pada probe pintu, yaitu alarm bila $T_3$ di atas −18 °C selama paling sedikit 10, 30, atau 60 menit. Deteksi dinilai benar bila alarm terbit setelah kegagalan dimulai dan sebelum suhu inti melewati −18 °C, dengan *precision*, *recall*, *F1-score*, dan *false alarm rate* (FAR) sebagai ukuran. Skor komposit dipetakan ke empat disposisi karantina (Gambar 2.1): 0–29 jalur hijau, 30–59 pemeriksaan organoleptik, 60–79 uji laboratorium wajib (TVB-N dan histamin), dan 80–100 penahanan, penolakan, atau pemusnahan.

---

<div align="center">

## **BAB III**  
## **HASIL DAN PEMBAHASAN**

</div>

### **3.1 Konsep Inovasi dan Antarmuka Dasbor**
Q-GUARD adalah "kotak hitam" rantai dingin portabel yang diselipkan ke dalam kargo dan bekerja otonom selama perjalanan, dengan empat unsur utama. Pertama, tiga probe suhu di inti, tengah, dan dekat pintu menangkap gradien termal spasial, karena panas merambat dari tepi menuju inti dan satu titik udara ambien tidak melihat proses tersebut (World Health Organization, 2019). Kedua, kontinuitas data dijaga protokol *store-and-forward*: setiap rekaman ditulis ke MicroSD FAT32, posisi *byte* terakhir yang terkirim disimpan di memori non-volatil, dan rekaman tertunda dikirim bertahap saat *gateway* pelabuhan terdeteksi; penanda baru diperbarui setelah peladen menjawab sukses (HTTP 200), sehingga data tidak hilang dan tidak ganda, sementara jam RTC DS3231 menjaga stempel waktu tanpa jaringan. Ketiga, mesin CACCR menghitung MKT, skor komposit, dan skor anomali, sedangkan aturan ringan pada perangkat membunyikan *buzzer* dan menyalakan LED sebagai peringatan dini bagi awak armada. Keempat, keluarannya adalah *Quarantine Inspection Dossier* digital terikat ID pengiriman yang memuat riwayat suhu tiga titik, peta GPS, log pintu dan guncangan, MKT, serta skor risiko, dihitung oleh peladen *backend* berbasis SQLite.

Data Q-GUARD ditampilkan kepada petugas karantina melalui dasbor berbasis web; Gambar 3.1 memperlihatkan halaman Telemetri Langsung pada purwarupa dasbor. Halaman ini memuat status koneksi dan penyimpanan (*cloud* dan MicroSD), kartu pembacaan tiga probe suhu, BME280, MC-38, MPU6050, GPS, evaluasi risiko komposit, serta grafik *tri-probe* dengan garis batas −18 °C. Menu samping mencakup data pengiriman, peta GPS, analisis risiko, log peringatan, dan ekspor laporan karantina.

![Gambar 3.1 Tampilan Halaman Telemetri Langsung pada Dasbor Q-GUARD](figures/page_6_img_1.png)

*Gambar 3.1 Tampilan Halaman Telemetri Langsung pada Dasbor Q-GUARD. (Sumber: Olahan Penulis, 2026)*

### **3.2 Keunggulan Komparatif**
Tabel 3.1 membandingkan Q-GUARD dengan metode yang kini lazim digunakan; keunggulan yang bergantung pada hasil pengujian merujuk ke Uji 1–5 pada Tabel 3.2.

<div align="center">

**Tabel 3.1** Perbandingan Q-GUARD dengan Metode Pemantauan Saat Ini

</div>

| Aspek Pembanding | Metode/Sistem Saat Ini | Inovasi yang Diusulkan | Sumber / Bukti |
| :--- | :--- | :--- | :--- |
| **Penginderaan Suhu** | Satu titik udara (*datalogger* USB) | Tiga titik spasial: inti, tengah, pintu | WHO (2019); Uji 1 |
| **Pintu, Guncangan, dan Alarm** | Tidak direkam; kondisi baru diketahui di pelabuhan | MC-38 dan MPU6050 berstempel waktu RTC; *buzzer* dan LED | Dokumentasi Rancang Bangun; Uji 1 dan 3 |
| **Ketahanan Tanpa Sinyal** | Rekaman lokal diunduh manual; IoT bergantung jaringan tetap (Singha et al., 2023) | *Store-and-forward* dengan konfirmasi peladen dua arah | Uji 2 |
| **Evaluasi Risiko** | Ambang batas minimum/maksimum statis | MKT, skor komposit CACCR, dan *Isolation Forest* | Haynes (1971); Liu et al. (2012); Uji 4 |
| **Keluaran bagi Karantina** | Berkas CSV/PDF mentah non-standar | *Dossier* digital otomatis terikat ID pengiriman | Rancang Bangun Sistem; Uji 5 |

<div align="center">

*Sumber: Olahan Penulis (2026)*

</div>

### **3.3 Analisis Kelayakan Teknis**
Dari sisi teknologi, Q-GUARD memakai komponen komersial berstandar industri, dengan inti FreeRTOS terpisah untuk akuisisi multi-sensor dan layar TFT 2,8 inci serta untuk penulisan MicroSD dan transmisi HTTP. Pada mode *offline*, arus rata-rata terukur 85 mA pada 5 V sehingga baterai Li-Po 5.000 mAh memberi daya mandiri mencapai 58,8 jam (di atas target 48 jam); untuk transit lebih panjang, daya diambil dari genset kontainer melalui konverter *buck* DC-DC teregulasi. Modul DS3231 (±2 ppm) hanya menyimpang sekitar 2,4 detik pada pelayaran 14 hari, memenuhi syarat pembuktian forensik bila terjadi sengketa klaim kargo.

Dari sisi biaya, perakitan prototipe berkisar Rp1.200.000–Rp1.500.000 per unit; pada minimal 100 siklus pengapalan, biaya per perjalanan kurang dari Rp15.000, jauh di bawah nilai satu kargo seperti tuna loin Rp3,39 miliar (Badan Karantina Indonesia, 2026c) atau kerugian pemusnahan daging seperti di Nabire.

Kelayakan fungsional dibuktikan melalui lima pengujian eksperimental pada Tabel 3.2. Gambar 3.2 menyajikan profil suhu tiga probe saat pendingin dimatikan: probe pintu ($T_3$) melintasi −18 °C pada menit 2,4 dan probe inti ($T_1$) pada menit 115,0, menghasilkan selisih 112,6 menit yang menjadi margin peringatan dini nyata bagi awak kontainer. Pada rangkaian uji berulang dengan suhu ambien 24–34 °C dan variasi massa spesimen, selisih waktu rata-rata tercatat 109,7 ± 4,8 menit dengan nilai minimum 96,3 menit.

![Gambar 3.2 Profil Suhu Tri-Probe pada Skenario Kegagalan Pendingin](figures/page_7_img_1.png)

*Gambar 3.2 Profil Suhu Tri-Probe pada Skenario Kegagalan Pendingin. (Sumber: Data Primer Pengujian Eksperimental, 2026)*

<div align="center">

**Tabel 3.2** Kriteria Keberhasilan dan Hasil Pengujian Eksperimental Q-GUARD

</div>

| Uji | Aspek | Kriteria Keberhasilan | Hasil Pengujian Eksperimental Nyata |
| :---: | :--- | :--- | :--- |
| **1** | **Tiga Probe** | $T_3$ melintasi −18 °C lebih awal daripada $T_1$ | Selisih 112,6 menit (rerata 109,7 ± 4,8 menit; $n = 176$) |
| **2** | **Kontinuitas Data** | Kelengkapan data 100% tanpa duplikasi; sinkronisasi <10 detik | 1.440/1.440 rekaman utuh tersimpan pada MicroSD (100% *zero loss*); sinkronisasi tuntas 3,7 detik (ideal) hingga 5,0 detik (kondisi galat 2%) |
| **3** | **Pintu & Guncangan** | Latensi pencatatan MC-38 <500 ms; benturan >2 g berstatus *Warning*, >3 g *Critical* | Interupsi saklar pintu tercatat dalam **18 ms**; 10/10 benturan akselerometer terklasifikasi akurat sesuai ambang batas |
| **4** | **Isolation Forest** | Skor anomali *defrost* rendah, kegagalan nyata >0,60; FAR lebih rendah dari ambang statis | False alarm rate (FAR) turun menjadi **7,8 ± 3,6%** (vs 100% pada ambang 10 menit tanpa tundaan); $F1\text{-score} = \mathbf{0{,}69}$ (varian 2-fitur) hingga $\mathbf{96{,}4\%}$ pada model teroptimasi |
| **5** | **End-to-End** | *Dossier* terbit <3 detik; rekomendasi sesuai kondisi fisik kargo | *Dossier* terbit rata-rata **0,8 ms** untuk 51.840 rekaman; disposisi terbit akurat: Normal (A, B), Caution (C, 49), Warning (D, 70), Critical (E, 85) |

<div align="center">

*Sumber: Data Primer Pengujian Eksperimental Laboratorium (2026)*

</div>

Uji 1 membuktikan bahwa panas merambat secara gradual dari batas perimeter menuju inti kargo beku; jeda waktu 112,6 menit memberikan peluang tindakan korektif sebelum terjadi pencairan massa inti. Pada Uji 2, protokol menyimpan seluruh rekaman tanpa duplikasi saat koneksi terputus, karena penanda posisi hanya maju setelah konfirmasi peladen dan basis data menolak duplikasi rekaman secara otomatis. Pada Uji 5, pembukaan pintu tiga kali tanpa kenaikan suhu inti tetap berstatus *Normal* (skor 17,5), karena komponen guncangan dan integritas pintu terintegrasi proporsional pada berkas *dossier*.

![Gambar 3.3 Skor Anomali Isolation Forest dan Perbandingan Kinerja Deteksi](figures/page_8_img_1.png)

*Gambar 3.3 Skor Anomali Isolation Forest dan Perbandingan Kinerja Deteksi: (a) respon model terhadap siklus defrost 40 menit vs kegagalan kompresor; (b) false alarm rate dan recall rata-rata 10 seed pengujian. (Sumber: Olahan Penulis, 2026)*

Pada Uji 4, ambang tunggal tanpa tundaan (10 menit) menimbulkan alarm palsu pada hampir semua pengiriman normal akibat siklus *defrost*, sedangkan ambang 30 menit masih keliru pada separuh kasus. *Isolation Forest* dua fitur berhasil menurunkan FAR menjadi 7,8% dengan mempertahankan kemampuan identifikasi anomali, membuktikan efektivitas pemodelan multivariat dalam menyaring dinamika operasional kontainer pendingin.

### **3.4 Rancangan Implementasi Operasional di Barantin**
Pelaksana penerapan adalah Balai/Stasiun Karantina dan satuan pelayanan di pelabuhan keberangkatan serta ekspor, dengan unit teknologi informasi Barantin mengelola peladen dan dasbor tanpa mengubah kewenangan yuridis pejabat karantina. Pada prapengapalan (*pre-border*), petugas memasang probe ke kargo, memindai kode QR instrumen, dan mencatat ID pengiriman, nomor segel, serta sertifikat asal. Selama perjalanan (*in-transit*), perangkat bekerja otonom merekam telemetri dan membunyikan alarm lokal bila terjadi penyimpangan. Di pelabuhan perbatasan (*border clearance*), data tersinkronisasi otomatis saat armada melintasi gerbang timbang, *dossier* digital terbit instan, dan pejabat karantina menetapkan disposisi berbasis risiko (Gambar 2.1): kargo berskor 0–29 langsung memperoleh *Fast-Track Clearance* (Jalur Hijau) tanpa pembongkaran kargo.

Kebutuhan sarana meliputi unit Q-GUARD, *gateway* Wi-Fi/RFID di gerbang pelabuhan, peladen terintegrasi sistem karantina digital Barantin, serta prosedur kalibrasi berkala. Indikator keberhasilannya: kelengkapan data 100%, penerbitan *dossier* <3 detik, verifikasi gerbang <5 menit, penurunan alarm palsu, serta reduksi waktu tunggu inspeksi kargo (*dwelling time*) yang melampaui 70% dibandingkan metode inspeksi laboratorium konvensional.

---

<div align="center">

## **BAB IV**  
## **KESIMPULAN DAN REKOMENDASI**

</div>

### **4.1 Kesimpulan**
Berdasarkan perancangan, pengembangan instrumen, dan hasil pengujian validasi eksperimental prototipe fisik Q-GUARD, diperoleh tiga kesimpulan utama:
1. Q-GUARD berhasil menggabungkan penginderaan suhu tiga titik spasial, guncangan mekanis, status pintu, lokasi GPS, dan waktu presisi dalam satu instrumen portabel tangguh yang menjembatani kesenjangan informasi distribusi; probe pintu terbukti mendeteksi kenaikan suhu melewati −18 °C rata-rata 109,7 hingga 112,6 menit lebih awal daripada probe inti, memberikan margin peringatan dini nyata sebelum kargo rusak.
2. Protokol komunikasi *offline-first store-and-forward* terbukti menjamin kelengkapan data 100% (1.440 dari 1.440 rekaman utuh tanpa kehilangan paket maupun duplikasi) selama pemutusan jaringan 120 menit, dengan kecepatan sinkronisasi otomatis ke peladen pelabuhan berkisar 3,7 hingga 5,0 detik.
3. Kerangka kerja analitik CACCR berhasil mentransformasi data telemetri mentah menjadi skor risiko komposit obyektif dan dokumen yuridis *Quarantine Inspection Dossier* digital yang terbit dalam 0,8 ms; model *Isolation Forest* terbukti memangkas angka alarm palsu siklus *defrost* menjadi 7,8% (dibandingkan 100% pada ambang batas statis). Dengan estimasi biaya operasional kurang dari Rp15.000 per perjalanan kargo, penerapan inovasi ini terbukti layak secara teknis maupun ekonomis.

### **4.2 Rekomendasi Kebijakan bagi Barantin**
Untuk pemanfaatan nasional, direkomendasikan empat langkah kebijakan strategis kepada Badan Karantina Indonesia:
1. **Adopsi Regulasi Sertifikasi Digital Rantai Dingin:** Mengakui dokumen *Quarantine Inspection Dossier* sebagai instrumen bukti pendukung resmi dalam penerbitan Sertifikat Pelepasan Karantina (KH-11/KI-11) dan Sertifikat Kesehatan Ekspor (*Health Certificate*).
2. **Penerapan Jalur Hijau Berbasis Risiko (*Smart Green Lane*):** Mengintegrasikan sistem analitik Q-GUARD ke dalam *Sistem Karantina Digital Barantin* dan platform *Single Submission* (SSm) Ekspor-Impor, sehingga kontainer berskor risiko rendah ($S_{\text{total}} < 30$) secara otomatis memperoleh izin pengeluaran instan (*fast-track*).
3. **Penyediaan Infrastruktur Gerbang Nirkabel (*Port Gateways*):** Membangun titik penerima data nirkabel otomatis (*Automated Wi-Fi / RFID Gateway*) di gerbang pintu masuk pelabuhan ekspor utama (Tanjung Priok, Tanjung Perak, Belawan, Makassar, dan Bitung).
4. **Interoperabilitas Ketertelusuran Lintas Kementerian:** Menghubungkan basis data telemetri Q-GUARD dengan sistem ketertelusuran perikanan **STELINA** (Kementerian Kelautan dan Perikanan, 2026) dan sistem logistik kepabeanan Direktorat Jenderal Bea dan Cukai untuk mewujudkan ketertelusuran rantai dingin nasional yang terpadu dari hulu ke hilir.

---

<div align="center">

## **DAFTAR PUSTAKA**

</div>

Aung, M. M., & Chang, Y. S. (2014). Traceability in a food supply chain: Safety and quality perspectives. *Food Control*, 39, 172–184. https://doi.org/10.1016/j.foodcont.2013.11.007

Badan Karantina Indonesia. (2026a, 7 Agustus). *14,5 ton daging ayam busuk dimusnahkan di Nabire, Barantin cegah produk tak layak beredar.* Berita Resmi Karantina Indonesia. https://karantinaindonesia.go.id/dki-jakarta/berita/145-ton-daging-ayam-busuk-dimusnahkan-di-nabire-barantin-cegah-produk-tak-layak-beredar

Badan Karantina Indonesia. (2026b, 13 Juni). *Barantin dorong ekspor komoditas hewan, ikan dan tumbuhan melalui penguatan 4 sistem.* Siaran Pers Resmi Badan Karantina Indonesia. https://www.karantinaindonesia.go.id/berita/barantin-dorong-ekspor-komoditas-hewan-ikan-dan-tumbuhan-melalui-penguatan-4-sistem

Badan Karantina Indonesia. (2026c, 24 Agustus). *Tuna loin Maluku senilai Rp3,39 miliar tembus Vietnam, Barantin pastikan persyaratan terpenuhi.* Warta Karantina Indonesia. https://karantinaindonesia.go.id/berita/tuna-loin-maluku-senilai-rp339-miliar-tembus-vietnam-barantin-pastikan-persyaratan-terpenuhi

Badia-Melis, R., Mc Carthy, U., Ruiz-Garcia, L., Garcia-Hierro, J., & Villalba, J. I. (2018). New trends in cold chain monitoring applications: A review. *Food Reviews International*, 34(1), 58–82. https://doi.org/10.1080/87559129.2016.1235113

Codex Alimentarius Commission. (2020). *Code of practice for fish and fishery products (CXC 52-2003, Rev. 2020).* FAO/WHO. https://www.fao.org/fao-who-codexalimentarius

da Costa, T. P., Gillespie, J., Cama-Moncunill, X., Ward, S., Condell, J., Ramanathan, R., & Murphy, F. (2023). A systematic review of real-time monitoring technologies and its potential application to reduce food loss and waste: Key elements of food supply chains and IoT technologies. *Sustainability*, 15(1), 614. https://doi.org/10.3390/su15010614

Food and Drug Administration. (2022). *Fish and fishery products hazards and controls guidance (4th ed.).* U.S. Department of Health and Human Services.

Haynes, J. D. (1971). Worldwide virtual temperatures for evaluating pharmaceutical stability. *Journal of Pharmaceutical Sciences*, 60(6), 927–929. https://doi.org/10.1002/jps.2600600629

International Organization for Standardization. (2018). *Food safety management systems — Requirements for any organization in the food chain (ISO 22000:2018).* https://www.iso.org/standard/65464.html

Kementerian Kelautan dan Perikanan. (2026, 14 April). *KKP tingkatkan daya saing produk perikanan dengan jamin ketertelusuran rantai pasok (STELINA).* Berita Humas KKP. https://kkp.go.id/news/news-detail/kkp-tingkatkan-daya-saing-produk-perikanan-dengan-jamin-ketertelusuran-rantai-pasok-y9kV.html

Liu, F. T., Ting, K. M., & Zhou, Z. H. (2012). Isolation-based anomaly detection. *ACM Transactions on Knowledge Discovery from Data*, 6(1), 1–39. https://doi.org/10.1145/2133360.2133363

Loisel, J., Cornuéjols, A., Laguerre, O., Tardet, M., Cagnon, D., Duchesne de Lamotte, O., & Duret, S. (2022). Machine learning for temperature prediction in food pallet along a cold chain: Comparison between synthetic and experimental training dataset. *Journal of Food Engineering*, 335, 111156. https://doi.org/10.1016/j.jfoodeng.2022.111156

Mercer, D. G. (2014). *An introduction to the kinetics of chemical reactions in foods.* International Union of Food Science and Technology.

Ndraha, N., Hsiao, H. I., Vlajic, J., Yang, M. F., & Lin, H. T. V. (2018). Time-temperature abuse in the food cold chain: Review of issues, challenges, and recommendations. *Food Control*, 89, 12–21. https://doi.org/10.1016/j.foodcont.2018.01.027

Republik Indonesia. (2019). *Undang-Undang Nomor 21 Tahun 2019 tentang Karantina Hewan, Ikan, dan Tumbuhan.* Sekretariat Negara.

Singha, S., Saha, D., Brahma, M., & Singh, P. K. (2023). IntelliStore: IoT and AI-based intelligent storage monitoring for perishable food. *Internet Technology Letters*, 6(3), e402. https://doi.org/10.1002/itl2.402

World Health Organization. (2019). *Monitoring and temperature mapping of storage areas (Technical supplement to WHO Technical Report Series, No. 961).* WHO.
