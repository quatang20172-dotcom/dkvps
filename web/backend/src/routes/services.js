const express = require('express');
const { runCommand, getServiceStatuses } = require('../utils/cli');
const { logAction } = require('../utils/database');

const router = express.Router();

const ALLOWED_SERVICES = ['nginx', 'php-fpm', 'mariadb', 'redis', 'memcached', 'fail2ban'];

router.get('/', async (req, res) => {
    const statuses = await getServiceStatuses();
    res.json({ services: statuses });
});

router.post('/:service/:action', async (req, res) => {
    const { service, action } = req.params;

    if (!ALLOWED_SERVICES.includes(service)) {
        return res.status(400).json({ error: `Service not allowed: ${service}` });
    }
    if (!['start', 'stop', 'restart', 'reload'].includes(action)) {
        return res.status(400).json({ error: `Action not allowed: ${action}` });
    }

    try {
        await runCommand(`systemctl ${action} ${service} 2>/dev/null`);
        logAction(req.user.id, `${action}_service`, 'services', service, null, req.ip);
        res.json({ message: `${service} ${action}ed.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
