#!/usr/bin/env bash
# ==============================================================================
# Q-GUARD One-Click Auto-Deploy Script
# Target Domain: q-guard.web.id
# Supported OS: Ubuntu 20.04 / 22.04 / 24.04, Debian 11 / 12
# ==============================================================================

set -euo pipefail

# Colors
C_RESET='\033[0m'
C_BOLD='\033[1m'
C_GREEN='\033[32m'
C_CYAN='\033[36m'
C_YELLOW='\033[33m'
C_RED='\033[31m'

DOMAIN="q-guard.web.id"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${C_CYAN}${C_BOLD}"
echo "====================================================================="
echo "       🛡️ Q-GUARD AUTOMATED DOCKER DEPLOYMENT (SMART QUARANTINE)"
echo "       Target Domain: https://${DOMAIN}"
echo "====================================================================="
echo -e "${C_RESET}"

# 1. Check Root Privileges
if [ "$EUID" -ne 0 ]; then
  echo -e "${C_YELLOW}ℹ️ Running without root. Commands requiring root will use sudo.${C_RESET}"
  SUDO="sudo"
else
  SUDO=""
fi

# 2. Check and Install Docker & Docker Compose Plugin
echo -e "${C_CYAN}[1/6] Memeriksa instalasi Docker & Docker Compose...${C_RESET}"
if ! command -v docker &> /dev/null; then
    echo -e "${C_YELLOW}Docker belum terpasang. Mengunduh & memasang Docker resmi...${C_RESET}"
    $SUDO apt-get update -y
    $SUDO apt-get install -y curl ca-certificates gnupg lsb-release
    curl -fsSL https://get.docker.com | $SUDO sh
    $SUDO systemctl enable --now docker
    echo -e "${C_GREEN}✓ Docker berhasil dipasang!${C_RESET}"
else
    echo -e "${C_GREEN}✓ Docker sudah terpasang: $(docker --version)${C_RESET}"
fi

if ! docker compose version &> /dev/null; then
    echo -e "${C_YELLOW}Memasang plugin Docker Compose...${C_RESET}"
    $SUDO apt-get update -y
    $SUDO apt-get install -y docker-compose-plugin
fi
echo -e "${C_GREEN}✓ Docker Compose siap: $(docker compose version)${C_RESET}"

# 3. Configure Firewall (UFW)
echo -e "${C_CYAN}[2/6] Memeriksa & membuka port firewall (80, 443, 22)...${C_RESET}"
if command -v ufw &> /dev/null && $SUDO ufw status | grep -q "Status: active"; then
    echo "Membuka port 80 (HTTP), 443 (HTTPS), dan 22 (SSH)..."
    $SUDO ufw allow 22/tcp
    $SUDO ufw allow 80/tcp
    $SUDO ufw allow 443/tcp
    $SUDO ufw allow 443/udp
    $SUDO ufw reload
    echo -e "${C_GREEN}✓ Firewall berhasil dikonfigurasi.${C_RESET}"
else
    echo -e "${C_GREEN}✓ UFW tidak aktif / port terbuka.${C_RESET}"
fi

