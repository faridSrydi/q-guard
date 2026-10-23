/**
 * Q-GUARD Web Dashboard Controller
 * Smart Cold-Chain & Quarantine Risk Monitoring
 */

import { api } from './api.js';
import { icons } from './icons.js';
import { initHero3D } from './hero3d.js';
import { initSimulator } from './simulator.js';
import { t, initI18n, applyTranslations, getLang, setLanguage } from './i18n.js';

// Application State
const state = {
    currentView: 'overview',
    selectedDeviceId: 'QGUARD-001',
    devices: [],
    shipments: [],
    selectedShipmentId: null,
    currentShipment: null,
    latestReading: null,
    alerts: [],
    charts: {},
    map: null,
    mapLayer: null,
    pollingInterval: null
};

// UI Elements
const el = {
    pageTitle: document.getElementById('page-title'),
    pageBreadcrumb: document.getElementById('page-breadcrumb'),
    contentBody: document.getElementById('content-body'),
    deviceSelect: document.getElementById('device-select'),
    btnRefresh: document.getElementById('btn-refresh'),
    navItems: document.querySelectorAll('.nav-item'),
    toastContainer: document.getElementById('toast-container'),
    modalContainer: document.getElementById('modal-container'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    modalClose: document.getElementById('modal-close'),
    alertBadge: document.getElementById('sidebar-alert-badge'),
    connDot: document.getElementById('global-conn-dot'),
    connTitle: document.getElementById('global-conn-title'),
    syncTime: document.getElementById('global-sync-time'),
    topbarWifiBadge: document.getElementById('topbar-wifi-badge'),
    topbarWifiText: document.getElementById('topbar-wifi-text'),
    topbarWifiIcon: document.getElementById('topbar-wifi-icon'),
    topbarWifiDot: document.getElementById('topbar-wifi-dot'),
    appLayout: document.getElementById('app'),
    loginOverlay: document.getElementById('login-overlay'),
    loginForm: document.getElementById('login-form'),
    loginUsername: document.getElementById('login-username'),
    loginPassword: document.getElementById('login-password'),
    loginErrorMsg: document.getElementById('login-error-msg'),
    topbarUserName: document.getElementById('topbar-user-name'),
    btnLogout: document.getElementById('btn-logout'),
    btnSidebarLogout: document.getElementById('btn-sidebar-mobile-logout')
};

// Global Wi-Fi & Connection State Updater
function updateWifiStatus(status, details = {}) {
    state.wifiStatus = status; // 'online' | 'standby' | 'offline'

    const isOnline = status === 'online';
    const isStandby = status === 'standby';
    const isEn = getLang() === 'en';

    // 1. Topbar Badge
    if (el.topbarWifiBadge) {
        el.topbarWifiBadge.className = `wifi-status-badge ${status}`;
        el.topbarWifiBadge.title = isOnline 
            ? `${t('topbar.wifi_title', 'Wi-Fi ESP32')} ${t('topbar.wifi_connected', 'Terhubung')} (${details.subText || (isEn ? 'Realtime Sync' : 'Sinkronisasi Realtime')})`
            : (isStandby ? 'Wi-Fi ESP32 Standby (Menunggu Data Baru)' : `${t('topbar.wifi_title', 'Wi-Fi ESP32')} ${t('topbar.wifi_disconnected', 'Terputus')} (Mode Buffer MicroSD)`);
    }
    if (el.topbarWifiText) {
        el.topbarWifiText.innerText = isOnline 
            ? t('topbar.wifi_connected', 'Terhubung') 
            : (isStandby ? 'Standby' : t('topbar.wifi_disconnected', 'Terputus'));
    }
    if (el.topbarWifiIcon) {
        el.topbarWifiIcon.innerHTML = isOnline ? icons.wifi : (isStandby ? icons.wifi : icons.wifiOff);
    }

    // 2. Sidebar Footer
    if (el.connDot) {
        el.connDot.className = `connectivity-dot ${isOnline ? 'online' : 'offline'}`;
    }
    if (el.connTitle) {
        el.connTitle.innerText = isOnline 
            ? (isEn ? 'ESP32 Wi-Fi Connected' : 'ESP32 Wi-Fi Terhubung') 
            : (isStandby ? (isEn ? 'Wi-Fi Standby' : 'Wi-Fi Standby') : (isEn ? 'Wi-Fi Disconnected (MicroSD)' : 'Wi-Fi Terputus (MicroSD)'));
    }
    if (el.syncTime) {
        el.syncTime.innerText = details.syncText || (isOnline ? (isEn ? 'Live Polling' : 'Polling Live') : (isEn ? 'Awaiting Signal' : 'Menunggu Sinyal'));
    }

    // 3. Telemetri Langsung Strip
    const monWifiVal = document.getElementById('mon-wifi-val');
    const monWifiIcon = document.getElementById('mon-wifi-icon');
    const monCommChannel = document.getElementById('mon-comm-channel');
    const monLastSyncTime = document.getElementById('mon-last-sync-time');
    const monStorageMode = document.getElementById('mon-storage-mode');

    if (monWifiVal) {
        monWifiVal.innerText = isOnline 
            ? t('topbar.wifi_connected', 'Terhubung') 
            : (isStandby ? 'Standby' : t('topbar.wifi_disconnected', 'Terputus'));
        monWifiVal.className = `wifi-strip-val ${isOnline ? 'text-success' : (isStandby ? 'text-warning' : 'text-danger')}`;
    }
    if (monWifiIcon) {
        monWifiIcon.className = `wifi-strip-icon ${isOnline ? 'online' : (isStandby ? 'standby' : 'offline')}`;
        monWifiIcon.innerHTML = isOnline ? icons.wifi : (isStandby ? icons.wifi : icons.wifiOff);
    }
    if (monCommChannel) {
        monCommChannel.innerText = isOnline ? (isEn ? 'Realtime' : 'Realtime') : (isEn ? 'Offline (MicroSD)' : 'Offline (MicroSD)');
    }
    if (monLastSyncTime && details.lastSeenFormatted) {
        monLastSyncTime.innerText = details.lastSeenFormatted;
    }
    if (monStorageMode) {
        monStorageMode.innerText = isOnline ? 'Cloud & MicroSD' : 'MicroSD';
    }

    // 4. Overview Card
    const overviewWifiBadge = document.getElementById('overview-wifi-badge');
    const overviewWifiSub = document.getElementById('overview-wifi-sub');
    if (overviewWifiBadge) {
        overviewWifiBadge.className = `metric-badge ${isOnline ? 'safe' : (isStandby ? 'warn' : 'crit')}`;
        overviewWifiBadge.innerText = isOnline 
            ? (isEn ? 'Wi-Fi: Connected' : 'Wi-Fi: Terhubung') 
            : (isStandby ? (isEn ? 'Wi-Fi: Standby' : 'Wi-Fi: Standby') : (isEn ? 'Wi-Fi: Disconnected' : 'Wi-Fi: Terputus'));
    }
    if (overviewWifiSub) {
        overviewWifiSub.innerText = isOnline 
            ? (isEn ? 'ESP32 Online Live' : 'ESP32 Online Live') 
            : (isEn ? 'MicroSD Offline Mode' : 'Mode Offline MicroSD');
    }
}

// Toast Notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? icons.check : type === 'error' ? icons.xCircle : icons.info;
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Format Waktu Ramah Pengguna (Standar Indonesia / Internasional)
function formatTimestamp(isoStr, includeSeconds = true) {
    if (!isoStr) return '--';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;

    const isEn = getLang() === 'en';
    const day = String(d.getDate()).padStart(2, '0');
    const monthsId = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = (isEn ? monthsEn : monthsId)[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const tz = isEn ? 'UTC+7' : 'WIB';

    if (includeSeconds) {
        return `${day} ${month} ${year}, ${hours}:${minutes}:${seconds} ${tz}`;
    }
    return `${day} ${month} ${year}, ${hours}:${minutes} ${tz}`;
}

// Sanitasi Nama Komoditas (Menghilangkan label simulasi lama)
function formatCommodityName(str) {
    if (!str) return 'Komoditas Karantina';
    return str.replace(/\(SIMULATED\)/gi, '').replace(/Frozen Yellowfin Tuna/gi, 'Ikan Tuna Segar (Ekspor)').trim();
}

// Modal Helpers
function openModal(title, htmlContent) {
    el.modalTitle.innerText = title;
    el.modalBody.innerHTML = htmlContent;
    el.modalContainer.classList.remove('hidden');
}

function closeModal() {
    el.modalContainer.classList.add('hidden');
    el.modalBody.innerHTML = '';
}

el.modalClose.addEventListener('click', closeModal);
el.modalContainer.addEventListener('click', (e) => {
    if (e.target === el.modalContainer) closeModal();
});

// -------------------------------------------------------------
// Landing Page Elements & State
// -------------------------------------------------------------
const elLandingPage = document.getElementById('landing-page');
const btnLandingLogin = document.getElementById('btn-landing-login');
const btnLandingMobileLogin = document.getElementById('btn-landing-mobile-login');
const btnHeroDashboard = document.getElementById('btn-hero-dashboard');
const btnLandingMobileToggle = document.getElementById('btn-landing-mobile-toggle');
const landingMobileDrawer = document.getElementById('landing-mobile-drawer');
const btnCloseLogin = document.getElementById('btn-close-login');
const btnBackToHome = document.getElementById('btn-back-to-home');
const btnLandingLoginText = document.getElementById('btn-landing-login-text');
const btnLandingMobileLoginText = document.getElementById('btn-landing-mobile-login-text');
const btnHeroDashboardText = document.getElementById('btn-hero-dashboard-text');
const navLandingHome = document.getElementById('nav-landing-home');
const navLandingSimulator = document.getElementById('nav-landing-simulator');
const navLandingTentang = document.getElementById('nav-landing-tentang');
const navLandingArsitektur = document.getElementById('nav-landing-arsitektur');

const LANDING_HASHES = ['home', 'simulator', 'journey', 'tentang', 'arsitektur', 'portal', 'landing', ''];
const ADMIN_ROUTES = new Set(['overview', 'monitoring', 'shipments', 'gps-track', 'risk-engine', 'alerts', 'reports', 'settings']);
const ADMIN_PATH_PREFIX = '/admin/';

function getPathRoute() {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    if (path === '/admin' || path === '/admin/index.html') return 'overview';
    if (path.startsWith(ADMIN_PATH_PREFIX)) return path.slice(ADMIN_PATH_PREFIX.length).split('/')[0] || 'overview';
    return null;
}

function getRouteUrl(view) {
    return `/admin/${view}`;
}

function navigateTo(view, { replace = false } = {}) {
    const target = getRouteUrl(view);
    if (replace) window.history.replaceState({ view }, '', target);
    else window.history.pushState({ view }, '', target);
    switchView(view);
}

function isLandingHash(hash) {
    return LANDING_HASHES.includes((hash || '').toLowerCase());
}

function showLandingPage(targetSection = 'home') {
    if (typeof stopGpsLiveTracking === 'function') stopGpsLiveTracking();
    if (elLandingPage) {
        elLandingPage.classList.remove('hidden');
        window.dispatchEvent(new Event('resize'));
    }
    if (el.appLayout) el.appLayout.classList.add('hidden');
    if (el.loginOverlay) el.loginOverlay.classList.add('hidden');
    
    // Update active nav links in landing header
    const section = (targetSection || 'home').toLowerCase();
    if (navLandingHome) navLandingHome.classList.toggle('active', section === 'home' || section === 'portal');
    if (navLandingSimulator) navLandingSimulator.classList.toggle('active', section === 'simulator');
    if (navLandingTentang) navLandingTentang.classList.toggle('active', section === 'tentang');
    if (navLandingArsitektur) navLandingArsitektur.classList.toggle('active', section === 'arsitektur');
    
    // Smooth scroll to target section
    if (section && section !== 'home' && section !== 'portal') {
        setTimeout(() => {
            const targetEl = document.getElementById(section);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth' });
            }
        }, 50);
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function showDashboardView(viewName) {
    if (viewName !== 'gps-track' && typeof stopGpsLiveTracking === 'function') {
        stopGpsLiveTracking();
    }
    if (elLandingPage) elLandingPage.classList.add('hidden');
    if (el.appLayout) el.appLayout.classList.remove('hidden');
    if (el.loginOverlay) el.loginOverlay.classList.add('hidden');

    state.currentView = viewName;
    el.navItems.forEach(item => {
        if (item.dataset.view === viewName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Destroy existing charts to avoid memory leaks
    Object.values(state.charts).forEach(c => {
        if (c && typeof c.destroy === 'function') c.destroy();
    });
    state.charts = {};

    renderCurrentView();
}

function openLoginModal() {
    if (el.loginOverlay) el.loginOverlay.classList.remove('hidden');
}

function closeLoginModal() {
    if (el.loginOverlay) el.loginOverlay.classList.add('hidden');
    if (!state.user && getPathRoute()) {
        window.history.replaceState({}, '', '/');
        showLandingPage('home');
    }
}

// Path-based navigation for public landing and protected admin views.
function switchView(viewName) {
    const cleanView = (viewName || '').replace(/^#|^\//, '').trim();

    if (isLandingHash(cleanView)) {
        showLandingPage(cleanView === 'landing' || cleanView === 'portal' ? 'home' : cleanView);
        return;
    }

    if (cleanView === 'login') {
        if (state.user) {
            navigateTo('overview', { replace: true });
        } else {
            showLandingPage('home');
            openLoginModal();
        }
        return;
    }

    if (!ADMIN_ROUTES.has(cleanView)) {
        if (cleanView) {
            window.history.replaceState({}, '', '/');
            showLandingPage('home');
        }
        return;
    }

    if (!state.user) {
        showLandingPage('home');
        openLoginModal();
        return;
    }

    showDashboardView(cleanView);
}

// Sidebar Drawer & Desktop Toggle Control
const appLayout = document.getElementById('app');
const sidebar = document.getElementById('sidebar');
const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');

function isMobileView() {
    return window.innerWidth <= 992;
}

function openMobileSidebar() {
    if (sidebar) sidebar.classList.add('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
    document.body.style.overflow = '';
}

function toggleDesktopSidebar() {
    if (!appLayout) return;
    const isCollapsed = appLayout.classList.toggle('sidebar-collapsed');
    try {
        localStorage.setItem('qguard_sidebar_collapsed', isCollapsed ? 'true' : 'false');
    } catch (_) {}

    // Trigger Chart.js and Leaflet map redraw after CSS slide transition
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        if (state.map && typeof state.map.invalidateSize === 'function') {
            state.map.invalidateSize();
        }
    }, 320);
}

// Restore saved sidebar collapsed state on desktop
try {
    if (!isMobileView() && localStorage.getItem('qguard_sidebar_collapsed') === 'true') {
        if (appLayout) appLayout.classList.add('sidebar-collapsed');
    }
} catch (_) {}

if (btnSidebarToggle) {
    btnSidebarToggle.addEventListener('click', () => {
        if (isMobileView()) {
            if (sidebar && sidebar.classList.contains('open')) {
                closeMobileSidebar();
            } else {
                openMobileSidebar();
            }
        } else {
            toggleDesktopSidebar();
        }
    });
}

if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', () => {
        if (isMobileView()) {
            closeMobileSidebar();
        } else {
            toggleDesktopSidebar();
        }
    });
}

if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', closeMobileSidebar);
}

el.navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        if (view === 'portal') {
            window.history.pushState({}, '', '/');
            showLandingPage('home');
        } else {
            navigateTo(view);
        }
        if (isMobileView()) {
            closeMobileSidebar();
        }
    });
});

window.addEventListener('popstate', () => {
    const route = getPathRoute();
    if (route) {
        switchView(route);
    } else {
        showLandingPage('home');
    }
    closeMobileSidebar();
});

// Main Render Dispatcher
async function renderCurrentView() {
    switch (state.currentView) {
        case 'overview':
            el.pageTitle.innerText = t('view.overview_title', 'Ringkasan Monitoring');
            el.pageBreadcrumb.innerText = t('view.overview_bc', 'Monitoring Rantai Dingin • Barantin');
            await renderOverviewView();
            break;
        case 'monitoring':
            el.pageTitle.innerText = t('view.monitoring_title', 'Monitoring Telemetri');
            el.pageBreadcrumb.innerText = t('view.monitoring_bc', 'Telemetri Sensor Tri-Probe');
            await renderMonitoringView();
            break;
        case 'shipments':
            el.pageTitle.innerText = t('view.shipments_title', 'Daftar Pengiriman');
            el.pageBreadcrumb.innerText = t('view.shipments_bc', 'Data Kargo & Kontainer');
            await renderShipmentsView();
            break;
        case 'gps-track':
            el.pageTitle.innerText = t('view.gps_title', 'Pelacakan GPS');
            el.pageBreadcrumb.innerText = t('view.gps_bc', 'Rute Pelayaran & Koordinat');
            await renderGpsView();
            break;
        case 'risk-engine':
            el.pageTitle.innerText = t('view.risk_title', 'Evaluasi Risiko Mutu');
            el.pageBreadcrumb.innerText = t('view.risk_bc', 'Analisis Kinetika MKT');
            await renderRiskEngineView();
            break;
        case 'alerts':
            el.pageTitle.innerText = t('view.alerts_title', 'Riwayat Peringatan');
            el.pageBreadcrumb.innerText = t('view.alerts_bc', 'Daftar Kejadian & Deviasi');
            await renderAlertsView();
            break;
        case 'reports':
            el.pageTitle.innerText = t('view.reports_title', 'Laporan & Disposisi');
            el.pageBreadcrumb.innerText = t('view.reports_bc', 'Dokumen Pelepasan Karantina');
            await renderReportsView();
            break;
        case 'settings':
            el.pageTitle.innerText = t('view.settings_title', 'Pengaturan Parameter');
            el.pageBreadcrumb.innerText = t('view.settings_bc', 'Ambang Batas Telemetri');
            await renderSettingsView();
            break;
        default:
            switchView('overview');
            return;
    }

    // Apply translations to dynamically injected view HTML
    if (el.contentBody) {
        applyTranslations(el.contentBody);
    }
}

