const express = require('express');
const { run, runSafe } = require('../utils/exec');

const router = express.Router();

router.get('/info', async (req, res) => {
    const [ver, mods, pools] = await Promise.all([
        runSafe('php -v 2>/dev/null | head -1'),
        runSafe('php -m 2>/dev/null'),
        runSafe('ls /etc/php-fpm.d/*.conf 2>/dev/null')
    ]);
    res.json({
        version: ver.stdout,
        modules: mods.stdout.split('\n').filter(m => m && !m.startsWith('[')),
        pools: pools.stdout.split('\n').filter(Boolean).map(f => f.split('/').pop().replace('.conf', ''))
    });
});

router.post('/version', async (req, res) => {
    const { version } = req.body;
    try {
        const r = await run(`/usr/bin/myvps php version ${version}`, 120000);
        res.json({ message: `PHP switched to ${version}`, output: r.stdout });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/restart', async (req, res) => {
    try {
        await run('systemctl restart php-fpm 2>/dev/null');
        res.json({ message: 'PHP-FPM restarted' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