# 4. Check DNS Resolution for Domain
echo -e "${C_CYAN}[3/6] Memeriksa DNS Record untuk ${DOMAIN}...${C_RESET}"
SERVER_IP=$(curl -4 -s https://ifconfig.me || curl -4 -s https://api.ipify.org || echo "unknown")
echo "IP Publik Server ini: ${SERVER_IP}"

DOMAIN_IP=$(getent ahosts "${DOMAIN}" 2>/dev/null | awk '{print $1}' | head -n 1 || echo "")
if [ -n "$DOMAIN_IP" ]; then
    echo "IP Domain ${DOMAIN}: ${DOMAIN_IP}"
    if [ "$DOMAIN_IP" = "$SERVER_IP" ]; then
        echo -e "${C_GREEN}✓ DNS Record TERHUBUNG SEMPURNA ke server ini!${C_RESET}"
    else
        echo -e "${C_YELLOW}⚠️ PERHATIAN: Domain ${DOMAIN} mengarah ke ${DOMAIN_IP}, sedangkan server ini ${SERVER_IP}.${C_RESET}"
        echo -e "${C_YELLOW}   Pastikan DNS A Record di penyedia domain Anda sudah mengarah ke ${SERVER_IP}.${C_RESET}"
    fi
else
    echo -e "${C_YELLOW}⚠️ Domain ${DOMAIN} belum dapat di-resolve atau DNS sedang proses propagasi.${C_RESET}"
    echo -e "${C_YELLOW}   Caddy akan otomatis menerbitkan SSL begitu DNS mengarah ke IP ${SERVER_IP}.${C_RESET}"
fi

# 5. Generate Environment Configuration (.env)
echo -e "${C_CYAN}[4/6] Menyiapkan file konfigurasi lingkungan (.env)...${C_RESET}"
cd "$APP_DIR"

if [ ! -f .env ]; then
    echo "Membuat .env baru dari .env.example..."
    cp .env.example .env
    
    # Generate secure cryptographically random keys
    RANDOM_JWT=$(openssl rand -hex 32 2>/dev/null || tr -dc A-Za-z0-9 </dev/urandom | head -c 64)
    RANDOM_API_KEY=$(openssl rand -hex 24 2>/dev/null || tr -dc A-Za-z0-9 </dev/urandom | head -c 48)
    
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=${RANDOM_JWT}/" .env
    sed -i "s/API_KEY=.*/API_KEY=${RANDOM_API_KEY}/" .env
    echo -e "${C_GREEN}✓ File .env dibuat dengan Secret Key terenkripsi aman.${C_RESET}"
else
    echo -e "${C_GREEN}✓ File .env sudah ada (tidak di-overwrite).${C_RESET}"
fi

# 6. Build & Launch Docker Containers
echo -e "${C_CYAN}[5/6] Membangun dan menjalankan kontainer Docker...${C_RESET}"
$SUDO docker compose pull || true
$SUDO docker compose down --remove-orphans || true
$SUDO docker compose up -d --build

# 7. Wait & Verify Health Check
echo -e "${C_CYAN}[6/6] Memverifikasi status aplikasi & kesehatan sistem...${C_RESET}"
echo "Menunggu inisialisasi database dan reverse proxy (12 detik)..."
sleep 12

HEALTH_CHECK_URL="http://127.0.0.1/api/health"
RETRIES=10
SUCCESS=false

for i in $(seq 1 $RETRIES); do
    if curl -sf "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
        SUCCESS=true
        break
    fi
    echo "Mencoba kembali verifikasi healthcheck ($i/$RETRIES)..."
    sleep 3
done

echo ""
if [ "$SUCCESS" = true ]; then
    echo -e "${C_GREEN}${C_BOLD}"
    echo "====================================================================="
    echo "  🎉 DEPLOYMENT SUKSES! SISTEM Q-GUARD AKTIF & BERJALAN"
    echo "====================================================================="
    echo -e "${C_RESET}"
    echo -e "  🌐 Portal Utama    : ${C_BOLD}https://${DOMAIN}${C_RESET}"
    echo -e "  📊 API Health      : ${C_BOLD}https://${DOMAIN}/api/health${C_RESET}"
    echo -e "  🔒 Kredensial Demo : ${C_BOLD}admin / admin123${C_RESET}"
    echo -e "  📡 ESP32 Endpoint  : ${C_BOLD}https://${DOMAIN}/api/sensor-data${C_RESET}"
    echo ""
    echo -e "${C_CYAN}Informasi SSL/TLS:${C_RESET}"
    echo "  Caddy secara otomatis mengelola sertifikat TLS Let's Encrypt / ZeroSSL"
    echo "  untuk domain ${DOMAIN} & www.${DOMAIN} dengan auto-renewal."
    echo ""
    echo -e "${C_CYAN}Perintah Berguna:${C_RESET}"
    echo "  - Cek log sistem   : docker compose logs -f"
    echo "  - Cek status container: docker compose ps"
    echo "  - Restart sistem   : docker compose restart"
    echo "  - Stop sistem      : docker compose down"
else
    echo -e "${C_YELLOW}${C_BOLD}"
    echo "====================================================================="
    echo "  ⚠️ SISTEM SEDANG MEMULAI (CONTAINER RUNNING)"
    echo "====================================================================="
    echo -e "${C_RESET}"
    echo "Kontainer Docker telah aktif, silakan periksa log dengan perintah:"
    echo "  docker compose ps"
    echo "  docker compose logs -f"
fi