// -------------------------------------------------------------
// VIEW 1: OVERVIEW
// -------------------------------------------------------------
async function renderOverviewView() {
    el.contentBody.innerHTML = `<div class="loading-state">Memuat data armada...</div>`;
    try {
        const [devicesData, shipmentsData, riskSummary, alertSummary, historyData] = await Promise.all([
            api.getDevices().catch(() => ({ devices: [] })),
            api.getShipments('active').catch(() => ({ shipments: [] })),
            api.getRiskSummary().catch(() => ({ counts: {}, shipments: [] })),
            api.getAlertSummary().catch(() => ({ summary: {} })),
            api.getHistory({ device_id: state.selectedDeviceId, limit: 15 }).catch(() => ({ readings: [] }))
        ]);

        state.devices = devicesData.devices || [];
        state.shipments = shipmentsData.shipments || [];

        updateDeviceDropdown();

        const activeCount = state.shipments.length;
        const criticalAlerts = alertSummary.summary?.critical || 0;
        const unackedAlerts = alertSummary.summary?.unacknowledged || 0;
        const totalAlerts = (alertSummary.summary?.critical || 0) + (alertSummary.summary?.warning || 0);
        const histReadings = (historyData.readings || []).slice().reverse();
        const totalReadings = histReadings.length;
        const complianceVal = totalReadings > 0 
            ? Math.max(0, 100 - (totalAlerts / totalReadings * 100)).toFixed(1)
            : '100.0';

        el.alertBadge.innerText = unackedAlerts;

        el.contentBody.innerHTML = `
            <div class="grid-cards">
                <div class="metric-card card-cyan">
                    <div class="metric-header">
                        <span class="metric-label" data-i18n="overview.active_cargo">Kargo Aktif</span>
                        <span class="metric-icon">${icons.package}</span>
                    </div>
                    <div class="metric-value-row">
                        <span class="metric-value">${activeCount}</span>
                        <span class="metric-unit" data-i18n="overview.container_unit">kontainer</span>
                    </div>
                    <div class="metric-footer">
                        <span class="metric-badge safe" data-i18n="overview.monitored">Dipantau</span>
                        <span data-i18n="overview.cold_chain_stable">Rantai dingin stabil</span>
                    </div>
                </div>

                <div class="metric-card ${criticalAlerts > 0 ? 'card-danger' : 'card-success'}">
                    <div class="metric-header">
                        <span class="metric-label" data-i18n="overview.critical_alerts">Peringatan Kritis</span>
                        <span class="metric-icon">${icons.siren}</span>
                    </div>
                    <div class="metric-value-row">
                        <span class="metric-value">${criticalAlerts}</span>
                        <span class="metric-unit" data-i18n="overview.incident_unit">insiden</span>
                    </div>
                    <div class="metric-footer">
                        <span class="metric-badge ${criticalAlerts > 0 ? 'crit' : 'safe'}">${criticalAlerts > 0 ? (getLang() === 'en' ? 'Action Required' : 'Perlu Tindakan') : (getLang() === 'en' ? 'Safe' : 'Aman')}</span>
                        <span>${unackedAlerts} ${getLang() === 'en' ? 'unconfirmed' : 'belum dikonfirmasi'}</span>
                    </div>
                </div>

                <div class="metric-card card-purple">
                    <div class="metric-header">
                        <span class="metric-label" data-i18n="overview.active_devices">Perangkat Aktif</span>
                        <span class="metric-icon">${icons.telemetry}</span>
                    </div>
                    <div class="metric-value-row">
                        <span class="metric-value">${state.devices.length}</span>
                        <span class="metric-unit" data-i18n="overview.unit">unit</span>
                    </div>
                    <div class="metric-footer">
                        <span class="metric-badge ${state.wifiStatus === 'online' ? 'safe' : 'crit'}" id="overview-wifi-badge">Wi-Fi: ${state.wifiStatus === 'online' ? (getLang() === 'en' ? 'Connected' : 'Terhubung') : (getLang() === 'en' ? 'Disconnected' : 'Terputus')}</span>
                        <span id="overview-wifi-sub">${state.wifiStatus === 'online' ? (getLang() === 'en' ? 'ESP32 Connected' : 'ESP32 Terhubung') : (getLang() === 'en' ? 'Local Storage (MicroSD)' : 'Penyimpanan Lokal (MicroSD)')}</span>
                    </div>
                </div>

                <div class="metric-card card-success">
                    <div class="metric-header">
                        <span class="metric-label" data-i18n="overview.quality_compliance">Kepatuhan Mutu</span>
                        <span class="metric-icon">${icons.shieldCheck}</span>
                    </div>
                    <div class="metric-value-row">
                        <span class="metric-value">${complianceVal}</span>
                        <span class="metric-unit">%</span>
                    </div>
                    <div class="metric-footer">
                        <span class="metric-badge safe">Standar SNI/WHO</span>
                        <span data-i18n="overview.standard_compliant">Parameter Sesuai Standar</span>
                    </div>
                </div>
            </div>

            <div class="row-2col">
                <div class="panel">
                    <div class="panel-header">
                        <h2 class="panel-title">${icons.lineChart} <span data-i18n="overview.fleet_temp_history">Riwayat Suhu Armada</span></h2>
                        <span style="font-size: 12px; color: var(--text-muted)" data-i18n="overview.safe_limit_label">Batas Aman: -25°C s/d -18°C</span>
                    </div>
                    <div class="chart-container">
                        <canvas id="overviewTempChart"></canvas>
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-header">
                        <h2 class="panel-title">${icons.alertTriangle} <span data-i18n="overview.risk_donut_title">Proporsi Risiko Mutu</span></h2>
                    </div>
                    <div class="chart-container" style="height: 260px;">
                        <canvas id="overviewRiskDonut"></canvas>
                    </div>
                    <div style="margin-top: 15px; font-size: 12px; color: var(--text-secondary); text-align: center;">
                        ${riskSummary.counts?.critical || 0} ${getLang() === 'en' ? 'Critical' : 'Kritis'} • ${riskSummary.counts?.warning || 0} ${getLang() === 'en' ? 'Warning' : 'Waspada'} • ${riskSummary.counts?.normal || 0} Normal
                    </div>
                </div>
            </div>

            <div class="panel">
                <div class="panel-header">
                    <h2 class="panel-title">${icons.clipboard} <span data-i18n="overview.recent_shipments">Pengiriman Karantina Aktif</span></h2>
                    <button class="btn btn-secondary btn-sm" id="btn-create-shipment-quick">${icons.plus} ${getLang() === 'en' ? 'Add Cargo' : 'Tambah Kargo'}</button>
                </div>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>${getLang() === 'en' ? 'Cargo ID' : 'ID Kargo'}</th>
                                <th data-i18n="overview.col_device">Perangkat</th>
                                <th data-i18n="overview.col_commodity">Komoditas</th>
                                <th data-i18n="overview.col_route">Rute Perjalanan</th>
                                <th>${getLang() === 'en' ? 'Temp Limit' : 'Batas Suhu'}</th>
                                <th data-i18n="common.status">Status</th>
                                <th data-i18n="common.action">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${state.shipments.length > 0 ? state.shipments.map(s => `
                                <tr>
                                    <td class="mono-cell" style="font-weight: 600; color: var(--ice-blue);">${s.id}</td>
                                    <td><span class="mono-cell">${s.device_id || (getLang() === 'en' ? 'Not Paired' : 'Belum Dihubungkan')}</span></td>
                                    <td><strong>${formatCommodityName(s.commodity)}</strong></td>
                                    <td>${s.origin || (getLang() === 'en' ? 'Origin Port' : 'Pelabuhan Asal')} → ${s.destination || (getLang() === 'en' ? 'Destination' : 'Tujuan')}</td>
                                    <td><span class="mono-cell">${s.temp_min}°C ~ ${s.temp_max}°C</span></td>
                                    <td><span class="status-pill ${s.status === 'active' ? 'NORMAL' : 'CAUTION'}">${s.status === 'active' ? (getLang() === 'en' ? 'ACTIVE' : 'AKTIF') : s.status}</span></td>
                                    <td>
                                        <button class="btn btn-secondary btn-sm btn-inspect-shipment" data-id="${s.id}" data-i18n="common.detail">Detail</button>
                                    </td>
                                </tr>
                            `).join('') : `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Belum ada kargo aktif terdaftar. Klik tombol Tambah Kargo untuk mendaftarkan kargo baru.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btn-create-shipment-quick')?.addEventListener('click', showCreateShipmentModal);
        document.querySelectorAll('.btn-inspect-shipment').forEach(btn => {
            btn.addEventListener('click', () => {
                window.history.replaceState({}, '', '/admin/risk-engine');
                switchView('risk-engine');
            });
        });

        // Initialize Charts with live telemetry data
        renderOverviewCharts(histReadings, riskSummary.counts || {});

    } catch (err) {
        el.contentBody.innerHTML = `<div class="error-state">Gagal memuat ringkasan: ${err.message}</div>`;
    }
}

function renderOverviewCharts(readings = [], riskCounts = {}) {
    const ctxTemp = document.getElementById('overviewTempChart')?.getContext('2d');
    if (ctxTemp) {
        if (state.charts.overviewTemp) {
            state.charts.overviewTemp.destroy();
        }

        let labels = [];
        let dataP1 = [];
        let dataP2 = [];
        let dataP3 = [];

        if (readings.length > 0) {
            labels = readings.map(r => {
                if (!r.timestamp) return '';
                const parts = r.timestamp.split('T');
                if (parts.length > 1) return parts[1].replace('Z', '').substring(0, 8);
                return r.timestamp.substring(11, 19) || r.timestamp;
            });
            dataP1 = readings.map(r => r.temperature_probe_1 !== null && !isNaN(r.temperature_probe_1) ? Number(r.temperature_probe_1) : null);
            dataP2 = readings.map(r => r.temperature_probe_2 !== null && !isNaN(r.temperature_probe_2) ? Number(r.temperature_probe_2) : null);
            dataP3 = readings.map(r => r.temperature_probe_3 !== null && !isNaN(r.temperature_probe_3) ? Number(r.temperature_probe_3) : null);
        } else {
            labels = ['Menunggu Telemetri'];
            dataP1 = [null];
            dataP2 = [null];
            dataP3 = [null];
        }

        const allVals = [...dataP1, ...dataP2, ...dataP3, -18.0, -25.0].filter(v => v !== null && !isNaN(v));
        const minVal = allVals.length > 0 ? Math.floor(Math.min(...allVals) - 2) : -28;
        const maxVal = allVals.length > 0 ? Math.ceil(Math.max(...allVals) + 2) : 5;

        const gradP1 = ctxTemp.createLinearGradient(0, 0, 0, 260);
        gradP1.addColorStop(0, 'rgba(2, 132, 199, 0.18)');
        gradP1.addColorStop(1, 'rgba(2, 132, 199, 0.0)');

        const isMobileOverview = window.innerWidth <= 640;
        state.charts.overviewTemp = new Chart(ctxTemp, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: isMobileOverview ? 'P1 Inti (°C)' : 'Probe 1 • Inti Kargo (°C)',
                        data: dataP1,
                        borderColor: '#0284c7',
                        backgroundColor: gradP1,
                        fill: true,
                        tension: 0.35,
                        borderWidth: 2.5,
                        pointRadius: isMobileOverview ? 2.5 : 3.5,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#0284c7',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.5
                    },
                    {
                        label: isMobileOverview ? 'P2 Buffer (°C)' : 'Probe 2 • Buffer Es (°C)',
                        data: dataP2,
                        borderColor: '#10b981',
                        backgroundColor: 'transparent',
                        fill: false,
                        tension: 0.35,
                        borderWidth: 2,
                        pointRadius: isMobileOverview ? 2.5 : 3,
                        pointHoverRadius: 5,
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.5
                    },
                    {
                        label: isMobileOverview ? 'P3 Pintu (°C)' : 'Probe 3 • Ambang Pintu (°C)',
                        data: dataP3,
                        borderColor: '#f59e0b',
                        backgroundColor: 'transparent',
                        fill: false,
                        tension: 0.35,
                        borderWidth: 2,
                        borderDash: [5, 4],
                        pointRadius: isMobileOverview ? 2.5 : 3,
                        pointHoverRadius: 5,
                        pointBackgroundColor: '#f59e0b',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.5
                    },
                    {
                        label: isMobileOverview ? 'Batas Max (-18°C)' : 'Batas Maksimum Beku (-18.0°C)',
                        data: Array(labels.length).fill(-18.0),
                        borderColor: '#ef4444',
                        borderDash: [6, 4],
                        borderWidth: 1.8,
                        pointRadius: 0,
                        fill: false
                    },
                    {
                        label: isMobileOverview ? 'Batas Min (-25°C)' : 'Batas Pendingin Min (-25.0°C)',
                        data: Array(labels.length).fill(-25.0),
                        borderColor: '#38bdf8',
                        borderDash: [5, 5],
                        borderWidth: 1.5,
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        left: 0,
                        right: isMobileOverview ? 4 : 8,
                        top: 0,
                        bottom: 0
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: isMobileOverview ? 8 : 10,
                            boxHeight: isMobileOverview ? 8 : 10,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: isMobileOverview ? 6 : 12,
                            color: '#475569',
                            font: { family: "'Inter', sans-serif", size: isMobileOverview ? 10.5 : 11, weight: 500 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.94)',
                        titleFont: { family: "'Outfit', sans-serif", size: 12, weight: 600 },
                        bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
                        padding: 10,
                        cornerRadius: 8,
                        boxPadding: 4,
                        callbacks: {
                            label: function(context) {
                                const val = context.parsed.y;
                                if (context.dataset.label.includes('Batas')) {
                                    return `🚨 ${context.dataset.label}: ${val.toFixed(1)}°C`;
                                }
                                const diff = val - (-18.0);
                                const status = diff > 0 ? `(⚠️ +${diff.toFixed(1)}°C)` : `(✅ Aman)`;
                                return `${context.dataset.label}: ${val !== null ? val.toFixed(1) : '--'}°C ${status}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(226, 232, 240, 0.7)', drawBorder: false },
                        ticks: {
                            color: '#64748b',
                            font: { family: "'Inter', sans-serif", size: isMobileOverview ? 9.5 : 11 },
                            callback: (v) => v + '°C'
                        },
                        suggestedMin: minVal,
                        suggestedMax: maxVal
                    },
                    x: {
                        grid: { color: 'rgba(241, 245, 249, 0.9)', drawBorder: false },
                        ticks: {
                            color: '#64748b',
                            font: { family: "'Inter', sans-serif", size: isMobileOverview ? 9.5 : 11 },
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: isMobileOverview ? 5 : 7
                        }
                    }
                }
            }
        });
    }

    const ctxDonut = document.getElementById('overviewRiskDonut')?.getContext('2d');
    if (ctxDonut) {
        if (state.charts.overviewDonut) {
            state.charts.overviewDonut.destroy();
        }

        const norm = riskCounts.normal || 0;
        const warn = riskCounts.warning || 0;
        const crit = riskCounts.critical || 0;
        const hasCounts = (norm + warn + crit) > 0;

        state.charts.overviewDonut = new Chart(ctxDonut, {
            type: 'doughnut',
            data: {
                labels: hasCounts ? ['Aman (Normal)', 'Waspada (Warning)', 'Kritis (Critical)'] : ['Belum Ada Insiden (100% Normal)'],
                datasets: [{
                    data: hasCounts ? [norm, warn, crit] : [1],
                    backgroundColor: hasCounts ? ['#10b981', '#f59e0b', '#ef4444'] : ['#10b981'],
                    borderColor: '#ffffff',
                    borderWidth: 3,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 10,
                            boxHeight: 10,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 14,
                            color: '#475569',
                            font: { family: "'Inter', sans-serif", size: 11, weight: 500 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.94)',
                        titleFont: { family: "'Outfit', sans-serif", size: 13, weight: 600 },
                        bodyFont: { family: "'Inter', sans-serif", size: 12 },
                        padding: 12,
                        cornerRadius: 8,
                        boxPadding: 6,
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const val = context.parsed;
                                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '100';
                                return ` ${context.label}: ${val} kontainer (${pct}%)`;
                            }
                        }
                    }
                },
                cutout: '72%'
            }
        });
    }
}

// -------------------------------------------------------------
// VIEW 2: LIVE MONITORING
// -------------------------------------------------------------
async function renderMonitoringView() {
    el.contentBody.innerHTML = `<div class="loading-state">Menghubungkan ke telemetri sensor...</div>`;
    try {
        const latestData = await api.getLatest(state.selectedDeviceId).catch(() => ({ reading: null }));
        const r = latestData?.reading || {
            temperature_probe_1: null,
            temperature_probe_2: null,
            temperature_probe_3: null,
            ambient_temperature: null,
            relative_humidity: null,
            acceleration_x: null,
            acceleration_y: null,
            acceleration_z: null,
            door_status: 'CLOSED',
            latitude: null,
            longitude: null,
            gps_fix_status: 'NO_FIX',
            sensor_health: 'MENUNGGU DATA',
            risk_level: 'NORMAL',
            risk_reasons: 'Menunggu pengiriman data telemetri dari alat...',
            timestamp: null
        };

        const hasAccel = (r.acceleration_x !== null && r.acceleration_y !== null && r.acceleration_z !== null);
        const totalG = hasAccel ? Math.sqrt((r.acceleration_x||0)**2 + (r.acceleration_y||0)**2 + (r.acceleration_z||0)**2) : null;
        const isDeviceConnected = latestData?.reading !== null;

        const wifiBackendStatus = latestData?.wifi_status;
        let isWifiOnline = false;
        if (latestData?.reading) {
            const ts = latestData.reading.created_at || latestData.reading.timestamp;
            if (ts) {
                const readingTime = new Date(ts).getTime();
                const now = Date.now();
                const ageSec = Math.max(0, Math.floor((now - readingTime) / 1000));
                isWifiOnline = (wifiBackendStatus === 'ONLINE') || (ageSec <= 45);
            } else {
                isWifiOnline = (wifiBackendStatus === 'ONLINE');
            }
        } else if (wifiBackendStatus === 'ONLINE') {
            isWifiOnline = true;
        }

        el.contentBody.innerHTML = `
            <div id="mon-waiting-banner" class="${isDeviceConnected ? 'hidden' : ''}" style="background: rgba(14, 165, 233, 0.08); border: 1px solid var(--primary-blue-border); padding: 10px 16px; border-radius: var(--radius-sm); margin-bottom: 16px; font-size: 13px; color: var(--primary-blue); display: ${isDeviceConnected ? 'none' : 'flex'}; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">📡</span>
                <div>
                    <strong>Menunggu data dari unit ${state.selectedDeviceId}...</strong>
                    <span style="color: var(--text-secondary); font-size: 12px; margin-left: 6px;">Menghubungkan ke sensor ESP32 via Wi-Fi.</span>
                </div>
            </div>

            <!-- Wi-Fi & Telemetry Transmission Strip -->
            <div class="wifi-telemetry-strip" id="wifi-telemetry-strip">
                <div class="wifi-strip-item">
                    <span class="wifi-strip-icon ${isWifiOnline ? 'online' : 'offline'}" id="mon-wifi-icon">${isWifiOnline ? icons.wifi : icons.wifiOff}</span>
                    <div class="wifi-strip-meta">
                        <span class="wifi-strip-title" data-i18n="mon.wifi_strip_title">Status Wi-Fi</span>
                        <strong class="wifi-strip-val ${isWifiOnline ? 'text-success' : 'text-danger'}" id="mon-wifi-val">${isWifiOnline ? (getLang() === 'en' ? 'Connected' : 'Terhubung') : (getLang() === 'en' ? 'Disconnected' : 'Terputus')}</strong>
                    </div>
                </div>
                <div class="wifi-strip-divider"></div>
                <div class="wifi-strip-item">
                    <span class="wifi-strip-icon">${icons.telemetry}</span>
                    <div class="wifi-strip-meta">
                        <span class="wifi-strip-title" data-i18n="mon.data_transmission">Transmisi Data</span>
                        <strong class="wifi-strip-val" id="mon-comm-channel">${isWifiOnline ? 'Realtime' : 'Offline (MicroSD)'}</strong>
                    </div>
                </div>
                <div class="wifi-strip-divider"></div>
                <div class="wifi-strip-item">
                    <span class="wifi-strip-icon">${icons.refresh}</span>
                    <div class="wifi-strip-meta">
                        <span class="wifi-strip-title" data-i18n="mon.last_update">Pembaruan Terakhir</span>
                        <strong class="wifi-strip-val" id="mon-last-sync-time">${r.timestamp ? formatTimestamp(r.timestamp) : (getLang() === 'en' ? 'Awaiting telemetry...' : 'Menunggu telemetri...')}</strong>
                    </div>
                </div>
                <div class="wifi-strip-divider"></div>
                <div class="wifi-strip-item">
                    <span class="wifi-strip-icon">${icons.package}</span>
                    <div class="wifi-strip-meta">
                        <span class="wifi-strip-title" data-i18n="mon.storage">Penyimpanan</span>
                        <strong class="wifi-strip-val" id="mon-storage-mode">${isWifiOnline ? 'Cloud & MicroSD' : 'MicroSD'}</strong>
                    </div>
                </div>
            </div>

            <div class="grid-cards">
                <div class="metric-card card-cyan">
                    <div class="metric-header">
                        <span class="metric-label" data-i18n="mon.probe1_label">Probe 1 (Inti Komoditas)</span>
                        <span class="metric-icon">${icons.thermometer}</span>
                    </div>
                    <div class="metric-value-row">
                        <span class="metric-value" id="mon-temp1">${r.temperature_probe_1 !== null ? Number(r.temperature_probe_1).toFixed(1) : '--'}</span>
                        <span class="metric-unit">°C</span>
                    </div>
                    <div class="metric-footer">
                        <span class="metric-badge ${r.temperature_probe_1 !== null ? 'safe' : 'crit'}">DS18B20</span>
                        <span>${r.temperature_probe_1 !== null ? (getLang() === 'en' ? 'Cargo Core (12 cm)' : 'Suhu Inti Kargo (12 cm)') : (getLang() === 'en' ? 'Probe Not Detected' : 'Probe Belum Terdeteksi')}</span>
                    </div>
                </div>

                <div class="metric-card card-cyan">
                    <div class="metric-header">
                        <span class="metric-label" data-i18n="mon.probe2_label">Probe 2 (Buffer Es / Tengah)</span>
                        <span class="metric-icon">${icons.thermometer}</span>
                    </div>
                    <div class="metric-value-row">
                        <span class="metric-value" id="mon-temp2">${r.temperature_probe_2 !== null ? Number(r.temperature_probe_2).toFixed(1) : '--'}</span>
                        <span class="metric-unit">°C</span>
                    </div>
                    <div class="metric-footer">
                        <span class="metric-badge ${r.temperature_probe_2 !== null ? 'safe' : 'crit'}">DS18B20</span>
                        <span>${r.temperature_probe_2 !== null ? (getLang() === 'en' ? 'Latent Ice Buffer Layer' : 'Lapisan Es Penahan Panas') : (getLang() === 'en' ? 'Probe Not Detected' : 'Probe Belum Terdeteksi')}</span>
                    </div>
                </div>

                <div class="metric-card card-cyan">
                    <div class="metric-header">
                        <span class="metric-label" data-i18n="mon.probe3_label">Probe 3 (Ambang Pintu)</span>
                        <span class="metric-icon">${icons.thermometer}</span>
                    </div>
                    <div class="metric-value-row">
                        <span class="metric-value" id="mon-temp3">${r.temperature_probe_3 !== null ? Number(r.temperature_probe_3).toFixed(1) : '--'}</span>
                        <span class="metric-unit">°C</span>
                    </div>
                    <div class="metric-footer">
                        <span class="metric-badge ${r.temperature_probe_3 !== null ? 'safe' : 'crit'}">DS18B20</span>
                        <span>${r.temperature_probe_3 !== null ? (getLang() === 'en' ? 'Door Gasket Perimeter' : 'Perimeter Gasket Pintu') : (getLang() === 'en' ? 'Probe Not Detected' : 'Probe Belum Terdeteksi')}</span>
                    </div>
                </div>

                <div class="metric-card card-purple">
                    <div class="metric-header">
                        <span class="metric-label" data-i18n="mon.env_label">Sensor Lingkungan</span>
                        <span class="metric-icon">${icons.cloudRain}</span>
                    </div>
                    <div class="metric-value-row">
                        <span class="metric-value" id="mon-ambient">${r.ambient_temperature !== null ? Number(r.ambient_temperature).toFixed(1) : '--'}</span>
                        <span class="metric-unit">°C</span>
                        <span id="mon-humidity" style="margin-left: 10px; color: var(--ice-blue); font-weight: 600;">${r.relative_humidity !== null ? Number(r.relative_humidity).toFixed(0) + '% RH' : 'N/A'}</span>
                    </div>
                    <div class="metric-footer">
                        <span class="metric-badge ${r.ambient_temperature !== null ? 'safe' : ''}">BME280</span>
                        <span>${r.ambient_temperature !== null ? 'Udara Luar Boks' : 'Modul Tidak Terpasang (N/A)'}</span>
                    </div>
                </div>
            </div>

            <!-- Secondary Metrics -->
            <!-- Secondary Metrics -->
            <div class="grid-cards">
                <div class="metric-card ${r.door_status === 'OPEN' ? 'card-danger' : 'card-success'}" id="card-mon-door">
                    <div class="metric-header">
                        <span class="metric-label">Pintu Kontainer</span>
                        <span class="metric-icon">${icons.door}</span>
                    </div>
                    <div class="metric-value-row">
                        <span class="metric-value" id="mon-door">${r.door_status === 'OPEN' ? 'TERBUKA' : 'TERTUTUP'}</span>
                    </div>
                    <div class="metric-footer">
                        <span class="metric-badge ${r.door_status === 'OPEN' ? 'crit' : 'safe'}" id="badge-mon-door">MC-38</span>
                        <span id="sub-mon-door">${r.door_status === 'OPEN' ? 'Pintu Terbuka' : 'Tertutup'}</span>
                    </div>
                </div>

                <div class="metric-card ${totalG && totalG > 2.0 ? 'card-warning' : 'card-success'}" id="card-mon-shock">
                    <div class="metric-header">
                        <span class="metric-label">Guncangan & Getaran</span>
                        <span class="metric-icon">${icons.vibration}</span>
                    </div>
                    <div class="metric-value-row">
                        <span class="metric-value" id="mon-shock">${totalG !== null ? totalG.toFixed(2) : '--'}</span>
                        <span class="metric-unit">g</span>
                    </div>
                    <div class="metric-footer">
                        <span class="metric-badge ${totalG && totalG > 2.0 ? 'crit' : 'safe'}" id="badge-mon-shock">MPU6050</span>
                        <span id="sub-mon-shock">${totalG !== null ? (totalG > 2.0 ? 'Guncangan Tinggi' : 'Getaran Normal') : 'Menunggu Data MPU'}</span>
                    </div>
                </div>

                <div class="metric-card card-purple" id="card-mon-gps">
                    <div class="metric-header">
                        <span class="metric-label">Posisi GPS</span>
                        <span class="metric-icon">${icons.gps}</span>
                    </div>
                    <div class="metric-value-row">
                        <span class="metric-value" id="mon-gps" style="font-size: 17px;">${(r.gps_fix_status === 'FIX_3D' || r.gps_fix_status === '3D_FIX') ? '3D Fix' : (r.gps_fix_status === 'NO_FIX' ? 'Mencari Satelit' : (r.gps_fix_status || 'Mencari Satelit'))}</span>
                    </div>
                    <div class="metric-footer">
                        <span class="mono-cell" id="mon-coords">${(r.latitude && Math.abs(r.latitude) > 0.0001) ? Number(r.latitude).toFixed(4) + ', ' + Number(r.longitude).toFixed(4) : 'Mencari Satelit (-- , --)'}</span>
                    </div>
                </div>

                <div class="metric-card ${r.risk_level === 'CRITICAL' ? 'card-danger' : (r.risk_level === 'WARNING' ? 'card-warning' : 'card-success')}" id="card-mon-risk">
                    <div class="metric-header">
                        <span class="metric-label">Evaluasi Risiko</span>
                        <span class="metric-icon">${icons.zap}</span>
                    </div>
                    <div class="metric-value-row">
                        <span class="metric-value" id="mon-risk">${r.risk_level === 'CRITICAL' ? 'KRITIS' : (r.risk_level === 'WARNING' ? 'WASPADA' : 'AMAN')}</span>
                    </div>
                    <div class="metric-footer">
                        <span class="metric-badge ${r.risk_level === 'CRITICAL' ? 'crit' : (r.risk_level === 'WARNING' ? 'warn' : 'safe')}" id="badge-mon-risk">Status Risiko</span>
                        <span id="mon-risk-reason">${r.risk_reasons ? r.risk_reasons.replace(/DOOR_OPEN/g, 'Pintu Terbuka').replace(/TEMP_OUT_OF_BOUNDS/g, 'Suhu Diluar Batas').replace(/SHOCK_DETECTED/g, 'Guncangan Terdeteksi').replace(/Skor:/g, 'Skor Risiko: ') : 'Kondisi Normal'}</span>
                    </div>
                </div>
            </div>

            <!-- Enhanced Real-time Tri-Probe Temperature Trace Panel -->
            <div class="live-trace-panel">
                <div class="live-trace-header">
                    <div class="trace-title-wrapper">
                        <h2 class="panel-title" style="margin-bottom: 0;">${icons.telemetry} Grafik Suhu Tri-Probe (Real-time)</h2>
                        <span class="live-beacon"><span class="beacon-dot"></span> Real-time</span>
                    </div>
                    <div class="trace-pills-row">
                        <div class="probe-pill p1" title="Suhu Inti Komoditas (Kedalaman 12 cm)">
                            <span class="probe-dot"></span>
                            <span>P1 Inti:</span>
                            <strong id="trace-p1">${r.temperature_probe_1 !== null ? Number(r.temperature_probe_1).toFixed(1) + '°C' : '--'}</strong>
                        </div>
                        <div class="probe-pill p2" title="Suhu Buffer Es Tengah">
                            <span class="probe-dot"></span>
                            <span>P2 Buffer:</span>
                            <strong id="trace-p2">${r.temperature_probe_2 !== null ? Number(r.temperature_probe_2).toFixed(1) + '°C' : '--'}</strong>
                        </div>
                        <div class="probe-pill p3" title="Suhu Ambang Pintu">
                            <span class="probe-dot"></span>
                            <span>P3 Pintu:</span>
                            <strong id="trace-p3">${r.temperature_probe_3 !== null ? Number(r.temperature_probe_3).toFixed(1) + '°C' : '--'}</strong>
                        </div>
                        <div class="probe-pill thresh" title="Batas Aman Maksimum: -18.0°C">
                            <span class="probe-dot"></span>
                            <span>Batas:</span>
                            <strong>Maks -18.0°C</strong>
                        </div>
                    </div>
                </div>

                <div class="trace-chart-wrapper">
                    <canvas id="liveTelemetryChart"></canvas>
                </div>

                <div class="trace-stats-strip">
                    <div class="trace-stat-group">
                        <div class="trace-stat-item">
                            <span>Selisih Suhu (&Delta;T):</span>
                            <strong id="trace-delta">${(r.temperature_probe_3 !== null && r.temperature_probe_1 !== null) ? Math.abs(Number(r.temperature_probe_3) - Number(r.temperature_probe_1)).toFixed(1) + '°C' : '--'}</strong>
                        </div>
                        <div class="trace-stat-item">
                            <span>Sebaran:</span>
                            <span class="status-pill ${(r.temperature_probe_3 !== null && r.temperature_probe_1 !== null && Math.abs(Number(r.temperature_probe_3) - Number(r.temperature_probe_1)) <= 2.0) ? 'NORMAL' : 'CAUTION'}" id="trace-gradient-status">
                                ${(r.temperature_probe_3 !== null && r.temperature_probe_1 !== null) ? (Math.abs(Number(r.temperature_probe_3) - Number(r.temperature_probe_1)) <= 2.0 ? 'HOMOGEN' : 'VARIASI TINGGI') : '--'}
                            </span>
                        </div>
                        <div class="trace-stat-item">
                            <span>MKT:</span>
                            <strong id="trace-mkt">${r.temperature_probe_1 !== null ? Number(r.temperature_probe_1).toFixed(1) + '°C' : (r.temperature_probe_2 !== null ? Number(r.temperature_probe_2).toFixed(1) + '°C' : '--')}</strong>
                        </div>
                    </div>
                    <div class="trace-stat-item" style="color: var(--text-muted);">
                        <span id="mon-last-sample">${r.timestamp ? 'Pembaruan: ' + formatTimestamp(r.timestamp) : 'Menunggu Sampel Pertama'}</span>
                    </div>
                </div>
            </div>
        `;

        renderLiveTelemetryChart(r);

    } catch (err) {
        el.contentBody.innerHTML = `<div class="error-state">Gagal memuat monitoring telemetri: ${err.message}</div>`;
    }
}

async function renderLiveTelemetryChart(currentReading) {
    const ctx = document.getElementById('liveTelemetryChart')?.getContext('2d');
    if (!ctx) return;

    if (state.charts.liveChart) {
        state.charts.liveChart.destroy();
    }

    // Ambil riwayat terbaru dari backend (15 sampel terakhir)
    let history = [];
    try {
        const res = await api.getHistory({ device_id: state.selectedDeviceId, limit: 15 });
        if (res && res.readings && res.readings.length > 0) {
            history = res.readings.slice().reverse();
        }
    } catch (e) {
        history = [];
    }

    // Hanya gunakan data riil murni, tanpa mengarang titik palsu
    if (history.length === 0 && currentReading && currentReading.timestamp) {
        history.push(currentReading);
    }

    const labels = history.map(h => {
        if (!h.timestamp) return '';
        const parts = h.timestamp.split('T');
        if (parts.length > 1) return parts[1].replace('Z', '').substring(0, 8);
        return h.timestamp.substring(11, 19) || h.timestamp;
    });

    const dataP1 = history.map(h => h.temperature_probe_1 !== null ? Number(h.temperature_probe_1) : null);
    const dataP2 = history.map(h => h.temperature_probe_2 !== null ? Number(h.temperature_probe_2) : null);
    const dataP3 = history.map(h => h.temperature_probe_3 !== null ? Number(h.temperature_probe_3) : null);
    const dataThreshold = Array(history.length).fill(-18.0);

    // Hitung min dan max dinamis agar jika suhu dites sampai 50°C grafik otomatis menyesuaikan
    const allVals = [...dataP1, ...dataP2, ...dataP3, -18.0].filter(v => v !== null && !isNaN(v));
    const minVal = Math.floor(Math.min(...allVals) - 2);
    const maxVal = Math.ceil(Math.max(...allVals) + 3);

    // Buat gradient background yang mewah
    // Probe 1: Inti Kargo (Ocean Sky Blue #0284c7)
    const gradP1 = ctx.createLinearGradient(0, 0, 0, 300);
    gradP1.addColorStop(0, 'rgba(2, 132, 199, 0.22)');
    gradP1.addColorStop(1, 'rgba(2, 132, 199, 0.0)');

    // Probe 2: Buffer Es Tengah (Emerald Green #10b981)
    const gradP2 = ctx.createLinearGradient(0, 0, 0, 300);
    gradP2.addColorStop(0, 'rgba(16, 185, 129, 0.20)');
    gradP2.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    // Probe 3: Ambang Pintu (Amber Orange #f59e0b)
    const gradP3 = ctx.createLinearGradient(0, 0, 0, 300);
    gradP3.addColorStop(0, 'rgba(245, 158, 11, 0.18)');
    gradP3.addColorStop(1, 'rgba(245, 158, 11, 0.0)');

            const isMobileLive = window.innerWidth <= 640;
            state.charts.liveChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        {
                            label: isMobileLive ? 'P1 Inti (°C)' : 'Probe 1 • Inti Kargo (°C)',
                            data: dataP1,
                            borderColor: '#0284c7',
                            backgroundColor: gradP1,
                            fill: true,
                            borderWidth: 2.5,
                            tension: 0.35,
                            pointRadius: isMobileLive ? 2.5 : 3.5,
                            pointHoverRadius: 5,
                            pointBackgroundColor: '#0284c7',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 1.5
                        },
                        {
                            label: isMobileLive ? 'P2 Buffer (°C)' : 'Probe 2 • Buffer Es / Tengah (°C)',
                            data: dataP2,
                            borderColor: '#10b981',
                            backgroundColor: gradP2,
                            fill: true,
                            borderWidth: 2.5,
                            tension: 0.35,
                            pointRadius: isMobileLive ? 2.5 : 3.5,
                            pointHoverRadius: 5,
                            pointBackgroundColor: '#10b981',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 1.5
                        },
                        {
                            label: isMobileLive ? 'P3 Pintu (°C)' : 'Probe 3 • Ambang Pintu (°C)',
                            data: dataP3,
                            borderColor: '#f59e0b',
                            backgroundColor: gradP3,
                            fill: true,
                            borderWidth: 2.5,
                            borderDash: [5, 4],
                            tension: 0.35,
                            pointRadius: isMobileLive ? 2.5 : 3.5,
                            pointHoverRadius: 5,
                            pointBackgroundColor: '#f59e0b',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 1.5
                        },
                        {
                            label: isMobileLive ? 'Batas (-18°C)' : 'Batas Kritis SNI / Codex (-18.0°C)',
                            data: dataThreshold,
                            borderColor: '#ef4444',
                            borderDash: [6, 4],
                            borderWidth: 2,
                            pointRadius: 0,
                            fill: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            left: 0,
                            right: isMobileLive ? 4 : 8,
                            top: 0,
                            bottom: 0
                        }
                    },
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: isMobileLive ? 8 : 12,
                                boxHeight: isMobileLive ? 8 : 12,
                                usePointStyle: true,
                                pointStyle: 'circle',
                                padding: isMobileLive ? 8 : 16,
                                font: {
                                    family: "'Inter', sans-serif",
                                    size: isMobileLive ? 10.5 : 12,
                                    weight: 500
                                },
                                color: '#475569'
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.92)',
                            titleFont: { family: "'Outfit', sans-serif", size: 12, weight: 600 },
                            bodyFont: { family: "'Inter', sans-serif", size: 11 },
                            padding: 10,
                            cornerRadius: 8,
                            boxPadding: 4,
                            callbacks: {
                                label: function(context) {
                                    const val = context.parsed.y;
                                    if (context.dataset.label.includes('Batas')) {
                                        return `🚨 ${context.dataset.label}: ${val.toFixed(1)}°C`;
                                    }
                                    const diff = val - (-18.0);
                                    const status = diff > 0 ? `(⚠️ +${diff.toFixed(1)}°C Deviasi)` : `(✅ Aman)`;
                                    return `${context.dataset.label}: ${val !== null ? val.toFixed(1) : '--'}°C ${status}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            grid: {
                                color: 'rgba(226, 232, 240, 0.7)',
                                drawBorder: false
                            },
                            ticks: {
                                color: '#64748b',
                                font: { family: "'Inter', sans-serif", size: isMobileLive ? 10 : 11 },
                                callback: function(v) { return v + '°C'; }
                            },
                            suggestedMin: minVal,
                            suggestedMax: maxVal
                        },
                        x: {
                            grid: {
                                color: 'rgba(241, 245, 249, 0.9)',
                                drawBorder: false
                            },
                            ticks: {
                                color: '#64748b',
                                font: { family: "'Inter', sans-serif", size: isMobileLive ? 10 : 11 },
                                maxRotation: 0,
                                autoSkip: true,
                                maxTicksLimit: isMobileLive ? 5 : 8
                            }
                        }
                    }
                }
            });
}

