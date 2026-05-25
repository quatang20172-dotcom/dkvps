/**
 * File Manager API routes
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { run, runSafe } = require('../utils/exec');

// List directory contents
router.get('/list', async (req, res) => {
    const dir = req.query.path || '/';
    try {
        const resolved = path.resolve(dir);
        if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'Path not found' });
        const stat = fs.statSync(resolved);
        if (!stat.isDirectory()) return res.status(400).json({ error: 'Not a directory' });

        const entries = fs.readdirSync(resolved, { withFileTypes: true });
        const files = entries.map(e => {
            const fp = path.join(resolved, e.name);
            try {
                const s = fs.statSync(fp);
                return {
                    name: e.name,
                    type: e.isDirectory() ? 'directory' : 'file',
                    size: s.size,
                    modified: s.mtime.toISOString(),
                    permissions: '0' + (s.mode & 0o777).toString(8),
                    owner: s.uid
                };
            } catch {
                return { name: e.name, type: e.isDirectory() ? 'directory' : 'file', size: 0 };
            }
        });
        files.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        res.json({ path: resolved, files });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Read file content
router.get('/read', async (req, res) => {
    const fp = req.query.path;
    if (!fp) return res.status(400).json({ error: 'Path required' });
    try {
        const resolved = path.resolve(fp);
        const stat = fs.statSync(resolved);
        if (stat.size > 2 * 1024 * 1024) return res.status(400).json({ error: 'File too large (>2MB)' });
        const content = fs.readFileSync(resolved, 'utf8');
        res.json({ path: resolved, content, size: stat.size });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Save file content
router.post('/save', async (req, res) => {
    const { path: fp, content } = req.body;
    if (!fp) return res.status(400).json({ error: 'Path required' });
    try {
        fs.writeFileSync(fp, content, 'utf8');
        res.json({ message: 'File saved', path: fp });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create file or directory
router.post('/create', async (req, res) => {
    const { path: fp, type } = req.body;
    if (!fp) return res.status(400).json({ error: 'Path required' });
    try {
        if (type === 'directory') {
            fs.mkdirSync(fp, { recursive: true });
        } else {
            fs.writeFileSync(fp, '', 'utf8');
        }
        res.json({ message: `${type || 'file'} created`, path: fp });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete file or directory
router.post('/delete', async (req, res) => {
    const { path: fp } = req.body;
    if (!fp) return res.status(400).json({ error: 'Path required' });
    try {
        const stat = fs.statSync(fp);
        if (stat.isDirectory()) {
            fs.rmSync(fp, { recursive: true, force: true });
        } else {
            fs.unlinkSync(fp);
        }
        res.json({ message: 'Deleted', path: fp });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Rename/Move
router.post('/rename', async (req, res) => {
    const { from, to } = req.body;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });
    try {
        fs.renameSync(from, to);
        res.json({ message: 'Renamed', from, to });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Change permissions
router.post('/chmod', async (req, res) => {
    const { path: fp, mode } = req.body;
    if (!fp || !mode) return res.status(400).json({ error: 'path and mode required' });
    try {
        await run(`chmod ${mode} "${fp}"`);
        res.json({ message: 'Permissions changed', path: fp, mode });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Change owner
router.post('/chown', async (req, res) => {
    const { path: fp, owner } = req.body;
    if (!fp || !owner) return res.status(400).json({ error: 'path and owner required' });
    try {
        await run(`chown ${owner} "${fp}"`);
        res.json({ message: 'Owner changed', path: fp, owner });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
