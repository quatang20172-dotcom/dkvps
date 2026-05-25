const express = require('express');
const { run, runSafe } = require('../utils/exec');

const router = express.Router();

router.get('/status', async (req, res) => {
    const [state, ports] = await Promise.all([
        runSafe('firewall-cmd --state 2>/dev/null || ufw status 2>/dev/null || echo N/A'),
        runSafe('firewall-cmd --list-ports 2>/dev/null || echo ""')
    ]);
    res.json({ state: state.stdout, ports: ports.stdout.split(' ').filter(Boolean) });
});

router.post('/open', async (req, res) => {
    const { port, protocol } = req.body;
    try {
        await run(`firewall-cmd --permanent --zone=public --add-port=${port}/${protocol || 'tcp'} 2>/dev/null && firewall-cmd --reload 2>/dev/null`);
        res.json({ message: `Port ${port} opened` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/close', async (req, res) => {
    const { port, protocol } = req.body;
    try {
        await run(`firewall-cmd --permanent --zone=public --remove-port=${port}/${protocol || 'tcp'} 2>/dev/null && firewall-cmd --reload 2>/dev/null`);
        res.json({ message: `Port ${port} closed` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