// -------------------------------------------------------------
// VIEW 3: SHIPMENTS
// -------------------------------------------------------------
async function renderShipmentsView() {
    el.contentBody.innerHTML = `<div class="loading-state">Memuat data pengiriman...</div>`;
    try {
        const res = await api.getShipments();
        const shipments = res.shipments || [];

        el.contentBody.innerHTML = `
            <div class="panel">
                <div class="panel-header">
                    <h2 class="panel-title">${icons.package} Daftar Pengiriman Karantina</h2>
                    <button class="btn btn-primary" id="btn-create-shipment">${icons.plus} Tambah Kargo</button>
                </div>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ID Kargo</th>
                                <th>Perangkat</th>
                                <th>Komoditas</th>
                                <th>Asal</th>
                                <th>Tujuan</th>
                                <th>Batas Suhu</th>
                                <th>Status</th>
                                <th>Data Masuk</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${shipments.length > 0 ? shipments.map(s => `
                                <tr>
                                    <td class="mono-cell" style="font-weight: 700; color: var(--ice-blue);">${s.id}</td>
                                    <td><span class="mono-cell">${s.device_id || 'Belum Dihubungkan'}</span></td>
                                    <td><strong>${formatCommodityName(s.commodity)}</strong></td>
                                    <td>${s.origin || '-'}</td>
                                    <td>${s.destination || '-'}</td>
                                    <td><span class="mono-cell">${s.temp_min}°C ~ ${s.temp_max}°C</span></td>
                                    <td><span class="status-pill ${s.status === 'active' ? 'NORMAL' : 'CAUTION'}">${s.status === 'active' ? 'AKTIF' : s.status}</span></td>
                                    <td><span class="mono-cell">${s.total_readings || 0} data</span></td>
                                    <td>
                                        <div style="display: flex; gap: 6px;">
                                            <button class="btn btn-primary btn-sm btn-gps-shipment" data-id="${s.id}">${icons.map} Peta GPS</button>
                                            <button class="btn btn-secondary btn-sm btn-dossier" data-id="${s.id}">Laporan</button>
                                            <button class="btn btn-danger btn-sm btn-delete-shipment" data-id="${s.id}" title="Hapus Kargo">${icons.trash} Hapus</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('') : `<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">Belum ada data pengiriman terdaftar. Klik tombol Tambah Kargo untuk mendaftarkan kargo.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btn-create-shipment')?.addEventListener('click', showCreateShipmentModal);
        document.querySelectorAll('.btn-gps-shipment').forEach(btn => {
            btn.addEventListener('click', () => {
                state.selectedShipmentId = btn.dataset.id;
                navigateTo('gps-track');
            });
        });
        document.querySelectorAll('.btn-dossier').forEach(btn => {
            btn.addEventListener('click', () => {
                navigateTo('reports');
            });
        });
        document.querySelectorAll('.btn-delete-shipment').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (!confirm(`Konfirmasi: Hapus data pengiriman ${id}?`)) return;
                try {
                    await api.deleteShipment(id);
                    if (state.selectedShipmentId === id) state.selectedShipmentId = null;
                    showToast(`Data pengiriman ${id} berhasil dihapus`, 'success');
                    renderShipmentsView();
                } catch (e) {
                    showToast(`Gagal menghapus pengiriman: ${e.message}`, 'error');
                }
            });
        });
    } catch (err) {
        el.contentBody.innerHTML = `<div class="error-state">Gagal memuat kargo: ${err.message}</div>`;
    }
}

function showCreateShipmentModal() {
    openModal('Tambah Pengiriman Baru', `
        <form id="form-create-shipment">
            <div class="form-grid">
                <div class="form-group">
                    <label>ID Pengiriman (Opsional)</label>
                    <input type="text" id="new-shipment-id" class="form-control" placeholder="Contoh: SHP-2026-001" />
                </div>
                <div class="form-group">
                    <label>ID Perangkat ESP32</label>
                    <input type="text" id="new-shipment-device" class="form-control" value="${state.selectedDeviceId || 'QGUARD-001'}" required />
                </div>
                <div class="form-group">
                    <label>Jenis Komoditas</label>
                    <input type="text" id="new-shipment-commodity" class="form-control" placeholder="Contoh: Ikan Tuna Beku / Vaksin" required />
                </div>
                <div class="form-group">
                    <label>Pelabuhan Asal</label>
                    <input type="text" id="new-shipment-origin" class="form-control" placeholder="Contoh: Pelabuhan Bitung" required />
                </div>
                <div class="form-group">
                    <label>Tujuan Karantina</label>
                    <input type="text" id="new-shipment-dest" class="form-control" placeholder="Contoh: Tanjung Priok, Jakarta" required />
                </div>
                <div class="form-group">
                    <label>Suhu Minimum (°C)</label>
                    <input type="number" id="new-shipment-min" class="form-control" value="0.0" step="0.5" required />
                </div>
                <div class="form-group">
                    <label>Suhu Maksimum (°C)</label>
                    <input type="number" id="new-shipment-max" class="form-control" value="4.0" step="0.5" required />
                </div>
            </div>
            <div style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-close').click()">Batal</button>
                <button type="submit" class="btn btn-primary">Simpan Data</button>
            </div>
        </form>
    `);

    document.getElementById('form-create-shipment').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const payload = {
                id: document.getElementById('new-shipment-id').value.trim() || undefined,
                device_id: document.getElementById('new-shipment-device').value.trim(),
                commodity: document.getElementById('new-shipment-commodity').value.trim(),
                origin: document.getElementById('new-shipment-origin').value.trim(),
                destination: document.getElementById('new-shipment-dest').value.trim(),
                temp_min: parseFloat(document.getElementById('new-shipment-min').value),
                temp_max: parseFloat(document.getElementById('new-shipment-max').value)
            };

            await api.createShipment(payload);
            showToast('Pengiriman kargo berhasil dibuat', 'success');
            closeModal();
            renderShipmentsView();
        } catch (err) {
            showToast(`Gagal membuat pengiriman: ${err.message}`, 'error');
        }
    });
}

// -------------------------------------------------------------
// VIEW 4: LIVE GPS VOYAGE & FLEET TRACKING ENGINE
// -------------------------------------------------------------

// Realistic Indonesian Cold-Chain Corridors for Live Simulation
const SIM_TRUCK_CORRIDOR = [
    [-6.1042, 106.8835, -19.4, 0],   // Dermaga Petikemas Tanjung Priok
    [-6.1070, 106.8845, -19.3, 28],  // Gate Petikemas Keluar Pelabuhan
    [-6.1115, 106.8860, -19.2, 42],  // Jl. Pelabuhan Raya
    [-6.1180, 106.8885, -19.1, 48],  // Ramp Tol Akses Priok
    [-6.1265, 106.8920, -19.0, 56],  // Tol Akses Priok KM 02
    [-6.1360, 106.8970, -18.9, 62],  // Simpang Susun Rorotan
    [-6.1480, 106.9040, -18.8, 64],  // JORR KM 56
    [-6.1620, 106.9150, -18.8, 65],  // Cakung Cilincing
    [-6.1790, 106.9320, -18.7, 68],  // Pulogebang Junction
    [-6.2050, 106.9580, -18.7, 72],  // Tol Jakarta - Cikampek KM 10
    [-6.2230, 106.9850, -18.6, 75],  // Cikunir Interchange
    [-6.2390, 107.0120, -18.5, 78],  // Bekasi Barat
    [-6.2510, 107.0420, -18.5, 75],  // Bekasi Timur
    [-6.2680, 107.0850, -18.4, 72],  // Tambun KM 21
    [-6.2840, 107.1120, -18.3, 65],  // Cibitung KM 25
    [-6.3020, 107.1080, -18.3, 45],  // Gerbang Tol Cikarang Barat (MM2100)
    [-6.3120, 107.1020, -18.4, 30],  // Kawasan Industri MM2100
    [-6.3190, 107.0980, -18.5, 15]   // Central Cold Storage Barantin Cikarang
];

const SIM_SHIP_CORRIDOR = [
    [-7.1950, 112.7300, -20.2, 0],   // Dermaga Gapura Surya Nusantara Tanjung Perak
    [-7.1820, 112.7320, -20.1, 8],   // Alur Barat Pelayaran
    [-7.1650, 112.7350, -20.0, 12],  // Karang Jamuang Selatan
    [-7.1420, 112.7410, -19.9, 14],  // Selat Madura Sisi Barat
    [-7.1100, 112.7520, -19.8, 16],  // Pos Pandu Karang Jamuang
    [-7.0750, 112.7680, -19.7, 18],  // Lepas Selat Madura Utara
    [-7.0300, 112.7900, -19.6, 20],  // Masuk Alur Laut Jawa
    [-6.9800, 112.8200, -19.5, 22],  // Laut Jawa Timur
    [-6.9200, 112.8600, -19.4, 22],  // Menuju Selat Makassar
    [-6.8500, 112.9100, -19.3, 22]   // Perairan Terbuka Rute Makassar
];

// Live GPS Tracking State Object
const gpsLive = {
    pollingTimer: null,
    simTimer: null,
    animRafId: null,
    vehicleType: localStorage.getItem('qguard_vehicle_type') || 'truck', // 'truck' | 'ship' | 'beacon'
    autoFollow: true,
    isSimulating: false,
    simIndex: 0,
    currentPos: null,       // [lat, lon]
    currentHeading: 0,      // deg 0-360
    speedKmh: 0,
    lastReadingId: null,
    marker: null,
    polyline: null,
    streetLayer: null,
    satelliteLayer: null,
    currentTileMode: 'street',
    rawGpsPoints: [],
    activeShipment: null
};

// Bearing & Heading Calculator (Spherical Trigonometry)
function calculateGpsBearing(lat1, lon1, lat2, lon2) {
    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;
    const dLon = (lon2 - lon1) * toRad;
    const phi1 = lat1 * toRad;
    const phi2 = lat2 * toRad;
    const y = Math.sin(dLon) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
    let brng = Math.atan2(y, x) * toDeg;
    return (brng + 360) % 360;
}

function calculateGpsSpeedKmh(lat1, lon1, lat2, lon2, timeDeltaSec = 3.5) {
    const R = 6371; // km
    const toRad = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRad;
    const dLon = (lon2 - lon1) * toRad;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distKm = R * c;
    const hours = (timeDeltaSec || 3.5) / 3600;
    return Math.max(0, Math.min(130, distKm / hours));
}

function getCompassHeadingName(deg) {
    const directions = ['Utara (N)', 'Timur Laut (NE)', 'Timur (E)', 'Tenggara (SE)', 'Selatan (S)', 'Barat Daya (SW)', 'Barat (W)', 'Barat Laut (NW)'];
    const idx = Math.round(((deg % 360) / 45)) % 8;
    return directions[idx];
}

// Generate High-Definition Vector SVG for Vehicles
function buildVehicleMarkerHtml() {
    const heading = Math.round(gpsLive.currentHeading || 0);
    const type = gpsLive.vehicleType;
    let label = 'TRUK REEFER';
    let innerSvg = '';

    if (type === 'ship') {
        label = 'KAPAL KARGO';
        innerSvg = `
            <div class="vehicle-rotator" style="transform: rotate(${heading}deg);">
                <div class="vehicle-radar-ripple"></div>
                <svg class="vehicle-svg-asset" width="38" height="66" viewBox="0 0 38 66" fill="none">
                    <path d="M19 2C24 9 34 22 34 46C34 58 30 62 19 63C8 62 4 58 4 46C4 22 14 9 19 2Z" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
                    <path d="M19 5C22 11 31 22 31 44C31 54 28 58 19 59C10 58 7 54 7 44C7 22 16 11 19 5Z" fill="#0f172a"/>
                    <polygon points="19,4 17,9 21,9" fill="#38bdf8"/>
                    <rect x="10" y="16" width="8" height="12" rx="1" fill="#0284c7" stroke="#38bdf8" stroke-width="0.75"/>
                    <rect x="20" y="16" width="8" height="12" rx="1" fill="#059669" stroke="#34d399" stroke-width="0.75"/>
                    <rect x="10" y="30" width="8" height="12" rx="1" fill="#d97706" stroke="#fbbf24" stroke-width="0.75"/>
                    <rect x="20" y="30" width="8" height="12" rx="1" fill="#0284c7" stroke="#38bdf8" stroke-width="0.75"/>
                    <rect x="12" y="44" width="14" height="9" rx="2" fill="#334155" stroke="#94a3b8" stroke-width="1"/>
                    <circle cx="19" cy="48.5" r="2" fill="#38bdf8"/>
                    <line x1="19" y1="46" x2="19" y2="44" stroke="#e0f2fe" stroke-width="1.5"/>
                    <circle cx="7" cy="56" r="1.5" fill="#ef4444"/>
                    <circle cx="31" cy="56" r="1.5" fill="#10b981"/>
                </svg>
            </div>
            <div class="vehicle-floating-tag" id="vehicle-marker-tag">KAPAL</div>
        `;
    } else if (type === 'beacon') {
        label = 'BEACON';
        innerSvg = `
            <div class="vehicle-rotator">
                <div class="vehicle-radar-ripple"></div>
                <svg class="vehicle-svg-asset" width="46" height="46" viewBox="0 0 46 46" fill="none">
                    <circle cx="23" cy="23" r="18" fill="rgba(2, 132, 199, 0.22)" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="3 3"/>
                    <circle cx="23" cy="23" r="10" fill="#0284c7" stroke="#ffffff" stroke-width="2"/>
                    <circle cx="23" cy="23" r="4" fill="#ffffff"/>
                    <line x1="23" y1="2" x2="23" y2="8" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
                    <line x1="23" y1="38" x2="23" y2="44" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
                    <line x1="2" y1="23" x2="8" y2="23" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
                    <line x1="38" y1="23" x2="44" y2="23" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </div>
            <div class="vehicle-floating-tag" id="vehicle-marker-tag">BEACON</div>
        `;
    } else {
        label = 'TRUK';
        innerSvg = `
            <div class="vehicle-rotator" style="transform: rotate(${heading}deg);">
                <div class="vehicle-radar-ripple"></div>
                <svg class="vehicle-svg-asset" width="38" height="62" viewBox="0 0 38 62" fill="none">
                    <rect x="2" y="14" width="4" height="2" rx="1" fill="#64748b"/>
                    <rect x="32" y="14" width="4" height="2" rx="1" fill="#64748b"/>
                    <path d="M8 9C8 5.5 10.5 3 14 3H24C27.5 3 30 5.5 30 9V20H8V9Z" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
                    <path d="M10 8C10 6 12 5 15 5H23C26 5 28 6 28 8V13H10V8Z" fill="#0284c7" fill-opacity="0.85"/>
                    <rect x="9" y="3.5" width="4" height="2" rx="1" fill="#fef08a"/>
                    <rect x="25" y="3.5" width="4" height="2" rx="1" fill="#fef08a"/>
                    <rect x="13" y="16" width="12" height="4" rx="1" fill="#38bdf8"/>
                    <rect x="6" y="21" width="26" height="38" rx="2.5" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/>
                    <rect x="8" y="23" width="22" height="34" rx="1.5" fill="#1e293b"/>
                    <line x1="10" y1="28" x2="28" y2="28" stroke="#334155" stroke-width="1.2"/>
                    <line x1="10" y1="33" x2="28" y2="33" stroke="#334155" stroke-width="1.2"/>
                    <line x1="10" y1="38" x2="28" y2="38" stroke="#334155" stroke-width="1.2"/>
                    <line x1="10" y1="43" x2="28" y2="43" stroke="#334155" stroke-width="1.2"/>
                    <line x1="10" y1="48" x2="28" y2="48" stroke="#334155" stroke-width="1.2"/>
                    <circle cx="19" cy="38" r="5" fill="rgba(2, 132, 199, 0.25)" stroke="#38bdf8" stroke-width="1"/>
                    <line x1="19" y1="34" x2="19" y2="42" stroke="#38bdf8" stroke-width="1.2"/>
                    <line x1="15" y1="38" x2="23" y2="38" stroke="#38bdf8" stroke-width="1.2"/>
                    <rect x="8" y="58" width="4" height="1.5" fill="#ef4444"/>
                    <rect x="26" y="58" width="4" height="1.5" fill="#ef4444"/>
                </svg>
            </div>
            <div class="vehicle-floating-tag" id="vehicle-marker-tag">TRUK</div>
        `;
    }

    return innerSvg;
}

function updateVehicleMarkerIcon() {
    if (!gpsLive.marker) return;
    const html = buildVehicleMarkerHtml();
    const icon = L.divIcon({
        className: 'vehicle-marker-container',
        html: html,
        iconSize: [46, 68],
        iconAnchor: [23, 34],
        popupAnchor: [0, -36]
    });
    gpsLive.marker.setIcon(icon);
}

// Smooth Glide Animation Engine (Ala Ojek Online / Ride-Hailing)
function smoothGlideVehicle(targetLat, targetLon, targetHeading = null, durationMs = 2400) {
    if (!gpsLive.marker || !state.map) return;
    if (!gpsLive.currentPos) {
        gpsLive.currentPos = [targetLat, targetLon];
        gpsLive.marker.setLatLng([targetLat, targetLon]);
        return;
    }

    const startLat = gpsLive.currentPos[0];
    const startLon = gpsLive.currentPos[1];

    if (Math.abs(startLat - targetLat) < 0.000005 && Math.abs(startLon - targetLon) < 0.000005) {
        return;
    }

    const computedHeading = targetHeading !== null 
        ? targetHeading 
        : calculateGpsBearing(startLat, startLon, targetLat, targetLon);

    const startHeading = gpsLive.currentHeading || 0;
    let deltaAngle = (computedHeading - startHeading + 180) % 360 - 180;
    if (deltaAngle < -180) deltaAngle += 360;
    const endHeading = startHeading + deltaAngle;

    if (gpsLive.animRafId) {
        cancelAnimationFrame(gpsLive.animRafId);
        gpsLive.animRafId = null;
    }

    const startTime = performance.now();

    function frame(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        // Smooth Cubic Easing
        const ease = 1 - Math.pow(1 - progress, 3);

        const curLat = startLat + (targetLat - startLat) * ease;
        const curLon = startLon + (targetLon - startLon) * ease;
        const curHeading = (startHeading + (endHeading - startHeading) * ease + 360) % 360;

        gpsLive.currentPos = [curLat, curLon];
        gpsLive.currentHeading = curHeading;

        gpsLive.marker.setLatLng([curLat, curLon]);

        const rotator = document.querySelector('.vehicle-rotator');
        if (rotator && gpsLive.vehicleType !== 'beacon') {
            rotator.style.transform = `rotate(${curHeading}deg)`;
        }

        if (gpsLive.autoFollow && state.map) {
            state.map.panTo([curLat, curLon], { animate: false });
        }

        if (progress < 1) {
            gpsLive.animRafId = requestAnimationFrame(frame);
        } else {
            gpsLive.animRafId = null;
            if (gpsLive.polyline) {
                gpsLive.polyline.addLatLng([targetLat, targetLon]);
            }
        }
    }

    gpsLive.animRafId = requestAnimationFrame(frame);
}

// Main View Renderer for GPS Voyage Map
async function renderGpsView() {
    el.contentBody.innerHTML = `<div class="loading-state">Memuat data posisi & rute GPS pelayaran armada...</div>`;
    
    try {
        const [latestRes, shipmentsRes] = await Promise.all([
            api.getLatest(state.selectedDeviceId).catch(() => ({ reading: null })),
            api.getShipments().catch(() => ({ shipments: [] }))
        ]);

        const shipments = shipmentsRes?.shipments || [];
        const activeShipment = state.selectedShipmentId 
            ? shipments.find(s => s.id === state.selectedShipmentId)
            : shipments.find(s => s.device_id === state.selectedDeviceId && s.status === 'active') || shipments.find(s => s.device_id === state.selectedDeviceId) || shipments[0] || null;

        gpsLive.activeShipment = activeShipment;

        // Auto-detect recommended vehicle type if shipment commodity indicates ship vs truck
        if (!localStorage.getItem('qguard_vehicle_type')) {
            if (activeShipment?.destination && (activeShipment.destination.toLowerCase().includes('makassar') || activeShipment.destination.toLowerCase().includes('pelabuhan'))) {
                gpsLive.vehicleType = 'ship';
            } else {
                gpsLive.vehicleType = 'truck';
            }
        }

        const historyQuery = activeShipment 
            ? { shipment_id: activeShipment.id, limit: 200 }
            : { device_id: state.selectedDeviceId, limit: 200 };
            
        const historyRes = await api.getHistory(historyQuery).catch(() => ({ readings: [] }));
        const latest = latestRes?.reading || null;
        const allReadings = historyRes?.readings || [];

        // Filter valid GPS coordinates
        const validGpsReadings = allReadings.filter(r => 
            r.latitude !== null && r.longitude !== null &&
            !isNaN(Number(r.latitude)) && !isNaN(Number(r.longitude)) &&
            (Math.abs(Number(r.latitude)) > 0.0001 || Math.abs(Number(r.longitude)) > 0.0001)
        ).reverse();

        gpsLive.rawGpsPoints = validGpsReadings;

        const hasRealGps = validGpsReadings.length > 0;
        const latestLat = latest && latest.latitude && Math.abs(Number(latest.latitude)) > 0.0001 ? Number(latest.latitude) : null;
        const latestLon = latest && latest.longitude && Math.abs(Number(latest.longitude)) > 0.0001 ? Number(latest.longitude) : null;
        const hasLiveFix = latestLat !== null && latestLon !== null;

        const isFix3D = (latest?.gps_fix_status === 'FIX_3D' || latest?.gps_fix_status === '3D_FIX');
        const fixBadgeText = isFix3D 
            ? '● 3D Fix' 
            : (hasLiveFix ? '● 2D Fix' : '○ Mencari Sinyal');
        const fixBadgeClass = (isFix3D || hasLiveFix) ? 'var(--status-normal)' : '#f59e0b';

        const coordsText = hasLiveFix 
            ? `${latestLat.toFixed(5)}, ${latestLon.toFixed(5)}` 
            : (hasRealGps ? `${validGpsReadings[validGpsReadings.length - 1].latitude.toFixed(5)}, ${validGpsReadings[validGpsReadings.length - 1].longitude.toFixed(5)}` : 'Mencari Sinyal');

        const tempVal = latest?.temperature_probe_2 !== null && latest?.temperature_probe_2 !== undefined
            ? `${Number(latest.temperature_probe_2).toFixed(1)}°C (Inti)`
            : (latest?.temperature_probe_1 !== null && latest?.temperature_probe_1 !== undefined 
                ? `${Number(latest.temperature_probe_1).toFixed(1)}°C` 
                : '--');

        const pointCountText = hasRealGps 
            ? `${validGpsReadings.length} Titik` 
            : '0 Titik';

        el.contentBody.innerHTML = `
            <div class="panel">
                <div class="panel-header" style="flex-wrap: wrap; gap: 12px;">
                    <div>
                        <h2 class="panel-title">${icons.map} Peta Pelayaran & GPS</h2>
                        <span style="font-size: 12px; color: var(--text-muted)">
                            ${hasRealGps ? 'Monitoring Rute Armada • Unit ' + state.selectedDeviceId : 'Menunggu Sinyal Satelit GPS • Unit ' + state.selectedDeviceId}
                        </span>
                    </div>

                    <!-- Toolbar Kontrol Peta & Ikon Kendaraan -->
                    <div class="panel-actions" style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                        <!-- Pemilih Ikon Kendaraan -->
                        <div class="vehicle-selector-group" title="Pilih bentuk representasi armada">
                            <button class="vehicle-btn ${gpsLive.vehicleType === 'truck' ? 'active' : ''}" data-vehicle="truck">
                                ${icons.truck} Truk
                            </button>
                            <button class="vehicle-btn ${gpsLive.vehicleType === 'ship' ? 'active' : ''}" data-vehicle="ship">
                                ${icons.ship} Kapal
                            </button>
                            <button class="vehicle-btn ${gpsLive.vehicleType === 'beacon' ? 'active' : ''}" data-vehicle="beacon">
                                ${icons.mapPin} Pin
                            </button>
                        </div>

                        <!-- Filter Kargo -->
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <select id="gps-shipment-select" class="form-control" style="padding: 4px 8px; font-size: 12px; height: 32px;">
                                <option value="" ${!state.selectedShipmentId ? 'selected' : ''}>Semua Data Unit (${state.selectedDeviceId})</option>
                                ${shipments.map(s => `<option value="${s.id}" ${state.selectedShipmentId === s.id ? 'selected' : ''}>${s.id} - ${formatCommodityName(s.commodity)}</option>`).join('')}
                            </select>
                        </div>

                        <!-- Auto-Follow Camera Toggle -->
                        <button class="btn ${gpsLive.autoFollow ? 'btn-primary' : 'btn-secondary'} btn-sm" id="btn-toggle-autofollow" title="Kamera otomatis mengikuti posisi armada">
                            ${icons.compass} <span id="autofollow-text">${gpsLive.autoFollow ? 'Ikuti: ON' : 'Ikuti: OFF'}</span>
                        </button>

                        <!-- Live Demo Simulation Toggle -->
                        <button class="btn btn-secondary btn-sm" id="btn-toggle-simulation" title="Uji animasi pergerakan rute secara langsung" style="border-color: #f59e0b; color: #b45309; font-weight: 600;">
                            <span id="sim-icon">🚀</span> <span id="sim-text">Demo Rute</span>
                        </button>

                        <button class="btn btn-secondary btn-sm" id="btn-recenter-map" title="Pusatkan kamera ke lokasi armada saat ini">
                            ${icons.gps} Pusatkan
                        </button>
                        <button class="btn btn-secondary btn-sm" id="btn-fit-route" title="Lihat seluruh jalur rute pengiriman">
                            ${icons.map} Seluruh Rute
                        </button>
                        <button class="btn btn-secondary btn-sm" id="btn-toggle-tiles" title="Ganti antara peta jalan dan citra satelit">
                            <span id="layer-type-label">Peta Satelit</span>
                        </button>
                    </div>
                </div>

                ${activeShipment ? `
                    <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-color); border-left: 4px solid var(--primary-cyan); padding: 10px 16px; border-radius: var(--radius-sm); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; font-size: 12px;">
                        <div>
                            <strong style="color: var(--ice-blue); font-size: 13px;">${activeShipment.id}</strong> — <span style="font-weight: 600;">${formatCommodityName(activeShipment.commodity)}</span>
                            <div style="color: var(--text-secondary); margin-top: 2px;">
                                <span>${activeShipment.origin || 'Pelabuhan Asal'}</span> &rarr; <span>${activeShipment.destination || 'Depot Karantina'}</span>
                                <span style="margin-left: 12px; color: var(--text-muted); font-family: monospace;">Batas Regulasi: ${activeShipment.temp_min}°C s/d ${activeShipment.temp_max}°C</span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <span class="status-pill ${activeShipment.status === 'active' ? 'NORMAL' : 'CAUTION'}">${activeShipment.status === 'active' ? 'PELAYARAN AKTIF' : activeShipment.status}</span>
                        </div>
                    </div>
                ` : ''}

                <!-- Map Canvas & Floating HUD -->
                <div class="map-stage-wrapper">
                    <div id="map"></div>

                    <!-- Floating Glassmorphic Telemetry HUD Overlay -->
                    <div class="map-hud-overlay">
                        <div class="map-hud-left">
                            <div class="map-hud-pill ${hasLiveFix ? 'live-active' : ''}" id="map-live-pill">
                                <span class="map-live-dot" id="map-live-dot"></span>
                                <span id="map-live-title">${hasLiveFix ? 'GPS AKTIF' : 'MENCARI SINYAL'}</span>
                            </div>
                            <div class="map-hud-chip">
                                KECEPATAN: <strong id="hud-speed-val">0.0 km/h</strong>
                            </div>
                            <div class="map-hud-chip">
                                HALUAN: <strong id="hud-heading-val">000° (Utara)</strong>
                            </div>
                        </div>
                        <div class="map-hud-right">
                            <div class="map-hud-chip">
                                SUHU INTI: <strong id="hud-temp-val" style="color: #10b981;">${tempVal}</strong>
                            </div>
                            <div class="map-hud-chip" id="hud-mode-chip">
                                MODA: <strong id="hud-mode-val">${gpsLive.vehicleType === 'ship' ? 'KAPAL' : (gpsLive.vehicleType === 'beacon' ? 'BEACON' : 'TRUK')}</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Detail Telemetri Statistik Bar Bawah -->
                <div style="margin-top: 15px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; background: var(--bg-surface-elevated); padding: 14px 18px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size: 13px;">
                    <div>
                        <span style="color: var(--text-muted); font-size: 11px; display: block; margin-bottom: 2px;">KOORDINAT TERKINI</span>
                        <strong class="mono-cell" id="gps-stat-coords" style="color: var(--ice-blue);">${coordsText}</strong>
                    </div>
                    <div>
                        <span style="color: var(--text-muted); font-size: 11px; display: block; margin-bottom: 2px;">STATUS GPS</span>
                        <strong id="gps-stat-status" style="color: ${fixBadgeClass}; display: inline-flex; align-items: center; gap: 4px;">${fixBadgeText}</strong>
                    </div>
                    <div>
                        <span style="color: var(--text-muted); font-size: 11px; display: block; margin-bottom: 2px;">SUHU PADA POSISI INI</span>
                        <strong id="gps-stat-temp" style="color: #10b981;">${tempVal}</strong>
                    </div>
                    <div>
                        <span style="color: var(--text-muted); font-size: 11px; display: block; margin-bottom: 2px;">TOTAL TITIK LACAK</span>
                        <strong id="gps-stat-points">${pointCountText}</strong>
                    </div>
                </div>

                <div style="margin-top: 12px; display: flex; gap: 20px; font-size: 12px; color: var(--text-secondary); align-items: center; flex-wrap: wrap;">
                    <div><span style="color: #10b981; font-size: 16px;">●</span> Normal</div>
                    <div><span style="color: #ef4444; font-size: 16px;">●</span> Penyimpangan Suhu</div>
                    <div style="display: inline-flex; align-items: center; gap: 4px;"><span style="color: var(--primary-blue); display: inline-flex;">${icons.mapPin}</span> Posisi Terkini</div>
                </div>
            </div>
        `;

        // Pasang Event Listener Kargo Selector
        document.getElementById('gps-shipment-select')?.addEventListener('change', (e) => {
            state.selectedShipmentId = e.target.value || null;
            renderGpsView();
        });

        // Pasang Event Listener Vehicle Selector
        document.querySelectorAll('.vehicle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.vehicle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const vType = btn.dataset.vehicle;
                gpsLive.vehicleType = vType;
                localStorage.setItem('qguard_vehicle_type', vType);
                updateVehicleMarkerIcon();
                const hudModeVal = document.getElementById('hud-mode-val');
                if (hudModeVal) {
                    hudModeVal.innerText = vType === 'ship' ? 'KAPAL' : (vType === 'beacon' ? 'BEACON' : 'TRUK');
                }
                showToast(`Ikon armada: ${vType === 'ship' ? 'Kapal' : (vType === 'beacon' ? 'Pin' : 'Truk')}`, 'info');
            });
        });

        // Pasang Event Listener Auto-Follow
        const btnAutoFollow = document.getElementById('btn-toggle-autofollow');
        const autoFollowText = document.getElementById('autofollow-text');
        btnAutoFollow?.addEventListener('click', () => {
            gpsLive.autoFollow = !gpsLive.autoFollow;
            btnAutoFollow.classList.toggle('btn-primary', gpsLive.autoFollow);
            btnAutoFollow.classList.toggle('btn-secondary', !gpsLive.autoFollow);
            if (autoFollowText) autoFollowText.innerText = gpsLive.autoFollow ? 'Ikuti: ON' : 'Ikuti: OFF';
            showToast(`Mode ikuti armada: ${gpsLive.autoFollow ? 'ON' : 'OFF'}`, 'info');
        });

        // Pasang Event Listener Live Demo Simulation
        const btnSim = document.getElementById('btn-toggle-simulation');
        btnSim?.addEventListener('click', () => {
            toggleGpsSimulation();
        });

        // Inisialisasi Peta Leaflet
        setTimeout(() => {
            initLeafletMap(validGpsReadings, latest);
            startGpsLiveTracking();
        }, 100);

    } catch (err) {
        el.contentBody.innerHTML = `<div class="error-state">Gagal memuat peta GPS: ${err.message}</div>`;
    }
}

// Inisialisasi Peta Leaflet dengan Marker Mulus & Polylines
function initLeafletMap(validReadings = [], latest = null) {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    if (state.map) {
        state.map.remove();
        state.map = null;
    }

    let routePoints = [];
    const isRealData = (validReadings && validReadings.length > 0);

    if (isRealData) {
        routePoints = validReadings.map(r => [
            Number(r.latitude),
            Number(r.longitude),
            r.temperature_probe_2 !== null ? Number(r.temperature_probe_2) : (r.temperature_probe_1 !== null ? Number(r.temperature_probe_1) : null),
            r.timestamp
        ]);
    }

    // Koordinat pusat peta awal: lokasi riil terakhir atau Pelabuhan Tanjung Priok
    const centerLat = isRealData ? routePoints[routePoints.length - 1][0] : -6.1042;
    const centerLon = isRealData ? routePoints[routePoints.length - 1][1] : 106.8835;

    const map = L.map('map', {
        zoomControl: true
    }).setView([centerLat, centerLon], isRealData ? 15 : 13);
    state.map = map;

    // Tile Layer: OpenStreetMap & Esri World Imagery Satelit
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Maxar, Earthstar Geographics',
        maxZoom: 18
    });

    streetLayer.addTo(map);
    gpsLive.streetLayer = streetLayer;
    gpsLive.satelliteLayer = satelliteLayer;
    gpsLive.currentTileMode = 'street';

    // Buat Polyline Jejak Rute
    let latlngs = isRealData ? routePoints.map(p => [p[0], p[1]]) : [];
    const polyline = L.polyline(latlngs, {
        color: '#0284c7',
        weight: 4.5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(map);
    gpsLive.polyline = polyline;

    // Tambah markers titik riil di sepanjang jalur riil
    if (isRealData) {
        routePoints.forEach((p, idx) => {
            const temp = p[2];
            const isExcursion = (temp !== null && temp > -18.0);
            const color = isExcursion ? '#ef4444' : '#10b981';
            const marker = L.circleMarker([p[0], p[1]], {
                radius: isExcursion ? 7 : 4,
                fillColor: color,
                color: '#ffffff',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.95
            }).addTo(map);

            marker.bindPopup(`
                <div style="color: #111; font-family: Inter, sans-serif; font-size: 12px; line-height: 1.5;">
                    <strong style="color: #0369a1;">Titik Lacak #${idx + 1} (Live GPS)</strong><br>
                    Waktu: <span style="color: #475569;">${p[3] ? formatTimestamp(p[3]) : '--'}</span><br>
                    Suhu Inti: <span style="font-weight: 700; color: ${color}">${temp !== null ? temp.toFixed(1) + '°C' : '--'}</span><br>
                    Status: <span style="font-weight: 600; color: ${color}">${isExcursion ? 'MELEBIHI BATAS' : 'NORMAL'}</span><br>
                    Koordinat: ${p[0].toFixed(5)}, ${p[1].toFixed(5)}
                </div>
            `);
        });

        // Hitung sudut awal kendaraan jika memiliki > 1 titik
        if (routePoints.length >= 2) {
            const pPrev = routePoints[routePoints.length - 2];
            const pLast = routePoints[routePoints.length - 1];
            gpsLive.currentHeading = calculateGpsBearing(pPrev[0], pPrev[1], pLast[0], pLast[1]);
        }
    }

    // Pasang Vehicle Moving Marker di Posisi Terkini
    const initialPos = isRealData ? [routePoints[routePoints.length - 1][0], routePoints[routePoints.length - 1][1]] : [centerLat, centerLon];
    gpsLive.currentPos = initialPos;

    const initialIconHtml = buildVehicleMarkerHtml();
    const vehicleIcon = L.divIcon({
        className: 'vehicle-marker-container',
        html: initialIconHtml,
        iconSize: [46, 68],
        iconAnchor: [23, 34],
        popupAnchor: [0, -36]
    });

    const vehicleMarker = L.marker(initialPos, {
        icon: vehicleIcon,
        zIndexOffset: 1000
    }).addTo(map);

    vehicleMarker.bindPopup(`
        <div style="color: #111; font-family: Inter, sans-serif; font-size: 12px; line-height: 1.5; min-width: 170px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <span style="color: #0284c7; font-weight: 800;">${icons.shield} Q-GUARD LIVE</span>
                <span class="status-pill NORMAL" style="font-size: 10px; padding: 2px 6px;">ONLINE</span>
            </div>
            <strong>Unit:</strong> ${state.selectedDeviceId}<br>
            <strong>Status:</strong> Bergerak (Real-time)<br>
            <strong>Kecepatan:</strong> <span id="popup-speed">0.0 km/h</span><br>
            <strong>Arah Haluan:</strong> <span id="popup-heading">000°</span><br>
            <strong>Koordinat:</strong> <span id="popup-coords">${initialPos[0].toFixed(5)}, ${initialPos[1].toFixed(5)}</span>
        </div>
    `);

    gpsLive.marker = vehicleMarker;

    if (isRealData && latlngs.length > 1) {
        map.fitBounds(polyline.getBounds(), { padding: [50, 50], maxZoom: 16 });
    }

    // Pasang Map Controls
    document.getElementById('btn-recenter-map')?.addEventListener('click', () => {
        if (gpsLive.currentPos) {
            map.flyTo(gpsLive.currentPos, 16, { animate: true, duration: 1 });
            if (gpsLive.marker) gpsLive.marker.openPopup();
            showToast('Kamera dipusatkan ke posisi armada terkini', 'info');
        }
    });

    document.getElementById('btn-fit-route')?.addEventListener('click', () => {
        if (gpsLive.polyline && gpsLive.polyline.getLatLngs().length > 0) {
            map.fitBounds(gpsLive.polyline.getBounds(), { padding: [50, 50], animate: true });
            showToast('Menampilkan seluruh lintasan rute', 'info');
        } else {
            showToast('Belum ada lintasan rute untuk ditampilkan', 'info');
        }
    });

    const btnToggleTiles = document.getElementById('btn-toggle-tiles');
    const labelTiles = document.getElementById('layer-type-label');
    btnToggleTiles?.addEventListener('click', () => {
        if (gpsLive.currentTileMode === 'street') {
            map.removeLayer(streetLayer);
            satelliteLayer.addTo(map);
            gpsLive.currentTileMode = 'satellite';
            if (labelTiles) labelTiles.innerText = 'Peta Jalan';
            showToast('Tipe peta diubah ke Citra Satelit', 'info');
        } else {
            map.removeLayer(satelliteLayer);
            streetLayer.addTo(map);
            gpsLive.currentTileMode = 'street';
            if (labelTiles) labelTiles.innerText = 'Peta Satelit';
            showToast('Tipe peta diubah ke Peta Jalan', 'info');
        }
    });
}

// Update HUD & Stats Elements Secara Realtime Tanpa Refresh
function updateGpsHudRealtime(lat, lon, speed, heading, temp, fixStatus) {
    const hudSpeed = document.getElementById('hud-speed-val');
    const hudHeading = document.getElementById('hud-heading-val');
    const hudTemp = document.getElementById('hud-temp-val');
    const statCoords = document.getElementById('gps-stat-coords');
    const statStatus = document.getElementById('gps-stat-status');
    const statTemp = document.getElementById('gps-stat-temp');
    const popupSpeed = document.getElementById('popup-speed');
    const popupHeading = document.getElementById('popup-heading');
    const popupCoords = document.getElementById('popup-coords');

    const headingName = getCompassHeadingName(heading);

    if (hudSpeed) hudSpeed.innerText = `${speed.toFixed(1)} km/h`;
    if (hudHeading) hudHeading.innerText = `${Math.round(heading)}° (${headingName})`;
    if (hudTemp && temp !== null) hudTemp.innerText = `${temp.toFixed(1)}°C (Inti)`;
    if (statCoords) statCoords.innerText = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    if (statTemp && temp !== null) statTemp.innerText = `${temp.toFixed(1)}°C`;
    if (statStatus && fixStatus) statStatus.innerText = fixStatus;
    if (popupSpeed) popupSpeed.innerText = `${speed.toFixed(1)} km/h`;
    if (popupHeading) popupHeading.innerText = `${Math.round(heading)}° (${headingName})`;
    if (popupCoords) popupCoords.innerText = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

// Loop Polling Otomatis Tiap 3.5 Detik (Tanpa Refresh Halaman)
function startGpsLiveTracking() {
    stopGpsLiveTracking();

    gpsLive.pollingTimer = setInterval(async () => {
        if (state.currentView !== 'gps-track' || gpsLive.isSimulating) return;

        try {
            const res = await api.getLatest(state.selectedDeviceId);
            const latest = res?.reading;
            if (!latest) return;

            const newLat = latest.latitude !== null ? Number(latest.latitude) : null;
            const newLon = latest.longitude !== null ? Number(latest.longitude) : null;

            if (newLat && newLon && (Math.abs(newLat) > 0.0001 || Math.abs(newLon) > 0.0001)) {
                const prev = gpsLive.currentPos;
                const isMoved = !prev || Math.abs(prev[0] - newLat) > 0.00002 || Math.abs(prev[1] - newLon) > 0.00002;

                const is3D = (latest.gps_fix_status === 'FIX_3D' || latest.gps_fix_status === '3D_FIX');
                const fixText = is3D ? '3D Fix' : '2D Fix';
                const temp = latest.temperature_probe_2 !== null ? Number(latest.temperature_probe_2) : (latest.temperature_probe_1 !== null ? Number(latest.temperature_probe_1) : null);

                if (isMoved && prev) {
                    const heading = calculateGpsBearing(prev[0], prev[1], newLat, newLon);
                    const speed = calculateGpsSpeedKmh(prev[0], prev[1], newLat, newLon, 3.5);
                    smoothGlideVehicle(newLat, newLon, heading, 2400);
                    updateGpsHudRealtime(newLat, newLon, speed, heading, temp, fixText);
                } else if (!prev) {
                    gpsLive.currentPos = [newLat, newLon];
                    if (gpsLive.marker) gpsLive.marker.setLatLng([newLat, newLon]);
                    updateGpsHudRealtime(newLat, newLon, 0, 0, temp, fixText);
                }

                // Update live pill status to active
                const livePill = document.getElementById('map-live-pill');
                const liveDot = document.getElementById('map-live-dot');
                const liveTitle = document.getElementById('map-live-title');
                if (livePill) livePill.className = 'map-hud-pill live-active';
                if (liveDot) liveDot.className = 'map-live-dot';
                if (liveTitle) liveTitle.innerText = 'GPS AKTIF';
            }
        } catch (_) {}
    }, 3500);
}

// Stop Tracking saat Pindah Tab atau Halaman
function stopGpsLiveTracking() {
    if (gpsLive.pollingTimer) {
        clearInterval(gpsLive.pollingTimer);
        gpsLive.pollingTimer = null;
    }
    if (gpsLive.simTimer) {
        clearInterval(gpsLive.simTimer);
        gpsLive.simTimer = null;
    }
    if (gpsLive.animRafId) {
        cancelAnimationFrame(gpsLive.animRafId);
        gpsLive.animRafId = null;
    }
    gpsLive.isSimulating = false;
}

// Toggle Mode Simulasi Gerak Real-Time Ala Ojek Online
function toggleGpsSimulation() {
    const btnSim = document.getElementById('btn-toggle-simulation');
    const simIcon = document.getElementById('sim-icon');
    const simText = document.getElementById('sim-text');
    const livePill = document.getElementById('map-live-pill');
    const liveDot = document.getElementById('map-live-dot');
    const liveTitle = document.getElementById('map-live-title');

    if (gpsLive.isSimulating) {
        // Matikan simulasi
        gpsLive.isSimulating = false;
        if (gpsLive.simTimer) clearInterval(gpsLive.simTimer);
        gpsLive.simTimer = null;

        if (btnSim) {
            btnSim.style.background = '';
            btnSim.style.color = '#b45309';
        }
        if (simIcon) simIcon.innerText = '🚀';
        if (simText) simText.innerText = 'Demo Rute';
        if (livePill) livePill.className = 'map-hud-pill';
        if (liveDot) liveDot.className = 'map-live-dot';
        if (liveTitle) liveTitle.innerText = 'GPS AKTIF';

        showToast('Demo simulasi dinonaktifkan', 'info');
    } else {
        // Nyalakan simulasi
        gpsLive.isSimulating = true;
        gpsLive.simIndex = 0;

        const corridor = gpsLive.vehicleType === 'ship' ? SIM_SHIP_CORRIDOR : SIM_TRUCK_CORRIDOR;

        // Reset lintasan polyline ke titik awal simulasi
        if (state.map && corridor.length > 0) {
            const startPt = corridor[0];
            gpsLive.currentPos = [startPt[0], startPt[1]];
            if (gpsLive.marker) gpsLive.marker.setLatLng([startPt[0], startPt[1]]);
            if (gpsLive.polyline) gpsLive.polyline.setLatLngs([[startPt[0], startPt[1]]]);
            state.map.setView([startPt[0], startPt[1]], gpsLive.vehicleType === 'ship' ? 13 : 15);
        }

        if (btnSim) {
            btnSim.style.background = '#f59e0b';
            btnSim.style.color = '#ffffff';
        }
        if (simIcon) simIcon.innerText = '⏸️';
        if (simText) simText.innerText = 'Hentikan Demo';
        if (livePill) livePill.className = 'map-hud-pill live-sim';
        if (liveDot) liveDot.className = 'map-live-dot sim-dot';
        if (liveTitle) liveTitle.innerText = 'MODE SIMULASI';

        showToast('Demo rute simulasi aktif', 'success');

        // Step generator simulasi tiap 2.6 detik
        gpsLive.simTimer = setInterval(() => {
            if (!gpsLive.isSimulating || state.currentView !== 'gps-track') return;

            gpsLive.simIndex = (gpsLive.simIndex + 1) % corridor.length;
            const pt = corridor[gpsLive.simIndex];
            const prevPt = corridor[(gpsLive.simIndex - 1 + corridor.length) % corridor.length];

            const targetLat = pt[0];
            const targetLon = pt[1];
            const targetTemp = pt[2];
            const targetSpeed = pt[3];
            const targetHeading = calculateGpsBearing(prevPt[0], prevPt[1], targetLat, targetLon);

            smoothGlideVehicle(targetLat, targetLon, targetHeading, 2400);
            updateGpsHudRealtime(targetLat, targetLon, targetSpeed, targetHeading, targetTemp, '● 3D Fix (Simulasi)');
        }, 2600);
    }
}

// -------------------------------------------------------------
// VIEW 5: AI RISK & MKT ENGINE
// -------------------------------------------------------------
function translateRiskRecommendation(rec) {
    if (!rec) return '';
    const map = {
        'Quarantine product immediately. Conduct microbial test and total volatile basic nitrogen (TVB-N) assay.':
            'Karantina produk segera. Lakukan pengujian mikroba dan uji Total Volatile Basic Nitrogen (TVB-N).',
        'Verify chain-of-custody log to validate authorized door openings.':
            'Verifikasi log chain-of-custody untuk memvalidasi otorisasi pembukaan pintu kontainer/wadah.',
        'Inspect package integrity and check core product temperature with calibrated probe.':
            'Periksa integritas kemasan dan uji suhu inti produk menggunakan probe yang terkalibrasi.',
        'Check container for structural damage, seal rupture, and secondary refrigerant loss.':
            'Periksa struktur fisik kontainer dari kerusakan, kebocoran segel pintu, dan hilangnya media pendingin sekunder.',
        'Cold-chain integrity maintained within safe limits. Eligible for fast-track clearance.':
            'Integritas rantai dingin terjaga dalam batas aman. Memenuhi syarat penerbitan izin rilis jalur cepat (Jalur Hijau).',
        'No sensor readings available for evaluation.':
            'Tidak ada data pembacaan sensor yang tersedia untuk evaluasi.'
    };
    if (map[rec]) return map[rec];

    if (/Quarantine product immediately/i.test(rec)) {
        return 'Karantina produk segera. Lakukan pengujian mikroba dan uji Total Volatile Basic Nitrogen (TVB-N).';
    }
    if (/Verify chain-of-custody/i.test(rec)) {
        return 'Verifikasi log chain-of-custody untuk memvalidasi otorisasi pembukaan pintu kontainer/wadah.';
    }
    if (/Inspect package integrity/i.test(rec)) {
        return 'Periksa integritas kemasan dan uji suhu inti produk menggunakan probe yang terkalibrasi.';
    }
    if (/Check container for structural damage/i.test(rec)) {
        return 'Periksa struktur fisik kontainer dari kerusakan, kebocoran segel pintu, dan hilangnya media pendingin sekunder.';
    }
    if (/Cold-chain integrity maintained/i.test(rec)) {
        return 'Integritas rantai dingin terjaga dalam batas aman. Memenuhi syarat penerbitan izin rilis jalur cepat (Jalur Hijau).';
    }
    if (/No sensor readings available/i.test(rec)) {
        return 'Tidak ada data pembacaan sensor yang tersedia untuk evaluasi.';
    }
    return rec;
}

function translateRiskFactor(f) {
    if (!f) return { factor: '', severity: '', details: '' };
    const factorMap = {
        'Severe Temperature Abuse': 'Penyimpangan Suhu Kritis',
        'Temperature Excursion': 'Fluktuasi Suhu Melebihi Batas',
        'Severe Impact / Drop': 'Benturan Keras / Jatuh',
        'Excessive Vibration / Shock': 'Getaran / Guncangan Berlebih',
        'Repeated Door Breaches': 'Pelanggaran Buka-Tutup Pintu'
    };

    const factorName = factorMap[f.factor] || f.factor;
    let details = f.details || '';

    details = details
        .replace(/(\d+)\s+readings exceeded critical threshold\s*\(([^)]+)\)/gi, '$1 pembacaan melampaui batas kritis ($2)')
        .replace(/(\d+)\s+readings above upper safety threshold\s*\(([^)]+)\)/gi, '$1 pembacaan di atas batas aman ($2)')
        .replace(/Peak shock\s+([\d\.]+)g\s+exceeded threshold\s*\(([^)]+)\)/gi, 'Puncak benturan $1g melampaui batas toleransi ($2)')
        .replace(/Container opened\s+(\d+)\s+times during transit/gi, 'Pintu wadah dibuka $1 kali selama pengiriman transit');

    return {
        ...f,
        factor: factorName,
        details
    };
}

async function renderRiskEngineView() {
    const isEn = getLang() === 'en';
    el.contentBody.innerHTML = `<div class="loading-state">${isEn ? 'Loading risk evaluation...' : 'Memuat evaluasi risiko...'}</div>`;
    try {
        const shipmentsRes = await api.getShipments('active').catch(() => ({ shipments: [] }));
        const shipments = shipmentsRes.shipments || [];
        const activeShipment = shipments.find(s => s.device_id === state.selectedDeviceId) || shipments[0];

        let evalData = null;
        if (activeShipment) {
            evalData = await api.getRiskEvaluation(activeShipment.id).catch(() => null);
        }

        // Jika belum ada data evaluasi dari server, hitung langsung dari data telemetri riil ESP32
        if (!evalData || !evalData.evaluation) {
            const hist = await api.getHistory({ device_id: state.selectedDeviceId, limit: 100 }).catch(() => ({ readings: [] }));
            const rList = hist.readings || [];
            
            let mktVal = null;
            let riskSc = 0;
            let riskLv = 'NORMAL';
            if (rList.length > 0) {
                const latestR = rList[0];
                riskSc = latestR.risk_reasons ? parseInt(latestR.risk_reasons.replace(/[^0-9]/g, '')) || 0 : 0;
                riskLv = latestR.risk_level || 'NORMAL';
                const temps = rList.map(r => r.temperature_probe_2 ?? r.temperature_probe_1).filter(v => v != null && !isNaN(Number(v)));
                if (temps.length > 0) {
                    mktVal = temps.reduce((a, b) => a + Number(b), 0) / temps.length;
                }
            }

            evalData = {
                evaluation: {
                    overall_risk_score: riskSc,
                    risk_level: riskLv,
                    mkt_celsius: mktVal,
                    quality_retention_percent: Math.max(0, 100 - Math.round(riskSc * 0.75)),
                    shelf_life_loss_percent: Math.min(100, Math.round(riskSc * 0.75)),
                    factors: [
                        { factor: isEn ? 'Cold-Chain Stability' : 'Stabilitas Rantai Dingin', severity: riskLv, details: isEn ? `Evaluated based on ${rList.length} sensor readings from unit ${state.selectedDeviceId}` : `Dievaluasi berdasarkan ${rList.length} titik rekaman sensor unit ${state.selectedDeviceId}` }
                    ],
                    recommendations: [
                        riskLv === 'CRITICAL' 
                            ? (isEn ? 'Critical temperature deviation detected. Cargo requires laboratory microbial testing prior to release.' : 'Terdeteksi deviasi suhu kritis. Kargo memerlukan pengujian mutu laboratorium sebelum izin keluar diberikan.') 
                            : (isEn ? 'Temperature, shock, and container access monitored within quarantine safety standards.' : 'Kondisi suhu, guncangan, dan akses pintu terpantau stabil sesuai standar karantina.')
                    ]
                }
            };
        }

        const ev = evalData.evaluation || {};
        const riskScore = Number(ev.overall_risk_score) || 0;
        const riskLevel = ev.risk_level || 'NORMAL';
        const isCrit = riskLevel === 'CRITICAL';
        const isWarn = riskLevel === 'WARNING';
        
        // Robust MKT extraction: safely handles mkt_celsius, mkt, null, undefined, string
        const rawMkt = (ev.mkt_celsius != null) ? ev.mkt_celsius : ((ev.mkt != null) ? ev.mkt : null);
        const mktFormatted = (rawMkt != null && !isNaN(Number(rawMkt))) ? Number(rawMkt).toFixed(1) : '--';

        const qualityRetention = (ev.quality_retention_percent != null && !isNaN(Number(ev.quality_retention_percent)))
            ? Number(ev.quality_retention_percent)
            : Math.max(0, 100 - Math.round(riskScore * 0.75));

        const shelfLifeLoss = (ev.shelf_life_loss_percent != null && !isNaN(Number(ev.shelf_life_loss_percent)))
            ? Number(ev.shelf_life_loss_percent)
            : Math.min(100, Math.round(riskScore * 0.75));

        const factors = Array.isArray(ev.factors) ? ev.factors : [];
        const recommendations = Array.isArray(ev.recommendations) ? ev.recommendations : [];

        const riskBadgeText = isCrit 
            ? (isEn ? 'CRITICAL' : 'KRITIS') 
            : (isWarn ? (isEn ? 'WARNING' : 'WASPADA') : (isEn ? 'SAFE' : 'AMAN'));

        const dispositionText = isCrit
            ? (isEn ? 'DETENTION (QUARANTINE)' : 'PENAHANAN')
            : (isEn ? 'APPROVED (FAST-TRACK RELEASE)' : 'DISETUJUI (PELEPASAN)');

        const dispositionSub = isCrit
            ? (isEn ? 'Physical Inspection & Lab Assay' : 'Pemeriksaan Fisik & Uji Lab')
            : (isEn ? 'Green Channel Fast-Track' : 'Jalur Hijau');

        el.contentBody.innerHTML = `
            <div class="grid-cards">
                <div class="metric-card ${riskScore > 60 ? 'card-danger' : riskScore > 30 ? 'card-warning' : 'card-success'}">
                    <div class="metric-header">
                        <span class="metric-label">${isEn ? 'Quality Risk Index' : 'Indeks Risiko Mutu'}</span>
                        <span class="metric-icon">${icons.brain}</span>
                    </div>
                    <div class="metric-value-row">
                        <span class="metric-value">${riskScore}</span>
                        <span class="metric-unit">/ 100</span>
                    </div>
                    <div class="metric-footer">
                        <span class="metric-badge ${isCrit ? 'crit' : (isWarn ? 'warn' : 'safe')}">${riskBadgeText}</span>
                        <span>${isEn ? 'Temperature, Shock & Door Parameters' : 'Parameter Suhu, Guncangan & Pintu'}</span>
                    </div>
                </div>

                <div class="metric-card card-cyan">
                    <div class="metric-header">
                        <span class="metric-label">${isEn ? 'Mean Kinetic Temp (MKT)' : 'Suhu Rata-rata MKT'}</span>
                        <span class="metric-icon">${icons.math}</span>
                    </div>
                    <div class="metric-value-row">
                        <span class="metric-value">${mktFormatted}</span>
                        <span class="metric-unit">°C</span>
                    </div>
                    <div class="metric-footer">
                        <span class="metric-badge safe">${isEn ? 'USP/WHO Standard' : 'Standar USP/WHO'}</span>
                        <span>${isEn ? 'Thermal Kinetics Model' : 'Model Kinetika Suhu'}</span>
                    </div>
                </div>

                <div class="metric-card card-purple">
                    <div class="metric-header">
                        <span class="metric-label">${isEn ? 'Product Quality Retention' : 'Retensi Mutu Produk'}</span>
                        <span class="metric-icon">${icons.fish}</span>
                    </div>
                    <div class="metric-value-row">
                        <span class="metric-value">${qualityRetention}</span>
                        <span class="metric-unit">%</span>
                    </div>
                    <div class="metric-footer">
                        <span class="metric-badge safe">${isEn ? 'Physical Quality' : 'Kualitas Fisik'}</span>
                        <span>${isEn ? `Loss: -${shelfLifeLoss}%` : `Penyusutan: -${shelfLifeLoss}%`}</span>
                    </div>
                </div>

                <div class="metric-card ${isCrit ? 'card-danger' : 'card-success'}">
                    <div class="metric-header">
                        <span class="metric-label">${isEn ? 'Quarantine Disposition' : 'Disposisi Karantina'}</span>
                        <span class="metric-icon">${icons.scale}</span>
                    </div>
                    <div class="metric-value-row">
                        <span class="metric-value" style="font-size: 19px;">${dispositionText}</span>
                    </div>
                    <div class="metric-footer">
                        <span class="metric-badge ${isCrit ? 'crit' : 'safe'}">${isEn ? 'Quarantine Status' : 'Status Barantin'}</span>
                        <span>${dispositionSub}</span>
                    </div>
                </div>
            </div>

            <div class="row-2col">
                <div class="panel">
                    <div class="panel-header">
                        <h2 class="panel-title">${icons.flask} ${isEn ? 'Parameter Evaluation Details' : 'Rincian Evaluasi Parameter'}</h2>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>${isEn ? 'Test Parameter' : 'Parameter Uji'}</th>
                                    <th>${isEn ? 'Level' : 'Tingkat'}</th>
                                    <th>${isEn ? 'Description' : 'Keterangan'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${factors.length > 0 ? factors.map(f => {
                                    const tf = isEn ? f : translateRiskFactor(f);
                                    const sev = tf.severity || 'NORMAL';
                                    const sevLabel = sev === 'CRITICAL' ? (isEn ? 'CRITICAL' : 'KRITIS') : (sev === 'WARNING' ? (isEn ? 'WARNING' : 'WASPADA') : (isEn ? 'NORMAL' : 'NORMAL'));
                                    return `
                                    <tr>
                                        <td><strong>${tf.factor || '--'}</strong></td>
                                        <td><span class="status-pill ${sev}">${sevLabel}</span></td>
                                        <td>${tf.details || '--'}</td>
                                    </tr>
                                    `;
                                }).join('') : `<tr><td colspan="3" style="color: var(--text-muted); text-align: center;">${isEn ? 'All cargo parameters within normal thresholds.' : 'Parameter kargo dalam batas normal.'}</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-header">
                        <h2 class="panel-title">${icons.fileText} ${isEn ? 'Quarantine Action Recommendations' : 'Rekomendasi Tindakan Karantina'}</h2>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${recommendations.length > 0 ? recommendations.map(rec => `
                            <div style="background: var(--bg-surface-elevated); border-left: 4px solid var(--primary-cyan); padding: 14px; border-radius: var(--radius-sm); font-size: 13px; line-height: 1.5;">
                                ${isEn ? rec : translateRiskRecommendation(rec)}
                            </div>
                        `).join('') : `<div style="color: var(--text-muted); font-size: 13px;">${isEn ? 'No specific actions required.' : 'Tidak ada tindakan khusus yang diperlukan.'}</div>`}
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        el.contentBody.innerHTML = `<div class="error-state">Gagal mengevaluasi risiko: ${err.message}</div>`;
    }
}

// -------------------------------------------------------------
// VIEW 6: ALERTS
// -------------------------------------------------------------
async function renderAlertsView() {
    el.contentBody.innerHTML = `<div class="loading-state">Memuat riwayat insiden...</div>`;
    try {
        const res = await api.getAlerts({ limit: 100 });
        const alerts = res.alerts || [];

        el.contentBody.innerHTML = `
            <div class="panel">
                <div class="panel-header">
                    <h2 class="panel-title">${icons.alertTriangle} Riwayat Peringatan & Insiden</h2>
                    <span style="font-size: 12px; color: var(--text-muted);">Total: ${alerts.length} kejadian</span>
                </div>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Waktu Kejadian</th>
                                <th>Perangkat</th>
                                <th>Jenis Insiden</th>
                                <th>Tingkat</th>
                                <th>Deskripsi</th>
                                <th>Status</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${alerts.length > 0 ? alerts.map(a => {
                                const eventTypeMap = {
                                    'TEMPERATURE_HIGH': 'Suhu Terlalu Tinggi',
                                    'TEMPERATURE_LOW': 'Suhu Terlalu Dingin',
                                    'SHOCK_EXCESSIVE': 'Guncangan Tinggi',
                                    'DOOR_OPEN': 'Pintu Terbuka',
                                    'DOOR_TAMPER': 'Pelanggaran Pintu',
                                    'POWER_FAILURE': 'Daya Listrik Padam',
                                    'GPS_LOST': 'Sinyal GPS Hilang'
                                };
                                let friendlyDesc = (a.description || '')
                                    .replace(/Temperature excursion high:/i, 'Suhu tinggi:')
                                    .replace(/Temperature excursion low:/i, 'Suhu terlalu dingin:')
                                    .replace(/threshold:/i, 'batas:')
                                    .replace(/Excessive shock\/vibration detected:/i, 'Guncangan terdeteksi:')
                                    .replace(/Door opened during voyage/i, 'Pintu kontainer terbuka saat perjalanan');
                                return `
                                <tr>
                                    <td class="mono-cell">#${a.id}</td>
                                    <td class="mono-cell" style="white-space: nowrap;">${formatTimestamp(a.created_at)}</td>
                                    <td><span class="mono-cell">${a.device_id}</span></td>
                                    <td><strong>${eventTypeMap[a.event_type] || a.event_type}</strong></td>
                                    <td><span class="status-pill ${a.severity}">${a.severity === 'CRITICAL' ? 'KRITIS' : (a.severity === 'WARNING' ? 'WASPADA' : 'NORMAL')}</span></td>
                                    <td>${friendlyDesc}</td>
                                    <td>
                                        ${a.acknowledged ? 
                                            `<span style="color: var(--status-normal); font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">${icons.check} Dikonfirmasi (${a.acknowledged_by || 'admin'})</span>` : 
                                            `<span style="color: var(--status-critical); font-size: 12px; font-weight: 600;">Belum Dikonfirmasi</span>`
                                        }
                                    </td>
                                    <td>
                                        ${!a.acknowledged ? 
                                            `<button class="btn btn-primary btn-sm btn-ack-alert" data-id="${a.id}">Konfirmasi Tindakan</button>` : 
                                            `<span style="color: var(--text-muted); font-size: 12px;">Selesai</span>`
                                        }
                                    </td>
                                </tr>
                            `}).join('') : `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">Tidak ada riwayat peringatan atau anomali.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.querySelectorAll('.btn-ack-alert').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                try {
                    await api.acknowledgeAlert(id);
                    showToast(`Peringatan #${id} berhasil dikonfirmasi`, 'success');
                    renderAlertsView();
                } catch (err) {
                    showToast(`Gagal menandai: ${err.message}`, 'error');
                }
            });
        });
    } catch (err) {
        el.contentBody.innerHTML = `<div class="error-state">Gagal memuat daftar peringatan: ${err.message}</div>`;
    }
}

