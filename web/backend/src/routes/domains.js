const express = require('express');
const { runMyvps, listDomains, readDomainConfig } = require('../utils/cli');
const { logAction } = require('../utils/database');

const router = express.Router();

// List all domains
router.get('/', (req, res) => {
    const domains = listDomains();
    res.json({ domains });
});

// Get domain info
router.get('/:domain', (req, res) => {
    const config = readDomainConfig(req.params.domain);
    if (!config) {
        return res.status(404).json({ error: 'Domain not found.' });
    }
    res.json({ domain: req.params.domain, ...config });
});

// Add domain
router.post('/', async (req, res) => {
    const { domain, installWordpress, installLaravel, createDatabase } = req.body;

    if (!domain) {
        return res.status(400).json({ error: 'Domain is required.' });
    }

    try {
        const args = [domain];
        const result = await runMyvps('domain', 'add', args);
        logAction(req.user.id, 'add_domain', 'domain', domain, null, req.ip);
        res.json({ message: `Domain ${domain} created.`, output: result.stdout });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete domain
router.delete('/:domain', async (req, res) => {
    const { domain } = req.params;

    try {
        const result = await runMyvps('domain', 'delete', [domain]);
        logAction(req.user.id, 'delete_domain', 'domain', domain, null, req.ip);
        res.json({ message: `Domain ${domain} deleted.`, output: result.stdout });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Suspend domain
router.post('/:domain/suspend', async (req, res) => {
    try {
        const result = await runMyvps('domain', 'suspend', [req.params.domain]);
        logAction(req.user.id, 'suspend_domain', 'domain', req.params.domain, null, req.ip);
        res.json({ message: `Domain ${req.params.domain} suspended.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Unsuspend domain
router.post('/:domain/unsuspend', async (req, res) => {
    try {
        const result = await runMyvps('domain', 'unsuspend', [req.params.domain]);
        logAction(req.user.id, 'unsuspend_domain', 'domain', req.params.domain, null, req.ip);
        res.json({ message: `Domain ${req.params.domain} unsuspended.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Fix permissions
router.post('/:domain/permission', async (req, res) => {
    try {
        const result = await runMyvps('domain', 'permission', [req.params.domain]);
        res.json({ message: `Permissions fixed for ${req.params.domain}.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
