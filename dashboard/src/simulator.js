/**
 * Q-GUARD Interactive Scenario Simulator (Bilingual ID / EN)
 * Allows landing page visitors to test 3 real cold-chain quarantine scenarios:
 * 1. Normal Cold Chain (Jalur Hijau / Green Channel)
 * 2. Defrost / Door Open (Jalur Kuning / Yellow Channel)
 * 3. Refrigeration Failure (Jalur Merah / Red Channel)
 */

import { getLang } from './i18n.js';

export function initSimulator() {
  const chartCanvas = document.getElementById('simulator-chart');
  if (!chartCanvas) return;

  function getScenarios(lang = 'id') {
    const isEn = lang === 'en';
    return {
      normal: {
        name: isEn ? 'Normal Cold Chain' : 'Rantai Dingin Normal',
        t1: -21.4,
        t2: -19.6,
        t3: -18.8,
        mkt: -19.2,
        door: isEn ? 'CLOSED' : 'TERTUTUP',
        shock: isEn ? '0.08 g (Normal)' : '0.08 g (Normal)',
        riskScore: 6,
        riskLevel: 'NORMAL',
        verdictClass: 'verdict-green',
        verdictTitle: isEn ? 'GREEN CHANNEL (RELEASE)' : 'JALUR HIJAU (PELEPASAN)',
        verdictDesc: isEn 
          ? 'Temperature complies with Codex CAC/RCP 8-1976 (≤ -18.0°C). Recommendation: Issue Official Quarantine Release Certificate (KH-1/KT-2).'
          : 'Suhu memenuhi standar SNI & Codex (≤ -18.0°C). Rekomendasi: Terbitkan Sertifikat Pelepasan Karantina (KH-1/KT-2).',
        labels: ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'],
        t1Data: [-21.2, -21.5, -21.0, -21.4, -21.6, -21.3, -21.5, -21.4, -21.1, -21.3, -21.5, -21.4],
        t2Data: [-19.5, -19.6, -19.4, -19.5, -19.7, -19.6, -19.5, -19.6, -19.5, -19.4, -19.6, -19.6],
        t3Data: [-18.6, -18.8, -18.5, -18.7, -18.9, -18.8, -18.7, -18.9, -18.7, -18.6, -18.8, -18.8]
      },
      defrost: {
        name: isEn ? 'Door Thermal Spike' : 'Fluktuasi Suhu Pintu',
        t1: -19.4,
        t2: -16.8,
        t3: -6.8,
        mkt: -16.5,
        door: isEn ? 'OPEN (3 Mins)' : 'TERBUKA (3 Menit)',
        shock: isEn ? '0.65 g (Moderate)' : '0.65 g (Sedang)',
        riskScore: 48,
        riskLevel: 'WARNING',
        verdictClass: 'verdict-yellow',
        verdictTitle: isEn ? 'YELLOW CHANNEL (PHYSICAL INSPECTION)' : 'JALUR KUNING (PEMERIKSAAN FISIK)',
        verdictDesc: isEn
          ? 'Temperature spike detected at container door threshold (T3), but commodity core (T1) remains protected. Recommendation: Physical inspection before release.'
          : 'Terdeteksi kenaikan suhu pada ambang pintu (T3), namun suhu inti komoditas (T1) tetap terjaga. Rekomendasi: Pemeriksaan fisik organoleptik.',
        labels: ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'],
        t1Data: [-21.2, -21.1, -21.0, -20.8, -20.2, -19.5, -19.2, -19.6, -20.2, -20.8, -21.0, -21.2],
        t2Data: [-19.5, -19.5, -19.4, -18.8, -17.5, -16.8, -17.0, -17.9, -18.6, -19.1, -19.3, -19.5],
        t3Data: [-18.6, -18.5, -18.2, -13.5, -7.5, -6.8, -8.2, -12.5, -15.5, -17.2, -18.0, -18.4]
      },
      failure: {
        name: isEn ? 'Compressor Breakdown' : 'Kerusakan Kompresor',
        t1: 2.5,
        t2: 5.2,
        t3: 8.5,
        mkt: 4.2,
        door: isEn ? 'CLOSED' : 'TERTUTUP',
        shock: isEn ? '2.15 g (High)' : '2.15 g (Tinggi)',
        riskScore: 92,
        riskLevel: 'CRITICAL',
        verdictClass: 'verdict-red',
        verdictTitle: isEn ? 'RED CHANNEL (HOLD & LAB TEST)' : 'JALUR MERAH (PENAHANAN & UJI LAB)',
        verdictDesc: isEn
          ? 'Critical cold-chain failure detected (> -18.0°C). Recommendation: Quarantine hold for microbiological laboratory culture tests.'
          : 'Terjadi deviasi suhu di atas batas kritis (> -18.0°C). Rekomendasi: Tahan kargo untuk pengujian laboratorium mikrobiologi.',
        labels: ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'],
        t1Data: [-21.2, -20.8, -19.5, -17.0, -13.5, -8.2, -2.5, 0.2, 1.2, 1.8, 2.2, 2.5],
        t2Data: [-19.5, -18.8, -16.2, -12.0, -6.5, -1.0, 1.5, 3.2, 4.0, 4.5, 4.8, 5.2],
        t3Data: [-18.6, -17.0, -12.5, -6.0, 0.5, 3.8, 5.5, 6.8, 7.5, 8.0, 8.3, 8.5]
      }
    };
  }

  let chartInstance = null;

  function renderChart(data) {
    if (typeof Chart === 'undefined') return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    const lang = getLang();
    const isEn = lang === 'en';
    const isMobile = window.innerWidth <= 640;
    const ctx = chartCanvas.getContext('2d');

    const labelT1 = isEn 
      ? (isMobile ? 'T1 Core (°C)' : 'T1 Core Commodity (°C)') 
      : (isMobile ? 'T1 Inti (°C)' : 'T1 Inti Komoditas (°C)');

    const labelT2 = isEn 
      ? (isMobile ? 'T2 Buffer (°C)' : 'T2 Thermal Ice Buffer (°C)') 
      : (isMobile ? 'T2 Buffer (°C)' : 'T2 Thermal Buffer Es (°C)');

    const labelT3 = isEn 
      ? (isMobile ? 'T3 Door (°C)' : 'T3 Door Perimeter (°C)') 
      : (isMobile ? 'T3 Pintu (°C)' : 'T3 Ambang Pintu (°C)');

    const labelLimit = isEn 
      ? (isMobile ? 'Limit (-18°C)' : 'Codex Critical Limit (-18.0°C)') 
      : (isMobile ? 'Batas (-18°C)' : 'Batas Kritis Codex (-18.0°C)');

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: labelT1,
            data: data.t1Data,
            borderColor: '#0284c7',
            backgroundColor: 'rgba(2, 132, 199, 0.08)',
            borderWidth: 2.5,
            tension: 0.35,
            fill: false,
            pointRadius: isMobile ? 2.5 : 3.5,
            pointHoverRadius: 5,
            pointBackgroundColor: '#0284c7',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5
          },
          {
            label: labelT2,
            data: data.t2Data,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            borderWidth: 2.5,
            tension: 0.35,
            fill: false,
            pointRadius: isMobile ? 2.5 : 3.5,
            pointHoverRadius: 5,
            pointBackgroundColor: '#10b981',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5
          },
          {
            label: labelT3,
            data: data.t3Data,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            borderWidth: 2,
            borderDash: [5, 4],
            tension: 0.35,
            fill: false,
            pointRadius: isMobile ? 2.5 : 3.5,
            pointHoverRadius: 5,
            pointBackgroundColor: '#f59e0b',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5
          },
          {
            label: labelLimit,
            data: new Array(data.labels.length).fill(-18.0),
            borderColor: '#ef4444',
            borderWidth: 2,
            borderDash: [6, 4],
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
            right: isMobile ? 4 : 8,
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
            align: 'start',
            labels: {
              boxWidth: isMobile ? 8 : 12,
              boxHeight: isMobile ? 8 : 12,
              usePointStyle: true,
              pointStyle: 'circle',
              font: {
                family: "'Plus Jakarta Sans', sans-serif",
                size: isMobile ? 10.5 : 12,
                weight: 500
              },
              color: '#475569',
              padding: isMobile ? 6 : 12
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 600 },
            bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
            padding: 10,
            cornerRadius: 8,
            boxPadding: 4,
            callbacks: {
              label: function(context) {
                const val = context.parsed.y;
                const limitText = isEn ? 'Limit' : 'Batas';
                if (context.dataset.label.includes(limitText)) {
                  return `🚨 ${context.dataset.label}: ${val.toFixed(1)}°C`;
                }
                const diff = val - (-18.0);
                const safeText = isEn ? 'Safe' : 'Aman';
                const status = diff > 0 ? `(⚠️ +${diff.toFixed(1)}°C)` : `(✅ ${safeText})`;
                return `${context.dataset.label}: ${val !== null ? val.toFixed(1) : '--'}°C ${status}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(226, 232, 240, 0.6)', drawBorder: false },
            ticks: {
              font: { family: "'Plus Jakarta Sans', sans-serif", size: isMobile ? 9.5 : 11 },
              color: '#64748b',
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: isMobile ? 5 : 8
            }
          },
          y: {
            grid: { color: 'rgba(226, 232, 240, 0.6)', drawBorder: false },
            ticks: {
              callback: (v) => v + '°C',
              font: { family: "'JetBrains Mono', monospace", size: isMobile ? 9.5 : 11 },
              color: '#64748b',
              padding: isMobile ? 2 : 4
            }
          }
        }
      }
    });
  }

  function updateScenarioUI(key) {
    const lang = getLang();
    const scenarios = getScenarios(lang);
    const s = scenarios[key];
    if (!s) return;

    // Update Angka Metrik
    const elT1 = document.getElementById('sim-val-t1');
    const elT2 = document.getElementById('sim-val-t2');
    const elT3 = document.getElementById('sim-val-t3');
    const elMkt = document.getElementById('sim-val-mkt');
    const elDoor = document.getElementById('sim-val-door');
    const elShock = document.getElementById('sim-val-shock');
    const elScore = document.getElementById('sim-val-score');
    const elScoreBar = document.getElementById('sim-score-bar');
    const elVerdict = document.getElementById('sim-verdict-box');
    const elVerdictTitle = document.getElementById('sim-verdict-title');
    const elVerdictDesc = document.getElementById('sim-verdict-desc');

    if (elT1) {
      elT1.textContent = s.t1.toFixed(1) + '°C';
      elT1.className = 'param-value ' + (s.t1 > -18.0 ? 'text-red' : 'text-green');
    }
    if (elT2) {
      elT2.textContent = s.t2.toFixed(1) + '°C';
      elT2.className = 'param-value ' + (s.t2 > -18.0 ? 'text-red' : 'text-green');
    }
    if (elT3) {
      elT3.textContent = s.t3.toFixed(1) + '°C';
      elT3.className = 'param-value ' + (s.t3 > -18.0 ? 'text-red' : 'text-green');
    }
    if (elMkt) {
      elMkt.textContent = s.mkt.toFixed(1) + '°C';
      elMkt.className = 'param-value ' + (s.mkt > -18.0 ? 'text-red' : 'text-green');
    }
    if (elDoor) elDoor.textContent = s.door;
    if (elShock) elShock.textContent = s.shock;

    if (elScore) elScore.textContent = s.riskScore + '/100';
    if (elScoreBar) {
      elScoreBar.style.width = s.riskScore + '%';
      elScoreBar.className = 'sim-bar-fill ' + (s.riskScore >= 75 ? 'bg-red' : (s.riskScore >= 35 ? 'bg-amber' : 'bg-green'));
    }

    if (elVerdict) {
      elVerdict.className = 'sim-verdict-card ' + s.verdictClass;
    }
    if (elVerdictTitle) elVerdictTitle.textContent = s.verdictTitle;
    if (elVerdictDesc) elVerdictDesc.textContent = s.verdictDesc;

    // Update buttons active class
    document.querySelectorAll('.sim-tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.scenario === key);
    });

    renderChart(s);
  }

  // Event Listener Tab
  document.querySelectorAll('.sim-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      updateScenarioUI(btn.dataset.scenario);
    });
  });

  // Responsive Redraw on Screen Resize / Orientation Change
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const activeBtn = document.querySelector('.sim-tab-btn.active');
      const currentKey = activeBtn ? activeBtn.dataset.scenario : 'normal';
      const scenarios = getScenarios(getLang());
      if (scenarios[currentKey]) {
        renderChart(scenarios[currentKey]);
      }
    }, 150);
  });

  // Re-render when language changes
  window.addEventListener('languageChanged', () => {
    const activeBtn = document.querySelector('.sim-tab-btn.active');
    const currentKey = activeBtn ? activeBtn.dataset.scenario : 'normal';
    updateScenarioUI(currentKey);
  });

  // Default awal ke Skenario Normal
  updateScenarioUI('normal');
  console.log('[Simulator] Modul Skenario Interaktif berhasil diinisialisasi');
}
