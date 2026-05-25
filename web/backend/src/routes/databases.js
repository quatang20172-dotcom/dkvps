const express = require('express');
const { runCommand, readConfig } = require('../utils/cli');
const { logAction } = require('../utils/database');

const router = express.Router();

// List databases
router.get('/', async (req, res) => {
    const config = readConfig();
    try {
        const result = await runCommand(
            `mysql -u ${config.db_admin_user} -p'${config.db_admin_password}' -e "SHOW DATABASES" -N 2>/dev/null`
        );
        const databases = result.stdout.split('\n')
            .filter(db => !['information_schema', 'performance_schema', 'mysql', 'sys'].includes(db))
            .filter(Boolean);
        res.json({ databases });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Database info
router.get('/:name', async (req, res) => {
    const config = readConfig();
    try {
        const tables = await runCommand(
            `mysql -u ${config.db_admin_user} -p'${config.db_admin_password}' -e "USE \\\`${req.params.name}\\\`; SHOW TABLES" -N 2>/dev/null`
        );
        const size = await runCommand(
            `mysql -u ${config.db_admin_user} -p'${config.db_admin_password}' -e "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) FROM information_schema.tables WHERE table_schema = '${req.params.name}'" -N 2>/dev/null`
        );
        res.json({
            name: req.params.name,
            tables: tables.stdout.split('\n').filter(Boolean),
            size_mb: parseFloat(size.stdout) || 0
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create database
router.post('/', async (req, res) => {
    const { name, user, password } = req.body;
    const config = readConfig();
    const dbPassword = password || require('crypto').randomBytes(16).toString('hex');

    try {
        await runCommand(`mysql -u ${config.db_admin_user} -p'${config.db_admin_password}' -e "CREATE DATABASE IF NOT EXISTS \\\`${name}\\\`" 2>/dev/null`);
        if (user) {
            await runCommand(`mysql -u ${config.db_admin_user} -p'${config.db_admin_password}' -e "CREATE USER IF NOT EXISTS '${user}'@'localhost' IDENTIFIED BY '${dbPassword}'" 2>/dev/null`);
            await runCommand(`mysql -u ${config.db_admin_user} -p'${config.db_admin_password}' -e "GRANT ALL PRIVILEGES ON \\\`${name}\\\`.* TO '${user}'@'localhost'" 2>/dev/null`);
            await runCommand(`mysql -u ${config.db_admin_user} -p'${config.db_admin_password}' -e "FLUSH PRIVILEGES" 2>/dev/null`);
        }

        logAction(req.user.id, 'create_database', 'database', name, null, req.ip);
        res.json({ message: 'Database created.', name, user, password: dbPassword });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete database
router.delete('/:name', async (req, res) => {
    const config = readConfig();
    try {
        await runCommand(`mysql -u ${config.db_admin_user} -p'${config.db_admin_password}' -e "DROP DATABASE IF EXISTS \\\`${req.params.name}\\\`" 2>/dev/null`);
        logAction(req.user.id, 'delete_database', 'database', req.params.name, null, req.ip);
        res.json({ message: `Database ${req.params.name} deleted.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Export database
router.post('/:name/export', async (req, res) => {
    const config = readConfig();
    const timestamp = new Date().toISOString().replace(/[:-]/g, '').slice(0, 15);
    const exportFile = `/etc/myvps/backup/db/${req.params.name}_${timestamp}.sql.gz`;

    try {
        await runCommand(`mysqldump -u ${config.db_admin_user} -p'${config.db_admin_password}' ${req.params.name} 2>/dev/null | gzip > ${exportFile}`);
        res.json({ message: 'Database exported.', file: exportFile });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
