/**
 * Auto Deploy (Git Webhook) API routes
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { run, runSafe } = require('../utils/exec');

const DEPLOY_CONFIG = '/etc/myvps/deploy.json';

function loadDeployConfig() {
    try {
        if (fs.existsSync(DEPLOY_CONFIG)) return JSON.parse(fs.readFileSync(DEPLOY_CONFIG, 'utf8'));
    } catch {}
    return { webhooks: [] };
}

function saveDeployConfig(config) {
    fs.mkdirSync(path.dirname(DEPLOY_CONFIG), { recursive: true });
    fs.writeFileSync(DEPLOY_CONFIG, JSON.stringify(config, null, 2));
}

// List webhooks
router.get('/', (req, res) => {
    const config = loadDeployConfig();
    res.json({ webhooks: config.webhooks });
});

// Create webhook
router.post('/', (req, res) => {
    const { name, directory, command } = req.body;
    if (!name || !directory || !command) return res.status(400).json({ error: 'name, directory and command required' });
    const config = loadDeployConfig();
    const token = crypto.randomBytes(16).toString('hex');
    const webhook = {
        id: Date.now().toString(),
        name,
        directory,
        command,
        token,
        created: new Date().toISOString(),
        lastRun: null,
        lastStatus: null
    };
    config.webhooks.push(webhook);
    saveDeployConfig(config);
    res.json({ message: 'Webhook created', webhook });
});

// Delete webhook
router.delete('/:id', (req, res) => {
    const config = loadDeployConfig();
    config.webhooks = config.webhooks.filter(w => w.id !== req.params.id);
    saveDeployConfig(config);
    res.json({ message: 'Webhook deleted' });
});

// Trigger webhook (public endpoint - auth via token in URL)
router.post('/trigger/:token', async (req, res) => {
    const config = loadDeployConfig();
    const webhook = config.webhooks.find(w => w.token === req.params.token);
    if (!webhook) return res.status(404).json({ error: 'Webhook not found' });
    try {
        const r = await run(`cd "${webhook.directory}" && ${webhook.command}`, 60000);
        webhook.lastRun = new Date().toISOString();
        webhook.lastStatus = 'success';
        saveDeployConfig(config);
        res.json({ message: 'Deploy triggered', output: r.stdout });
    } catch (e) {
        webhook.lastRun = new Date().toISOString();
        webhook.lastStatus = 'failed';
        saveDeployConfig(config);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