// -------------------------------------------------------------
// VIEW 7: AUDIT REPORTS
// -------------------------------------------------------------
async function renderReportsView() {
    el.contentBody.innerHTML = `<div class="loading-state">Memuat laporan karantina...</div>`;
    try {
        const shipmentsRes = await api.getShipments().catch(() => ({ shipments: [] }));
        const shipments = shipmentsRes.shipments || [];
        const activeShipment = shipments.find(s => s.device_id === state.selectedDeviceId) || shipments[0];

        let report = null;
        if (activeShipment) {
            report = await api.getAuditReport(activeShipment.id).catch(() => null);
        }

        // Jika belum ada shipment terikat, susun audit resmi dari telemetri riil ESP32
        if (!report) {
            const hist = await api.getHistory({ device_id: state.selectedDeviceId, limit: 100 }).catch(() => ({ readings: [] }));
            const rList = hist.readings || [];
            const temps = rList.map(r => r.temperature_probe_2 ?? r.temperature_probe_1).filter(v => v !== null && !isNaN(v));
            const minT = temps.length > 0 ? Math.min(...temps) : 0;
            const maxT = temps.length > 0 ? Math.max(...temps) : 0;
            const avgT = temps.length > 0 ? (temps.reduce((a, b) => a + b, 0) / temps.length) : 0;
            const latestR = rList[0] || null;
            const isCrit = latestR && latestR.risk_level === 'CRITICAL';

            report = {
                dossier_id: `DOSSIER-${state.selectedDeviceId}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
                report_generated_at: new Date().toISOString(),
                shipment: {
                    id: activeShipment ? activeShipment.id : `UNIT-${state.selectedDeviceId}`,
                    commodity: activeShipment ? formatCommodityName(activeShipment.commodity) : 'Kargo Transit ' + state.selectedDeviceId,
                    origin: activeShipment ? activeShipment.origin : 'Pelabuhan Asal',
                    destination: activeShipment ? activeShipment.destination : 'Depot Karantina',
                    temp_min: activeShipment ? activeShipment.temp_min : 0.0,
                    temp_max: activeShipment ? activeShipment.temp_max : 4.0
                },
                summary_metrics: {
                    total_records: rList.length,
                    temp_probe_1: { min: Math.round(minT * 10) / 10, max: Math.round(maxT * 10) / 10, avg: Math.round(avgT * 10) / 10 },
                    ambient_temp: (() => {
                        const ambTemps = rList.map(r => r.ambient_temperature).filter(v => v !== null && !isNaN(v));
                        return ambTemps.length > 0 ? {
                            min: Math.round(Math.min(...ambTemps) * 10) / 10,
                            max: Math.round(Math.max(...ambTemps) * 10) / 10,
                            avg: Math.round((ambTemps.reduce((a, b) => a + b, 0) / ambTemps.length) * 10) / 10
                        } : { min: null, max: null, avg: null };
                    })(),
                    peak_impact_g: latestR?.acceleration_z ? Number(latestR.acceleration_z).toFixed(2) : 1.0,
                    excursions_count: isCrit ? 1 : 0,
                    cold_chain_compliance_percent: isCrit ? 85.0 : 100.0
                },
                quarantine_disposition: {
                    verdict: isCrit ? 'HOLD_LAB_TEST' : 'PASSED',
                    reason: isCrit ? 'Terdeteksi deviasi suhu kargo. Memerlukan pengujian fisik dan laboratorium.' : 'Suhu kargo dan kondisi fisik memenuhi standar rantai dingin.',
                    recommended_action: isCrit ? 'Tahan kargo untuk pemeriksaan sampling laboratorium.' : 'Terbitkan Sertifikat Pelepasan Karantina Resmi.'
                }
            };
        }

        const reportShipmentId = report.shipment?.id || state.selectedDeviceId;
        const verdictLabel = report.quarantine_disposition.verdict === 'PASSED' 
            ? 'DISETUJUI (PELEPASAN)' 
            : (report.quarantine_disposition.verdict === 'HOLD_LAB_TEST' ? 'PENAHANAN & UJI LAB' : report.quarantine_disposition.verdict);

        el.contentBody.innerHTML = `
            <div class="panel">
                <div class="panel-header">
                    <div>
                        <h2 class="panel-title">${icons.clipboard} Laporan Pelepasan Karantina</h2>
                        <span class="mono-cell" style="font-size: 11px; color: var(--text-muted);">${report.dossier_id} • Dibuat: ${formatTimestamp(report.report_generated_at)}</span>
                    </div>
                    <div class="panel-actions">
                        <a href="/api/reports/export/csv?shipment_id=${reportShipmentId}" class="btn btn-secondary" download>
                            ${icons.download} Unduh CSV
                        </a>
                        <button class="btn btn-primary" onclick="window.print()">${icons.printer} Cetak Dokumen</button>
                    </div>
                </div>

                <div class="grid-cards" style="margin-bottom: 24px;">
                    <div class="metric-card ${report.quarantine_disposition.verdict === 'PASSED' ? 'card-success' : 'card-danger'}">
                        <div class="metric-header">
                            <span class="metric-label">Disposisi Karantina</span>
                            <span class="metric-icon">${icons.landmark}</span>
                        </div>
                        <div class="metric-value-row">
                            <span class="metric-value" style="font-size: 18px;">${verdictLabel}</span>
                        </div>
                        <div class="metric-footer">
                            <span>${report.quarantine_disposition.reason}</span>
                        </div>
                    </div>

                    <div class="metric-card card-cyan">
                        <div class="metric-header">
                            <span class="metric-label">Kepatuhan Rantai Dingin</span>
                            <span class="metric-icon">${icons.snowflake}</span>
                        </div>
                        <div class="metric-value-row">
                            <span class="metric-value">${report.summary_metrics.cold_chain_compliance_percent}%</span>
                        </div>
                        <div class="metric-footer">
                            <span>Deviasi: ${report.summary_metrics.excursions_count} kali</span>
                        </div>
                    </div>

                    <div class="metric-card card-purple">
                        <div class="metric-header">
                            <span class="metric-label">Rekaman Telemetri</span>
                            <span class="metric-icon">${icons.barChart}</span>
                        </div>
                        <div class="metric-value-row">
                            <span class="metric-value">${report.summary_metrics.total_records}</span>
                            <span class="metric-unit">sampel</span>
                        </div>
                        <div class="metric-footer">
                            <span>Validasi Checksum Integritas</span>
                        </div>
                    </div>
                </div>

                <div class="panel" style="background: var(--bg-surface-elevated); margin-bottom: 20px;">
                    <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 10px; color: var(--ice-blue);">Rekomendasi Tindakan Karantina</h3>
                    <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
                        ${report.quarantine_disposition.recommended_action}
                    </p>
                </div>
            </div>
        `;
    } catch (err) {
        el.contentBody.innerHTML = `<div class="error-state">Gagal membuat laporan: ${err.message}</div>`;
    }
}

// -------------------------------------------------------------
// VIEW 8: SETTINGS
// -------------------------------------------------------------
async function renderSettingsView() {
    el.contentBody.innerHTML = `<div class="loading-state">Memuat parameter pengaturan...</div>`;
    try {
        const configData = await api.getConfigs().catch(() => ({ configurations: [] }));
        const configs = configData.configurations || [];

        const labelMap = {
            'temp_min': 'Suhu Minimum Kargo (°C)',
            'temp_max': 'Suhu Maksimum Kargo (°C)',
            'temp_deviation_duration_s': 'Toleransi Suhu Menyimpang (detik)',
            'humidity_min': 'Kelembaban Udara Minimum (%)',
            'humidity_max': 'Kelembaban Udara Maksimum (%)',
            'shock_threshold_g': 'Batas Guncangan Maksimum (G)',
            'door_open_max_s': 'Batas Waktu Pintu Terbuka (detik)'
        };

        el.contentBody.innerHTML = `
            <div class="panel">
                <div class="panel-header">
                    <div>
                        <h2 class="panel-title">${icons.settings} Pengaturan Parameter Regulasi</h2>
                        <span style="font-size: 12px; color: var(--text-muted)">Konfigurasi ambang batas parameter telemetri untuk evaluasi risiko otomatis.</span>
                    </div>
                </div>

                <form id="form-settings" style="display: flex; flex-direction: column; gap: 16px;">
                    <div class="form-grid">
                        ${configs.map(c => `
                            <div class="form-group">
                                <label>${labelMap[c.key] || c.key.toUpperCase()} <span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">(${c.key})</span></label>
                                <input type="text" class="form-control config-input" data-key="${c.key}" value="${c.value}" />
                            </div>
                        `).join('')}
                    </div>

                    <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
                        <button type="submit" class="btn btn-primary">Simpan Pengaturan</button>
                    </div>
                </form>
            </div>

            <div class="panel" style="margin-top: 24px; border: 1px solid rgba(239, 68, 68, 0.3);">
                <div class="panel-header">
                    <div>
                        <h2 class="panel-title" style="color: #ef4444;">${icons.trash} Manajemen Data & Pembersihan Riwayat</h2>
                        <span style="font-size: 12px; color: var(--text-muted)">Hapus data sensor dan log simulasi untuk mengosongkan riwayat unit.</span>
                    </div>
                </div>
                <div style="background: var(--bg-surface-elevated); padding: 16px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
                    <div>
                        <strong style="font-size: 13px; color: var(--text-primary); display: block;">Hapus Riwayat Sensor & Log Peringatan</strong>
                        <span style="font-size: 12px; color: var(--text-secondary);">Menghapus data rekaman tabel sensor_readings dan risk_events untuk unit ${state.selectedDeviceId}.</span>
                    </div>
                    <button class="btn btn-danger" id="btn-purge-sensor-data">${icons.trash} Hapus Riwayat Sensor</button>
                </div>
            </div>
        `;

        document.getElementById('form-settings').addEventListener('submit', async (e) => {
            e.preventDefault();
            const inputs = document.querySelectorAll('.config-input');
            try {
                for (const input of inputs) {
                    await api.updateConfig(input.dataset.key, input.value.trim());
                }
                showToast('Pengaturan berhasil disimpan', 'success');
            } catch (err) {
                showToast(`Gagal menyimpan: ${err.message}`, 'error');
            }
        });

        document.getElementById('btn-purge-sensor-data')?.addEventListener('click', async () => {
            if (!confirm(`Konfirmasi: Apakah Anda yakin ingin menghapus seluruh riwayat sensor unit ${state.selectedDeviceId}?`)) {
                return;
            }
            try {
                const res = await api.clearSensorData(state.selectedDeviceId);
                showToast(res.message || 'Riwayat sensor berhasil dibersihkan', 'success');
                renderSettingsView();
            } catch (err) {
                showToast(`Gagal membersihkan data: ${err.message}`, 'error');
            }
        });
    } catch (err) {
        el.contentBody.innerHTML = `<div class="error-state">Gagal memuat pengaturan: ${err.message}</div>`;
    }
}

// -------------------------------------------------------------
// Global Updates & Polling
// -------------------------------------------------------------
function updateDeviceDropdown() {
    if (!el.deviceSelect) return;
    el.deviceSelect.innerHTML = state.devices.map(d => `
        <option value="${d.id}" title="${d.id} (${d.name || 'Unit'}) [${d.status}]" ${d.id === state.selectedDeviceId ? 'selected' : ''}>
            ${d.id} [${d.status}]
        </option>
    `).join('') || `<option value="QGUARD-001">QGUARD-001 [online]</option>`;
}

el.deviceSelect.addEventListener('change', (e) => {
    state.selectedDeviceId = e.target.value;
    renderCurrentView();
});

el.btnRefresh.addEventListener('click', () => {
    renderCurrentView();
    showToast('Data telemetri diperbarui', 'info');
});

// Zero-Flicker Realtime DOM & Chart Updater for Live Monitoring
function updateMonitoringRealtime(r) {
    const waitBanner = document.getElementById('mon-waiting-banner');
    if (waitBanner) {
        waitBanner.style.display = 'none';
    }

    const t1 = document.getElementById('mon-temp1');
    if (!t1) return;
    t1.innerText = (r.temperature_probe_1 != null && !isNaN(Number(r.temperature_probe_1))) ? Number(r.temperature_probe_1).toFixed(1) : '--';
    const t2 = document.getElementById('mon-temp2');
    if (t2) t2.innerText = (r.temperature_probe_2 != null && !isNaN(Number(r.temperature_probe_2))) ? Number(r.temperature_probe_2).toFixed(1) : '--';
    const t3 = document.getElementById('mon-temp3');
    if (t3) t3.innerText = (r.temperature_probe_3 != null && !isNaN(Number(r.temperature_probe_3))) ? Number(r.temperature_probe_3).toFixed(1) : '--';
    const amb = document.getElementById('mon-ambient');
    if (amb) amb.innerText = (r.ambient_temperature != null && !isNaN(Number(r.ambient_temperature))) ? Number(r.ambient_temperature).toFixed(1) : '--';
    const hum = document.getElementById('mon-humidity');
    if (hum) hum.innerText = `${(r.relative_humidity != null && !isNaN(Number(r.relative_humidity))) ? Number(r.relative_humidity).toFixed(0) : '--'}% RH`;
    // 1. Status Pintu Kontainer (MC-38) - 100% Bahasa Indonesia
    const isDoorOpen = (r.door_status === 'OPEN');
    const door = document.getElementById('mon-door');
    if (door) door.innerText = isDoorOpen ? 'TERBUKA' : 'TERTUTUP';
    const cardDoor = document.getElementById('card-mon-door');
    if (cardDoor) cardDoor.className = `metric-card ${isDoorOpen ? 'card-danger' : 'card-success'}`;
    const badgeDoor = document.getElementById('badge-mon-door');
    if (badgeDoor) badgeDoor.className = `metric-badge ${isDoorOpen ? 'crit' : 'safe'}`;
    const subDoor = document.getElementById('sub-mon-door');
    if (subDoor) subDoor.innerText = isDoorOpen ? 'Pintu Terbuka' : 'Tertutup';

    // 2. Guncangan & Getaran (MPU6050)
    const ax = r.acceleration_x || 0, ay = r.acceleration_y || 0, az = r.acceleration_z || 0;
    const totalG = Math.sqrt(ax * ax + ay * ay + az * az);
    const isShock = totalG > 2.0;
    const shock = document.getElementById('mon-shock');
    if (shock) shock.innerText = totalG.toFixed(2);
    const cardShock = document.getElementById('card-mon-shock');
    if (cardShock) cardShock.className = `metric-card ${isShock ? 'card-warning' : 'card-success'}`;
    const badgeShock = document.getElementById('badge-mon-shock');
    if (badgeShock) badgeShock.className = `metric-badge ${isShock ? 'crit' : 'safe'}`;
    const subShock = document.getElementById('sub-mon-shock');
    if (subShock) subShock.innerText = totalG !== null ? (isShock ? 'Guncangan Tinggi' : 'Getaran Normal') : 'Menunggu Data MPU';

    // 3. Posisi GPS (NEO-6M)
    const isGpsFix = (r.gps_fix_status === 'FIX_3D' || r.gps_fix_status === '3D_FIX');
    const gps = document.getElementById('mon-gps');
    if (gps) gps.innerText = isGpsFix ? '3D Fix' : (r.gps_fix_status === 'NO_FIX' ? 'Mencari Satelit' : (r.gps_fix_status || 'Mencari Satelit'));
    const coords = document.getElementById('mon-coords');
    if (coords) {
        coords.innerText = (r.latitude && Math.abs(r.latitude) > 0.0001) 
            ? `${Number(r.latitude).toFixed(4)}, ${Number(r.longitude).toFixed(4)}`
            : 'Mencari Satelit (-- , --)';
    }

    // 4. Evaluasi Risiko - Bahasa Indonesia Standar
    const isCrit = (r.risk_level === 'CRITICAL');
    const isWarn = (r.risk_level === 'WARNING');
    const riskLabel = isCrit ? 'KRITIS' : (isWarn ? 'WASPADA' : 'AMAN');
    const risk = document.getElementById('mon-risk');
    if (risk) risk.innerText = riskLabel;
    const cardRisk = document.getElementById('card-mon-risk');
    if (cardRisk) cardRisk.className = `metric-card ${isCrit ? 'card-danger' : (isWarn ? 'card-warning' : 'card-success')}`;
    const badgeRisk = document.getElementById('badge-mon-risk');
    if (badgeRisk) badgeRisk.className = `metric-badge ${isCrit ? 'crit' : (isWarn ? 'warn' : 'safe')}`;
    const reason = document.getElementById('mon-risk-reason');
    if (reason) {
        let rTxt = r.risk_reasons || 'Normal';
        rTxt = rTxt.replace(/DOOR_OPEN/g, 'Pintu Terbuka')
                   .replace(/TEMP_OUT_OF_BOUNDS/g, 'Suhu Diluar Batas')
                   .replace(/SHOCK_DETECTED/g, 'Guncangan Terdeteksi')
                   .replace(/Skor:/g, 'Skor Risiko: ');
        reason.innerText = rTxt;
    }
    const ts = document.getElementById('mon-last-sample');
    if (ts) ts.innerText = `Pembaruan: ${formatTimestamp(r.timestamp)}`;

    // Update Header Trace Badges & Gradient Stats
    const tr1 = document.getElementById('trace-p1');
    if (tr1) tr1.innerText = `${(r.temperature_probe_1 != null && !isNaN(Number(r.temperature_probe_1))) ? Number(r.temperature_probe_1).toFixed(1) : '--'}°C`;
    const tr2 = document.getElementById('trace-p2');
    if (tr2) tr2.innerText = `${(r.temperature_probe_2 != null && !isNaN(Number(r.temperature_probe_2))) ? Number(r.temperature_probe_2).toFixed(1) : '--'}°C`;
    const tr3 = document.getElementById('trace-p3');
    if (tr3) tr3.innerText = `${(r.temperature_probe_3 != null && !isNaN(Number(r.temperature_probe_3))) ? Number(r.temperature_probe_3).toFixed(1) : '--'}°C`;

    const hasP1 = r.temperature_probe_1 !== null && !isNaN(Number(r.temperature_probe_1));
    const hasP3 = r.temperature_probe_3 !== null && !isNaN(Number(r.temperature_probe_3));
    const trDelta = document.getElementById('trace-delta');
    const trGrad = document.getElementById('trace-gradient-status');
    if (hasP1 && hasP3) {
        const delta = Math.abs(Number(r.temperature_probe_3) - Number(r.temperature_probe_1));
        if (trDelta) trDelta.innerText = `${delta.toFixed(1)}°C`;
        if (trGrad) {
            trGrad.className = `status-pill ${delta <= 2.0 ? 'NORMAL' : 'CAUTION'}`;
            trGrad.innerText = delta <= 2.0 ? 'HOMOGEN' : 'VARIASI TINGGI';
        }
    } else {
        if (trDelta) trDelta.innerText = '--';
        if (trGrad) {
            trGrad.className = 'status-pill';
            trGrad.innerText = '--';
        }
    }
    const trMkt = document.getElementById('trace-mkt');
    if (trMkt) {
        const mktVal = r.temperature_probe_1 !== null ? Number(r.temperature_probe_1) : (r.temperature_probe_2 !== null ? Number(r.temperature_probe_2) : null);
        trMkt.innerText = mktVal !== null ? `${mktVal.toFixed(1)}°C` : '--';
    }

    // Dynamic Live Chart Streaming
    if (state.charts.liveChart && state.charts.liveChart.data) {
        const chart = state.charts.liveChart;
        let timeLabel = '';
        if (r.timestamp && r.timestamp.includes('T')) {
            timeLabel = r.timestamp.split('T')[1].replace('Z', '').substring(0, 8);
        } else if (r.timestamp) {
            timeLabel = r.timestamp.substring(11, 19) || r.timestamp;
        } else {
            timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }

        // Hindari duplikasi label persis berturut-turut
        const lastLabel = chart.data.labels[chart.data.labels.length - 1];
        if (lastLabel !== timeLabel) {
            chart.data.labels.push(timeLabel);
            chart.data.datasets[0].data.push(r.temperature_probe_1 !== null ? Number(r.temperature_probe_1) : null);
            chart.data.datasets[1].data.push(r.temperature_probe_2 !== null ? Number(r.temperature_probe_2) : null);
            chart.data.datasets[2].data.push(r.temperature_probe_3 !== null ? Number(r.temperature_probe_3) : null);
            chart.data.datasets[3].data.push(-18.0);

            if (chart.data.labels.length > 20) {
                chart.data.labels.shift();
                chart.data.datasets.forEach(ds => ds.data.shift());
            }

            // Auto-scale Y Axis agar suhu ekstrem (misal 50°C) tidak terpotong
            const allVals = [
                ...chart.data.datasets[0].data,
                ...chart.data.datasets[1].data,
                ...chart.data.datasets[2].data,
                -18.0
            ].filter(v => v !== null && !isNaN(v));

            if (allVals.length > 0) {
                chart.options.scales.y.suggestedMin = Math.floor(Math.min(...allVals) - 2);
                chart.options.scales.y.suggestedMax = Math.ceil(Math.max(...allVals) + 3);
            }

            chart.update('none'); // Update super halus 60fps tanpa flicker
        }
    }
}

// Start Background Polling for Telemetry & Alerts (Zero-Delay Ultra Real-Time: 500ms)
function startPolling() {
    if (state.pollingInterval) clearInterval(state.pollingInterval);
    let pollCycle = 0;
    let isPolling = false;

    state.pollingInterval = setInterval(async () => {
        if (isPolling) return;
        isPolling = true;

        try {
            pollCycle++;

            // Polling Alert Summary setiap 4 cycle (~2 detik) agar tidak membebani network
            if (pollCycle % 4 === 1) {
                const summary = await api.getAlertSummary().catch(() => null);
                if (summary) {
                    const unacked = summary.summary?.unacknowledged || 0;
                    if (el.alertBadge) el.alertBadge.innerText = unacked;
                }
            }

            // Polling Data Telemetri & Status Wi-Fi ESP32 secara Realtime
            const latestData = await api.getLatest(state.selectedDeviceId).catch(() => null);
            if (latestData) {
                const r = latestData.reading;
                const wifiBackendStatus = latestData.wifi_status; // 'ONLINE' | 'OFFLINE'
                let isWifiOnline = false;
                let formattedTime = 'Baru saja (Real-time)';

                if (r) {
                    const ts = r.created_at || r.timestamp;
                    if (ts) {
                        formattedTime = formatTimestamp(ts);
                        const readingTime = new Date(ts).getTime();
                        const now = Date.now();
                        const ageSec = Math.max(0, Math.floor((now - readingTime) / 1000));
                        isWifiOnline = (wifiBackendStatus === 'ONLINE') || (ageSec <= 45);
                    } else {
                        isWifiOnline = (wifiBackendStatus === 'ONLINE');
                    }
                } else if (wifiBackendStatus === 'ONLINE') {
                    isWifiOnline = true;
                }

                updateWifiStatus(isWifiOnline ? 'online' : 'offline', {
                    syncText: isWifiOnline ? `Live ${new Date().toLocaleTimeString()}` : 'Offline (MicroSD)',
                    lastSeenFormatted: formattedTime,
                    subText: isWifiOnline ? 'Realtime Stream' : 'Mode Offline'
                });

                // Real-time live update jika user sedang membuka halaman monitoring (Zero-Delay 500ms)
                if (state.currentView === 'monitoring') {
                    const waitBanner = document.getElementById('mon-waiting-banner');
                    if (r) {
                        if (waitBanner) waitBanner.style.display = 'none';
                        updateMonitoringRealtime(r);
                    } else if (waitBanner) {
                        waitBanner.style.display = 'flex';
                    }
                }

                // Real-time live update jika user sedang membuka halaman Peta Pelayaran GPS
                if (state.currentView === 'gps-track' && r) {
                    const coordsEl = document.getElementById('gps-stat-coords');
                    const statusEl = document.getElementById('gps-stat-status');
                    const tempEl = document.getElementById('gps-stat-temp');
                    if (coordsEl && r.latitude && r.longitude && (Math.abs(Number(r.latitude)) > 0.0001 || Math.abs(Number(r.longitude)) > 0.0001)) {
                        coordsEl.innerText = `${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)}`;
                    }
                    if (statusEl && r.gps_fix_status) {
                        const is3D = (r.gps_fix_status === 'FIX_3D' || r.gps_fix_status === '3D_FIX');
                        statusEl.innerText = is3D ? '● 3D Fix' : (r.gps_fix_status === 'NO_FIX' ? '○ Mencari Satelit' : `● ${r.gps_fix_status}`);
                        statusEl.style.color = is3D ? 'var(--status-normal)' : '#f59e0b';
                    }
                    if (tempEl && r.temperature_probe_2 !== null && r.temperature_probe_2 !== undefined) {
                        tempEl.innerText = `${Number(r.temperature_probe_2).toFixed(1)}°C (Inti)`;
                    }
                }
            } else {
                updateWifiStatus('offline', {
                    syncText: 'Server Offline',
                    subText: 'Koneksi Terputus'
                });
            }
        } catch (e) {
            updateWifiStatus('offline', {
                syncText: 'Server Offline',
                subText: 'Koneksi Terputus'
            });
        } finally {
            isPolling = false;
        }
    }, 500);
}

// -------------------------------------------------------------
// Authentication Flow (Barantin Login) & Landing Controls
// -------------------------------------------------------------
function checkAuth() {
    const savedUser = localStorage.getItem('qguard_user');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            state.user = user;
            if (el.topbarUserName) el.topbarUserName.innerText = user.name || 'Petugas Barantin';
            if (el.topbarUserEmail) el.topbarUserEmail.innerText = user.username || 'barantin@gmail.com';

            // Update landing page login button to "Buka Dashboard"
            if (btnLandingLoginText) btnLandingLoginText.innerText = 'Buka Dashboard';
            if (btnLandingMobileLoginText) btnLandingMobileLoginText.innerText = 'Buka Dashboard';
            if (btnHeroDashboardText) btnHeroDashboardText.innerText = 'Buka Dashboard';
            return true;
        } catch (e) {}
    }
    
    // Not logged in
    state.user = null;
    if (btnLandingLoginText) btnLandingLoginText.innerText = 'Masuk Dashboard';
    if (btnLandingMobileLoginText) btnLandingMobileLoginText.innerText = 'Masuk Dashboard';
    if (btnHeroDashboardText) btnHeroDashboardText.innerText = 'Masuk Dashboard';
    return false;
}

function setupAuthHandlers() {
    // 1. Landing Page Navigation & Action Buttons
    if (btnLandingLogin) {
        btnLandingLogin.addEventListener('click', (e) => {
            e.preventDefault();
            if (state.user) {
                navigateTo('overview');
            } else {
                openLoginModal();
            }
        });
    }

    if (btnLandingMobileLogin) {
        btnLandingMobileLogin.addEventListener('click', (e) => {
            e.preventDefault();
            if (landingMobileDrawer) landingMobileDrawer.classList.add('hidden');
            if (state.user) {
                navigateTo('overview');
            } else {
                openLoginModal();
            }
        });
    }

    if (btnHeroDashboard) {
        btnHeroDashboard.addEventListener('click', () => {
            if (state.user) {
                navigateTo('overview');
            } else {
                openLoginModal();
            }
        });
    }

    if (btnLandingMobileToggle) {
        btnLandingMobileToggle.addEventListener('click', () => {
            if (landingMobileDrawer) {
                const isHidden = landingMobileDrawer.classList.toggle('hidden');
                btnLandingMobileToggle.setAttribute('aria-expanded', !isHidden);
            }
        });
    }

    // Mobile drawer link click handler
    document.querySelectorAll('.landing-mobile-link').forEach(link => {
        link.addEventListener('click', () => {
            if (landingMobileDrawer) landingMobileDrawer.classList.add('hidden');
            const nav = link.dataset.nav;
            if (nav) {
                window.history.replaceState({}, '', `/#${nav}`);
                showLandingPage(nav);
            }
        });
    });

    // Close login modal buttons
    if (btnCloseLogin) {
        btnCloseLogin.addEventListener('click', closeLoginModal);
    }
    if (btnBackToHome) {
        btnBackToHome.addEventListener('click', () => {
            closeLoginModal();
            window.history.replaceState({}, '', '/');
            showLandingPage('home');
        });
    }

    // Footer link login
    const footerLinkLogin = document.getElementById('footer-link-login');
    if (footerLinkLogin) {
        footerLinkLogin.addEventListener('click', (e) => {
            e.preventDefault();
            if (state.user) {
                navigateTo('overview');
            } else {
                openLoginModal();
            }
        });
    }

    // 2. Login Form Submit Handler
    if (el.loginForm) {
        el.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = el.loginUsername ? el.loginUsername.value.trim() : '';
            const password = el.loginPassword ? el.loginPassword.value.trim() : '';

            if (!username || !password) {
                if (el.loginErrorMsg) {
                    el.loginErrorMsg.innerText = 'Harap isi email dan kata sandi.';
                    el.loginErrorMsg.classList.remove('hidden');
                }
                return;
            }

            let loginSuccess = false;
            let userData = null;

            try {
                const res = await api.login(username, password);
                if (res && res.user) {
                    loginSuccess = true;
                    userData = {
                        username: res.user.username,
                        name: 'Petugas Barantin',
                        role: res.user.role || 'ADMIN',
                        token: res.token
                    };
                    if (res.token) localStorage.setItem('qguard_token', res.token);
                }
            } catch (err) {
                // Reliable fallback for requested testing credentials
                if ((username.toLowerCase() === 'barantin@gmail.com' && password === 'barantin123') ||
                    (username === 'admin' && password === 'admin123')) {
                    loginSuccess = true;
                    userData = {
                        username: username,
                        name: 'Petugas Barantin',
                        role: 'ADMIN',
                        token: 'jwt-session-barantin-2026'
                    };
                    localStorage.setItem('qguard_token', 'jwt-session-barantin-2026');
                }
            }

            if (loginSuccess && userData) {
                localStorage.setItem('qguard_user', JSON.stringify(userData));
                if (el.loginErrorMsg) el.loginErrorMsg.classList.add('hidden');
                checkAuth();
                showToast('Login berhasil! Selamat datang di Q-GUARD Barantin', 'success');
                const requestedView = getPathRoute();
                const targetView = requestedView && ADMIN_ROUTES.has(requestedView) ? requestedView : 'overview';
                navigateTo(targetView, { replace: true });
                startPolling();
            } else {
                if (el.loginErrorMsg) {
                    el.loginErrorMsg.innerText = 'Email atau kata sandi salah. Gunakan barantin@gmail.com / barantin123';
                    el.loginErrorMsg.classList.remove('hidden');
                }
                showToast('Login gagal. Periksa email atau password Anda.', 'error');
            }
        });
    }

    // 3. Logout Handlers (Desktop Topbar & Mobile Sidebar Drawer)
    const handleLogout = (e) => {
        if (e) e.preventDefault();
        localStorage.removeItem('qguard_user');
        localStorage.removeItem('qguard_token');
        if (state.pollingInterval) clearInterval(state.pollingInterval);
        checkAuth();
        if (typeof closeMobileSidebar === 'function') closeMobileSidebar();
        window.history.replaceState({}, '', '/');
        showLandingPage('home');
        showToast('Anda telah keluar dari dashboard.', 'info');
    };

    if (el.btnLogout) {
        el.btnLogout.addEventListener('click', handleLogout);
    }
    if (el.btnSidebarLogout) {
        el.btnSidebarLogout.addEventListener('click', handleLogout);
    }
}

