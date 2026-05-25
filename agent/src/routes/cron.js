/**
 * Cron Jobs API routes
 */
const express = require('express');
const router = express.Router();
const { run, runSafe } = require('../utils/exec');

// List cron jobs
router.get('/', async (req, res) => {
    try {
        const r = await runSafe('crontab -l 2>/dev/null');
        const lines = (r.stdout || '').split('\n').filter(l => l.trim() && !l.startsWith('#'));
        const jobs = lines.map((line, i) => {
            const parts = line.split(/\s+/);
            const schedule = parts.slice(0, 5).join(' ');
            const command = parts.slice(5).join(' ');
            return { id: i, schedule, command, raw: line };
        });
        res.json({ jobs });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Add cron job
router.post('/', async (req, res) => {
    const { schedule, command } = req.body;
    if (!schedule || !command) return res.status(400).json({ error: 'schedule and command required' });
    try {
        const existing = await runSafe('crontab -l 2>/dev/null');
        const current = existing.stdout || '';
        const newCron = current.trim() ? `${current.trim()}\n${schedule} ${command}` : `${schedule} ${command}`;
        await run(`echo "${newCron.replace(/"/g, '\\"')}" | crontab -`);
        res.json({ message: 'Cron job added', schedule, command });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete cron job by index
router.delete('/:id', async (req, res) => {
    const idx = parseInt(req.params.id);
    try {
        const r = await runSafe('crontab -l 2>/dev/null');
        const lines = (r.stdout || '').split('\n');
        const jobs = lines.filter(l => l.trim() && !l.startsWith('#'));
        if (idx < 0 || idx >= jobs.length) return res.status(404).json({ error: 'Job not found' });
        const comments = lines.filter(l => l.startsWith('#') || !l.trim());
        jobs.splice(idx, 1);
        const newCron = [...comments, ...jobs].join('\n').trim();
        if (newCron) {
            await run(`echo "${newCron.replace(/"/g, '\\"')}" | crontab -`);
        } else {
            await runSafe('crontab -r 2>/dev/null');
        }
        res.json({ message: 'Cron job deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
