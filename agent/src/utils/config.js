/**
 * Config reader - reads /etc/myvps/.myvps.conf
 */
const fs = require('fs');
const path = require('path');

const CONF_PATH = '/etc/myvps/.myvps.conf';
const USER_DIR = '/etc/myvps/user';

function loadConfig() {
    const config = {};
    try {
        fs.readFileSync(CONF_PATH, 'utf8').split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const idx = line.indexOf('=');
                if (idx > 0) config[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
            }
        });
    } catch (e) { /* config may not exist */ }
    return config;
}

function loadDomainConfig(domain) {
    const config = {};
    try {
        fs.readFileSync(path.join(USER_DIR, `.${domain}.conf`), 'utf8').split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#') && !line.startsWith('[')) {
                const idx = line.indexOf('=');
                if (idx > 0) config[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
            }
        });
    } catch (e) { return null; }
    return config;
}

function listDomainConfigs() {
    const domains = [];
    try {
        fs.readdirSync(USER_DIR).forEach(file => {
            if (file.startsWith('.') && file.endsWith('.conf')) {
                const domain = file.slice(1, -5);
                if (domain.includes('.')) {
                    const cfg = loadDomainConfig(domain);
                    if (cfg) domains.push({ domain, ...cfg });
                }
            }
        });
    } catch (e) { /* dir may not exist */ }
    return domains;
}

module.exports = { loadConfig, loadDomainConfig, listDomainConfigs };
