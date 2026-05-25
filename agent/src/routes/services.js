const express = require('express');
const { run, runSafe } = require('../utils/exec');

const router = express.Router();
const ALLOWED = ['nginx', 'php-fpm', 'mariadb', 'redis', 'redis-server', 'memcached', 'fail2ban'];

router.get('/', async (req, res) => {
    const services = {};
    const phpVer = await runSafe("php -r 'echo PHP_MAJOR_VERSION.\".\".PHP_MINOR_VERSION;' 2>/dev/null");
    const ver = (phpVer.stdout || '8.1').trim();
    const svcMap = { 'php-fpm': [`php${ver}-fpm`, 'php-fpm'], 'redis': ['redis-server', 'redis'] };
    const svcs = ['nginx', 'php-fpm', 'mariadb', 'redis', 'memcached', 'fail2ban'];
    await Promise.all(svcs.map(async s => {
        const names = svcMap[s] || [s];
        for (const name of names) {
            const r = await runSafe(`systemctl is-active ${name} 2>/dev/null`);
            const st = (r.stdout || '').trim();
            if (st === 'active') { services[s] = 'active'; return; }
        }
        services[s] = 'inactive';
    }));
    res.json({ services });
});

router.post('/:name/:action', async (req, res) => {
    const { name, action } = req.params;
    if (!ALLOWED.includes(name)) return res.status(400).json({ error: 'Service not allowed' });
    if (!['start', 'stop', 'restart', 'reload'].includes(action)) return res.status(400).json({ error: 'Invalid action' });

    try {
        let svcName = name;
        if (name === 'php-fpm') {
            const phpVer = await runSafe("php -r 'echo PHP_MAJOR_VERSION.\".\".PHP_MINOR_VERSION;' 2>/dev/null");
            const ver = (phpVer.stdout || '8.1').trim();
            const check = await runSafe(`systemctl list-units --type=service | grep php${ver}-fpm`);
            svcName = check.stdout.trim() ? `php${ver}-fpm` : 'php-fpm';
        } else if (name === 'redis') {
            const check = await runSafe('systemctl list-units --type=service | grep redis-server');
            svcName = check.stdout.trim() ? 'redis-server' : 'redis';
        }
        await run(`systemctl ${action} ${svcName} 2>/dev/null`);
        const r = await runSafe(`systemctl is-active ${svcName} 2>/dev/null`);
        res.json({ message: `${name} ${action}ed`, status: (r.stdout || 'inactive').trim() });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
