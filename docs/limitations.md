# Q-GUARD Technical Limitations & Fail-Safe Considerations

## 1. Edge Hardware & Sensor Limitations

### Temperature Sensing (DS18B20)
- **Thermal Inertia**: The stainless-steel probe sheath has a thermal response time ($\tau$) of ~8 to 15 seconds in still air, and ~2 to 4 seconds in liquid/ice slurry. Rapid micro-fluctuations (< 2 seconds) may be filtered out.
- **Probe Accuracy**: $\pm 0.5°\text{C}$ accuracy between $-10°\text{C}$ to $+85°\text{C}$. For deep freeze ($-25°\text{C}$ to $-18°\text{C}$), accuracy widens to $\pm 1.0°\text{C}$ unless calibrated against an ice-point reference.
- **OneWire Bus Timing**: Severe interrupt jitter or high Wi-Fi radio activity on Core 0 can occasionally interrupt bit-banging timing. The firmware handles this by disabling interrupts briefly during `OneWire` time-critical slots.

### Inertial Measurement (MPU6050)
- **Zero-g Drift**: MEMS accelerometers experience temperature-dependent zero-g offset drift. Normal transport vibration is separated from real impact drops by computing high-pass filtered dynamic vector magnitudes ($g_{\text{net}} > 2.0g$).
- **Sampling Frequency**: Polled at 10 Hz; impacts shorter than 10 ms may register lower peak values.

### GPS Reception (NEO-6M)
- **Reefer Container Shielding**: Standard refrigerated ISO shipping containers act as Faraday cages. If the GPS patch antenna is placed inside the insulated container rather than routed externally or through a glass viewport, TTFF (Time To First Fix) will fail or drift.
- **Fail-Safe**: When GPS fix status is `NO_FIX`, the system marks coordinates as `null` or keeps the last known valid waypoint rather than inventing or spoofing coordinates.

### Local RTC (DS3231)
- **Time Sync Hierarchy**: The DS3231 TCXO (Temperature Compensated Crystal Oscillator) provides accurate real-time ($\pm 2\text{ ppm}$). GPS UTC time and NTP Wi-Fi time are used as higher-tier synchronization sources to periodically correct any drift.

---

## 2. Power & Energy Budgeting

- In full active mode (TFT backlight ON, Wi-Fi transmitting, GPS tracking, 3× DS18B20 continuous conversion), the ESP32 consumes ~180–240 mA at 3.3V (~0.8W).
- For voyages longer than 24 hours without external vehicle/container power, the device should implement automatic screen sleep (TFT backlight turned off after 60s inactivity) and modem sleep between sampling intervals, reducing consumption to ~35 mA.

---

## 3. Communication & Network Edge Cases

- **Blind Zones**: During open-sea maritime distribution or remote highway transit without cellular/Wi-Fi coverage, data synchronization pauses.
- **Buffer Safety**: The MicroSD card can store over 1,000,000 records (~160 days of continuous 10-second sampling). When network connectivity resumes, the batch sync mechanism guarantees zero data loss using idempotency and database deduplication.

---

## 4. Legal & Regulatory Disclaimer

The Q-GUARD platform is an auxiliary IoT monitoring, early warning, and algorithmic audit system. It provides decision support for quarantine inspectors, quality assurance managers, and cold-chain operators. Under official regulatory mandates (e.g., Badan Karantina Indonesia), automated recommendations do not supersede mandatory physical laboratory verification (TVB-N, heavy metals, microbial plate counts) when required by statutory law.
