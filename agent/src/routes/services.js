const express = require('express');
const { run, runSafe } = require('../utils/exec');

const router = express.Router();
const ALLOWED = ['nginx', 'php-fpm', 'mariadb', 'redis', 'memcached', 'fail2ban'];

router.get('/', async (req, res) => {
    const services = {};
    await Promise.all(ALLOWED.map(async s => {
        const r = await runSafe(`systemctl is-active ${s} 2>/dev/null || echo inactive`);
        services[s] = r.stdout;
    }));
    res.json({ services });
});

router.post('/:name/:action', async (req, res) => {
    const { name, action } = req.params;
    if (!ALLOWED.includes(name)) return res.status(400).json({ error: 'Service not allowed' });
    if (!['start', 'stop', 'restart', 'reload'].includes(action)) return res.status(400).json({ error: 'Invalid action' });

    try {
        await run(`systemctl ${action} ${name} 2>/dev/null`);
        const r = await runSafe(`systemctl is-active ${name} 2>/dev/null || echo inactive`);
        res.json({ message: `${name} ${action}ed`, status: r.stdout });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