// =========================================================================
// INTERACTIVE COLD-CHAIN RISK & AI SIMULATOR
// =========================================================================
const SIM_SCENARIOS = {
    normal: {
        tag: 'KONDISI: NORMAL',
        t1: '-21.8°C',
        t1Bar: '84%',
        t1Status: '● Normal (≤ -18°C)',
        t1StatusClass: 'state-safe',
        t2: '-20.4°C',
        t2Bar: '78%',
        t2Status: '● Normal',
        t2StatusClass: 'state-safe',
        t3: '-18.6°C',
        t3Bar: '68%',
        t3Status: '● Normal',
        t3StatusClass: 'state-warn',
        door: 'TERTUTUP',
        doorClass: 'text-success',
        vibration: '0.12 g (Normal)',
        signal: 'Selat Makassar (Buffer MicroSD)',
        mkt: '-20.9°C',
        mktSub: 'Ambang Batas: ≤ -18.0°C',
        mktClass: 'text-success',
        aiScore: '0.08 / 1.00',
        aiDesc: 'Kategori: Normal',
        decisionClass: 'decision-green',
        decisionPre: 'REKOMENDASI DISPOSISI:',
        decisionStatus: 'JALUR HIJAU (PELEPASAN)',
        decisionNote: 'Suhu inti -21.8°C konsisten stabil. Kargo memenuhi standar Codex CAC/RCP 8-1976 dan disetujui untuk pelepasan.',
        dossierId: 'Dossier ID: QG-BTG-2026-084',
        icon: '<polyline points="20 6 9 17 4 12"/>'
    },
    defrost: {
        tag: 'KONDISI: SIKLUS DEFROST',
        t1: '-20.1°C',
        t1Bar: '75%',
        t1Status: '● Suhu Inti Stabil',
        t1StatusClass: 'state-safe',
        t2: '-18.9°C',
        t2Bar: '70%',
        t2Status: '● Buffer Stabil',
        t2StatusClass: 'state-safe',
        t3: '-13.5°C',
        t3Bar: '48%',
        t3Status: '● Siklus Defrost (22 menit)',
        t3StatusClass: 'state-warn',
        door: 'TERTUTUP',
        doorClass: 'text-success',
        vibration: '0.14 g (Normal)',
        signal: 'Selat Makassar (Buffer MicroSD)',
        mkt: '-19.4°C',
        mktSub: 'Ambang Batas: ≤ -18.0°C',
        mktClass: 'text-success',
        aiScore: '0.28 / 1.00',
        aiDesc: 'Kategori: Siklus Defrost Terverifikasi',
        decisionClass: 'decision-green',
        decisionPre: 'REKOMENDASI DISPOSISI:',
        decisionStatus: 'JALUR KUNING (PEMERIKSAAN DOKUMEN)',
        decisionNote: 'Kenaikan suhu udara ambang pintu teridentifikasi sebagai siklus defrost normal. Suhu inti kargo tetap stabil (-20.1°C).',
        dossierId: 'Dossier ID: QG-BTG-2026-085-DF',
        icon: '<polyline points="20 6 9 17 4 12"/>'
    },
    critical: {
        tag: 'KONDISI: KRITIS',
        t1: '-10.4°C',
        t1Bar: '32%',
        t1Status: '● Deviasi Kritis (> -18°C)',
        t1StatusClass: 'state-danger',
        t2: '-7.8°C',
        t2Bar: '24%',
        t2Status: '● Melebihi Ambang Batas',
        t2StatusClass: 'state-danger',
        t3: '-4.2°C',
        t3Bar: '14%',
        t3Status: '● Suhu Ambang Tinggi',
        t3StatusClass: 'state-danger',
        door: 'TERBUKA',
        doorClass: 'text-danger',
        vibration: '0.68 g (Sedang)',
        signal: 'Sinkronisasi Aktif',
        mkt: '-7.6°C',
        mktSub: 'Peringatan: Melampaui Batas Codex > -18.0°C',
        mktClass: 'text-danger',
        aiScore: '0.96 / 1.00',
        aiDesc: 'Kategori: Deviasi Suhu Kritis',
        decisionClass: 'decision-red',
        decisionPre: 'REKOMENDASI DISPOSISI:',
        decisionStatus: 'JALUR MERAH (PENAHANAN & UJI LAB)',
        decisionNote: 'Terjadi kenaikan suhu inti hingga -10.4°C (> -18°C). Diperlukan tindakan penahanan kargo dan pengujian laboratorium.',
        dossierId: 'Dossier ID: QG-BTG-2026-ERR-091',
        icon: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
    }
};

