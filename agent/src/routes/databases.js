const express = require('express');
const { run } = require('../utils/exec');
const { loadConfig } = require('../utils/config');
const crypto = require('crypto');

const router = express.Router();

router.get('/', async (req, res) => {
    const c = loadConfig();
    try {
        const r = await run(`mysql -u ${c.db_admin_user} -p'${c.db_admin_password}' -N -e "SHOW DATABASES" 2>/dev/null`);
        const dbs = r.stdout.split('\n').filter(d => d && !['information_schema', 'performance_schema', 'mysql', 'sys'].includes(d));
        res.json({ databases: dbs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/:name/info', async (req, res) => {
    const c = loadConfig();
    try {
        const [tables, size] = await Promise.all([
            run(`mysql -u ${c.db_admin_user} -p'${c.db_admin_password}' -N -e "USE \\\`${req.params.name}\\\`; SHOW TABLES" 2>/dev/null`),
            run(`mysql -u ${c.db_admin_user} -p'${c.db_admin_password}' -N -e "SELECT ROUND(SUM(data_length+index_length)/1024/1024,2) FROM information_schema.tables WHERE table_schema='${req.params.name}'" 2>/dev/null`)
        ]);
        res.json({ name: req.params.name, tables: tables.stdout.split('\n').filter(Boolean), size_mb: parseFloat(size.stdout) || 0 });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/', async (req, res) => {
    const { name, user } = req.body;
    const c = loadConfig();
    const password = crypto.randomBytes(16).toString('hex');
    try {
        await run(`mysql -u ${c.db_admin_user} -p'${c.db_admin_password}' -e "CREATE DATABASE IF NOT EXISTS \\\`${name}\\\`" 2>/dev/null`);
        if (user) {
            await run(`mysql -u ${c.db_admin_user} -p'${c.db_admin_password}' -e "CREATE USER IF NOT EXISTS '${user}'@'localhost' IDENTIFIED BY '${password}'; GRANT ALL ON \\\`${name}\\\`.* TO '${user}'@'localhost'; FLUSH PRIVILEGES" 2>/dev/null`);
        }
        res.json({ message: 'Created', name, user, password });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:name', async (req, res) => {
    const c = loadConfig();
    try {
        await run(`mysql -u ${c.db_admin_user} -p'${c.db_admin_password}' -e "DROP DATABASE IF EXISTS \\\`${req.params.name}\\\`" 2>/dev/null`);
        res.json({ message: 'Deleted' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/:name/export', async (req, res) => {
    const c = loadConfig();
    const ts = new Date().toISOString().replace(/[:-]/g, '').slice(0, 15);
    const file = `/etc/myvps/backup/db/${req.params.name}_${ts}.sql.gz`;
    try {
        await run(`mysqldump -u ${c.db_admin_user} -p'${c.db_admin_password}' ${req.params.name} 2>/dev/null | gzip > ${file}`);
        res.json({ message: 'Exported', file });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
