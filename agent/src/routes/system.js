/**
 * System info & monitoring routes
 */
const express = require('express');
const os = require('os');
const { run, runSafe } = require('../utils/exec');
const { loadConfig } = require('../utils/config');

const router = express.Router();

// Full system status
router.get('/status', async (req, res) => {
    try {
        const config = loadConfig();
        const [cpu, mem, disk, uptime] = await Promise.all([
            runSafe("grep 'cpu ' /proc/stat | awk '{u=($2+$4)*100/($2+$4+$5)} END {printf \"%.1f\",u}'"),
            runSafe("free -b | awk '/Mem:/{printf \"%d|%d|%d\",$2,$3,$7}'"),
            runSafe("df -B1 / | tail -1 | awk '{printf \"%d|%d|%d|%s\",$2,$3,$4,$5}'"),
            runSafe("uptime -p 2>/dev/null || uptime")
        ]);

        const m = mem.stdout.split('|').map(Number);
        const d = disk.stdout.split('|');

        res.json({
            ip: config.ip || '',
            hostname: os.hostname(),
            os: `${os.type()} ${os.release()}`,
            version: config.version || '1.0.0',
            cpu: { usage: parseFloat(cpu.stdout) || 0, cores: os.cpus().length, model: os.cpus()[0]?.model || '' },
            memory: { total: m[0] || 0, used: m[1] || 0, available: m[2] || 0 },
            disk: { total: parseInt(d[0]) || 0, used: parseInt(d[1]) || 0, available: parseInt(d[2]) || 0, usage: d[3] || '0%' },
            uptime: uptime.stdout,
            load: os.loadavg()
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Detailed system info
router.get('/info', async (req, res) => {
    const config = loadConfig();
    const [kernel, virt, phpVer, mysqlVer, nginxVer] = await Promise.all([
        runSafe('uname -r'),
        runSafe("hostnamectl 2>/dev/null | grep 'Virtualization' | cut -d: -f2 | xargs || echo 'N/A'"),
        runSafe("php -v 2>/dev/null | head -1 | awk '{print $2}' || echo N/A"),
        runSafe("mysql --version 2>/dev/null | grep -oP '\\d+\\.\\d+\\.\\d+' | head -1 || echo N/A"),
        runSafe("nginx -v 2>&1 | grep -oP '\\d+\\.\\d+\\.\\d+' || echo N/A")
    ]);

    res.json({
        ip: config.ip,
        hostname: os.hostname(),
        kernel: kernel.stdout,
        virtualization: virt.stdout,
        ssh_port: config.port_ssh || '22',
        agent_port: config.port_agent || '9090',
        software: { php: phpVer.stdout, mariadb: mysqlVer.stdout, nginx: nginxVer.stdout },
        timezone: config.timezone || 'UTC'
    });
});

// Top processes
router.get('/processes', async (req, res) => {
    try {
        const result = await run("ps aux --sort=-%cpu | head -16 | tail -15");
        const processes = result.stdout.split('\n').filter(Boolean).map(line => {
            const p = line.trim().split(/\s+/);
            return { user: p[0], pid: p[1], cpu: p[2], mem: p[3], command: p.slice(10).join(' ') };
        });
        res.json({ processes });
    } catch (e) {
        res.json({ processes: [] });
    }
});

// Disk partitions
router.get('/disk', async (req, res) => {
    try {
        const result = await run("df -B1 | grep -vE 'tmpfs|devtmpfs' | tail -n +2");
        const disks = result.stdout.split('\n').filter(Boolean).map(line => {
            const p = line.trim().split(/\s+/);
            return { filesystem: p[0], total: +p[1], used: +p[2], available: +p[3], usage: p[4], mount: p[5] };
        });
        res.json({ disks });
    } catch (e) {
        res.json({ disks: [] });
    }
});

// Network connections
router.get('/network', async (req, res) => {
    try {
        const result = await run("ss -tuln | tail -n +2");
        const connections = result.stdout.split('\n').filter(Boolean).map(line => {
            const p = line.trim().split(/\s+/);
            return { type: p[0], state: p[1], local: p[4], remote: p[5] };
        });
        res.json({ connections });
    } catch (e) {
        res.json({ connections: [] });
    }
});

module.exports = router;