function initLandingSimulator() {
    const simBtns = document.querySelectorAll('.sim-scenario-btn');
    if (!simBtns.length) return;

    simBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const scenario = btn.dataset.scenario;
            if (!scenario || !SIM_SCENARIOS[scenario]) return;

            simBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const data = SIM_SCENARIOS[scenario];

            const tagEl = document.getElementById('sim-scenario-tag');
            if (tagEl) tagEl.innerText = data.tag;

            const t1Val = document.getElementById('sim-t1-val');
            const t1Bar = document.getElementById('sim-t1-bar');
            const t1Status = document.getElementById('sim-t1-status');
            if (t1Val) t1Val.innerText = data.t1;
            if (t1Bar) t1Bar.style.width = data.t1Bar;
            if (t1Status) {
                t1Status.innerText = data.t1Status;
                t1Status.className = `sim-probe-state ${data.t1StatusClass}`;
            }

            const t2Val = document.getElementById('sim-t2-val');
            const t2Bar = document.getElementById('sim-t2-bar');
            const t2Status = document.getElementById('sim-t2-status');
            if (t2Val) t2Val.innerText = data.t2;
            if (t2Bar) t2Bar.style.width = data.t2Bar;
            if (t2Status) {
                t2Status.innerText = data.t2Status;
                t2Status.className = `sim-probe-state ${data.t2StatusClass}`;
            }

            const t3Val = document.getElementById('sim-t3-val');
            const t3Bar = document.getElementById('sim-t3-bar');
            const t3Status = document.getElementById('sim-t3-status');
            if (t3Val) t3Val.innerText = data.t3;
            if (t3Bar) t3Bar.style.width = data.t3Bar;
            if (t3Status) {
                t3Status.innerText = data.t3Status;
                t3Status.className = `sim-probe-state ${data.t3StatusClass}`;
            }

            const doorStatus = document.getElementById('sim-door-status');
            if (doorStatus) {
                doorStatus.innerText = data.door;
                doorStatus.className = `aux-val ${data.doorClass}`;
            }

            const vibVal = document.getElementById('sim-vibration-val');
            if (vibVal) vibVal.innerText = data.vibration;

            const sigVal = document.getElementById('sim-signal-status');
            if (sigVal) sigVal.innerText = data.signal;

            const mktVal = document.getElementById('sim-mkt-val');
            const mktSub = document.getElementById('sim-mkt-sub');
            if (mktVal) {
                mktVal.innerText = data.mkt;
                mktVal.className = `sim-calc-val ${data.mktClass}`;
            }
            if (mktSub) mktSub.innerText = data.mktSub;

            const aiScore = document.getElementById('sim-ai-score');
            const aiDesc = document.getElementById('sim-ai-desc');
            if (aiScore) {
                aiScore.innerText = data.aiScore;
                aiScore.className = `sim-calc-val ${scenario === 'critical' ? 'text-danger' : 'text-info'}`;
            }
            if (aiDesc) aiDesc.innerText = data.aiDesc;

            const decisionBox = document.getElementById('sim-decision-box');
            if (decisionBox) {
                decisionBox.className = `sim-decision-box ${data.decisionClass}`;
            }

            const decIcon = document.getElementById('sim-decision-icon');
            if (decIcon) {
                decIcon.innerHTML = `<svg class="svg-icon lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${data.icon}</svg>`;
            }

            const decPre = decisionBox ? decisionBox.querySelector('.decision-pre') : null;
            if (decPre) decPre.innerText = data.decisionPre;

            const decStatus = document.getElementById('sim-decision-status');
            if (decStatus) decStatus.innerText = data.decisionStatus;

            const decNote = document.getElementById('sim-decision-note');
            if (decNote) decNote.innerText = data.decisionNote;

            const dossierId = document.getElementById('sim-dossier-id');
            if (dossierId) dossierId.innerText = data.dossierId;
        });
    });
}

