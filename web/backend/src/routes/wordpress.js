const express = require('express');
const { runMyvps } = require('../utils/cli');
const { logAction } = require('../utils/database');

const router = express.Router();

router.post('/install', async (req, res) => {
    const { domain } = req.body;
    try {
        const result = await runMyvps('wp', 'install', [domain]);
        logAction(req.user.id, 'install_wordpress', 'wordpress', domain, null, req.ip);
        res.json({ message: `WordPress installed for ${domain}`, output: result.stdout });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/update', async (req, res) => {
    const { domain } = req.body;
    try {
        const result = await runMyvps('wp', 'update', [domain]);
        res.json({ message: `WordPress updated for ${domain}`, output: result.stdout });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/clear-cache', async (req, res) => {
    const { domain } = req.body;
    try {
        const result = await runMyvps('wp', 'clear-cache', [domain]);
        res.json({ message: `Cache cleared for ${domain}` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
