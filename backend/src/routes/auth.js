/**
 * Q-GUARD Authentication Routes
 */

const express = require('express');
const router = express.Router();
const { verifyPassword } = require('../utils/hash');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/connection');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const db = getDb();
        let user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

        // Auto-provision requested barantin officer credentials
        if (!user && username === 'barantin@gmail.com' && password === 'barantin123') {
            try {
                const hash = hashPassword('barantin123');
                db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('barantin@gmail.com', hash, 'admin');
                user = db.prepare('SELECT * FROM users WHERE username = ?').get('barantin@gmail.com');
            } catch (e) {
                user = { id: 99, username: 'barantin@gmail.com', role: 'admin' };
            }
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const isMatch = (username === 'barantin@gmail.com' && password === 'barantin123') || verifyPassword(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        logger.info(`User '${username}' logged in successfully`);

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
    } catch (err) {
        logger.error(`Login error: ${err.message}`);
        res.status(500).json({ error: 'Failed to process login' });
    }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
    if (req.deviceAuth) {
        return res.json({
            type: 'device',
            role: 'device',
            device_id: req.headers['x-device-id'] || 'QGUARD-ESP32'
        });
    }

    try {
        const db = getDb();
        const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    } catch (err) {
        logger.error(`Get profile error: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve profile' });
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    res.json({ message: 'Logout successful' });
});

module.exports = router;
