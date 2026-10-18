# 🚀 Panduan Setup Docker & Auto Deploy Q-GUARD

Panduan lengkap deployment sistem **Q-GUARD** (*Smart Quarantine Cold-Chain Risk Monitoring*) menggunakan Docker Compose dengan **SSL/HTTPS otomatis (Let's Encrypt)** untuk domain **`q-guard.web.id`**, serta pipeline **CI/CD Auto-Deploy** menggunakan GitHub Actions.

---

## 🏗️ 1. Arsitektur Docker Produksi

Sistem dideploy dalam 3 kontainer terisolasi yang saling terhubung:

```
[ Internet / Browser / ESP32 ]
            │
            ▼  (Port 80 HTTP & 443 HTTPS)
┌────────────────────────────────────────────────────────┐
│  qguard-caddy (Caddy v2.8 Reverse Proxy)               │
│  - Otomatis terbitkan & perbarui SSL/TLS Let's Encrypt │
│  - Otomatis redirect HTTP -> HTTPS                     │
│  - Mendukung HTTP/3 (QUIC) & Kompresi Gzip/Zstandard   │
└───────────┬────────────────────────────────┬───────────┘
            │                                │
      [ /api/* ]                         [ /* ]
            │                                │
            ▼                                ▼
┌───────────────────────────┐    ┌──────────────────────────┐
│  qguard-backend           │    │  qguard-frontend         │
│  - Node.js 22 LTS Alpine  │    │  - Nginx 1.27 Alpine     │
│  - Native SQLite Sync     │    │  - SPA Routing & Caching │
│  - Auto Migrate & Seed    │    │  - Port 80 Internal      │
│  - Volume: /app/data      │    └──────────────────────────┘
└───────────────────────────┘
```

---

## 🌐 2. Langkah 1: Pengaturan DNS Domain (`q-guard.web.id`)

Sebelum menjalankan deploy di VPS, pastikan domain `q-guard.web.id` sudah diarahkan ke IP publik server Anda melalui dashboard penyedia domain (Domainesia, Niagahoster, IDCloudHost, Cloudflare, dll.):

| Tipe Record | Nama Host / Subdomain | Nilai / Target IP | TTL |
| :--- | :--- | :--- | :--- |
| **A Record** | `@` (atau kosong) | `IP_PUBLIK_VPS_ANDA` | Otomatis / 300 |
| **A Record** | `www` | `IP_PUBLIK_VPS_ANDA` | Otomatis / 300 |

> [!TIP]
> Anda dapat mengecek apakah DNS sudah mengarah dengan menjalankan di terminal:
> ```bash
> ping q-guard.web.id
> ```

---

## ⚡ 3. Langkah 2: Deploy Cepat 1-Perintah di VPS (`deploy.sh`)

Hubungkan SSH ke VPS Anda (Ubuntu 20.04 / 22.04 / 24.04 atau Debian 11 / 12), lalu jalankan:

```bash
# 1. Clone repositori ke direktori /opt/qguard
sudo git clone https://github.com/USERNAME/REPO_NAME.git /opt/qguard
cd /opt/qguard

# 2. Beri izin eksekusi dan jalankan script deploy otomatis
sudo chmod +x deploy.sh
sudo bash deploy.sh
```

### Apa yang dilakukan oleh `deploy.sh` secara otomatis?
1. Memeriksa & memasang **Docker Engine** serta **Docker Compose Plugin** terbaru jika belum ada.
2. Membuka port firewall **80 (HTTP)**, **443 (HTTPS)**, dan **22 (SSH)** via UFW.
3. Memvalidasi apakah DNS `q-guard.web.id` sudah terarah ke IP server.
4. Membuat file `.env` dari `.env.example` dan men-generate **Secret Key acak 64-karakter** (`JWT_SECRET` & `API_KEY`) yang aman.
5. Menjalankan `docker compose up -d --build`.
6. Melakukan migrasi tabel database dan verifikasi akun default `admin / admin123`.
7. Menunggu Caddy menerbitkan sertifikat SSL resmi untuk `https://q-guard.web.id`.

---

## 🔄 4. Langkah 3: Konfigurasi Auto-Deploy via GitHub Actions

Setiap kali Anda melakukan `git push` ke branch `main`, GitHub Actions akan otomatis mengupdate dan merestart kontainer di server VPS Anda tanpa downtime manual.

### A. Buat SSH Key untuk GitHub Actions di Server VPS
Di server VPS, jalankan:
```bash
# Generate key baru tanpa passphrase
ssh-keygen -t ed25519 -C "github-actions-qguard" -f ~/.ssh/id_github_actions -N ""

# Tambahkan public key ke daftar authorized_keys
cat ~/.ssh/id_github_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Tampilkan private key untuk disalin ke GitHub
cat ~/.ssh/id_github_actions
```

### B. Tambahkan Secrets di Repository GitHub
Buka GitHub: **Repository Anda** $\to$ **Settings** $\to$ **Secrets and variables** $\to$ **Actions** $\to$ **New repository secret**:

| Nama Secret | Nilai |
| :--- | :--- |
| `VPS_HOST` | IP Publik VPS Anda (contoh: `103.186.x.x`) |
| `VPS_USERNAME` | Username SSH (contoh: `root` atau `ubuntu`) |
| `VPS_SSH_KEY` | Salin seluruh isi teks dari `cat ~/.ssh/id_github_actions` (termasuk `-----BEGIN ...` hingga `-----END ...`) |
| `VPS_PORT` | Port SSH Anda (default: `22`) |
| `VPS_APP_DIR` | `/opt/qguard` |

File workflow sudah tersedia di [`.github/workflows/deploy.yml`](file:///.github/workflows/deploy.yml). Cukup lakukan push ke `main`, dan pipeline auto-deploy akan langsung bekerja!

---

## 🧪 5. Uji Coba & Verifikasi Akses

Setelah deployment selesai:

1. **Buka Portal Publik**:
   ```
   https://q-guard.web.id
   ```
   - Halaman utama beranda responsif, visual Tri-Probe, dan simulator AI langsung aktif dengan gembok hijau HTTPS valid.

2. **Login Petugas Barantin**:
   - Tombol: **Buka Dashboard** / **Login Petugas**
   - Username: `admin`
   - Password: `admin123`

3. **Cek Health Check API**:
   ```
   https://q-guard.web.id/api/health
   ```
   Output JSON:
   ```json
   {
     "status": "OK",
     "service": "Q-GUARD Backend API",
     "version": "1.0.0",
     "database": { "status": "healthy" }
   }
   ```

4. **Koneksi Telemetri ESP32 (Firmware)**:
   Ubah target URL di firmware ESP32 `qguard_esp32.ino`:
   ```cpp
   const char* SERVER_URL = "https://q-guard.web.id/api/sensor-data";
   const char* API_KEY    = "API_KEY_DARI_FILE_ENV";
   ```

---

## 💻 6. Uji Coba Lokal Tanpa Domain (Local Docker)

Jika Anda ingin menguji kontainer Docker di laptop/komputer lokal sebelum ke VPS:

```bash
docker compose -f docker-compose.local.yml up -d --build
```
Akses di browser lokal:
- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:3000/api/health`

---

## 🛠️ 7. Perintah Pemeliharaan Harian (Maintenance)

Jalankan perintah ini di dalam direktori `/opt/qguard`:

```bash
# Melihat log realtime seluruh container
docker compose logs -f

# Melihat log khusus Caddy (akses SSL & web)
docker compose logs -f caddy

# Melihat log khusus Backend (database & telemetri)
docker compose logs -f backend

# Melihat status container dan penggunaan resource
docker compose ps
docker stats

# Merestart seluruh sistem
docker compose restart

# Menghentikan sistem
docker compose down

# Backup Database SQLite
docker cp qguard-backend:/app/data/qguard.db ./backup_$(date +%Y%m%d_%H%M%S).db
```
