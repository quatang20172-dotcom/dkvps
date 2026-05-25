/**
 * MyVPS Web Dashboard API Server
 *
 * Connects to CLI tools to provide web-based VPS management.
 * Uses JWT auth, REST API, and WebSocket for real-time updates.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');

const { authRouter, authMiddleware } = require('./src/routes/auth');
const domainRouter = require('./src/routes/domains');
const databaseRouter = require('./src/routes/databases');
const phpRouter = require('./src/routes/php');
const nginxRouter = require('./src/routes/nginx');
const sslRouter = require('./src/routes/ssl');
const sshRouter = require('./src/routes/ssh');
const firewallRouter = require('./src/routes/firewall');
const cacheRouter = require('./src/routes/cache');
const backupRouter = require('./src/routes/backup');
const wordpressRouter = require('./src/routes/wordpress');
const monitorRouter = require('./src/routes/monitor');
const servicesRouter = require('./src/routes/services');
const { initDB } = require('./src/utils/database');
const { setupWebSocket } = require('./src/utils/websocket');

const app = express();
const server = http.createServer(app);

// Config
const PORT = process.env.MYVPS_API_PORT || 3001;
const MYVPS_CONF = '/etc/myvps/.myvps.conf';

// Init database
initDB();

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Rate limiting
app.use('/api/auth', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many login attempts. Try again later.' }
}));

app.use('/api', rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 120,
    message: { error: 'Rate limit exceeded.' }
}));

// Static files (frontend build)
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/domains', authMiddleware, domainRouter);
app.use('/api/databases', authMiddleware, databaseRouter);
app.use('/api/php', authMiddleware, phpRouter);
app.use('/api/nginx', authMiddleware, nginxRouter);
app.use('/api/ssl', authMiddleware, sslRouter);
app.use('/api/ssh', authMiddleware, sshRouter);
app.use('/api/firewall', authMiddleware, firewallRouter);
app.use('/api/cache', authMiddleware, cacheRouter);
app.use('/api/backup', authMiddleware, backupRouter);
app.use('/api/wordpress', authMiddleware, wordpressRouter);
app.use('/api/monitor', authMiddleware, monitorRouter);
app.use('/api/services', authMiddleware, servicesRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
});

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('API Error:', err.message);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});

// WebSocket for real-time monitoring
const wss = new WebSocket.Server({ server, path: '/ws' });
setupWebSocket(wss);

// Start
server.listen(PORT, '0.0.0.0', () => {
    console.log(`MyVPS API Server running on port ${PORT}`);
});
