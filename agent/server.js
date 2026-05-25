/**
 * MyVPS Agent - Lightweight API running on VPS
 *
 * This agent runs directly on the VPS with minimal resource usage.
 * The Web Dashboard (running separately) connects to this agent
 * to monitor and control the VPS.
 *
 * Dependencies: express, helmet, jsonwebtoken, ws (4 packages only)
 * Memory: ~15-20MB
 */

const express = require('express');
const helmet = require('helmet');
const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const auth = require('./src/routes/auth');
const system = require('./src/routes/system');
const domains = require('./src/routes/domains');
const databases = require('./src/routes/databases');
const services = require('./src/routes/services');
const ssl = require('./src/routes/ssl');
const php = require('./src/routes/php');
const firewall = require('./src/routes/firewall');
const cache = require('./src/routes/cache');
const backup = require('./src/routes/backup');
const files = require('./src/routes/files');
const cron = require('./src/routes/cron');
const proxy = require('./src/routes/proxy');
const ftp = require('./src/routes/ftp');
const deploy = require('./src/routes/deploy');
const docker = require('./src/routes/docker');
const pm2Routes = require('./src/routes/pm2');
const terminal = require('./src/routes/terminal');
const migrate = require('./src/routes/migrate');
const appstore = require('./src/routes/appstore');
const sshkeys = require('./src/routes/sshkeys');
const cloudbackup = require('./src/routes/cloudbackup');
const { setupWS } = require('./src/utils/ws');
const { loadConfig } = require('./src/utils/config');

const config = loadConfig();
const PORT = process.env.AGENT_PORT || config.port_agent || 9090;
const JWT_SECRET = process.env.AGENT_SECRET || config.agent_secret || require('crypto').randomBytes(32).toString('hex');

const app = express();
const server = http.createServer(app);

// Minimal middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));

// CORS - allow dashboard from any origin (auth via token)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Auth middleware
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token required' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
}

// Public routes
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: config.version || '1.0.0',
        hostname: require('os').hostname(),
        uptime: process.uptime()
    });
});
app.use('/api/auth', auth(JWT_SECRET, config));

// Protected routes
app.use('/api/system', authMiddleware, system);
app.use('/api/domains', authMiddleware, domains);
app.use('/api/databases', authMiddleware, databases);
app.use('/api/services', authMiddleware, services);
app.use('/api/ssl', authMiddleware, ssl);
app.use('/api/php', authMiddleware, php);
app.use('/api/firewall', authMiddleware, firewall);
app.use('/api/cache', authMiddleware, cache);
app.use('/api/backup', authMiddleware, backup);
app.use('/api/files', authMiddleware, files);
app.use('/api/cron', authMiddleware, cron);
app.use('/api/proxy', authMiddleware, proxy);
app.use('/api/ftp', authMiddleware, ftp);
app.use('/api/deploy', authMiddleware, deploy);
app.use('/api/docker', authMiddleware, docker);
app.use('/api/pm2', authMiddleware, pm2Routes);
app.use('/api/terminal', authMiddleware, terminal);
app.use('/api/migrate', authMiddleware, migrate);
app.use('/api/appstore', authMiddleware, appstore);
app.use('/api/sshkeys', authMiddleware, sshkeys);
app.use('/api/cloudbackup', authMiddleware, cloudbackup);

// Public webhook trigger endpoint (auth via token in URL)
app.post('/api/deploy/trigger/:token', (req, res, next) => {
    deploy.handle ? deploy.handle(req, res, next) : next();
});

// Serve static dashboard (optional - dashboard can also run standalone)
const dashboardPath = path.join(__dirname, '..', 'dashboard');
if (fs.existsSync(dashboardPath)) {
    app.use(express.static(dashboardPath));
    app.get('/', (req, res) => res.sendFile(path.join(dashboardPath, 'index.html')));
}

// WebSocket for real-time monitoring
const wss = new WebSocket.Server({ server, path: '/ws' });
setupWS(wss, JWT_SECRET);

// Terminal WebSocket
terminal.setupTerminalWS(server, jwt, JWT_SECRET);

// Error handler
app.use((err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
    res.status(500).json({ error: 'Internal server error' });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[MyVPS Agent] Running on port ${PORT}`);
    console.log(`[MyVPS Agent] Memory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
});
