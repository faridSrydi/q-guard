/**
 * Q-GUARD Seed Data
 * 
 * IMPORTANT: All data in this file is SIMULATED for development/demo purposes.
 * Do NOT use as actual monitoring data.
 */

const { getDb, closeDb } = require('./connection');
const { hashPassword } = require('../utils/hash');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const db = getDb();

console.log('Q-GUARD Seed Data (SIMULATED)');
console.log('============================');

const seed = db.transaction(() => {
    // 1. Default admin user
    const hash = hashPassword('admin123');
    db.prepare(`INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)`)
      .run('admin', hash, 'admin');
    console.log('  ✓ Default user: admin / admin123');

    // 2. Default device
    db.prepare(`INSERT OR IGNORE INTO devices (id, name, firmware_version, status, last_seen_at) VALUES (?, ?, ?, ?, ?)`)
      .run('QGUARD-001', 'Q-GUARD Prototype #1', '1.0.0', 'online', new Date().toISOString());
    console.log('  ✓ Device: QGUARD-001');

    // 3. Default shipment (Clean placeholder)
    const shipmentId = 'SHP-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-001';
    db.prepare(`
        INSERT OR IGNORE INTO shipments (
            id, device_id, commodity, origin, destination, status,
            temp_min, temp_max, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        shipmentId,
        'QGUARD-001',
        'Ikan Tuna Segar (Ekspor)',
        'Pelabuhan Muara Baru, Jakarta',
        'Depot Karantina Tanjung Priok',
        'active',
        0.0,
        4.0,
        'Pengiriman aktif terhubung dengan unit QGUARD-001'
    );
    console.log(`  ✓ Shipment: ${shipmentId}`);
});

try {
    seed();
    console.log('');
    console.log('Seed complete. Ready for real ESP32 telemetry.');
} catch (err) {
    console.error('Seed failed:', err.message);
} finally {
    closeDb();
}
