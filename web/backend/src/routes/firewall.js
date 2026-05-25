const express = require('express');
const { runCommand } = require('../utils/cli');
const { logAction } = require('../utils/database');

const router = express.Router();

router.get('/status', async (req, res) => {
    try {
        const [state, ports, services] = await Promise.all([
            runCommand('firewall-cmd --state 2>/dev/null || ufw status 2>/dev/null || echo "N/A"'),
            runCommand('firewall-cmd --list-ports 2>/dev/null || echo ""'),
            runCommand('firewall-cmd --list-services 2>/dev/null || echo ""')
        ]);
        res.json({
            state: state.stdout,
            ports: ports.stdout.split(' ').filter(Boolean),
            services: services.stdout.split(' ').filter(Boolean)
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/open', async (req, res) => {
    const { port, protocol } = req.body;
    try {
        await runCommand(`firewall-cmd --permanent --zone=public --add-port=${port}/${protocol || 'tcp'} 2>/dev/null && firewall-cmd --reload 2>/dev/null`);
        logAction(req.user.id, 'open_port', 'firewall', port.toString(), null, req.ip);
        res.json({ message: `Port ${port} opened.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/close', async (req, res) => {
    const { port, protocol } = req.body;
    try {
        await runCommand(`firewall-cmd --permanent --zone=public --remove-port=${port}/${protocol || 'tcp'} 2>/dev/null && firewall-cmd --reload 2>/dev/null`);
        logAction(req.user.id, 'close_port', 'firewall', port.toString(), null, req.ip);
        res.json({ message: `Port ${port} closed.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