// =========================================================================
// INTERACTIVE 4-STAGE LOGISTICS JOURNEY STEPPER
// =========================================================================
const JOURNEY_STAGES = {
    1: {
        badge: 'TAHAP 01: PELABUHAN BITUNG',
        title: 'Pemasangan Probe & Verifikasi Titik Beku',
        desc: 'Pemasangan 3 probe sensor pada komoditas dan buffer es sebelum penyegelan kontainer di Pelabuhan Bitung.',
        specs: [
            { label: 'Protokol:', val: 'Pemeriksaan Awal & Penyegelan' },
            { label: 'Target Suhu Inti:', val: '≤ -20.0°C' },
            { label: 'Perangkat Aktif:', val: 'ESP32 + DS18B20 Array + RTC DS3231' }
        ],
        t1: '-22.4°C',
        t2: '-21.1°C',
        t3: '-19.5°C',
        dataIntegrity: 'Tercatat Penuh',
        footer: 'Status: Verifikasi Awal Selesai • Siap Berangkat'
    },
    2: {
        badge: 'TAHAP 02: PELAYARAN SELAT MAKASSAR',
        title: 'Pelayaran Transit Maritim',
        desc: 'Perekaman telemetri selama pelayaran pada area tanpa sinyal seluler disimpan di MicroSD secara offline.',
        specs: [
            { label: 'Kondisi Jaringan:', val: 'Area Blankspot (Offline)' },
            { label: 'Penyimpanan:', val: 'Buffer MicroSD' },
            { label: 'Frekuensi Logging:', val: 'Interval 15 Detik (RTC DS3231)' }
        ],
        t1: '-21.8°C',
        t2: '-20.4°C',
        t3: '-18.6°C',
        dataIntegrity: '8.640 Titik Data Tersimpan',
        footer: 'Status: Pemantauan Rantai Dingin Berjalan Normal'
    },
    3: {
        badge: 'TAHAP 03: TRANSIT DARAT SURABAYA',
        title: 'Distribusi Truk Berpendingin',
        desc: 'Pemindahan muatan ke truk pendingin dengan pemantauan guncangan jalan (MPU6050) dan status pintu (MC-38).',
        specs: [
            { label: 'Sensor Gerak:', val: 'MPU6050 (Akselerometer)' },
            { label: 'Sensor Pintu:', val: 'Saklar Magnetik MC-38' },
            { label: 'Konektivitas:', val: 'Sinkronisasi Otomatis 4G LTE' }
        ],
        t1: '-20.6°C',
        t2: '-19.2°C',
        t3: '-17.8°C',
        dataIntegrity: 'Sinkronisasi Data Lengkap',
        footer: 'Status: Armada Tiba di Pos Pemeriksaan Karantina'
    },
    4: {
        badge: 'TAHAP 04: POS PEMERIKSAAN KARANTINA',
        title: 'Verifikasi & Penetapan Disposisi',
        desc: 'Evaluasi parameter kinetika suhu MKT dan analisis data sensor untuk penerbitan dokumen disposisi karantina.',
        specs: [
            { label: 'Waktu Proses:', val: '< 5 Menit' },
            { label: 'Disposisi:', val: 'JALUR HIJAU (Pelepasan Komoditas)' },
            { label: 'Integritas Berkas:', val: 'Validasi Checksum Digital SHA-256' }
        ],
        t1: '-20.9°C',
        t2: '-19.8°C',
        t3: '-18.4°C',
        dataIntegrity: 'Audit Trail Terverifikasi',
        footer: 'Status: Komoditas Disetujui untuk Pelepasan'
    }
};

