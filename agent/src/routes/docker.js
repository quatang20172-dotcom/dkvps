/**
 * Docker Manager API routes
 */
const express = require('express');
const router = express.Router();
const { run, runSafe } = require('../utils/exec');

// Check if Docker is installed
router.get('/status', async (req, res) => {
    const r = await runSafe('docker --version 2>/dev/null');
    const active = await runSafe('systemctl is-active docker 2>/dev/null');
    res.json({
        installed: r.stdout.includes('Docker'),
        version: (r.stdout || '').trim(),
        status: (active.stdout || 'inactive').trim()
    });
});

// List containers
router.get('/containers', async (req, res) => {
    try {
        const r = await run('docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}" 2>/dev/null');
        const containers = (r.stdout || '').split('\n').filter(Boolean).map(line => {
            const [id, name, image, status, ports] = line.split('|');
            return { id, name, image, status, ports: ports || '' };
        });
        res.json({ containers });
    } catch (e) { res.json({ containers: [], error: e.message }); }
});

// Container action (start/stop/restart/remove)
router.post('/containers/:id/:action', async (req, res) => {
    const { id, action } = req.params;
    const validActions = ['start', 'stop', 'restart', 'rm'];
    if (!validActions.includes(action)) return res.status(400).json({ error: 'Invalid action' });
    try {
        const force = action === 'rm' ? ' -f' : '';
        await run(`docker ${action}${force} ${id}`);
        res.json({ message: `Container ${action} successful` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Container logs
router.get('/containers/:id/logs', async (req, res) => {
    try {
        const r = await run(`docker logs --tail 100 ${req.params.id} 2>&1`);
        res.json({ logs: r.stdout || '' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// List images
router.get('/images', async (req, res) => {
    try {
        const r = await run('docker images --format "{{.ID}}|{{.Repository}}|{{.Tag}}|{{.Size}}" 2>/dev/null');
        const images = (r.stdout || '').split('\n').filter(Boolean).map(line => {
            const [id, repository, tag, size] = line.split('|');
            return { id, repository, tag, size };
        });
        res.json({ images });
    } catch (e) { res.json({ images: [], error: e.message }); }
});

// Remove image
router.delete('/images/:id', async (req, res) => {
    try {
        await run(`docker rmi -f ${req.params.id}`);
        res.json({ message: 'Image removed' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
