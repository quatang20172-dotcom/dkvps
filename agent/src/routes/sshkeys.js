/**
 * SSH Key Management API routes
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { run, runSafe } = require('../utils/exec');

const AUTH_KEYS = '/root/.ssh/authorized_keys';
const SSH_CONFIG = '/etc/ssh/sshd_config';

// List SSH keys
router.get('/', (req, res) => {
    try {
        if (!fs.existsSync(AUTH_KEYS)) return res.json({ keys: [] });
        const content = fs.readFileSync(AUTH_KEYS, 'utf8');
        const keys = content.split('\n').filter(l => l.trim() && !l.startsWith('#')).map((line, i) => {
            const parts = line.trim().split(/\s+/);
            return {
                id: i,
                type: parts[0] || '',
                fingerprint: parts[1] ? parts[1].substring(0, 20) + '...' : '',
                comment: parts.slice(2).join(' ') || 'unnamed',
                raw: line.trim()
            };
        });
        res.json({ keys });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Add SSH key
router.post('/', (req, res) => {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'key required' });
    const trimmed = key.trim();
    if (!trimmed.startsWith('ssh-') && !trimmed.startsWith('ecdsa-')) {
        return res.status(400).json({ error: 'Invalid SSH key format' });
    }
    try {
        fs.mkdirSync('/root/.ssh', { recursive: true });
        let existing = '';
        if (fs.existsSync(AUTH_KEYS)) existing = fs.readFileSync(AUTH_KEYS, 'utf8');
        if (existing.includes(trimmed)) return res.status(400).json({ error: 'Key already exists' });
        fs.appendFileSync(AUTH_KEYS, (existing.endsWith('\n') ? '' : '\n') + trimmed + '\n');
        fs.chmodSync(AUTH_KEYS, 0o600);
        res.json({ message: 'SSH key added' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete SSH key by index
router.delete('/:id', (req, res) => {
    const idx = parseInt(req.params.id);
    try {
        if (!fs.existsSync(AUTH_KEYS)) return res.status(404).json({ error: 'No keys file' });
        const lines = fs.readFileSync(AUTH_KEYS, 'utf8').split('\n');
        const keys = lines.filter(l => l.trim() && !l.startsWith('#'));
        if (idx < 0 || idx >= keys.length) return res.status(404).json({ error: 'Key not found' });
        keys.splice(idx, 1);
        const comments = lines.filter(l => l.startsWith('#'));
        fs.writeFileSync(AUTH_KEYS, [...comments, ...keys].join('\n') + '\n');
        res.json({ message: 'SSH key deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get SSH config
router.get('/config', async (req, res) => {
    try {
        const port = await runSafe("grep -E '^Port ' /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}'");
        const rootLogin = await runSafe("grep -E '^PermitRootLogin ' /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}'");
        const passAuth = await runSafe("grep -E '^PasswordAuthentication ' /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}'");
        res.json({
            port: (port.stdout || '22').trim(),
            permitRootLogin: (rootLogin.stdout || 'yes').trim(),
            passwordAuthentication: (passAuth.stdout || 'yes').trim()
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update SSH config
router.post('/config', async (req, res) => {
    const { port, permitRootLogin, passwordAuthentication } = req.body;
    try {
        if (port) {
            await run(`sed -i 's/^#*Port .*/Port ${port}/' ${SSH_CONFIG}`);
            await runSafe(`grep -q '^Port ' ${SSH_CONFIG} || echo 'Port ${port}' >> ${SSH_CONFIG}`);
        }
        if (permitRootLogin !== undefined) {
            await run(`sed -i 's/^#*PermitRootLogin .*/PermitRootLogin ${permitRootLogin}/' ${SSH_CONFIG}`);
            await runSafe(`grep -q '^PermitRootLogin ' ${SSH_CONFIG} || echo 'PermitRootLogin ${permitRootLogin}' >> ${SSH_CONFIG}`);
        }
        if (passwordAuthentication !== undefined) {
            await run(`sed -i 's/^#*PasswordAuthentication .*/PasswordAuthentication ${passwordAuthentication}/' ${SSH_CONFIG}`);
            await runSafe(`grep -q '^PasswordAuthentication ' ${SSH_CONFIG} || echo 'PasswordAuthentication ${passwordAuthentication}' >> ${SSH_CONFIG}`);
        }
        await run('systemctl reload sshd 2>/dev/null || systemctl reload ssh 2>/dev/null');
        res.json({ message: 'SSH config updated' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Generate SSH key pair
router.post('/generate', async (req, res) => {
    const { comment, type } = req.body;
    const keyType = type || 'ed25519';
    const keyComment = comment || 'myvps-generated';
    const keyPath = `/root/.ssh/myvps_${Date.now()}`;
    try {
        await run(`ssh-keygen -t ${keyType} -C "${keyComment}" -f "${keyPath}" -N ""`);
        const pubKey = fs.readFileSync(`${keyPath}.pub`, 'utf8').trim();
        const privKey = fs.readFileSync(keyPath, 'utf8');
        fs.unlinkSync(keyPath);
        fs.unlinkSync(`${keyPath}.pub`);
        res.json({ publicKey: pubKey, privateKey: privKey });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
