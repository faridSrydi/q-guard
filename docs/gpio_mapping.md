# Q-GUARD Hardware Pinout & GPIO Mapping Specification

## 1. Boot Strapping Pin Analysis & Safe Reassignments

The ESP32 (ESP-WROOM-32) has several strapping pins sampled during power-on/reset. Improper voltage levels during boot cause bootloader crashes, UART download mode entrapment, or brownout resets.

| GPIO | Default Hardware Function | Strapping Role | Risk Assessment | Mitigation / Safe Assignment |
|------|---------------------------|----------------|-----------------|------------------------------|
| **GPIO0** | SPI Flash boot mode | Must be HIGH for normal SPI boot | High (if button/sensor pulls LOW at power-up) | **Reassigned to GPIO34** (Input-only safe pin). Touch uses polling instead of dedicated IRQ. |
| **GPIO2** | Boot mode select | Must be LOW or floating during boot | High (LED pull-up could trigger flashing mode) | **Moved LED Yellow to GPIO33** |
| **GPIO12** | Flash Voltage (MTDI) | Must be LOW at boot for 3.3V flash | High (HIGH selects 1.8V flash, crashing 3.3V chip) | **Buzzer moved to GPIO12** with dedicated 10kΩ pulldown resistor to guarantee LOW at boot. |
| **GPIO15** | Boot log control (MTDO)| Affects debug serial output | Low/Medium | **Moved LED Green to GPIO32** |

---

## 2. Complete Safe GPIO Allocation Table

### Sensors & Digital Inputs

| Sensor / Module | Protocol | ESP32 Pin | Logic Level | Hardware Notes |
|-----------------|----------|-----------|-------------|----------------|
| **3× DS18B20** | OneWire | **GPIO4** | 3.3V | External 4.7kΩ pull-up to 3.3V rail. Parasite power disabled. |
| **BME280** | I²C (SDA) | **GPIO21** | 3.3V | Default address `0x76`. |
| **BME280** | I²C (SCL) | **GPIO22** | 3.3V | 400 kHz Fast-Mode. |
| **MPU6050** | I²C (SDA/SCL) | **GPIO21 / 22** | 3.3V | **AD0 tied to 3.3V** to shift address to `0x69` (avoiding conflict with RTC). |
| **DS3231 RTC** | I²C (SDA/SCL) | **GPIO21 / 22** | 3.3V | Fixed address `0x68`. Internal battery backup CR2032. |
| **NEO-6M GPS** | UART2 (RX) | **GPIO16** | 3.3V | Connects to GPS module TX pin. 9600 baud. |
| **NEO-6M GPS** | UART2 (TX) | **GPIO17** | 3.3V | Connects to GPS module RX pin. |
| **MC-38 Door** | Digital In | **GPIO35** | 3.3V | Input-only. Internal pull-up. LOW = Closed, HIGH = Breach / Open. |
| **Button 1 (Nav)** | Digital In | **GPIO39** | 3.3V | Input-only (Sensor_VN). External 10kΩ pull-up. |
| **Button 2 (Sel)** | Digital In | **GPIO36** | 3.3V | Input-only (Sensor_VP). External 10kΩ pull-up. |
| **Button 3 (Back)**| Digital In | **GPIO34** | 3.3V | Input-only. External 10kΩ pull-up. |

---

### SPI Bus (VSPI) Allocation

The MicroSD module and the TFT display + touch controller share the high-speed VSPI bus with independent Chip Select lines.

| Line | Signal | ESP32 Pin | Connected Devices |
|------|--------|-----------|-------------------|
| **SCK** | Serial Clock | **GPIO18** | Shared: MicroSD, TFT ILI9341, XPT2046 |
| **MISO** | Master In Slave Out | **GPIO19** | Shared: MicroSD DO, TFT SDO, XPT2046 DO |
| **MOSI** | Master Out Slave In | **GPIO23** | Shared: MicroSD DI, TFT SDI, XPT2046 DI |
| **CS_SD** | MicroSD Chip Select | **GPIO5** | Dedicated MicroSD CS (active LOW) |
| **CS_TFT** | TFT Display Chip Select | **GPIO14** | Dedicated ILI9341 CS (active LOW) |
| **DC_TFT** | TFT Data / Command | **GPIO27** | Dedicated ILI9341 D/C |
| **RST_TFT**| TFT Hardware Reset | **GPIO13** | Dedicated ILI9341 Reset (active LOW) |
| **CS_TOUCH**| Touch Controller CS | **GPIO26** | Dedicated XPT2046 CS (active LOW) |

---

### Actuators & Indicators

| Indicator | Function | ESP32 Pin | Active Level |
|-----------|----------|-----------|--------------|
| **LED Green** | Normal cold-chain status | **GPIO32** | Active HIGH (Current limit 330Ω) |
| **LED Yellow** | Caution / Sensor degraded | **GPIO33** | Active HIGH (Current limit 330Ω) |
| **LED Red** | Critical temperature breach | **GPIO25** | Active HIGH (Current limit 330Ω) |
| **Active Buzzer** | Audible alarm for breach | **GPIO12** | Active HIGH via NPN Transistor (2N2222) with 10kΩ pulldown. |

---

## 3. I²C Address Conflict Resolution

```
0x68: DS3231 RTC (Hardwired internally, cannot be modified)
0x68: MPU6050 Default address (Causes bus collision with RTC!)
      ▲
      │ SOLUTION:
      └─ Tie MPU6050 AD0 pin to 3.3V ──▶ Address changes to 0x69!
0x76: BME280 Default address (No conflict)
```
