/**
 * Auth route - API key based authentication
 * Lightweight: no database, uses config file for credentials
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

module.exports = function(JWT_SECRET, config) {
    const router = express.Router();

    // Login with API key or admin password
    router.post('/login', (req, res) => {
        const { api_key, password } = req.body;

        // Method 1: API key (for dashboard)
        if (api_key && (api_key === config.api_key || api_key === config.agent_api_key)) {
            const token = jwt.sign({ role: 'dashboard', iat: Date.now() }, JWT_SECRET, { expiresIn: '7d' });
            return res.json({ token, expires_in: '7d' });
        }

        // Method 2: Admin password
        if (password && password === config.admin_password) {
            const token = jwt.sign({ role: 'admin', iat: Date.now() }, JWT_SECRET, { expiresIn: '24h' });
            return res.json({ token, expires_in: '24h' });
        }

        res.status(401).json({ error: 'Invalid credentials' });
    });

    // Generate new API key
    router.post('/generate-key', (req, res) => {
        const { password } = req.body;
        if (password !== config.admin_password) {
            return res.status(401).json({ error: 'Admin password required' });
        }
        const newKey = crypto.randomBytes(32).toString('hex');
        // Save to config
        const fs = require('fs');
        const confPath = '/etc/myvps/.myvps.conf';
        try {
            let content = fs.readFileSync(confPath, 'utf8');
            if (content.includes('agent_api_key=')) {
                content = content.replace(/agent_api_key=.*/, `agent_api_key=${newKey}`);
            } else {
                content += `\nagent_api_key=${newKey}\n`;
            }
            fs.writeFileSync(confPath, content);
            config.agent_api_key = newKey;
            res.json({ api_key: newKey });
        } catch (e) {
            res.status(500).json({ error: 'Failed to save API key' });
        }
    });

    // Verify token
    router.get('/verify', (req, res) => {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ valid: false });
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            res.json({ valid: true, role: decoded.role });
        } catch {
            res.status(401).json({ valid: false });
        }
    });

    return router;
};
