const express = require('express');
const { runMyvps, runCommand } = require('../utils/cli');
const { logAction } = require('../utils/database');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const BACKUP_DIR = '/etc/myvps/backup';

router.get('/', (req, res) => {
    try {
        const sourceDir = path.join(BACKUP_DIR, 'source');
        const dbDir = path.join(BACKUP_DIR, 'db');

        const sources = fs.existsSync(sourceDir)
            ? fs.readdirSync(sourceDir).map(f => ({
                name: f, type: 'source',
                size: fs.statSync(path.join(sourceDir, f)).size,
                created: fs.statSync(path.join(sourceDir, f)).mtime
            })) : [];

        const dbs = fs.existsSync(dbDir)
            ? fs.readdirSync(dbDir).map(f => ({
                name: f, type: 'database',
                size: fs.statSync(path.join(dbDir, f)).size,
                created: fs.statSync(path.join(dbDir, f)).mtime
            })) : [];

        res.json({ backups: [...sources, ...dbs] });
    } catch (e) {
        res.json({ backups: [] });
    }
});

router.post('/create', async (req, res) => {
    const { domain, type } = req.body;
    try {
        const action = type === 'database' ? 'db-only' : 'create';
        const result = await runMyvps('backup', action, [domain]);
        logAction(req.user.id, 'create_backup', 'backup', domain, type, req.ip);
        res.json({ message: `Backup created for ${domain}`, output: result.stdout });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:filename', (req, res) => {
    const { filename } = req.params;
    const sourcePath = path.join(BACKUP_DIR, 'source', filename);
    const dbPath = path.join(BACKUP_DIR, 'db', filename);

    if (fs.existsSync(sourcePath)) {
        fs.unlinkSync(sourcePath);
    } else if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
    }
    res.json({ message: `Backup ${filename} deleted.` });
});

module.exports = router;
