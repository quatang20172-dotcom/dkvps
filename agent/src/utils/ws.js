/**
 * WebSocket handler - real-time system monitoring
 * Sends CPU/RAM/Disk/Services every 5 seconds to authenticated clients
 */
const jwt = require('jsonwebtoken');
const os = require('os');
const { runSafe } = require('./exec');

function setupWS(wss, secret) {
    const clients = new Set();

    wss.on('connection', (ws, req) => {
        // Auth: token in query string ?token=xxx
        const url = new URL(req.url, 'http://localhost');
        const token = url.searchParams.get('token');
        if (!token) { ws.close(4001, 'Token required'); return; }
        try {
            jwt.verify(token, secret);
        } catch {
            ws.close(4001, 'Invalid token');
            return;
        }

        clients.add(ws);
        ws.on('close', () => clients.delete(ws));
        ws.on('error', () => clients.delete(ws));

        // Send initial data
        gatherAndSend(ws);
    });

    // Broadcast every 5s
    setInterval(() => {
        if (clients.size === 0) return;
        gatherStats().then(data => {
            const msg = JSON.stringify({ type: 'stats', data, ts: Date.now() });
            clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
        }).catch(() => {});
    }, 5000);
}

async function gatherAndSend(ws) {
    const data = await gatherStats();
    if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'stats', data, ts: Date.now() }));
    }
}

async function gatherStats() {
    const [cpuResult, memResult, diskResult, uptimeResult, servicesResult] = await Promise.all([
        runSafe("grep 'cpu ' /proc/stat | awk '{u=($2+$4)*100/($2+$4+$5)} END {printf \"%.1f\",u}'"),
        runSafe("free -b | awk '/Mem:/{printf \"%d|%d|%d\",$2,$3,$7}'"),
        runSafe("df -B1 / | tail -1 | awk '{printf \"%d|%d|%d|%s\",$2,$3,$4,$5}'"),
        runSafe("uptime -p 2>/dev/null || uptime"),
        getServiceStatuses()
    ]);

    const mem = memResult.stdout.split('|').map(Number);
    const disk = diskResult.stdout.split('|');

    return {
        cpu: { usage: parseFloat(cpuResult.stdout) || 0, cores: os.cpus().length },
        memory: { total: mem[0] || 0, used: mem[1] || 0, available: mem[2] || 0 },
        disk: { total: parseInt(disk[0]) || 0, used: parseInt(disk[1]) || 0, available: parseInt(disk[2]) || 0, usage: disk[3] || '0%' },
        uptime: uptimeResult.stdout,
        hostname: os.hostname(),
        services: servicesResult
    };
}

async function getServiceStatuses() {
    const svcs = ['nginx', 'php-fpm', 'mariadb', 'redis', 'memcached', 'fail2ban', 'sshd'];
    const results = {};
    await Promise.all(svcs.map(async s => {
        const r = await runSafe(`systemctl is-active ${s} 2>/dev/null`);
        results[s] = (r.stdout || 'inactive').trim();
    }));
    return results;
}

module.exports = { setupWS };
