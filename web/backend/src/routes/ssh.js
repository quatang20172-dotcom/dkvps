const express = require('express');
const { runCommand, readConfig } = require('../utils/cli');
const { logAction } = require('../utils/database');

const router = express.Router();

router.get('/info', (req, res) => {
    const config = readConfig();
    res.json({ port: config.port_ssh || '22' });
});

router.post('/port', async (req, res) => {
    const { port } = req.body;
    try {
        await runCommand(`sed -i 's/^#*Port .*/Port ${port}/' /etc/ssh/sshd_config && systemctl reload sshd`);
        logAction(req.user.id, 'change_ssh_port', 'ssh', port.toString(), null, req.ip);
        res.json({ message: `SSH port changed to ${port}` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/failed-logins', async (req, res) => {
    try {
        const result = await runCommand(
            "grep 'Failed password' /var/log/auth.log 2>/dev/null | awk '{print $(NF-3)}' | sort | uniq -c | sort -rn | head -20 || " +
            "grep 'authentication failure' /var/log/secure 2>/dev/null | head -20 || echo 'No log found'"
        );
        res.json({ data: result.stdout });
    } catch (e) {
        res.json({ data: 'Unable to read auth logs.' });
    }
});

module.exports = router;
