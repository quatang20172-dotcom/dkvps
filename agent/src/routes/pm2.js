/**
 * PM2 Manager API routes
 */
const express = require('express');
const router = express.Router();
const { run, runSafe } = require('../utils/exec');

// Check PM2 status
router.get('/status', async (req, res) => {
    const r = await runSafe('pm2 --version 2>/dev/null');
    res.json({
        installed: !!r.stdout.trim(),
        version: (r.stdout || '').trim()
    });
});

// List PM2 processes
router.get('/', async (req, res) => {
    try {
        const r = await run('pm2 jlist 2>/dev/null');
        const processes = JSON.parse(r.stdout || '[]').map(p => ({
            id: p.pm_id,
            name: p.name,
            status: p.pm2_env?.status || 'unknown',
            cpu: p.monit?.cpu || 0,
            memory: p.monit?.memory || 0,
            uptime: p.pm2_env?.pm_uptime || 0,
            restarts: p.pm2_env?.restart_time || 0,
            cwd: p.pm2_env?.pm_cwd || ''
        }));
        res.json({ processes });
    } catch (e) { res.json({ processes: [], error: e.message }); }
});

// Add PM2 app
router.post('/', async (req, res) => {
    const { name, script, cwd } = req.body;
    if (!name || !script) return res.status(400).json({ error: 'name and script required' });
    try {
        const cwdFlag = cwd ? `--cwd "${cwd}"` : '';
        await run(`pm2 start ${script} --name "${name}" ${cwdFlag}`);
        await runSafe('pm2 save');
        res.json({ message: 'App started', name });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PM2 action (restart/stop/delete)
router.post('/:id/:action', async (req, res) => {
    const { id, action } = req.params;
    const validActions = ['restart', 'stop', 'delete'];
    if (!validActions.includes(action)) return res.status(400).json({ error: 'Invalid action' });
    try {
        await run(`pm2 ${action} ${id}`);
        if (action !== 'delete') await runSafe('pm2 save');
        res.json({ message: `${action} successful` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PM2 logs
router.get('/:id/logs', async (req, res) => {
    try {
        const r = await run(`pm2 logs ${req.params.id} --nostream --lines 50 2>&1`);
        res.json({ logs: r.stdout || '' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
