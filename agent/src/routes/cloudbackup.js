/**
 * Cloud Backup API routes
 * Backup to S3, Google Drive, remote server via rsync
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { run, runSafe } = require('../utils/exec');

const CONFIG_FILE = '/etc/myvps/cloudbackup.json';

function loadConfig() {
    try { if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch {}
    return { destinations: [], schedules: [], history: [] };
}

function saveConfig(config) {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// List cloud backup destinations
router.get('/destinations', (req, res) => {
    const config = loadConfig();
    const safe = config.destinations.map(d => ({ ...d, secretKey: d.secretKey ? '***' : undefined, password: d.password ? '***' : undefined }));
    res.json({ destinations: safe });
});

// Add backup destination
router.post('/destinations', (req, res) => {
    const { name, type, bucket, region, accessKey, secretKey, host, path: remotePath, username, password, sshKey } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name and type required' });
    const config = loadConfig();
    const dest = {
        id: Date.now().toString(), name, type,
        bucket, region, accessKey, secretKey,
        host, path: remotePath, username, password, sshKey,
        created: new Date().toISOString()
    };
    config.destinations.push(dest);
    saveConfig(config);
    res.json({ message: 'Destination added', id: dest.id });
});

// Delete backup destination
router.delete('/destinations/:id', (req, res) => {
    const config = loadConfig();
    config.destinations = config.destinations.filter(d => d.id !== req.params.id);
    saveConfig(config);
    res.json({ message: 'Destination deleted' });
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
    res.json({
        aws: !!aws.stdout,
        rclone: !!rclone.stdout,
        rsync: !!rsync.stdout,
        awsVersion: (aws.stdout || '').split('\n')[0],
        rcloneVersion: (rclone.stdout || '').split('\n')[0],
    });
});

module.exports = router;
