const express = require('express');
const { run } = require('../utils/exec');
const { listDomainConfigs, loadDomainConfig } = require('../utils/config');

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ domains: listDomainConfigs() });
});

router.get('/:domain', (req, res) => {
    const cfg = loadDomainConfig(req.params.domain);
    if (!cfg) return res.status(404).json({ error: 'Domain not found' });
    res.json({ domain: req.params.domain, ...cfg });
});

router.post('/', async (req, res) => {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ error: 'Domain required' });
    try {
        const result = await run(`/usr/bin/myvps domain add ${domain} <<< "n\nn\nn"`, 60000);
        res.json({ message: `Domain ${domain} created`, output: result.stdout });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:domain', async (req, res) => {
    try {
        const result = await run(`/usr/bin/myvps domain delete ${req.params.domain} <<< "y"`, 30000);
        res.json({ message: `Domain ${req.params.domain} deleted` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/:domain/suspend', async (req, res) => {
    try {
        await run(`/usr/bin/myvps domain suspend ${req.params.domain}`);
        res.json({ message: 'Suspended' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/:domain/unsuspend', async (req, res) => {
    try {
        await run(`/usr/bin/myvps domain unsuspend ${req.params.domain}`);
        res.json({ message: 'Unsuspended' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/:domain/fix-permissions', async (req, res) => {
    try {
        await run(`/usr/bin/myvps domain permission ${req.params.domain}`);
        res.json({ message: 'Permissions fixed' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
