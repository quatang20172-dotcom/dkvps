/**
 * App Store API routes
 * One-click install popular applications
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const { run, runSafe } = require('../utils/exec');

const APPS = [
    {
        id: 'wordpress', name: 'WordPress', category: 'CMS', icon: 'W',
        description: 'Popular blogging and CMS platform',
        install: async (domain) => {
            const dir = `/var/www/${domain}/public_html`;
            await run(`mkdir -p ${dir}`);
            await run(`cd ${dir} && curl -sO https://wordpress.org/latest.tar.gz && tar -xzf latest.tar.gz --strip-components=1 && rm latest.tar.gz`);
            await run(`chown -R www-data:www-data ${dir}`);
            return { message: 'WordPress downloaded. Complete setup at http://' + domain };
        }
    },
    {
        id: 'phpmyadmin', name: 'phpMyAdmin', category: 'Database', icon: 'P',
        description: 'Web-based MySQL/MariaDB management tool',
        install: async (domain) => {
            const dir = `/var/www/${domain}/public_html/phpmyadmin`;
            await run(`mkdir -p ${dir}`);
            await run(`cd /tmp && curl -sL https://www.phpmyadmin.net/downloads/phpMyAdmin-latest-all-languages.tar.gz -o pma.tar.gz && tar -xzf pma.tar.gz --strip-components=1 -C ${dir} && rm pma.tar.gz`);
            const secret = require('crypto').randomBytes(32).toString('hex');
            fs.writeFileSync(`${dir}/config.inc.php`, `<?php\n$cfg['blowfish_secret'] = '${secret}';\n$cfg['Servers'][1]['host'] = 'localhost';\n$cfg['Servers'][1]['auth_type'] = 'cookie';\n`);
            await run(`chown -R www-data:www-data ${dir}`);
            return { message: 'phpMyAdmin installed at /phpmyadmin' };
        }
    },
    {
        id: 'filemanager', name: 'Tiny File Manager', category: 'Tools', icon: 'F',
        description: 'Web-based file manager (single PHP file)',
        install: async (domain) => {
            const dir = `/var/www/${domain}/public_html/filemanager`;
            await run(`mkdir -p ${dir}`);
            await run(`curl -sL https://raw.githubusercontent.com/prasathmani/tinyfilemanager/master/tinyfilemanager.php -o ${dir}/index.php`);
            await run(`chown -R www-data:www-data ${dir}`);
            return { message: 'Tiny File Manager installed at /filemanager' };
        }
    },
    {
        id: 'adminer', name: 'Adminer', category: 'Database', icon: 'A',
        description: 'Lightweight database management in a single PHP file',
        install: async (domain) => {
            const dir = `/var/www/${domain}/public_html/adminer`;
            await run(`mkdir -p ${dir}`);
            await run(`curl -sL https://github.com/vrana/adminer/releases/download/v4.8.1/adminer-4.8.1.php -o ${dir}/index.php`);
            await run(`chown -R www-data:www-data ${dir}`);
            return { message: 'Adminer installed at /adminer' };
        }
    },
    {
        id: 'laravel', name: 'Laravel', category: 'Framework', icon: 'L',
        description: 'PHP web application framework',
        install: async (domain) => {
            const dir = `/var/www/${domain}`;
            await run(`cd ${dir} && composer create-project laravel/laravel public_html --no-interaction 2>/dev/null || echo "Install composer first"`, 120000);
            await run(`chown -R www-data:www-data ${dir}/public_html`);
            return { message: 'Laravel installed. Update nginx to point to public_html/public' };
        }
    },
    {
        id: 'nodejs-app', name: 'Node.js App', category: 'Runtime', icon: 'N',
        description: 'Express.js starter template',
        install: async (domain) => {
            const dir = `/var/www/${domain}/app`;
            await run(`mkdir -p ${dir}`);
            fs.writeFileSync(`${dir}/package.json`, JSON.stringify({
                name: domain.replace(/\./g, '-'), version: '1.0.0', main: 'app.js',
                scripts: { start: 'node app.js' },
                dependencies: { express: '^4.18.0' }
            }, null, 2));
            fs.writeFileSync(`${dir}/app.js`, `const express = require('express');\nconst app = express();\nconst PORT = process.env.PORT || 3000;\napp.get('/', (req, res) => res.send('Hello from ${domain}'));\napp.listen(PORT, () => console.log('Server running on port ' + PORT));\n`);
            await runSafe(`cd ${dir} && npm install 2>/dev/null`);
            return { message: 'Node.js app created. Start with: cd ' + dir + ' && npm start' };
        }
    },
    {
        id: 'static-site', name: 'Static HTML Site', category: 'Web', icon: 'H',
        description: 'Simple HTML/CSS/JS starter template',
        install: async (domain) => {
            const dir = `/var/www/${domain}/public_html`;
            await run(`mkdir -p ${dir}`);
            fs.writeFileSync(`${dir}/index.html`, `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1.0">\n<title>${domain}</title>\n<style>body{font-family:system-ui;max-width:800px;margin:50px auto;padding:0 20px;color:#333}h1{color:#2563eb}</style>\n</head>\n<body>\n<h1>Welcome to ${domain}</h1>\n<p>Your website is ready. Edit this file to get started.</p>\n</body>\n</html>\n`);
            await run(`chown -R www-data:www-data ${dir}`);
            return { message: 'Static site created with index.html' };
        }
    },
    {
        id: 'redis-commander', name: 'Redis Commander', category: 'Tools', icon: 'R',
        description: 'Web-based Redis management tool',
        install: async () => {
            await run('npm install -g redis-commander 2>/dev/null');
            return { message: 'Redis Commander installed. Start: redis-commander --port 8081' };
        }
    }
];

// List available apps
router.get('/', (req, res) => {
    const apps = APPS.map(({ id, name, category, icon, description }) => ({ id, name, category, icon, description }));
    res.json({ apps });
});

// Get app details
router.get('/:id', (req, res) => {
    const app = APPS.find(a => a.id === req.params.id);
    if (!app) return res.status(404).json({ error: 'App not found' });
    const { install, ...info } = app;
    res.json(info);
});

// Install app
router.post('/:id/install', async (req, res) => {
    const app = APPS.find(a => a.id === req.params.id);
    if (!app) return res.status(404).json({ error: 'App not found' });
    const { domain } = req.body;
    if (!domain && app.id !== 'redis-commander') return res.status(400).json({ error: 'domain required' });
    try {
        const result = await app.install(domain);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
