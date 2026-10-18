# Q-GUARD REST API Reference Specification

Base URL: `http://localhost:3000/api`

All requests and responses use `application/json` content type. ESP32 device communication utilizes `X-API-Key` authentication; dashboard users use Bearer JWT tokens.

---

## 1. System Health & Heartbeat

### `GET /health`
Returns the status of the API service, SQLite database connectivity, memory footprint, and process uptime.

**Response (HTTP 200)**:
```json
{
  "status": "OK",
  "service": "Q-GUARD Backend API",
  "version": "1.0.0",
  "timestamp": "2026-10-16T03:00:00.000Z",
  "uptime_seconds": 120,
  "database": {
    "status": "healthy",
    "details": null
  },
  "memory": {
    "rss_mb": 45.2,
    "heap_used_mb": 10.1,
    "heap_total_mb": 12.3
  }
}
```

---

## 2. Telemetry Ingestion (ESP32 Batch Sync)

### `POST /sensor-data/batch`
Primary high-throughput endpoint for batch uploading offline sensor records stored on the MicroSD card.

**Headers**:
- `Content-Type: application/json`
- `X-API-Key: <configured_api_key>` (Optional in development)

**Request Body**:
```json
{
  "device_id": "QGUARD-001",
  "batch_size": 2,
  "readings": [
    {
      "record_id": 101,
      "shipment_id": "SHP-20261015-001",
      "timestamp": "2026-10-16 03:00:00",
      "temperature_probe_1": -21.4,
      "temperature_probe_2": -21.8,
      "temperature_probe_3": -21.1,
      "ambient_temperature": 24.5,
      "relative_humidity": 62.0,
      "acceleration_x": 0.04,
      "acceleration_y": -0.02,
      "acceleration_z": 0.99,
      "door_status": "CLOSED",
      "latitude": -6.1020,
      "longitude": 106.8520,
      "gps_fix_status": "3D_FIX",
      "sensor_health": "OK",
      "risk_level": "NORMAL",
      "risk_reasons": "OK"
    }
  ]
}
```

**Response (HTTP 201 Created)**:
```json
{
  "status": "success",
  "device_id": "QGUARD-001",
  "received": 2,
  "accepted": 2,
  "duplicates": 0,
  "alerts_generated": 0
}
```

---

## 3. Devices

- `GET /devices`: List all registered nodes, online status, and active consignments.
- `GET /devices/:id`: Node hardware profile and telemetry counter.
- `GET /devices/:id/latest`: Instant snapshot of latest reading from the node.
- `POST /devices`: Register a new monitoring device node.
- `PUT /devices/:id`: Update firmware version, alias, or configuration parameters.

---

## 4. Shipments / Consignments

- `GET /shipments`: Filter consignments by `status` (active/completed) and `device_id`.
- `GET /shipments/:id`: Full consignment details including statistical temperature aggregates (min, max, average).
- `GET /shipments/:id/readings`: Fetch time-series readings with `limit` (default 100, max 1000) and `order` (ASC/DESC).
- `POST /shipments`: Create and initialize a new cold-chain consignment voyage.
- `PUT /shipments/:id`: Update consignment lifecycle or update threshold limits.

---

## 5. AI Risk & Quality Engine

### `GET /risk/summary`
System-wide risk assessment across all active maritime/transit consignments.

### `GET /risk/evaluate/:shipmentId`
Detailed multi-factor analysis:
- Calculated Mean Kinetic Temperature (MKT)
- Arrhenius Protein Quality Retention (%)
- Remaining Shelf-Life penalty (%)
- Factor-by-factor breakdown (Thermal, Shock, Seal)
- Official regulatory clearance recommendation

---

## 6. Alerts & Breaches

- `GET /alerts`: Query cold-chain excursion events, shock triggers, and hatch breaches with pagination and severity filters (`CRITICAL`, `WARNING`, `INFO`).
- `GET /alerts/summary`: Total counts of critical and unacknowledged alerts.
- `POST /alerts/:id/ack`: Officer sign-off and electronic signature for an alert.
- `POST /alerts/ack-all`: Bulk acknowledgment for a consignment.

---

## 7. Reports & Compliance Dossier

- `GET /reports/shipment/:id`: Generates full digital inspection dossier with quarantine verdict (`PASSED`, `CONDITIONAL_INSPECTION`, `REJECTED_QUARANTINE`).
- `GET /reports/export/csv`: Export raw, tamper-evident telemetry as CSV for regulatory audit.
- `GET /reports/summary`: Aggregate analytics across entire fleet.

---

## 8. Configuration

- `GET /config`: Retrieve active thresholds (`temp_min`, `temp_max`, `shock_threshold_g`, `door_open_max_s`).
- `PUT /config/:key`: Update specific threshold parameter.
- `POST /config/bulk`: Bulk update configurations.
