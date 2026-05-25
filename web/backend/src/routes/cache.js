const express = require('express');
const { runCommand, getServiceStatuses } = require('../utils/cli');

const router = express.Router();

router.get('/status', async (req, res) => {
    const statuses = await getServiceStatuses();
    res.json({
        redis: statuses.redis || 'inactive',
        memcached: statuses.memcached || 'inactive'
    });
});

router.post('/redis/flush', async (req, res) => {
    try {
        await runCommand('redis-cli FLUSHALL 2>/dev/null');
        res.json({ message: 'Redis flushed.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/opcache/reset', async (req, res) => {
    try {
        await runCommand('php -r "opcache_reset();" 2>/dev/null');
        res.json({ message: 'OPcache reset.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/clear-all', async (req, res) => {
    try {
        await Promise.all([
            runCommand('redis-cli FLUSHALL 2>/dev/null'),
            runCommand('php -r "opcache_reset();" 2>/dev/null')
        ]);
        res.json({ message: 'All caches cleared.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
