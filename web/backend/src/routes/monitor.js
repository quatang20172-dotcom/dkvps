const express = require('express');
const { getSystemStats, getServiceStatuses, runCommand, readConfig } = require('../utils/cli');
const os = require('os');

const router = express.Router();

// System status
router.get('/status', async (req, res) => {
    try {
        const [stats, services] = await Promise.all([
            getSystemStats(),
            getServiceStatuses()
        ]);
        const config = readConfig();

        res.json({
            ip: config.ip || '',
            version: config.version || '1.0.0',
            ...stats,
            services,
            hostname: os.hostname(),
            platform: `${os.type()} ${os.release()}`
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// CPU details
router.get('/cpu', async (req, res) => {
    const cpus = os.cpus();
    res.json({
        model: cpus[0]?.model || 'Unknown',
        cores: cpus.length,
        speed: cpus[0]?.speed || 0,
        loadavg: os.loadavg()
    });
});

// Memory details
router.get('/memory', async (req, res) => {
    try {
        const result = await runCommand("free -b | awk '/Mem:/ {print $2, $3, $4, $5, $6, $7}'");
        const [total, used, free, shared, buffers, cached] = result.stdout.split(' ').map(Number);
        res.json({ total, used, free, shared, buffers, cached });
    } catch (e) {
        res.json({
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem()
        });
    }
});

// Disk usage
router.get('/disk', async (req, res) => {
    try {
        const result = await runCommand("df -B1 | grep -v tmpfs | grep -v devtmpfs | tail -n +2");
        const disks = result.stdout.split('\n').filter(Boolean).map(line => {
            const parts = line.trim().split(/\s+/);
            return {
                filesystem: parts[0],
                total: parseInt(parts[1]),
                used: parseInt(parts[2]),
                available: parseInt(parts[3]),
                usage: parts[4],
                mountpoint: parts[5]
            };
        });
        res.json({ disks });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Top processes
router.get('/processes', async (req, res) => {
    try {
        const result = await runCommand("ps aux --sort=-%cpu | head -16 | tail -15");
        const processes = result.stdout.split('\n').filter(Boolean).map(line => {
            const parts = line.trim().split(/\s+/);
            return {
                user: parts[0],
                pid: parts[1],
                cpu: parts[2],
                mem: parts[3],
                command: parts.slice(10).join(' ')
            };
        });
        res.json({ processes });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Network connections
router.get('/network', async (req, res) => {
    try {
        const result = await runCommand("ss -tuln | tail -n +2");
        const connections = result.stdout.split('\n').filter(Boolean).map(line => {
            const parts = line.trim().split(/\s+/);
            return {
                type: parts[0],
                state: parts[1],
                local: parts[4],
                remote: parts[5]
            };
        });
        res.json({ connections });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Audit log
router.get('/audit-log', (req, res) => {
    const { getAuditLog } = require('../utils/database');
    const limit = parseInt(req.query.limit) || 100;
    const logs = getAuditLog(limit);
    res.json({ logs });
});

module.exports = router;
