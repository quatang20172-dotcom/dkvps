/**
 * Cloud Backup API routes
 * Backup to S3, Google Drive, pCloud, remote server via rsync
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { run, runSafe } = require('../utils/exec');

const CONFIG_FILE = '/etc/myvps/cloudbackup.json';
const RCLONE_CONFIG = '/root/.config/rclone/rclone.conf';

function loadConfig() {
    try { if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch {}
    return { destinations: [], schedules: [], history: [] };
}

function saveConfig(config) {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function writeRcloneRemote(remoteName, lines) {
    const dir = path.dirname(RCLONE_CONFIG);
    fs.mkdirSync(dir, { recursive: true });
    let existing = '';
    if (fs.existsSync(RCLONE_CONFIG)) existing = fs.readFileSync(RCLONE_CONFIG, 'utf8');
    // Remove existing remote with same name
    const sections = existing.split(/(?=^\[)/m).filter(s => s.trim());
    const filtered = sections.filter(s => !s.startsWith(`[${remoteName}]`));
    const newSection = `[${remoteName}]\n${lines.join('\n')}\n`;
    fs.writeFileSync(RCLONE_CONFIG, [...filtered, newSection].join('\n'));
}

// List cloud backup destinations
router.get('/destinations', (req, res) => {
    const config = loadConfig();
    const safe = config.destinations.map(d => ({
        ...d,
        secretKey: d.secretKey ? '***' : undefined,
        password: d.password ? '***' : undefined,
        clientSecret: d.clientSecret ? '***' : undefined,
        token: d.token ? '***' : undefined,
    }));
    res.json({ destinations: safe });
});

// Add backup destination
router.post('/destinations', async (req, res) => {
    const { name, type, bucket, region, accessKey, secretKey, host,
        path: remotePath, username, password, sshKey,
        clientId, clientSecret, token, folderId } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name and type required' });

    const config = loadConfig();
    const remoteName = `myvps-${name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
    const dest = {
        id: Date.now().toString(), name, type, remoteName,
        bucket, region, accessKey, secretKey,
        host, path: remotePath, username, password, sshKey,
        clientId, clientSecret, token, folderId,
        created: new Date().toISOString()
    };

    // Auto-configure rclone for Google Drive and pCloud
    if (type === 'gdrive') {
        const lines = ['type = drive'];
        if (clientId) lines.push(`client_id = ${clientId}`);
        if (clientSecret) lines.push(`client_secret = ${clientSecret}`);
        if (token) lines.push(`token = ${token}`);
        if (folderId) lines.push(`root_folder_id = ${folderId}`);
        lines.push('scope = drive');
        writeRcloneRemote(remoteName, lines);
        dest.rcloneRemote = remoteName;
    } else if (type === 'pcloud') {
        const lines = ['type = pcloud'];
        if (username) lines.push(`username = ${username}`);
        if (password) lines.push(`password = ${password}`);
        if (token) lines.push(`token = ${token}`);
        if (host) lines.push(`hostname = ${host}`);
        writeRcloneRemote(remoteName, lines);
        dest.rcloneRemote = remoteName;
    }

    config.destinations.push(dest);
    saveConfig(config);
    res.json({ message: 'Destination added', id: dest.id });
});

// Delete backup destination
router.delete('/destinations/:id', (req, res) => {
    const config = loadConfig();
    const dest = config.destinations.find(d => d.id === req.params.id);
    config.destinations = config.destinations.filter(d => d.id !== req.params.id);
    saveConfig(config);
    // Clean up rclone config
    if (dest?.rcloneRemote && fs.existsSync(RCLONE_CONFIG)) {
        try {
            const existing = fs.readFileSync(RCLONE_CONFIG, 'utf8');
            const sections = existing.split(/(?=^\[)/m).filter(s => s.trim());
            const filtered = sections.filter(s => !s.startsWith(`[${dest.rcloneRemote}]`));
            fs.writeFileSync(RCLONE_CONFIG, filtered.join('\n'));
        } catch {}
    }
    res.json({ message: 'Destination deleted' });
});

// Setup rclone interactively (for OAuth-based services)
router.post('/rclone-setup', async (req, res) => {
    const { type } = req.body;
    try {
        // Check if rclone is installed
        const check = await runSafe('rclone --version 2>/dev/null');
        if (!check.stdout) {
            // Auto-install rclone
            await run('curl https://rclone.org/install.sh | sudo bash 2>&1', 60000);
        }
        const ver = await runSafe('rclone --version 2>/dev/null');
        res.json({
            installed: !!ver.stdout,
            version: (ver.stdout || '').split('\n')[0],
            instructions: type === 'gdrive'
                ? 'For Google Drive: 1) Run `rclone authorize "drive"` on a machine with a browser, 2) Copy the token JSON, 3) Paste it when adding destination'
                : type === 'pcloud'
                    ? 'For pCloud: 1) Run `rclone authorize "pcloud"` on a machine with a browser, 2) Copy the token JSON, 3) Paste it when adding destination'
                    : 'Run `rclone config` to set up manually'
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// List rclone remotes
router.get('/rclone-remotes', async (req, res) => {
    try {
        const r = await runSafe('rclone listremotes 2>/dev/null');
        const remotes = (r.stdout || '').split('\n').filter(Boolean).map(r => r.replace(/:$/, ''));
        res.json({ remotes });
    } catch { res.json({ remotes: [] }); }
});

// Run cloud backup
router.post('/run', async (req, res) => {
    const { destinationId, domain, type } = req.body;
    if (!destinationId) return res.status(400).json({ error: 'destinationId required' });
    const config = loadConfig();
    const dest = config.destinations.find(d => d.id === destinationId);
    if (!dest) return res.status(404).json({ error: 'Destination not found' });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = '/backup';
    await runSafe(`mkdir -p ${backupDir}`);

    try {
        let localFile = '';

        // Create local backup first
        if (domain && type !== 'database') {
            localFile = `${backupDir}/files_${domain}_${timestamp}.tar.gz`;
            await run(`tar -czf "${localFile}" -C /var/www "${domain}" 2>/dev/null`, 300000);
        } else if (domain && type === 'database') {
            const dbName = domain.replace(/\./g, '_').replace(/-/g, '_');
            localFile = `${backupDir}/db_${dbName}_${timestamp}.sql.gz`;
            await run(`mysqldump -u root "${dbName}" 2>/dev/null | gzip > "${localFile}"`, 300000);
        } else {
            localFile = `${backupDir}/full_backup_${timestamp}.tar.gz`;
            await run(`tar -czf "${localFile}" /var/www /etc/nginx /etc/myvps 2>/dev/null`, 300000);
        }

        // Upload to destination
        let uploadResult = '';
        if (dest.type === 's3') {
            const s3Path = `s3://${dest.bucket}/${path.basename(localFile)}`;
            const envVars = `AWS_ACCESS_KEY_ID="${dest.accessKey}" AWS_SECRET_ACCESS_KEY="${dest.secretKey}" AWS_DEFAULT_REGION="${dest.region || 'us-east-1'}"`;
            const r = await run(`${envVars} aws s3 cp "${localFile}" "${s3Path}" 2>&1`, 300000);
            uploadResult = r.stdout;
        } else if (dest.type === 'rsync') {
            const keyFlag = dest.sshKey ? `-e "ssh -i ${dest.sshKey} -o StrictHostKeyChecking=no"` : '-e "ssh -o StrictHostKeyChecking=no"';
            const remote = `${dest.username || 'root'}@${dest.host}:${dest.path || '/backup'}/`;
            const r = await run(`rsync -avz ${keyFlag} "${localFile}" "${remote}" 2>&1`, 300000);
            uploadResult = r.stdout;
        } else if (dest.type === 'gdrive' || dest.type === 'pcloud') {
            const remote = dest.rcloneRemote || dest.remoteName;
            const remotePath = dest.path || '/myvps-backup';
            const r = await run(`rclone copy "${localFile}" "${remote}:${remotePath}" 2>&1`, 300000);
            uploadResult = r.stdout;
        } else if (dest.type === 'rclone') {
            const r = await run(`rclone copy "${localFile}" "${dest.name}:${dest.path || '/backup'}" 2>&1`, 300000);
            uploadResult = r.stdout;
        }

        // Save to history
        config.history.unshift({
            id: Date.now().toString(),
            destination: dest.name,
            type: dest.type,
            file: path.basename(localFile),
            size: fs.existsSync(localFile) ? fs.statSync(localFile).size : 0,
            date: new Date().toISOString(),
            status: 'success'
        });
        if (config.history.length > 50) config.history = config.history.slice(0, 50);
        saveConfig(config);

        res.json({ message: 'Backup uploaded', file: localFile, output: uploadResult });
    } catch (e) {
        config.history.unshift({
            id: Date.now().toString(), destination: dest.name, type: dest.type,
            file: '', date: new Date().toISOString(), status: 'failed', error: e.message
        });
        saveConfig(config);
        res.status(500).json({ error: e.message });
    }
});

// Get backup history
router.get('/history', (req, res) => {
    const config = loadConfig();
    res.json({ history: config.history || [] });
});

// Check available tools
router.get('/tools', async (req, res) => {
    const aws = await runSafe('aws --version 2>/dev/null');
    const rclone = await runSafe('rclone --version 2>/dev/null');
    const rsync = await runSafe('rsync --version 2>/dev/null');
    // Check rclone remotes
    const remotes = await runSafe('rclone listremotes 2>/dev/null');
    const remoteList = (remotes.stdout || '').split('\n').filter(Boolean).map(r => r.replace(/:$/, ''));
    res.json({
        aws: !!aws.stdout,
        rclone: !!rclone.stdout,
        rsync: !!rsync.stdout,
        awsVersion: (aws.stdout || '').split('\n')[0],
        rcloneVersion: (rclone.stdout || '').split('\n')[0],
        rcloneRemotes: remoteList,
    });
});

module.exports = router;
