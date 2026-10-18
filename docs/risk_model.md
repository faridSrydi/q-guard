# Q-GUARD Cold-Chain Risk & Quality Degradation Model

## 1. Regulatory Context

In perishable seafood export and smart quarantine inspection (governed by FDA, WHO, and Indonesian Veterinary Public Health Regulation No. 11/2022), cold-chain compliance cannot rely solely on simple arithmetic average temperatures. Short, high-temperature spikes cause non-linear acceleration of enzymatic and microbial decay.

---

## 2. Mean Kinetic Temperature (MKT)

Mean Kinetic Temperature (MKT) is a single derived temperature that, if maintained over the same duration, would induce the same thermal degradation as the actual fluctuating temperature profile experienced by the consignment.

### Mathematical Formulation (Haynes / USP / FDA Formula)

$$T_{\text{mkt}} = \frac{\frac{\Delta H}{R}}{-\ln\left(\frac{1}{n}\sum_{i=1}^{n} \exp\left(-\frac{\Delta H}{R \cdot T_i}\right)\right)}$$

Where:
- $\Delta H$: Activation energy for lipid oxidation / protein denaturation in frozen fish ($83.14\text{ kJ/mol}$).
- $R$: Universal gas constant ($8.314 \times 10^{-3}\text{ kJ/(mol}\cdot\text{K)}$).
- $\frac{\Delta H}{R}$: $10,000\text{ K}$.
- $T_i$: Absolute temperature of reading $i$ in Kelvin ($T_i = T_{°\text{C}} + 273.15$).
- $n$: Total number of discrete temperature readings.

Because of the negative exponential function, higher temperatures are heavily weighted, accurately reflecting the biological risk of temporary freezer breakdown.

---

## 3. Arrhenius Shelf-Life & Quality Retention Index

The rate constant $k$ of enzymatic degradation (Total Volatile Basic Nitrogen — TVB-N increase) follows the Arrhenius equation:

$$k(T) = A \cdot \exp\left(-\frac{E_a}{R \cdot T}\right)$$

Relative quality loss is calculated as:

$$\text{Shelf-Life Penalty (\%)} = \min\left(100, \text{Risk Score} \times 0.75\right)$$
$$\text{Quality Retention (\%)} = 100\% - \text{Shelf-Life Penalty (\%)} $$

---

## 4. Multi-Factor Composite Risk Score (0 - 100)

The composite risk score $S_{\text{total}}$ evaluates three independent physical vectors:

$$S_{\text{total}} = 0.60 \cdot S_{\text{thermal}} + 0.25 \cdot S_{\text{shock}} + 0.15 \cdot S_{\text{integrity}}$$

### Factor 1: Thermal Abuse ($S_{\text{thermal}}$)
- Normal range: $-25.0°\text{C} \le T \le -18.0°\text{C} \implies S = 0$.
- Moderate excursion ($-18.0°\text{C} < T \le -13.0°\text{C}$):
  $$S = \min\left(65, 80 \times \frac{n_{\text{excursion}}}{n_{\text{total}}} + 5 \times n_{\text{excursion}}\right)$$
- Severe excursion ($T > -13.0°\text{C}$):
  $$S = 50 + \min\left(40, 10 \times n_{\text{critical}}\right)$$

### Factor 2: Mechanical Impact & Shock ($S_{\text{shock}}$)
Derived from the tri-axial accelerometer vector magnitude:
$$g_{\text{net}} = \sqrt{a_x^2 + a_y^2 + a_z^2}$$
- $g_{\text{net}} \le 2.0g$: Safe ($S = 0$).
- $2.0g < g_{\text{net}} \le 3.0g$: Warning ($S = 40$).
- $g_{\text{net}} > 3.0g$: Critical Drop / Impact ($S = 70$).

### Factor 3: Container Seal Integrity ($S_{\text{integrity}}$)
Monitored via the magnetic reed switch (MC-38):
- 0 breaches: $S = 0$.
- 1–5 breaches: $S = 20$.
- $> 5$ breaches: $S = 50$ (Risk of atmospheric moisture condensation and core thaw).

---

## 5. Smart Quarantine Decision Matrix

| Composite Risk Score | Risk Classification | Quarantine Disposition | Official Regulatory Action |
|:---:|:---:|:---:|:---|
| **0 – 29** | `NORMAL` | **PASSED** | Issue Smart Quarantine Certificate of Release; expedited green-lane clearance. |
| **30 – 59** | `CAUTION` | **CONDITIONAL_INSPECTION** | Visual check of packaging seal and sensory assessment before release. |
| **60 – 79** | `WARNING` | **CONDITIONAL_INSPECTION** | Secondary core probe check; mandatory TVB-N laboratory sampling. |
| **80 – 100** | `CRITICAL` | **REJECTED_QUARANTINE** | Immediate cold hold quarantine; cargo re-export or biological destruction order. |
