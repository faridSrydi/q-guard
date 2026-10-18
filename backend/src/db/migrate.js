/**
 * Q-GUARD Database Migration
 * 
 * Creates all required tables with proper indices and constraints.
 */

const { getDb, closeDb } = require('./connection');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DB_PATH = process.env.DB_PATH || './data/qguard.db';
const db = getDb();

const migrations = [
    // Devices table
    `CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT 'Q-GUARD Device',
        firmware_version TEXT,
        last_seen_at TEXT,
        status TEXT DEFAULT 'offline',
        config_json TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )`,

    // Shipments table
    `CREATE TABLE IF NOT EXISTS shipments (
        id TEXT PRIMARY KEY,
        device_id TEXT,
        commodity TEXT NOT NULL DEFAULT 'Frozen Fish',
        origin TEXT,
        destination TEXT,
        status TEXT DEFAULT 'active',
        started_at TEXT DEFAULT (datetime('now')),
        ended_at TEXT,
        temp_min REAL DEFAULT -25.0,
        temp_max REAL DEFAULT -18.0,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (device_id) REFERENCES devices(id)
    )`,

    // Sensor readings table
    `CREATE TABLE IF NOT EXISTS sensor_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_record_id INTEGER,
        device_id TEXT NOT NULL,
        shipment_id TEXT,
        timestamp TEXT NOT NULL,
        temperature_probe_1 REAL,
        temperature_probe_2 REAL,
        temperature_probe_3 REAL,
        ambient_temperature REAL,
        relative_humidity REAL,
        acceleration_x REAL,
        acceleration_y REAL,
        acceleration_z REAL,
        door_status TEXT,
        latitude REAL,
        longitude REAL,
        gps_fix_status TEXT,
        sensor_health TEXT,
        risk_level TEXT,
        risk_reasons TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (device_id) REFERENCES devices(id),
        FOREIGN KEY (shipment_id) REFERENCES shipments(id)
    )`,

    // Unique constraint to prevent duplicate records from same device
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_readings_device_record 
     ON sensor_readings(device_id, device_record_id)`,

    // Index for time-range queries
    `CREATE INDEX IF NOT EXISTS idx_readings_timestamp 
     ON sensor_readings(timestamp)`,

    // Index for device + shipment queries
    `CREATE INDEX IF NOT EXISTS idx_readings_device_shipment 
     ON sensor_readings(device_id, shipment_id)`,

    // Risk events table
    `CREATE TABLE IF NOT EXISTS risk_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        shipment_id TEXT,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        risk_level TEXT,
        risk_score INTEGER,
        description TEXT,
        sensor_reading_id INTEGER,
        acknowledged INTEGER DEFAULT 0,
        acknowledged_by TEXT,
        acknowledged_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (device_id) REFERENCES devices(id),
        FOREIGN KEY (shipment_id) REFERENCES shipments(id),
        FOREIGN KEY (sensor_reading_id) REFERENCES sensor_readings(id)
    )`,

    `CREATE INDEX IF NOT EXISTS idx_risk_events_device 
     ON risk_events(device_id, created_at)`,

    `CREATE INDEX IF NOT EXISTS idx_risk_events_severity 
     ON risk_events(severity)`,

    // Sync logs table
    `CREATE TABLE IF NOT EXISTS sync_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        batch_size INTEGER,
        records_from INTEGER,
        records_to INTEGER,
        status TEXT DEFAULT 'success',
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (device_id) REFERENCES devices(id)
    )`,

    // System configurations table
    `CREATE TABLE IF NOT EXISTS system_configurations (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
    )`,

    // Users table for dashboard authentication
    `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'operator',
        created_at TEXT DEFAULT (datetime('now'))
    )`,

    // Insert default risk thresholds
    `INSERT OR IGNORE INTO system_configurations (key, value, description) VALUES
        ('temp_min', '-25.0', 'Minimum acceptable temperature (°C)'),
        ('temp_max', '-18.0', 'Maximum acceptable temperature (°C)'),
        ('temp_deviation_duration_s', '300', 'Max deviation duration before escalation (seconds)'),
        ('humidity_min', '30.0', 'Minimum acceptable humidity (%)'),
        ('humidity_max', '80.0', 'Maximum acceptable humidity (%)'),
        ('shock_threshold_g', '2.0', 'Shock detection threshold (g-force)'),
        ('door_open_max_s', '60', 'Max door open duration before alert (seconds)')`,
];

console.log('Q-GUARD Database Migration');
console.log('========================');
console.log(`Database: ${DB_PATH}`);
console.log('');

const runMigrations = db.transaction(() => {
    for (const sql of migrations) {
        try {
            db.exec(sql);
            // Extract table/index name for logging
            const match = sql.match(/(?:TABLE|INDEX)\s+(?:IF NOT EXISTS\s+)?(\w+)/i);
            if (match) {
                console.log(`  ✓ ${match[1]}`);
            }
        } catch (err) {
            console.error(`  ✗ Error: ${err.message}`);
            console.error(`    SQL: ${sql.substring(0, 80)}...`);
            throw err;
        }
    }
});

try {
    runMigrations();
    console.log('');
    console.log('Migration complete.');
} catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
} finally {
    closeDb();
}
