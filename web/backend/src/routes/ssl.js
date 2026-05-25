const express = require('express');
const { runMyvps, runCommand } = require('../utils/cli');
const { logAction } = require('../utils/database');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const result = await runCommand('~/.acme.sh/acme.sh --list 2>/dev/null');
        res.json({ certificates: result.stdout });
    } catch (e) {
        res.json({ certificates: '' });
    }
});

router.post('/install', async (req, res) => {
    const { domain, provider } = req.body;
    try {
        const action = provider === 'zerossl' ? 'install-zerossl' : 'install';
        const result = await runMyvps('ssl', action, [domain]);
        logAction(req.user.id, 'install_ssl', 'ssl', domain, provider, req.ip);
        res.json({ message: `SSL installed for ${domain}`, output: result.stdout });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/renew', async (req, res) => {
    const { domain } = req.body;
    try {
        const result = await runMyvps('ssl', 'renew', domain ? [domain] : []);
        res.json({ message: 'SSL renewed.', output: result.stdout });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:domain', async (req, res) => {
    try {
        const result = await runMyvps('ssl', 'delete', [req.params.domain]);
        logAction(req.user.id, 'delete_ssl', 'ssl', req.params.domain, null, req.ip);
        res.json({ message: `SSL removed for ${req.params.domain}` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
