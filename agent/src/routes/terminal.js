/**
 * Terminal API - provides WebSocket-based terminal access
 * Uses node-pty for PTY support (install: npm install node-pty)
 * Fallback: uses child_process spawn for basic terminal
 */
const express = require('express');
const router = express.Router();

// Simple command execution endpoint (fallback if no xterm.js)
router.post('/exec', async (req, res) => {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: 'command required' });
    const { exec } = require('child_process');
    exec(command, { timeout: 30000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
        res.json({
            stdout: stdout || '',
            stderr: stderr || '',
            code: error ? error.code || 1 : 0
        });
    });
});

module.exports = router;

/**
 * Setup terminal WebSocket
 * Called from server.js to attach /ws/terminal endpoint
 */
module.exports.setupTerminalWS = function(server, jwt, JWT_SECRET) {
    const WebSocket = require('ws');
    const { spawn } = require('child_process');

    const wss = new WebSocket.Server({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url, 'http://localhost');
        if (url.pathname !== '/ws/terminal') return;

        const token = url.searchParams.get('token');
        if (!token) { socket.destroy(); return; }
        try { jwt.verify(token, JWT_SECRET); } catch { socket.destroy(); return; }

        wss.handleUpgrade(request, socket, head, (ws) => {
            const shell = spawn('/bin/bash', ['-i'], {
                env: { ...process.env, TERM: 'xterm-256color' },
                cwd: process.env.HOME || '/root'
            });

            shell.stdout.on('data', (data) => {
                if (ws.readyState === WebSocket.OPEN) ws.send(data.toString());
            });
            shell.stderr.on('data', (data) => {
                if (ws.readyState === WebSocket.OPEN) ws.send(data.toString());
            });
            shell.on('close', () => {
                if (ws.readyState === WebSocket.OPEN) ws.close();
            });

            ws.on('message', (msg) => {
                const str = msg.toString();
                try {
                    const parsed = JSON.parse(str);
                    if (parsed.type === 'resize' && parsed.cols && parsed.rows) return;
                    if (parsed.type === 'input') { shell.stdin.write(parsed.data); return; }
                } catch {}
                shell.stdin.write(str);
            });

            ws.on('close', () => { shell.kill(); });
        });
    });
};
