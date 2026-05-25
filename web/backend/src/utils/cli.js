/**
 * CLI Bridge - Executes MyVPS CLI commands and returns results
 */

const { exec, execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const MYVPS_CLI = '/usr/bin/myvps';
const MYVPS_CONF = '/etc/myvps/.myvps.conf';
const MYVPS_USER_DIR = '/etc/myvps/user';

/**
 * Execute a shell command and return output
 */
function runCommand(command, timeout = 30000) {
    return new Promise((resolve, reject) => {
        exec(command, { timeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            if (error && error.killed) {
                reject(new Error(`Command timed out: ${command}`));
                return;
            }
            resolve({
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: error ? error.code : 0
            });
        });
    });
}

/**
 * Execute MyVPS CLI command
 */
function runMyvps(module, action, args = []) {
    const cmd = [MYVPS_CLI, module, action, ...args].filter(Boolean).join(' ');
    return runCommand(cmd);
}

/**
 * Execute MyVPS CLI in JSON mode
 */
function runMyvpsJson(module, action, args = []) {
    const cmd = [MYVPS_CLI, '--json', module, action, ...args].filter(Boolean).join(' ');
    return runCommand(cmd);
}

/**
 * Read MyVPS global config
 */
function readConfig() {
    const config = {};
    try {
        const content = fs.readFileSync(MYVPS_CONF, 'utf8');
        content.split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key) {
                    config[key.trim()] = valueParts.join('=').trim();
                }
            }
        });
    } catch (e) {
        // Config may not exist yet
    }
    return config;
}

/**
 * Read domain config
 */
function readDomainConfig(domain) {
    const config = {};
    const confFile = path.join(MYVPS_USER_DIR, `.${domain}.conf`);
    try {
        const content = fs.readFileSync(confFile, 'utf8');
        content.split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#') && !line.startsWith('[')) {
                const [key, ...valueParts] = line.split('=');
                if (key) {
                    config[key.trim()] = valueParts.join('=').trim();
                }
            }
        });
    } catch (e) {
        return null;
    }
    return config;
}

/**
 * List all domains from config files
 */
function listDomains() {
    const domains = [];
    try {
        const files = fs.readdirSync(MYVPS_USER_DIR);
        files.forEach(file => {
            if (file.startsWith('.') && file.endsWith('.conf')) {
                const domain = file.slice(1, -5);
                if (domain.includes('.')) {
                    const config = readDomainConfig(domain);
                    if (config) {
                        domains.push({
                            domain,
                            username: config.username,
                            db_name: config.db_name || '',
                            php_version: config.php_version || '8.1',
                            status: config.status || 'active',
                            created_at: config.created_at || ''
                        });
                    }
                }
            }
        });
    } catch (e) {
        // Directory may not exist
    }
    return domains;
}

/**
 * Get system stats
 */
async function getSystemStats() {
    const [cpu, memory, disk, uptime] = await Promise.all([
        runCommand("grep 'cpu ' /proc/stat | awk '{usage=($2+$4)*100/($2+$4+$5)} END {printf \"%.1f\", usage}'"),
        runCommand("free -b | awk '/Mem:/ {printf \"%d|%d|%d\", $2, $3, $7}'"),
        runCommand("df -B1 / | tail -1 | awk '{printf \"%d|%d|%d|%s\", $2, $3, $4, $5}'"),
        runCommand("uptime -p 2>/dev/null || uptime")
    ]);

    const memParts = memory.stdout.split('|');
    const diskParts = disk.stdout.split('|');

    return {
        cpu: {
            usage: parseFloat(cpu.stdout) || 0,
            cores: require('os').cpus().length
        },
        memory: {
            total: parseInt(memParts[0]) || 0,
            used: parseInt(memParts[1]) || 0,
            available: parseInt(memParts[2]) || 0
        },
        disk: {
            total: parseInt(diskParts[0]) || 0,
            used: parseInt(diskParts[1]) || 0,
            available: parseInt(diskParts[2]) || 0,
            usage: diskParts[3] || '0%'
        },
        uptime: uptime.stdout
    };
}

/**
 * Get service statuses
 */
async function getServiceStatuses() {
    const services = ['nginx', 'php-fpm', 'mariadb', 'redis', 'memcached', 'fail2ban', 'sshd'];
    const results = {};

    await Promise.all(services.map(async (svc) => {
        const { stdout } = await runCommand(`systemctl is-active ${svc} 2>/dev/null || echo inactive`);
        results[svc] = stdout;
    }));

    return results;
}

/**
 * Spawn long-running process and stream output
 */
function spawnProcess(command, args = []) {
    return spawn(command, args, {
        shell: true,
        env: { ...process.env }
    });
}

module.exports = {
    runCommand,
    runMyvps,
    runMyvpsJson,
    readConfig,
    readDomainConfig,
    listDomains,
    getSystemStats,
    getServiceStatuses,
    spawnProcess
};
