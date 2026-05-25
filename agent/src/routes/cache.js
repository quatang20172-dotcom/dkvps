const express = require('express');
const { runSafe } = require('../utils/exec');

const router = express.Router();

router.get('/status', async (req, res) => {
    const [redis, memcached] = await Promise.all([
        runSafe('systemctl is-active redis 2>/dev/null || echo inactive'),
        runSafe('systemctl is-active memcached 2>/dev/null || echo inactive')
    ]);
    res.json({ redis: redis.stdout, memcached: memcached.stdout });
});

router.post('/redis/flush', async (req, res) => {
    await runSafe('redis-cli FLUSHALL 2>/dev/null');
    res.json({ message: 'Redis flushed' });
});

router.post('/opcache/reset', async (req, res) => {
    await runSafe('php -r "opcache_reset();" 2>/dev/null');
    res.json({ message: 'OPcache reset' });
});

router.post('/clear-all', async (req, res) => {
    await Promise.all([
        runSafe('redis-cli FLUSHALL 2>/dev/null'),
        runSafe('php -r "opcache_reset();" 2>/dev/null')
    ]);
    res.json({ message: 'All caches cleared' });
});

module.exports = router;
