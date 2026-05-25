/**
 * Reverse Proxy API routes
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const { run, runSafe } = require('../utils/exec');

function getNginxDir() {
    if (fs.existsSync('/etc/nginx/sites-available')) return '/etc/nginx/sites-available';
    return '/etc/nginx/conf.d';
}

// List proxy configs
router.get('/', async (req, res) => {
    try {
        const dir = getNginxDir();
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.conf'));
        const proxies = [];
        for (const file of files) {
            const content = fs.readFileSync(`${dir}/${file}`, 'utf8');
            const proxyMatch = content.match(/proxy_pass\s+(.+);/);
            if (proxyMatch) {
                const serverMatch = content.match(/server_name\s+(.+);/);
                proxies.push({
                    domain: serverMatch ? serverMatch[1].trim() : file.replace('.conf', ''),
                    target: proxyMatch[1].trim(),
                    file: file,
                    ssl: content.includes('ssl_certificate')
                });
            }
        }
        res.json({ proxies });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create reverse proxy
router.post('/', async (req, res) => {
    const { domain, target, ssl } = req.body;
    if (!domain || !target) return res.status(400).json({ error: 'domain and target required' });
    try {
        const dir = getNginxDir();
        const config = `server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass ${target};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
`;
        fs.writeFileSync(`${dir}/${domain}.conf`, config);
        if (fs.existsSync('/etc/nginx/sites-enabled')) {
            await runSafe(`ln -sf ${dir}/${domain}.conf /etc/nginx/sites-enabled/${domain}.conf`);
        }
        await run('nginx -t');
        await run('systemctl reload nginx');
        res.json({ message: 'Proxy created', domain, target });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete proxy
router.delete('/:domain', async (req, res) => {
    const { domain } = req.params;
    try {
        const dir = getNginxDir();
        const fp = `${dir}/${domain}.conf`;
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
        if (fs.existsSync(`/etc/nginx/sites-enabled/${domain}.conf`)) {
            fs.unlinkSync(`/etc/nginx/sites-enabled/${domain}.conf`);
        }
        await run('systemctl reload nginx');
        res.json({ message: 'Proxy deleted', domain });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
