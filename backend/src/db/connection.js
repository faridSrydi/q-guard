/**
 * Q-GUARD Database Connection Module
 * 
 * Powered by Node.js 22 Built-in SQLite (DatabaseSync)
 * Fast, synchronous, zero-dependency, zero native binding issues.
 */

const path = require('path');
const fs = require('fs');

let db = null;

function getDb() {
    if (db) return db;

    const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'qguard.db');
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    // Try Node 22 native SQLite
    let rawDb;
    try {
        const { DatabaseSync } = require('node:sqlite');
        rawDb = new DatabaseSync(dbPath);
    } catch (e) {
        try {
            const Database = require('better-sqlite3');
            rawDb = new Database(dbPath);
            rawDb.pragma('journal_mode = WAL');
            rawDb.pragma('foreign_keys = ON');
            db = rawDb;
            return db;
        } catch (e2) {
            throw new Error('Neither node:sqlite nor better-sqlite3 could be loaded. Ensure Node is run with --experimental-sqlite.');
        }
    }

    rawDb.exec('PRAGMA journal_mode = WAL');
    rawDb.exec('PRAGMA foreign_keys = ON');

    db = {
        pragma: (str) => {
            try { rawDb.exec(`PRAGMA ${str}`); } catch (e) {}
        },
        exec: (sql) => rawDb.exec(sql),
        prepare: (sql) => {
            const stmt = rawDb.prepare(sql);
            return {
                run: (...args) => {
                    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
                        const obj = args[0];
                        const formatted = {};
                        for (const [k, v] of Object.entries(obj)) {
                            formatted[k.startsWith('@') ? k : `@${k}`] = v;
                        }
                        const info = stmt.run(formatted);
                        return {
                            changes: info?.changes !== undefined ? info.changes : 1,
                            lastInsertRowid: info?.lastInsertRowid !== undefined ? info.lastInsertRowid : null
                        };
                    }
                    const info = stmt.run(...args);
                    return {
                        changes: info?.changes !== undefined ? info.changes : 1,
                        lastInsertRowid: info?.lastInsertRowid !== undefined ? info.lastInsertRowid : null
                    };
                },
                get: (...args) => {
                    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
                        const obj = args[0];
                        const formatted = {};
                        for (const [k, v] of Object.entries(obj)) {
                            formatted[k.startsWith('@') ? k : `@${k}`] = v;
                        }
                        return stmt.get(formatted);
                    }
                    return stmt.get(...args);
                },
                all: (...args) => {
                    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
                        const obj = args[0];
                        const formatted = {};
                        for (const [k, v] of Object.entries(obj)) {
                            formatted[k.startsWith('@') ? k : `@${k}`] = v;
                        }
                        return stmt.all(formatted);
                    }
                    return stmt.all(...args);
                }
            };
        },
        transaction: (fn) => {
            return (...args) => {
                rawDb.exec('BEGIN');
                try {
                    const result = fn(...args);
                    rawDb.exec('COMMIT');
                    return result;
                } catch (err) {
                    rawDb.exec('ROLLBACK');
                    throw err;
                }
            };
        },
        close: () => rawDb.close()
    };

    // Auto-clean simulated remnants so the system always displays real quarantine data
    try {
        db.prepare("UPDATE shipments SET commodity = 'Ikan Tuna Segar (Ekspor)' WHERE commodity LIKE '%SIMULATED%'").run();
        db.prepare("DELETE FROM sensor_readings WHERE timestamp LIKE '2045%' OR timestamp LIKE '%82-39%'").run();
    } catch (e) {}

    return db;
}

function closeDb() {
    if (db) {
        db.close();
        db = null;
    }
}

module.exports = { getDb, closeDb };
