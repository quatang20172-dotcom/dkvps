/**
 * Server Migration API routes
 * Export/Import server config for migration between VPS
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { run, runSafe } = require('../utils/exec');

// Export server config (domains, databases, nginx configs, php pools)
router.get('/export', async (req, res) => {
    try {
        const exportData = { version: '1.0', exported: new Date().toISOString(), domains: [], databases: [], nginx: {}, phpPools: {} };

        // Domains
        const confDir = '/etc/myvps/user';
        if (fs.existsSync(confDir)) {
            const files = fs.readdirSync(confDir).filter(f => f.endsWith('.conf'));
            for (const f of files) {
                try {
                    const content = fs.readFileSync(path.join(confDir, f), 'utf8');
                    const domain = f.replace(/^\./, '').replace('.conf', '');
                    const config = {};
                    content.split('\n').forEach(line => {
                        if (line.includes('=') && !line.startsWith('#')) {
                            const [k, ...v] = line.split('=');
                            config[k.trim()] = v.join('=').trim().replace(/^'|'$/g, '');
                        }
                    });
                    exportData.domains.push({ domain, config });
                } catch {}
            }
        }

        // Databases
        const dbResult = await runSafe("mysql -u root -e \"SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME NOT IN ('information_schema','performance_schema','mysql','sys')\" -sN 2>/dev/null");
        exportData.databases = (dbResult.stdout || '').split('\n').filter(Boolean);

        // Nginx configs
        const nginxDirs = ['/etc/nginx/sites-available', '/etc/nginx/conf.d'];
        for (const dir of nginxDirs) {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir).filter(f => f.endsWith('.conf') && f !== 'default.conf');
                for (const f of files) {
                    try { exportData.nginx[f] = fs.readFileSync(path.join(dir, f), 'utf8'); } catch {}
                }
            }
        }

        // PHP-FPM pools
        const phpVer = await runSafe("php -r 'echo PHP_MAJOR_VERSION.\".\".PHP_MINOR_VERSION;' 2>/dev/null");
        const ver = (phpVer.stdout || '8.1').trim();
        const poolDirs = [`/etc/php/${ver}/fpm/pool.d`, '/etc/php-fpm.d'];
        for (const dir of poolDirs) {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir).filter(f => f.endsWith('.conf') && f !== 'www.conf');
                for (const f of files) {
                    try { exportData.phpPools[f] = fs.readFileSync(path.join(dir, f), 'utf8'); } catch {}
                }
            }
        }

        // Crontab
        const cronResult = await runSafe('crontab -l 2>/dev/null');
        exportData.crontab = cronResult.stdout || '';

        // Installed packages
        const pkgs = await runSafe('dpkg --get-selections 2>/dev/null | head -100');
        exportData.packages = (pkgs.stdout || '').split('\n').filter(l => l.includes('install')).map(l => l.split(/\s+/)[0]);

        res.json(exportData);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Import server config
router.post('/import', async (req, res) => {
    const { domains, databases, nginx, phpPools, crontab } = req.body;
    const results = { domains: [], databases: [], nginx: [], phpPools: [], errors: [] };

    // Import nginx configs
    if (nginx) {
        const dir = fs.existsSync('/etc/nginx/sites-available') ? '/etc/nginx/sites-available' : '/etc/nginx/conf.d';
        for (const [name, content] of Object.entries(nginx)) {
            try {
                fs.writeFileSync(path.join(dir, name), content);
                if (fs.existsSync('/etc/nginx/sites-enabled')) {
                    await runSafe(`ln -sf ${dir}/${name} /etc/nginx/sites-enabled/${name}`);
                }
                results.nginx.push(name);
            } catch (e) { results.errors.push(`nginx ${name}: ${e.message}`); }
        }
    }

    // Import PHP-FPM pools
    if (phpPools) {
        const phpVer = await runSafe("php -r 'echo PHP_MAJOR_VERSION.\".\".PHP_MINOR_VERSION;' 2>/dev/null");
        const ver = (phpVer.stdout || '8.1').trim();
        let poolDir = '/etc/php-fpm.d';
        if (fs.existsSync(`/etc/php/${ver}/fpm/pool.d`)) poolDir = `/etc/php/${ver}/fpm/pool.d`;
        for (const [name, content] of Object.entries(phpPools)) {
            try {
                fs.writeFileSync(path.join(poolDir, name), content);
                results.phpPools.push(name);
            } catch (e) { results.errors.push(`php-pool ${name}: ${e.message}`); }
        }
    }

    // Import domain configs
    if (domains) {
        const confDir = '/etc/myvps/user';
        await runSafe(`mkdir -p ${confDir}`);
        for (const d of domains) {
            try {
                const lines = Object.entries(d.config).map(([k, v]) => `${k}=${v.includes(' ') ? `'${v}'` : v}`);
                fs.writeFileSync(path.join(confDir, `.${d.domain}.conf`), lines.join('\n') + '\n');
                await runSafe(`mkdir -p /var/www/${d.domain}/public_html`);
                results.domains.push(d.domain);
            } catch (e) { results.errors.push(`domain ${d.domain}: ${e.message}`); }
        }
    }

    // Import crontab
    if (crontab) {
        try {
            await run(`echo "${crontab.replace(/"/g, '\\"')}" | crontab -`);
        } catch (e) { results.errors.push(`crontab: ${e.message}`); }
    }

    // Reload services
    await runSafe('nginx -t && systemctl reload nginx 2>/dev/null');
    const phpVer = await runSafe("php -r 'echo PHP_MAJOR_VERSION.\".\".PHP_MINOR_VERSION;' 2>/dev/null");
    const ver = (phpVer.stdout || '8.1').trim();
    await runSafe(`systemctl restart php${ver}-fpm 2>/dev/null || systemctl restart php-fpm 2>/dev/null`);

    res.json({ message: 'Import completed', results });
});

// Sync files from remote server via rsync
router.post('/sync', async (req, res) => {
    const { source, destination, sshKey } = req.body;
    if (!source || !destination) return res.status(400).json({ error: 'source and destination required' });
    try {
        const keyFlag = sshKey ? `-e "ssh -i ${sshKey} -o StrictHostKeyChecking=no"` : '-e "ssh -o StrictHostKeyChecking=no"';
        const r = await run(`rsync -avz --progress ${keyFlag} "${source}" "${destination}"`, 300000);
        res.json({ message: 'Sync completed', output: r.stdout });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
