const express = require('express');
const { runCommand } = require('../utils/cli');
const fs = require('fs');

const router = express.Router();

router.get('/status', async (req, res) => {
    try {
        const [status, version] = await Promise.all([
            runCommand('systemctl is-active nginx 2>/dev/null'),
            runCommand('nginx -v 2>&1')
        ]);
        res.json({ status: status.stdout, version: version.stderr || version.stdout });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/config/:domain', (req, res) => {
    const confPath = `/etc/nginx/conf.d/${req.params.domain}.conf`;
    try {
        const content = fs.readFileSync(confPath, 'utf8');
        res.json({ domain: req.params.domain, config: content });
    } catch (e) {
        res.status(404).json({ error: 'Config not found.' });
    }
});

router.post('/test', async (req, res) => {
    try {
        const result = await runCommand('nginx -t 2>&1');
        const ok = result.exitCode === 0;
        res.json({ valid: ok, output: result.stdout || result.stderr });
    } catch (e) {
        res.json({ valid: false, output: e.message });
    }
});

router.post('/restart', async (req, res) => {
    try {
        await runCommand('nginx -t 2>&1 && systemctl restart nginx');
        res.json({ message: 'Nginx restarted.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/reload', async (req, res) => {
    try {
        await runCommand('nginx -t 2>&1 && systemctl reload nginx');
        res.json({ message: 'Nginx reloaded.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