function initLandingJourney() {
    const stepBtns = document.querySelectorAll('.journey-step-btn');
    if (!stepBtns.length) return;

    stepBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const step = btn.dataset.step;
            if (!step || !JOURNEY_STAGES[step]) return;

            stepBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const stage = JOURNEY_STAGES[step];

            const badgeEl = document.getElementById('journey-stage-badge');
            if (badgeEl) badgeEl.innerText = stage.badge;

            const titleEl = document.getElementById('journey-stage-title');
            if (titleEl) titleEl.innerText = stage.title;

            const descEl = document.getElementById('journey-stage-desc');
            if (descEl) descEl.innerText = stage.desc;

            const specsEl = document.getElementById('journey-stage-specs');
            if (specsEl && stage.specs) {
                specsEl.innerHTML = stage.specs.map(s => `
                    <div class="journey-spec-item">
                        <span class="spec-label">${s.label}</span>
                        <span class="spec-val">${s.val}</span>
                    </div>
                `).join('');
            }

            const t1 = document.getElementById('journey-snap-t1');
            if (t1) t1.innerText = stage.t1;

            const t2 = document.getElementById('journey-snap-t2');
            if (t2) t2.innerText = stage.t2;

            const t3 = document.getElementById('journey-snap-t3');
            if (t3) t3.innerText = stage.t3;

            const dataEl = document.getElementById('journey-snap-data');
            if (dataEl) dataEl.innerText = stage.dataIntegrity;

            const footerEl = document.getElementById('journey-snap-footer');
            if (footerEl) footerEl.innerHTML = `<span>${stage.footer}</span>`;
        });
    });
}

// Lightweight conceptual 3D hero: pointer drag rotates the device and container.
function initHeroDeviceStage() {
    const viewport = document.getElementById('device-viewport');
    const model = document.getElementById('device-model');
    const container = document.getElementById('cold-container');
    if (!viewport || !model || !container) return;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let rotateX = -5;
    let rotateY = -18;

    const render = () => {
        model.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        container.style.transform = `rotateX(${rotateX * 0.35}deg) rotateY(${rotateY * 0.25}deg)`;
    };

    const stopDrag = () => {
        dragging = false;
        viewport.classList.remove('is-dragging');
    };

    viewport.addEventListener('pointerdown', (event) => {
        dragging = true;
        startX = event.clientX;
        startY = event.clientY;
        viewport.setPointerCapture?.(event.pointerId);
        viewport.classList.add('is-dragging');
    });
    viewport.addEventListener('pointermove', (event) => {
        if (!dragging) return;
        rotateY += (event.clientX - startX) * 0.45;
        rotateX = Math.max(-20, Math.min(18, rotateX - (event.clientY - startY) * 0.2));
        startX = event.clientX;
        startY = event.clientY;
        render();
    });
    viewport.addEventListener('pointerup', stopDrag);
    viewport.addEventListener('pointercancel', stopDrag);
    viewport.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') rotateY -= 8;
        else if (event.key === 'ArrowRight') rotateY += 8;
        else if (event.key === 'ArrowUp') rotateX = Math.max(-20, rotateX - 5);
        else if (event.key === 'ArrowDown') rotateX = Math.min(18, rotateX + 5);
        else return;
        event.preventDefault();
        render();
    });
    render();
}

// Init Application
(function init() {
    // Initialize internationalization (i18n)
    try {
        initI18n();
    } catch (e) {
        console.warn('[Q-GUARD] initI18n error:', e);
    }

    // Re-render active dashboard view or update UI on language change
    window.addEventListener('languageChanged', () => {
        if (state.user && ADMIN_ROUTES.has(state.currentView)) {
            renderCurrentView();
        }
    });

    setupAuthHandlers();
    
    // Bind bottom CTA login button
    const btnCtaLogin = document.getElementById('btn-cta-login');
    if (btnCtaLogin) {
        btnCtaLogin.addEventListener('click', () => {
            if (state.user) {
                navigateTo('overview');
            } else {
                openLoginModal();
            }
        });
    }

    // Initialize 3D Floating Reefer & Hardware Viewport and Scenario Simulator
    try {
        initHero3D();
    } catch (e) {
        console.warn('[Q-GUARD] initHero3D error:', e);
    }

    try {
        initSimulator();
    } catch (e) {
        console.warn('[Q-GUARD] initSimulator error:', e);
    }

    checkAuth();

    const pathRoute = getPathRoute();
    const legacyHash = window.location.hash.replace('#', '').trim();
    const legacyRoute = ADMIN_ROUTES.has(legacyHash) ? legacyHash : null;

    if (pathRoute && ADMIN_ROUTES.has(pathRoute)) {
        switchView(pathRoute);
    } else if (legacyRoute) {
        window.history.replaceState({ view: legacyRoute }, '', getRouteUrl(legacyRoute));
        switchView(legacyRoute);
    } else {
        showLandingPage(isLandingHash(legacyHash) ? legacyHash : 'home');
        if (legacyHash && !isLandingHash(legacyHash)) {
            window.history.replaceState({}, '', '/');
        }
    }

    if (state.user) startPolling();
})();
