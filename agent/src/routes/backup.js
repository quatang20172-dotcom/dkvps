const express = require('express');
const { run } = require('../utils/exec');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const BACKUP_DIR = '/etc/myvps/backup';

router.get('/', (req, res) => {
    const backups = [];
    for (const type of ['source', 'db']) {
        const dir = path.join(BACKUP_DIR, type);
        try {
            fs.readdirSync(dir).forEach(f => {
                const stat = fs.statSync(path.join(dir, f));
                backups.push({ name: f, type, size: stat.size, created: stat.mtime });
            });
        } catch (e) { /* dir may not exist */ }
    }
    res.json({ backups });
});

router.post('/create', async (req, res) => {
    const { domain, type } = req.body;
    try {
        const action = type === 'database' ? 'db-only' : 'create';
        const r = await run(`/usr/bin/myvps backup ${action} ${domain}`, 300000);
        res.json({ message: `Backup created for ${domain}`, output: r.stdout });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:filename', (req, res) => {
    for (const type of ['source', 'db']) {
        const fp = path.join(BACKUP_DIR, type, req.params.filename);
        if (fs.existsSync(fp)) { fs.unlinkSync(fp); break; }
    }
    res.json({ message: 'Deleted' });
});

module.exports = router;
