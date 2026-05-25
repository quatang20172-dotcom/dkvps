const express = require('express');
const { run, runSafe } = require('../utils/exec');

const router = express.Router();

router.get('/', async (req, res) => {
    const r = await runSafe('~/.acme.sh/acme.sh --list 2>/dev/null');
    res.json({ certificates: r.stdout });
});

router.post('/install', async (req, res) => {
    const { domain, provider } = req.body;
    try {
        const cmd = provider === 'zerossl'
            ? `/usr/bin/myvps ssl install-zerossl ${domain}`
            : `/usr/bin/myvps ssl install ${domain}`;
        const r = await run(cmd, 120000);
        res.json({ message: `SSL installed for ${domain}`, output: r.stdout });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/renew', async (req, res) => {
    try {
        const r = await run('~/.acme.sh/acme.sh --renew-all 2>&1', 120000);
        res.json({ message: 'Renewed', output: r.stdout });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:domain', async (req, res) => {
    try {
        await run(`~/.acme.sh/acme.sh --remove -d ${req.params.domain} 2>/dev/null`);
        res.json({ message: 'Removed' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
