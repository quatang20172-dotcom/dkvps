const express = require('express');
const { runCommand, runMyvps } = require('../utils/cli');
const { logAction } = require('../utils/database');

const router = express.Router();

router.get('/info', async (req, res) => {
    try {
        const [version, modules] = await Promise.all([
            runCommand('php -v 2>/dev/null | head -1'),
            runCommand('php -m 2>/dev/null')
        ]);
        res.json({
            version: version.stdout,
            modules: modules.stdout.split('\n').filter(m => m && !m.startsWith('['))
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/pools', async (req, res) => {
    try {
        const result = await runCommand('ls /etc/php-fpm.d/*.conf 2>/dev/null');
        const pools = result.stdout.split('\n').filter(Boolean).map(f => {
            const name = f.split('/').pop().replace('.conf', '');
            return { name, config: f };
        });
        res.json({ pools });
    } catch (e) {
        res.json({ pools: [] });
    }
});

router.post('/version', async (req, res) => {
    const { version } = req.body;
    try {
        const result = await runMyvps('php', 'version', [version]);
        logAction(req.user.id, 'change_php_version', 'php', version, null, req.ip);
        res.json({ message: `PHP version changed to ${version}`, output: result.stdout });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/restart', async (req, res) => {
    try {
        await runCommand('systemctl restart php-fpm 2>/dev/null');
        res.json({ message: 'PHP-FPM restarted.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
