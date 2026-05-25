/**
 * FTP Management API routes
 */
const express = require('express');
const router = express.Router();
const { run, runSafe } = require('../utils/exec');

// Check FTP server status
router.get('/status', async (req, res) => {
    const vsftpd = await runSafe('systemctl is-active vsftpd 2>/dev/null');
    const pureFtp = await runSafe('systemctl is-active pure-ftpd 2>/dev/null');
    res.json({
        vsftpd: (vsftpd.stdout || '').trim(),
        pureFtp: (pureFtp.stdout || '').trim(),
        installed: (vsftpd.stdout || '').trim() === 'active' || (pureFtp.stdout || '').trim() === 'active'
    });
});

// List FTP users
router.get('/', async (req, res) => {
    try {
        const r = await runSafe('cat /etc/vsftpd.userlist 2>/dev/null || cat /etc/vsftpd/user_list 2>/dev/null');
        const users = (r.stdout || '').split('\n').filter(u => u.trim() && !u.startsWith('#'));
        const ftpUsers = [];
        for (const user of users) {
            const home = await runSafe(`getent passwd ${user} | cut -d: -f6`);
            ftpUsers.push({ username: user, home: (home.stdout || '').trim() });
        }
        res.json({ users: ftpUsers });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create FTP user
router.post('/', async (req, res) => {
    const { username, password, home } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const homeDir = home || `/var/www/${username}`;
    try {
        await run(`useradd -m -d ${homeDir} -s /usr/sbin/nologin ${username} 2>/dev/null || useradd -m -d ${homeDir} -s /sbin/nologin ${username}`);
        await run(`echo "${username}:${password}" | chpasswd`);
        await run(`mkdir -p ${homeDir} && chown ${username}:${username} ${homeDir}`);
        const userlist = '/etc/vsftpd.userlist';
        await runSafe(`touch ${userlist} && echo "${username}" >> ${userlist}`);
        res.json({ message: 'FTP user created', username, home: homeDir });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Change FTP user password
router.post('/:username/password', async (req, res) => {
    const { username } = req.params;
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'password required' });
    try {
        await run(`echo "${username}:${password}" | chpasswd`);
        res.json({ message: 'Password changed', username });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete FTP user
router.delete('/:username', async (req, res) => {
    const { username } = req.params;
    try {
        await run(`userdel ${username} 2>/dev/null`);
        await runSafe(`sed -i '/^${username}$/d' /etc/vsftpd.userlist 2>/dev/null`);
        res.json({ message: 'FTP user deleted', username });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
