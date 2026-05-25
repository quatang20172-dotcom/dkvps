/**
 * All dashboard pages - pure JS rendering
 */

const pages = {};

// ============ Dashboard ============
pages.dashboard = async (el) => {
    const srv = activeServer();
    el.innerHTML = `
        <div class="flex-between mb-4">
            <div><h1 class="page-title" style="margin:0">Dashboard</h1>
            <p class="text-sm text-muted">${srv?.name || ''} — ${srv?.url || ''}</p></div>
        </div>
        <div class="grid grid-4" id="stat-cards">
            <div class="card stat-card"><div class="stat-label">CPU</div><div class="stat-value" id="s-cpu">—</div><div class="mt-2" id="s-cpu-bar"></div></div>
            <div class="card stat-card"><div class="stat-label">Memory</div><div class="stat-value" id="s-mem">—</div><div class="stat-sub" id="s-mem-sub"></div><div class="mt-2" id="s-mem-bar"></div></div>
            <div class="card stat-card"><div class="stat-label">Disk</div><div class="stat-value" id="s-disk">—</div><div class="stat-sub" id="s-disk-sub"></div><div class="mt-2" id="s-disk-bar"></div></div>
            <div class="card stat-card"><div class="stat-label">Domains</div><div class="stat-value" id="s-domains">—</div></div>
        </div>
        <div class="grid grid-2">
            <div class="card"><h3>Services</h3><div id="svc-list">Loading...</div></div>
            <div class="card"><h3>Server Info</h3><div id="srv-info">Loading...</div></div>
        </div>`;

    // Load domains count
    try {
        const d = await apiGet('/domains');
        document.getElementById('s-domains').textContent = (d.domains || []).length;
    } catch { document.getElementById('s-domains').textContent = '—'; }

    // Load initial status
    try {
        const s = await apiGet('/system/status');
        state.stats = { ...state.stats, ...s };
        renderDashboardStats();
        renderDashboardInfo(s);
    } catch {}
};

function renderDashboardStats() {
    const s = state.stats;
    if (!s) return;
    const cpu = s.cpu?.usage || 0;
    const memPct = s.memory?.total ? (s.memory.used / s.memory.total * 100) : 0;
    const diskPct = s.disk?.total ? (s.disk.used / s.disk.total * 100) : 0;

    const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    const setH = (id, val) => { const e = document.getElementById(id); if (e) e.innerHTML = val; };

    set('s-cpu', cpu.toFixed(1) + '%');
    setH('s-cpu-bar', progressBar(cpu, 'blue'));
    set('s-mem', memPct.toFixed(1) + '%');
    set('s-mem-sub', formatBytes(s.memory?.used) + ' / ' + formatBytes(s.memory?.total));
    setH('s-mem-bar', progressBar(memPct, 'green'));
    set('s-disk', diskPct.toFixed(1) + '%');
    set('s-disk-sub', formatBytes(s.disk?.used) + ' / ' + formatBytes(s.disk?.total));
    setH('s-disk-bar', progressBar(diskPct, 'blue'));

    // Services
    if (s.services) {
        const el = document.getElementById('svc-list');
        if (el) el.innerHTML = Object.entries(s.services).map(([n, st]) =>
            `<div class="flex-between" style="padding:6px 0;border-bottom:1px solid var(--border)">
                <span>${n}</span>${badge(st)}
            </div>`
        ).join('');
    }
}

function renderDashboardInfo(s) {
    const el = document.getElementById('srv-info');
    if (!el) return;
    const rows = [
        ['IP', s.ip], ['Hostname', s.hostname], ['OS', s.os],
        ['Uptime', s.uptime], ['CPU Cores', s.cpu?.cores], ['Version', 'v' + (s.version || '1.0.0')]
    ];
    el.innerHTML = rows.map(([k, v]) =>
        `<div class="flex-between" style="padding:6px 0;border-bottom:1px solid var(--border)">
            <span class="text-muted">${k}</span><span class="mono">${v || '—'}</span>
        </div>`
    ).join('');
}

// ============ Domains ============
pages.domains = async (el) => {
    el.innerHTML = `
        <div class="flex-between mb-4">
            <h1 class="page-title" style="margin:0">Domains</h1>
            <button class="btn btn-primary" id="add-domain-btn">${icon('plus',14)} Add Domain</button>
        </div>
        <div class="card hidden mb-4" id="add-domain-form">
            <div class="form-row">
                <input type="text" id="new-domain" placeholder="example.com">
                <button class="btn btn-primary" id="do-add-domain">Add</button>
                <button class="btn btn-secondary" id="cancel-add-domain">Cancel</button>
            </div>
        </div>
        <div class="card" style="padding:0;overflow:auto">
            <table><thead><tr><th>Domain</th><th>User</th><th>PHP</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
            <tbody id="domain-list"><tr><td colspan="5" style="text-align:center;padding:30px;color:var(--fg3)">Loading...</td></tr></tbody></table>
        </div>`;

    document.getElementById('add-domain-btn').onclick = () => document.getElementById('add-domain-form').classList.toggle('hidden');
    document.getElementById('cancel-add-domain').onclick = () => document.getElementById('add-domain-form').classList.add('hidden');
    document.getElementById('do-add-domain').onclick = async () => {
        const domain = document.getElementById('new-domain').value.trim();
        if (!domain) return;
        try { await apiPost('/domains', { domain }); } catch (e) { alert(e.message); }
        loadDomains();
        document.getElementById('add-domain-form').classList.add('hidden');
        document.getElementById('new-domain').value = '';
    };

    loadDomains();
};

async function loadDomains() {
    try {
        const data = await apiGet('/domains');
        const tbody = document.getElementById('domain-list');
        const domains = data.domains || [];
        if (!domains.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--fg3)">No domains</td></tr>';
            return;
        }
        tbody.innerHTML = domains.map(d => `
            <tr>
                <td><span class="flex gap-sm">${icon('globe',16)} <strong>${d.domain}</strong></span></td>
                <td class="text-muted">${d.username || ''}</td>
                <td>${d.php_version || ''}</td>
                <td>${badge(d.status || 'active')}</td>
                <td style="text-align:right">
                    ${d.status === 'active'
                        ? `<button class="btn-icon" title="Suspend" onclick="domainAction('${d.domain}','suspend')">${icon('pause',16)}</button>`
                        : `<button class="btn-icon" title="Unsuspend" onclick="domainAction('${d.domain}','unsuspend')">${icon('play',16)}</button>`}
                    <button class="btn-icon danger" title="Delete" onclick="domainAction('${d.domain}','delete')">${icon('trash',16)}</button>
                </td>
            </tr>`
        ).join('');
    } catch (e) { document.getElementById('domain-list').innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--red)">${e.message}</td></tr>`; }
}

window.domainAction = async (domain, action) => {
    if (action === 'delete' && !confirm(`Delete ${domain} and ALL data?`)) return;
    try {
        if (action === 'delete') await apiDelete(`/domains/${domain}`);
        else await apiPost(`/domains/${domain}/${action}`);
        loadDomains();
    } catch (e) { alert(e.message); }
};

// ============ Databases ============
pages.databases = async (el) => {
    el.innerHTML = `
        <div class="flex-between mb-4">
            <h1 class="page-title" style="margin:0">Databases</h1>
            <button class="btn btn-primary" id="add-db-btn">${icon('plus',14)} Create</button>
        </div>
        <div class="card hidden mb-4" id="add-db-form">
            <div class="form-row">
                <input type="text" id="db-name" placeholder="Database name">
                <input type="text" id="db-user" placeholder="Username">
                <button class="btn btn-primary" id="do-add-db">Create</button>
                <button class="btn btn-secondary" id="cancel-add-db">Cancel</button>
            </div>
        </div>
        <div class="card" style="padding:0;overflow:auto">
            <table><thead><tr><th>Database</th><th style="text-align:right">Actions</th></tr></thead>
            <tbody id="db-list"><tr><td colspan="2" style="text-align:center;padding:30px;color:var(--fg3)">Loading...</td></tr></tbody></table>
        </div>`;

    document.getElementById('add-db-btn').onclick = () => document.getElementById('add-db-form').classList.toggle('hidden');
    document.getElementById('cancel-add-db').onclick = () => document.getElementById('add-db-form').classList.add('hidden');
    document.getElementById('do-add-db').onclick = async () => {
        const name = document.getElementById('db-name').value.trim();
        const user = document.getElementById('db-user').value.trim();
        if (!name) return;
        try {
            const r = await apiPost('/databases', { name, user });
            alert(`Created!\nDB: ${r.name}\nUser: ${r.user}\nPassword: ${r.password}`);
            document.getElementById('add-db-form').classList.add('hidden');
            loadDatabases();
        } catch (e) { alert(e.message); }
    };
    loadDatabases();
};

async function loadDatabases() {
    try {
        const data = await apiGet('/databases');
        const tbody = document.getElementById('db-list');
        const dbs = data.databases || [];
        if (!dbs.length) { tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;padding:30px;color:var(--fg3)">No databases</td></tr>'; return; }
        tbody.innerHTML = dbs.map(db => `
            <tr>
                <td><span class="flex gap-sm">${icon('database',16)} <strong>${db}</strong></span></td>
                <td style="text-align:right">
                    <button class="btn-icon" title="Export" onclick="dbExport('${db}')">${icon('archive',16)}</button>
                    <button class="btn-icon danger" title="Delete" onclick="dbDelete('${db}')">${icon('trash',16)}</button>
                </td>
            </tr>`).join('');
    } catch (e) { document.getElementById('db-list').innerHTML = `<tr><td colspan="2" style="color:var(--red)">${e.message}</td></tr>`; }
}

window.dbExport = async (name) => { try { const r = await apiPost(`/databases/${name}/export`); alert('Exported: ' + r.file); } catch (e) { alert(e.message); } };
window.dbDelete = async (name) => { if (!confirm(`Delete ${name}?`)) return; try { await apiDelete(`/databases/${name}`); loadDatabases(); } catch (e) { alert(e.message); } };

// ============ Services ============
pages.services = async (el) => {
    const svcs = [
        ['nginx', 'Nginx', 'Web server'],
        ['php-fpm', 'PHP-FPM', 'PHP processor'],
        ['mariadb', 'MariaDB', 'Database'],
        ['redis', 'Redis', 'Cache'],
        ['memcached', 'Memcached', 'Memory cache'],
        ['fail2ban', 'Fail2Ban', 'Security'],
    ];
    el.innerHTML = `<h1 class="page-title">Services</h1><div class="grid grid-3" id="svc-grid">Loading...</div>`;

    try {
        const data = await apiGet('/services');
        const services = data.services || {};
        document.getElementById('svc-grid').innerHTML = svcs.map(([name, label, desc]) => {
            const st = services[name] || 'unknown';
            const active = st === 'active';
            return `<div class="card">
                <div class="flex-between mb-2">
                    <div><strong>${label}</strong><br><span class="text-xs text-muted">${desc}</span></div>
                    ${badge(st)}
                </div>
                <div class="flex gap-sm">
                    <button class="btn btn-secondary btn-sm" onclick="svcAction('${name}','start')">${icon('play',12)} Start</button>
                    <button class="btn btn-secondary btn-sm" onclick="svcAction('${name}','stop')">${icon('stop',12)} Stop</button>
                    <button class="btn btn-primary btn-sm" onclick="svcAction('${name}','restart')">${icon('refresh',12)} Restart</button>
                </div>
            </div>`;
        }).join('');
    } catch (e) { document.getElementById('svc-grid').innerHTML = `<p style="color:var(--red)">${e.message}</p>`; }
};

window.svcAction = async (name, action) => {
    try { await apiPost(`/services/${name}/${action}`); setTimeout(() => navigate('services'), 1000); } catch (e) { alert(e.message); }
};

// ============ SSL ============
pages.ssl = async (el) => {
    el.innerHTML = `<h1 class="page-title">SSL Certificates</h1>
        <div class="card">
            <div class="form-row">
                <select id="ssl-domain"><option value="">Select domain...</option></select>
                <select id="ssl-provider"><option value="letsencrypt">Let's Encrypt</option><option value="zerossl">ZeroSSL</option></select>
                <button class="btn btn-primary" id="ssl-install">${icon('lock',14)} Install</button>
                <button class="btn btn-secondary" id="ssl-renew">${icon('refresh',14)} Renew All</button>
            </div>
        </div>
        <div class="card"><h3>Certificates</h3><pre id="ssl-list" class="mono text-sm" style="white-space:pre-wrap;background:var(--bg3);padding:12px;border-radius:var(--radius)">Loading...</pre></div>`;

    try {
        const [certs, domains] = await Promise.all([apiGet('/ssl'), apiGet('/domains')]);
        document.getElementById('ssl-list').textContent = certs.certificates || 'No certificates. Install acme.sh first.';
        const sel = document.getElementById('ssl-domain');
        (domains.domains || []).forEach(d => { const o = document.createElement('option'); o.value = d.domain; o.textContent = d.domain; sel.appendChild(o); });
    } catch {}

    document.getElementById('ssl-install').onclick = async () => {
        const domain = document.getElementById('ssl-domain').value;
        const provider = document.getElementById('ssl-provider').value;
        if (!domain) return alert('Select a domain');
        try { await apiPost('/ssl/install', { domain, provider }); alert('SSL installed for ' + domain); navigate('ssl'); } catch (e) { alert(e.message); }
    };
    document.getElementById('ssl-renew').onclick = async () => {
        try { await apiPost('/ssl/renew'); alert('Renewed'); } catch (e) { alert(e.message); }
    };
};

// ============ PHP ============
pages.php = async (el) => {
    el.innerHTML = `<h1 class="page-title">PHP Management</h1>
        <div class="card"><h3>Current Version</h3><p id="php-ver" class="mono">Loading...</p></div>
        <div class="card"><h3>Change Version</h3><div class="flex gap-sm" id="php-btns"></div></div>
        <div class="card"><h3>Modules</h3><div id="php-mods" style="display:flex;flex-wrap:wrap;gap:4px">Loading...</div></div>`;

    try {
        const info = await apiGet('/php/info');
        document.getElementById('php-ver').textContent = info.version || 'Unknown';
        document.getElementById('php-btns').innerHTML = ['7.4','8.0','8.1','8.2','8.3'].map(v =>
            `<button class="btn btn-secondary" onclick="phpSwitch('${v}')">PHP ${v}</button>`
        ).join('');
        document.getElementById('php-mods').innerHTML = (info.modules || []).map(m =>
            `<span class="text-xs mono" style="background:var(--bg3);padding:3px 8px;border-radius:4px">${m}</span>`
        ).join('');
    } catch (e) { document.getElementById('php-ver').textContent = e.message; }
};

window.phpSwitch = async (v) => {
    if (!confirm(`Switch to PHP ${v}?`)) return;
    try { await apiPost('/php/version', { version: v }); alert('PHP switched to ' + v); navigate('php'); } catch (e) { alert(e.message); }
};

// ============ Firewall ============
pages.firewall = async (el) => {
    el.innerHTML = `<h1 class="page-title">Firewall</h1>
        <div class="card">
            <p class="mb-4">Status: <strong id="fw-state">Loading...</strong></p>
            <div class="form-row mb-4">
                <input type="text" id="fw-port" placeholder="Port number" style="max-width:150px">
                <button class="btn btn-primary" id="fw-open">${icon('plus',14)} Open Port</button>
            </div>
            <h3>Open Ports</h3>
            <div id="fw-ports" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>
        </div>`;

    try {
        const data = await apiGet('/firewall/status');
        document.getElementById('fw-state').textContent = data.state || 'N/A';
        renderPorts(data.ports || []);
    } catch {}

    document.getElementById('fw-open').onclick = async () => {
        const port = document.getElementById('fw-port').value.trim();
        if (!port) return;
        try { await apiPost('/firewall/open', { port, protocol: 'tcp' }); document.getElementById('fw-port').value = ''; navigate('firewall'); } catch (e) { alert(e.message); }
    };
};

function renderPorts(ports) {
    const el = document.getElementById('fw-ports');
    if (!el) return;
    if (!ports.length) { el.innerHTML = '<span class="text-muted text-sm">No custom ports</span>'; return; }
    el.innerHTML = ports.map(p => `
        <span class="badge badge-green" style="padding:4px 12px;font-size:13px">${p}
            <button onclick="fwClose('${p.replace(/\/.*/, '')}')" style="background:none;border:none;cursor:pointer;margin-left:4px;color:var(--red);font-size:14px">&times;</button>
        </span>`).join('');
}

window.fwClose = async (port) => {
    if (!confirm(`Close port ${port}?`)) return;
    try { await apiPost('/firewall/close', { port, protocol: 'tcp' }); navigate('firewall'); } catch (e) { alert(e.message); }
};

// ============ Cache ============
pages.cache = async (el) => {
    el.innerHTML = `<h1 class="page-title">Cache</h1>
        <div class="grid grid-3" id="cache-grid">Loading...</div>
        <button class="btn btn-danger mt-2" onclick="cacheAction('/cache/clear-all','All cleared')">${icon('trash',14)} Clear All Caches</button>`;

    try {
        const data = await apiGet('/cache/status');
        document.getElementById('cache-grid').innerHTML = `
            <div class="card"><h3>Redis</h3>${badge(data.redis || 'inactive')}
                <button class="btn btn-danger btn-sm mt-2" onclick="cacheAction('/cache/redis/flush','Redis flushed')" style="width:100%;justify-content:center">${icon('trash',12)} Flush</button></div>
            <div class="card"><h3>Memcached</h3>${badge(data.memcached || 'inactive')}</div>
            <div class="card"><h3>OPcache</h3>${badge('active')}
                <button class="btn btn-danger btn-sm mt-2" onclick="cacheAction('/cache/opcache/reset','OPcache reset')" style="width:100%;justify-content:center">${icon('trash',12)} Reset</button></div>`;
    } catch (e) { document.getElementById('cache-grid').textContent = e.message; }
};

window.cacheAction = async (path, msg) => {
    try { await apiPost(path); alert(msg); } catch (e) { alert(e.message); }
};

// ============ Backup ============
pages.backup = async (el) => {
    el.innerHTML = `<h1 class="page-title">Backup</h1>
        <div class="card mb-4">
            <div class="form-row">
                <select id="bk-domain"><option value="">Select domain...</option></select>
                <select id="bk-type"><option value="full">Full</option><option value="database">DB Only</option></select>
                <button class="btn btn-primary" id="bk-create">${icon('archive',14)} Create Backup</button>
            </div>
        </div>
        <div class="card" style="padding:0;overflow:auto">
            <table><thead><tr><th>File</th><th>Type</th><th>Size</th><th style="text-align:right">Actions</th></tr></thead>
            <tbody id="bk-list"><tr><td colspan="4" style="text-align:center;padding:30px;color:var(--fg3)">Loading...</td></tr></tbody></table>
        </div>`;

    try {
        const [backups, domains] = await Promise.all([apiGet('/backup'), apiGet('/domains')]);
        const sel = document.getElementById('bk-domain');
        (domains.domains || []).forEach(d => { const o = document.createElement('option'); o.value = d.domain; o.textContent = d.domain; sel.appendChild(o); });
        renderBackups(backups.backups || []);
    } catch {}

    document.getElementById('bk-create').onclick = async () => {
        const domain = document.getElementById('bk-domain').value;
        const type = document.getElementById('bk-type').value;
        if (!domain) return alert('Select a domain');
        try { await apiPost('/backup/create', { domain, type }); alert('Backup created'); navigate('backup'); } catch (e) { alert(e.message); }
    };
};

function renderBackups(backups) {
    const tbody = document.getElementById('bk-list');
    if (!backups.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--fg3)">No backups</td></tr>'; return; }
    tbody.innerHTML = backups.map(b => `
        <tr>
            <td class="mono text-sm">${b.name}</td>
            <td>${b.type}</td>
            <td>${formatBytes(b.size)}</td>
            <td style="text-align:right"><button class="btn-icon danger" onclick="bkDelete('${b.name}')">${icon('trash',16)}</button></td>
        </tr>`).join('');
}

window.bkDelete = async (name) => {
    if (!confirm(`Delete ${name}?`)) return;
    try { await apiDelete(`/backup/${name}`); navigate('backup'); } catch (e) { alert(e.message); }
};

// ============ Monitor ============
pages.monitor = async (el) => {
    el.innerHTML = `<h1 class="page-title">System Monitor</h1>
        <div class="grid grid-3 mb-4">
            <div class="card stat-card"><div class="stat-label">CPU</div><div class="stat-value" id="m-cpu">—</div><div class="stat-sub" id="m-cpu-sub"></div></div>
            <div class="card stat-card"><div class="stat-label">Memory</div><div class="stat-value" id="m-mem">—</div><div class="stat-sub" id="m-mem-sub"></div></div>
            <div class="card stat-card"><div class="stat-label">Disk</div><div class="stat-value" id="m-disk">—</div><div class="stat-sub" id="m-disk-sub"></div></div>
        </div>
        <div class="card"><h3>Top Processes</h3>
            <table><thead><tr><th>PID</th><th>User</th><th>CPU%</th><th>MEM%</th><th>Command</th></tr></thead>
            <tbody id="m-proc">Loading...</tbody></table>
        </div>`;

    try {
        const procs = await apiGet('/system/processes');
        document.getElementById('m-proc').innerHTML = (procs.processes || []).map(p =>
            `<tr><td class="mono">${p.pid}</td><td>${p.user}</td><td>${p.cpu}%</td><td>${p.mem}%</td><td class="mono text-sm" style="max-width:300px;overflow:hidden;text-overflow:ellipsis">${p.command}</td></tr>`
        ).join('');
    } catch {}

    renderMonitorStats();
};

function renderMonitorStats() {
    const s = state.stats;
    if (!s) return;
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('m-cpu', (s.cpu?.usage || 0).toFixed(1) + '%');
    set('m-cpu-sub', (s.cpu?.cores || 0) + ' cores');
    const memPct = s.memory?.total ? (s.memory.used / s.memory.total * 100) : 0;
    set('m-mem', memPct.toFixed(1) + '%');
    set('m-mem-sub', formatBytes(s.memory?.used) + ' / ' + formatBytes(s.memory?.total));
    set('m-disk', s.disk?.usage || '0%');
    set('m-disk-sub', formatBytes(s.disk?.used) + ' / ' + formatBytes(s.disk?.total));
}

// ============ Servers (Enhanced Multi-Server) ============
pages.servers = async (el) => {
    el.innerHTML = `
        <div class="flex-between mb-4">
            <h1 class="page-title" style="margin:0">VPS Servers</h1>
            <button class="btn btn-primary" id="add-srv-btn">${icon('plus',14)} Add Server</button>
        </div>
        <div class="card hidden mb-4" id="add-srv-form">
            <div id="add-srv-err" class="login-err hidden mb-2"></div>
            <div class="form-row">
                <input type="text" id="new-srv-name" placeholder="Server name">
                <input type="text" id="new-srv-url" placeholder="https://ip:9090">
                <input type="password" id="new-srv-key" placeholder="API key" class="mono">
                <button class="btn btn-primary" id="do-add-srv">Connect</button>
                <button class="btn btn-secondary" id="cancel-add-srv">Cancel</button>
            </div>
        </div>
        <div class="grid grid-2" id="srv-grid"></div>`;

    document.getElementById('add-srv-btn').onclick = () => document.getElementById('add-srv-form').classList.toggle('hidden');
    document.getElementById('cancel-add-srv').onclick = () => document.getElementById('add-srv-form').classList.add('hidden');
    document.getElementById('do-add-srv').onclick = async () => {
        const errEl = document.getElementById('add-srv-err');
        errEl.classList.add('hidden');
        try {
            await addServer(
                document.getElementById('new-srv-name').value,
                document.getElementById('new-srv-url').value,
                document.getElementById('new-srv-key').value
            );
            renderApp();
            connectWS();
        } catch (e) {
            errEl.textContent = e.message;
            errEl.classList.remove('hidden');
        }
    };

    const grid = document.getElementById('srv-grid');
    state.servers.forEach(s => {
        const isActive = s.id === state.activeId;
        const cardId = `srv-card-${s.id}`;
        grid.innerHTML += `
            <div class="card" id="${cardId}" style="${isActive ? 'border-color:var(--primary);box-shadow:0 0 0 2px var(--primary-light)' : ''};cursor:pointer" onclick="switchServer('${s.id}')">
                <div class="flex-between mb-2">
                    <strong>${icon('server',16)} ${s.name}</strong>
                    <span id="srv-health-${s.id}" class="badge badge-yellow">checking...</span>
                </div>
                <p class="mono text-xs text-muted mb-2">${s.url}</p>
                <div id="srv-stats-${s.id}" class="text-sm text-muted mb-2">Loading stats...</div>
                <div id="srv-services-${s.id}" class="text-sm mb-2"></div>
                <div class="flex gap-sm" onclick="event.stopPropagation()">
                    ${isActive ? `<span class="badge badge-green">Active</span>` : `<button class="btn btn-secondary btn-sm" onclick="switchServer('${s.id}')">${icon('monitor',12)} Switch</button>`}
                    <button class="btn btn-danger btn-sm" onclick="removeSrv('${s.id}','${s.name}')">${icon('trash',12)} Remove</button>
                </div>
            </div>`;
    });

    // Fetch health + stats for all servers in parallel
    state.servers.forEach(async s => {
        try {
            const healthRes = await fetch(`${s.url}/api/health`, { signal: AbortSignal.timeout(5000) });
            const health = await healthRes.json();
            const healthEl = document.getElementById(`srv-health-${s.id}`);
            if (healthEl) { healthEl.className = 'badge badge-green'; healthEl.textContent = `online v${health.version || '?'}`; }

            const statusRes = await fetch(`${s.url}/api/system/status`, {
                headers: { 'Authorization': `Bearer ${s.token}` },
                signal: AbortSignal.timeout(5000)
            });
            const st = await statusRes.json();
            const statsEl = document.getElementById(`srv-stats-${s.id}`);
            if (statsEl) {
                const memPct = st.memory?.total ? (st.memory.used / st.memory.total * 100).toFixed(1) : 0;
                const diskPct = st.disk?.usage || '0%';
                statsEl.innerHTML = `CPU: ${(st.cpu?.usage || 0).toFixed(1)}% &nbsp; RAM: ${memPct}% &nbsp; Disk: ${diskPct} &nbsp; IP: ${st.ip || '—'}`;
            }
            const svcEl = document.getElementById(`srv-services-${s.id}`);
            if (svcEl && st.services) {
                svcEl.innerHTML = Object.entries(st.services).map(([n, v]) =>
                    `<span class="badge ${v === 'active' ? 'badge-green' : 'badge-red'}" style="font-size:11px;margin:1px">${n}</span>`
                ).join('');
            }
        } catch {
            const healthEl = document.getElementById(`srv-health-${s.id}`);
            if (healthEl) { healthEl.className = 'badge badge-red'; healthEl.textContent = 'offline'; }
            const statsEl = document.getElementById(`srv-stats-${s.id}`);
            if (statsEl) statsEl.textContent = 'Unable to connect';
        }
    });
};

window.removeSrv = (id, name) => {
    if (!confirm(`Remove ${name}?`)) return;
    removeServer(id);
    if (!activeServer()) { renderLogin(); return; }
    renderApp();
    connectWS();
};

window.switchServer = (id) => {
    state.activeId = id;
    saveServers();
    renderApp();
    connectWS();
};

// ============ File Manager ============
let filePath = '/var/www';

pages.files = async (el) => {
    el.innerHTML = `<h1 class="page-title">File Manager</h1>
        <div class="card mb-4">
            <div class="flex-between">
                <div class="flex gap-sm" style="flex:1">
                    <button class="btn btn-secondary btn-sm" onclick="fileUp()" title="Up">${icon('folder',14)} ..</button>
                    <input type="text" id="fm-path" value="${filePath}" style="flex:1;font-family:monospace;font-size:13px">
                    <button class="btn btn-primary btn-sm" onclick="fileGo()">${icon('refresh',14)} Go</button>
                </div>
                <div class="flex gap-sm" style="margin-left:8px">
                    <button class="btn btn-secondary btn-sm" onclick="fileNew('file')">${icon('file',14)} New File</button>
                    <button class="btn btn-secondary btn-sm" onclick="fileNew('directory')">${icon('folder',14)} New Folder</button>
                </div>
            </div>
        </div>
        <div class="card" style="padding:0;overflow:auto">
            <table><thead><tr><th>Name</th><th>Size</th><th>Permissions</th><th>Modified</th><th style="text-align:right">Actions</th></tr></thead>
            <tbody id="fm-list"><tr><td colspan="5" style="text-align:center;padding:30px;color:var(--fg3)">Loading...</td></tr></tbody></table>
        </div>
        <div class="card hidden mt-4" id="fm-editor">
            <div class="flex-between mb-2">
                <h3 id="fm-editor-title">Edit File</h3>
                <div class="flex gap-sm">
                    <button class="btn btn-primary btn-sm" onclick="fileSave()">${icon('archive',14)} Save</button>
                    <button class="btn btn-secondary btn-sm" onclick="fileCloseEditor()">Close</button>
                </div>
            </div>
            <textarea id="fm-content" style="width:100%;height:400px;font-family:monospace;font-size:13px;background:var(--bg3);color:var(--fg);border:1px solid var(--border);border-radius:var(--radius);padding:12px;resize:vertical"></textarea>
        </div>`;
    loadFiles();
};

async function loadFiles() {
    try {
        const data = await apiGet(`/files/list?path=${encodeURIComponent(filePath)}`);
        filePath = data.path;
        document.getElementById('fm-path').value = filePath;
        const tbody = document.getElementById('fm-list');
        if (!data.files.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--fg3)">Empty directory</td></tr>'; return; }
        tbody.innerHTML = data.files.map(f => {
            const isDir = f.type === 'directory';
            const sizeStr = isDir ? '—' : formatBytes(f.size);
            const modStr = f.modified ? new Date(f.modified).toLocaleString() : '—';
            return `<tr>
                <td><span class="flex gap-sm" style="cursor:${isDir ? 'pointer' : 'default'}" ${isDir ? `onclick="fileNav('${f.name}')"` : ''}>
                    ${icon(isDir ? 'folder' : 'file', 16)} <strong>${f.name}</strong>
                </span></td>
                <td class="mono text-sm">${sizeStr}</td>
                <td class="mono text-sm">${f.permissions || '—'}</td>
                <td class="text-sm text-muted">${modStr}</td>
                <td style="text-align:right">
                    ${!isDir ? `<button class="btn-icon" title="Edit" onclick="fileEdit('${f.name}')">${icon('edit',16)}</button>` : ''}
                    <button class="btn-icon danger" title="Delete" onclick="fileDel('${f.name}')">${icon('trash',16)}</button>
                </td>
            </tr>`;
        }).join('');
    } catch (e) { document.getElementById('fm-list').innerHTML = `<tr><td colspan="5" style="color:var(--red)">${e.message}</td></tr>`; }
}

window.fileNav = (name) => { filePath = filePath.replace(/\/$/, '') + '/' + name; loadFiles(); };
window.fileUp = () => { const p = filePath.split('/'); p.pop(); filePath = p.join('/') || '/'; loadFiles(); };
window.fileGo = () => { filePath = document.getElementById('fm-path').value.trim() || '/'; loadFiles(); };

window.fileNew = async (type) => {
    const name = prompt(`New ${type} name:`);
    if (!name) return;
    const fp = filePath.replace(/\/$/, '') + '/' + name;
    try { await apiPost('/files/create', { path: fp, type }); loadFiles(); } catch (e) { alert(e.message); }
};

window.fileDel = async (name) => {
    if (!confirm(`Delete ${name}?`)) return;
    const fp = filePath.replace(/\/$/, '') + '/' + name;
    try { await apiPost('/files/delete', { path: fp }); loadFiles(); } catch (e) { alert(e.message); }
};

let editingFile = '';
window.fileEdit = async (name) => {
    const fp = filePath.replace(/\/$/, '') + '/' + name;
    try {
        const data = await apiGet(`/files/read?path=${encodeURIComponent(fp)}`);
        editingFile = fp;
        document.getElementById('fm-editor').classList.remove('hidden');
        document.getElementById('fm-editor-title').textContent = 'Edit: ' + name;
        document.getElementById('fm-content').value = data.content;
    } catch (e) { alert(e.message); }
};

window.fileSave = async () => {
    const content = document.getElementById('fm-content').value;
    try { await apiPost('/files/save', { path: editingFile, content }); alert('Saved'); } catch (e) { alert(e.message); }
};

window.fileCloseEditor = () => { document.getElementById('fm-editor').classList.add('hidden'); };

// ============ Terminal ============
pages.terminal = async (el) => {
    el.innerHTML = `<h1 class="page-title">Terminal</h1>
        <div class="card">
            <div id="term-output" style="background:#1a1b26;color:#a9b1d6;font-family:monospace;font-size:13px;padding:12px;border-radius:var(--radius);height:400px;overflow-y:auto;white-space:pre-wrap;word-wrap:break-word"></div>
            <div class="flex gap-sm mt-2">
                <span class="mono text-sm" style="color:var(--green);padding:6px 0">$</span>
                <input type="text" id="term-input" placeholder="Type command..." style="flex:1;font-family:monospace;font-size:13px;background:var(--bg3);color:var(--fg);border:1px solid var(--border)">
                <button class="btn btn-primary btn-sm" onclick="termExec()">${icon('play',14)} Run</button>
            </div>
        </div>
        <p class="text-sm text-muted mt-2">Commands run on the VPS as root. Use with caution.</p>`;

    document.getElementById('term-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') termExec();
    });
    document.getElementById('term-output').textContent = 'Welcome to MyVPS Terminal\nType a command and press Enter.\n\n';
};

window.termExec = async () => {
    const input = document.getElementById('term-input');
    const output = document.getElementById('term-output');
    const cmd = input.value.trim();
    if (!cmd) return;
    output.textContent += `$ ${cmd}\n`;
    input.value = '';
    try {
        const r = await apiPost('/terminal/exec', { command: cmd });
        if (r.stdout) output.textContent += r.stdout + '\n';
        if (r.stderr) output.textContent += r.stderr + '\n';
    } catch (e) { output.textContent += `Error: ${e.message}\n`; }
    output.scrollTop = output.scrollHeight;
};

// ============ Proxy ============
pages.proxy = async (el) => {
    el.innerHTML = `<h1 class="page-title">Reverse Proxy</h1>
        <div class="card mb-4">
            <h3>Create Proxy</h3>
            <p class="text-sm text-muted mb-2">Route a domain to a backend app (Node.js, Python, etc.)</p>
            <div class="form-row">
                <input type="text" id="px-domain" placeholder="app.example.com">
                <input type="text" id="px-target" placeholder="http://127.0.0.1:3000">
                <button class="btn btn-primary" id="px-add">${icon('plus',14)} Create Proxy</button>
            </div>
        </div>
        <div class="card" style="padding:0;overflow:auto">
            <table><thead><tr><th>Domain</th><th>Target</th><th>SSL</th><th style="text-align:right">Actions</th></tr></thead>
            <tbody id="px-list"><tr><td colspan="4" style="text-align:center;padding:30px;color:var(--fg3)">Loading...</td></tr></tbody></table>
        </div>`;

    document.getElementById('px-add').onclick = async () => {
        const domain = document.getElementById('px-domain').value.trim();
        const target = document.getElementById('px-target').value.trim();
        if (!domain || !target) return alert('Domain and target required');
        try { await apiPost('/proxy', { domain, target }); navigate('proxy'); } catch (e) { alert(e.message); }
    };

    try {
        const data = await apiGet('/proxy');
        const tbody = document.getElementById('px-list');
        const proxies = data.proxies || [];
        if (!proxies.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--fg3)">No proxies configured</td></tr>'; return; }
        tbody.innerHTML = proxies.map(p => `
            <tr>
                <td><strong>${p.domain}</strong></td>
                <td class="mono text-sm">${p.target}</td>
                <td>${p.ssl ? badge('active') : badge('inactive')}</td>
                <td style="text-align:right">
                    <button class="btn-icon danger" title="Delete" onclick="proxyDel('${p.domain}')">${icon('trash',16)}</button>
                </td>
            </tr>`).join('');
    } catch (e) { document.getElementById('px-list').innerHTML = `<tr><td colspan="4" style="color:var(--red)">${e.message}</td></tr>`; }
};

window.proxyDel = async (domain) => {
    if (!confirm(`Delete proxy for ${domain}?`)) return;
    try { await apiDelete(`/proxy/${domain}`); navigate('proxy'); } catch (e) { alert(e.message); }
};

// ============ Cron Jobs ============
pages.cron = async (el) => {
    el.innerHTML = `<h1 class="page-title">Cron Jobs</h1>
        <div class="card mb-4">
            <h3>Add Cron Job</h3>
            <div class="form-row mb-2">
                <select id="cron-preset">
                    <option value="">Custom schedule...</option>
                    <option value="* * * * *">Every minute</option>
                    <option value="*/5 * * * *">Every 5 minutes</option>
                    <option value="0 * * * *">Every hour</option>
                    <option value="0 0 * * *">Daily (midnight)</option>
                    <option value="0 2 * * *">Daily (2 AM)</option>
                    <option value="0 0 * * 0">Weekly (Sunday)</option>
                    <option value="0 0 1 * *">Monthly</option>
                </select>
                <input type="text" id="cron-schedule" placeholder="* * * * *" style="max-width:150px;font-family:monospace">
            </div>
            <div class="form-row">
                <input type="text" id="cron-cmd" placeholder="Command to run" style="flex:1;font-family:monospace">
                <button class="btn btn-primary" id="cron-add">${icon('plus',14)} Add</button>
            </div>
        </div>
        <div class="card" style="padding:0;overflow:auto">
            <table><thead><tr><th>Schedule</th><th>Command</th><th style="text-align:right">Actions</th></tr></thead>
            <tbody id="cron-list"><tr><td colspan="3" style="text-align:center;padding:30px;color:var(--fg3)">Loading...</td></tr></tbody></table>
        </div>`;

    document.getElementById('cron-preset').onchange = function() {
        if (this.value) document.getElementById('cron-schedule').value = this.value;
    };

    document.getElementById('cron-add').onclick = async () => {
        const schedule = document.getElementById('cron-schedule').value.trim();
        const command = document.getElementById('cron-cmd').value.trim();
        if (!schedule || !command) return alert('Schedule and command required');
        try { await apiPost('/cron', { schedule, command }); navigate('cron'); } catch (e) { alert(e.message); }
    };

    try {
        const data = await apiGet('/cron');
        const tbody = document.getElementById('cron-list');
        const jobs = data.jobs || [];
        if (!jobs.length) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--fg3)">No cron jobs</td></tr>'; return; }
        tbody.innerHTML = jobs.map(j => `
            <tr>
                <td class="mono text-sm">${j.schedule}</td>
                <td class="mono text-sm" style="max-width:400px;overflow:hidden;text-overflow:ellipsis">${j.command}</td>
                <td style="text-align:right">
                    <button class="btn-icon danger" title="Delete" onclick="cronDel(${j.id})">${icon('trash',16)}</button>
                </td>
            </tr>`).join('');
    } catch (e) { document.getElementById('cron-list').innerHTML = `<tr><td colspan="3" style="color:var(--red)">${e.message}</td></tr>`; }
};

window.cronDel = async (id) => {
    if (!confirm('Delete this cron job?')) return;
    try { await apiDelete(`/cron/${id}`); navigate('cron'); } catch (e) { alert(e.message); }
};

// ============ Auto Deploy ============
pages.deploy = async (el) => {
    el.innerHTML = `<h1 class="page-title">Auto Deploy</h1>
        <div class="card mb-4">
            <h3>Create Webhook</h3>
            <p class="text-sm text-muted mb-2">Auto-deploy from GitHub/GitLab push events</p>
            <div class="form-row mb-2">
                <input type="text" id="dpl-name" placeholder="Project name">
                <input type="text" id="dpl-dir" placeholder="/var/www/example.com" style="font-family:monospace">
            </div>
            <div class="form-row">
                <input type="text" id="dpl-cmd" placeholder="git pull && npm run build" style="flex:1;font-family:monospace">
                <button class="btn btn-primary" id="dpl-add">${icon('plus',14)} Create</button>
            </div>
        </div>
        <div class="card" style="padding:0;overflow:auto">
            <table><thead><tr><th>Name</th><th>Directory</th><th>Command</th><th>Last Run</th><th style="text-align:right">Actions</th></tr></thead>
            <tbody id="dpl-list"><tr><td colspan="5" style="text-align:center;padding:30px;color:var(--fg3)">Loading...</td></tr></tbody></table>
        </div>`;

    document.getElementById('dpl-add').onclick = async () => {
        const name = document.getElementById('dpl-name').value.trim();
        const directory = document.getElementById('dpl-dir').value.trim();
        const command = document.getElementById('dpl-cmd').value.trim();
        if (!name || !directory || !command) return alert('All fields required');
        try {
            const r = await apiPost('/deploy', { name, directory, command });
            const srv = activeServer();
            alert(`Webhook created!\n\nURL: ${srv.url}/api/deploy/trigger/${r.webhook.token}\n\nAdd this URL to your GitHub/GitLab webhook settings.`);
            navigate('deploy');
        } catch (e) { alert(e.message); }
    };

    try {
        const data = await apiGet('/deploy');
        const tbody = document.getElementById('dpl-list');
        const webhooks = data.webhooks || [];
        if (!webhooks.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--fg3)">No webhooks</td></tr>'; return; }
        const srv = activeServer();
        tbody.innerHTML = webhooks.map(w => `
            <tr>
                <td><strong>${w.name}</strong></td>
                <td class="mono text-sm">${w.directory}</td>
                <td class="mono text-sm" style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${w.command}</td>
                <td class="text-sm">${w.lastRun ? new Date(w.lastRun).toLocaleString() : '—'} ${w.lastStatus ? badge(w.lastStatus === 'success' ? 'active' : 'inactive') : ''}</td>
                <td style="text-align:right">
                    <button class="btn-icon" title="Copy URL" onclick="dplCopy('${srv.url}/api/deploy/trigger/${w.token}')">${icon('copy',16)}</button>
                    <button class="btn-icon danger" title="Delete" onclick="dplDel('${w.id}')">${icon('trash',16)}</button>
                </td>
            </tr>`).join('');
    } catch (e) { document.getElementById('dpl-list').innerHTML = `<tr><td colspan="5" style="color:var(--red)">${e.message}</td></tr>`; }
};

window.dplCopy = (url) => { navigator.clipboard.writeText(url).then(() => alert('Webhook URL copied!')); };
window.dplDel = async (id) => {
    if (!confirm('Delete this webhook?')) return;
    try { await apiDelete(`/deploy/${id}`); navigate('deploy'); } catch (e) { alert(e.message); }
};

// ============ FTP Management ============
pages.ftp = async (el) => {
    el.innerHTML = `<h1 class="page-title">FTP Management</h1>
        <div class="card mb-4">
            <h3>Create FTP User</h3>
            <div class="form-row">
                <input type="text" id="ftp-user" placeholder="Username">
                <input type="password" id="ftp-pass" placeholder="Password">
                <input type="text" id="ftp-home" placeholder="/var/www/domain (optional)" style="font-family:monospace">
                <button class="btn btn-primary" id="ftp-add">${icon('plus',14)} Create</button>
            </div>
        </div>
        <div class="card mb-4">
            <h3>FTP Server Status</h3>
            <div id="ftp-status">Loading...</div>
        </div>
        <div class="card" style="padding:0;overflow:auto">
            <table><thead><tr><th>Username</th><th>Home Directory</th><th style="text-align:right">Actions</th></tr></thead>
            <tbody id="ftp-list"><tr><td colspan="3" style="text-align:center;padding:30px;color:var(--fg3)">Loading...</td></tr></tbody></table>
        </div>`;

    document.getElementById('ftp-add').onclick = async () => {
        const username = document.getElementById('ftp-user').value.trim();
        const password = document.getElementById('ftp-pass').value;
        const home = document.getElementById('ftp-home').value.trim();
        if (!username || !password) return alert('Username and password required');
        try { await apiPost('/ftp', { username, password, home }); alert('FTP user created'); navigate('ftp'); } catch (e) { alert(e.message); }
    };

    try {
        const [status, users] = await Promise.all([apiGet('/ftp/status'), apiGet('/ftp')]);
        document.getElementById('ftp-status').innerHTML = `
            <div class="flex gap-sm">
                <span>vsftpd: ${badge(status.vsftpd)}</span>
            </div>`;
        const tbody = document.getElementById('ftp-list');
        const ftpUsers = users.users || [];
        if (!ftpUsers.length) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--fg3)">No FTP users</td></tr>'; return; }
        tbody.innerHTML = ftpUsers.map(u => `
            <tr>
                <td><strong>${u.username}</strong></td>
                <td class="mono text-sm">${u.home || '—'}</td>
                <td style="text-align:right">
                    <button class="btn-icon danger" title="Delete" onclick="ftpDel('${u.username}')">${icon('trash',16)}</button>
                </td>
            </tr>`).join('');
    } catch (e) { document.getElementById('ftp-list').innerHTML = `<tr><td colspan="3" style="color:var(--red)">${e.message}</td></tr>`; }
};

window.ftpDel = async (username) => {
    if (!confirm(`Delete FTP user ${username}?`)) return;
    try { await apiDelete(`/ftp/${username}`); navigate('ftp'); } catch (e) { alert(e.message); }
};

// ============ Docker Manager ============
pages.docker = async (el) => {
    el.innerHTML = `<h1 class="page-title">Docker Manager</h1>
        <div class="card mb-4" id="docker-status">Loading Docker status...</div>
        <div class="card mb-4">
            <h3>Containers</h3>
            <div style="overflow:auto">
                <table><thead><tr><th>Name</th><th>Image</th><th>Status</th><th>Ports</th><th style="text-align:right">Actions</th></tr></thead>
                <tbody id="dk-containers"><tr><td colspan="5" style="text-align:center;padding:30px;color:var(--fg3)">Loading...</td></tr></tbody></table>
            </div>
        </div>
        <div class="card">
            <h3>Images</h3>
            <div style="overflow:auto">
                <table><thead><tr><th>Repository</th><th>Tag</th><th>Size</th><th style="text-align:right">Actions</th></tr></thead>
                <tbody id="dk-images"><tr><td colspan="4" style="text-align:center;padding:30px;color:var(--fg3)">Loading...</td></tr></tbody></table>
            </div>
        </div>`;

    try {
        const [status, containers, images] = await Promise.all([
            apiGet('/docker/status'), apiGet('/docker/containers'), apiGet('/docker/images')
        ]);
        document.getElementById('docker-status').innerHTML = `
            <div class="flex-between">
                <div><strong>Docker</strong> ${badge(status.status)}</div>
                <span class="mono text-sm">${status.version || 'Not installed'}</span>
            </div>`;

        const ct = document.getElementById('dk-containers');
        const c = containers.containers || [];
        if (!c.length) { ct.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--fg3)">No containers</td></tr>'; }
        else ct.innerHTML = c.map(x => {
            const running = x.status.toLowerCase().startsWith('up');
            return `<tr>
                <td><strong>${x.name}</strong></td>
                <td class="mono text-sm">${x.image}</td>
                <td>${badge(running ? 'active' : 'inactive')}</td>
                <td class="mono text-sm">${x.ports || '—'}</td>
                <td style="text-align:right">
                    <button class="btn-icon" title="${running ? 'Stop' : 'Start'}" onclick="dkAction('${x.id}','${running ? 'stop' : 'start'}')">${icon(running ? 'stop' : 'play', 16)}</button>
                    <button class="btn-icon" title="Restart" onclick="dkAction('${x.id}','restart')">${icon('refresh',16)}</button>
                    <button class="btn-icon" title="Logs" onclick="dkLogs('${x.id}')">${icon('terminal',16)}</button>
                    <button class="btn-icon danger" title="Remove" onclick="dkAction('${x.id}','rm')">${icon('trash',16)}</button>
                </td>
            </tr>`;
        }).join('');

        const ig = document.getElementById('dk-images');
        const imgs = images.images || [];
        if (!imgs.length) { ig.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--fg3)">No images</td></tr>'; }
        else ig.innerHTML = imgs.map(x => `
            <tr>
                <td class="mono text-sm">${x.repository}</td>
                <td>${x.tag}</td>
                <td class="mono text-sm">${x.size}</td>
                <td style="text-align:right"><button class="btn-icon danger" title="Remove" onclick="dkImgDel('${x.id}')">${icon('trash',16)}</button></td>
            </tr>`).join('');
    } catch (e) { document.getElementById('docker-status').innerHTML = `<p style="color:var(--red)">${e.message}</p>`; }
};

window.dkAction = async (id, action) => {
    if (action === 'rm' && !confirm('Remove this container?')) return;
    try { await apiPost(`/docker/containers/${id}/${action}`); setTimeout(() => navigate('docker'), 500); } catch (e) { alert(e.message); }
};

window.dkLogs = async (id) => {
    try {
        const r = await apiGet(`/docker/containers/${id}/logs`);
        const w = window.open('', '_blank', 'width=800,height=600');
        w.document.write(`<pre style="background:#1a1b26;color:#a9b1d6;padding:16px;font-size:13px;margin:0">${r.logs || 'No logs'}</pre>`);
    } catch (e) { alert(e.message); }
};

window.dkImgDel = async (id) => {
    if (!confirm('Remove this image?')) return;
    try { await apiDelete(`/docker/images/${id}`); navigate('docker'); } catch (e) { alert(e.message); }
};

// ============ PM2 Manager ============
pages.pm2 = async (el) => {
    el.innerHTML = `<h1 class="page-title">PM2 Manager</h1>
        <div class="card mb-4" id="pm2-status">Loading...</div>
        <div class="card mb-4">
            <h3>Add Application</h3>
            <div class="form-row">
                <input type="text" id="pm2-name" placeholder="App name">
                <input type="text" id="pm2-script" placeholder="app.js or npm start" style="font-family:monospace">
                <input type="text" id="pm2-cwd" placeholder="/var/www/app (optional)" style="font-family:monospace">
                <button class="btn btn-primary" id="pm2-add">${icon('plus',14)} Start</button>
            </div>
        </div>
        <div class="card" style="padding:0;overflow:auto">
            <table><thead><tr><th>Name</th><th>Status</th><th>CPU</th><th>Memory</th><th>Restarts</th><th style="text-align:right">Actions</th></tr></thead>
            <tbody id="pm2-list"><tr><td colspan="6" style="text-align:center;padding:30px;color:var(--fg3)">Loading...</td></tr></tbody></table>
        </div>`;

    document.getElementById('pm2-add').onclick = async () => {
        const name = document.getElementById('pm2-name').value.trim();
        const script = document.getElementById('pm2-script').value.trim();
        const cwd = document.getElementById('pm2-cwd').value.trim();
        if (!name || !script) return alert('Name and script required');
        try { await apiPost('/pm2', { name, script, cwd }); navigate('pm2'); } catch (e) { alert(e.message); }
    };

    try {
        const [status, procs] = await Promise.all([apiGet('/pm2/status'), apiGet('/pm2')]);
        document.getElementById('pm2-status').innerHTML = `
            <div class="flex-between">
                <div><strong>PM2</strong> ${status.installed ? badge('active') : badge('inactive')}</div>
                <span class="mono text-sm">${status.version || 'Not installed'}</span>
            </div>`;

        const tbody = document.getElementById('pm2-list');
        const processes = procs.processes || [];
        if (!processes.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--fg3)">No applications</td></tr>'; return; }
        tbody.innerHTML = processes.map(p => `
            <tr>
                <td><strong>${p.name}</strong><br><span class="text-xs mono text-muted">${p.cwd || ''}</span></td>
                <td>${badge(p.status === 'online' ? 'active' : p.status)}</td>
                <td class="mono">${p.cpu}%</td>
                <td class="mono">${formatBytes(p.memory)}</td>
                <td class="mono">${p.restarts}</td>
                <td style="text-align:right">
                    <button class="btn-icon" title="Restart" onclick="pm2Act(${p.id},'restart')">${icon('refresh',16)}</button>
                    <button class="btn-icon" title="${p.status === 'online' ? 'Stop' : 'Restart'}" onclick="pm2Act(${p.id},'${p.status === 'online' ? 'stop' : 'restart'}')">${icon(p.status === 'online' ? 'stop' : 'play', 16)}</button>
                    <button class="btn-icon" title="Logs" onclick="pm2Logs(${p.id})">${icon('terminal',16)}</button>
                    <button class="btn-icon danger" title="Delete" onclick="pm2Act(${p.id},'delete')">${icon('trash',16)}</button>
                </td>
            </tr>`).join('');
    } catch (e) { document.getElementById('pm2-status').innerHTML = `<p style="color:var(--red)">${e.message}</p>`; }
};

window.pm2Act = async (id, action) => {
    if (action === 'delete' && !confirm('Delete this app from PM2?')) return;
    try { await apiPost(`/pm2/${id}/${action}`); setTimeout(() => navigate('pm2'), 500); } catch (e) { alert(e.message); }
};

window.pm2Logs = async (id) => {
    try {
        const r = await apiGet(`/pm2/${id}/logs`);
        const w = window.open('', '_blank', 'width=800,height=600');
        w.document.write(`<pre style="background:#1a1b26;color:#a9b1d6;padding:16px;font-size:13px;margin:0">${r.logs || 'No logs'}</pre>`);
    } catch (e) { alert(e.message); }
};

// ============ App Store ============
pages.appstore = async (el) => {
    el.innerHTML = `<h1 class="page-title">App Store</h1>
        <p class="text-muted mb-4">One-click install popular applications to your domains</p>
        <div class="grid grid-3" id="app-grid">Loading...</div>`;

    try {
        const [apps, domains] = await Promise.all([apiGet('/appstore'), apiGet('/domains')]);
        const domainList = (domains.domains || []).map(d => d.domain);
        const grid = document.getElementById('app-grid');
        grid.innerHTML = (apps.apps || []).map(app => {
            const colors = { CMS: '#2563eb', Database: '#16a34a', Tools: '#d97706', Framework: '#9333ea', Runtime: '#e11d48', Web: '#0891b2' };
            const color = colors[app.category] || '#6b7280';
            return `<div class="card">
                <div class="flex gap-sm mb-2">
                    <div style="width:40px;height:40px;background:${color};color:white;border-radius:var(--radius);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:18px">${app.icon}</div>
                    <div><strong>${app.name}</strong><br><span class="text-xs" style="color:${color}">${app.category}</span></div>
                </div>
                <p class="text-sm text-muted mb-2">${app.description}</p>
                <div class="flex gap-sm">
                    <select class="app-domain-sel" id="app-domain-${app.id}" style="flex:1;font-size:12px">
                        <option value="">Select domain...</option>
                        ${domainList.map(d => `<option value="${d}">${d}</option>`).join('')}
                    </select>
                    <button class="btn btn-primary btn-sm" onclick="appInstall('${app.id}')">${icon('download',12)} Install</button>
                </div>
            </div>`;
        }).join('');
    } catch (e) { document.getElementById('app-grid').innerHTML = `<p style="color:var(--red)">${e.message}</p>`; }
};

window.appInstall = async (id) => {
    const domain = document.getElementById(`app-domain-${id}`)?.value;
    if (!domain && id !== 'redis-commander') return alert('Select a domain first');
    if (!confirm(`Install on ${domain || 'server'}?`)) return;
    try {
        const r = await apiPost(`/appstore/${id}/install`, { domain });
        alert(r.message);
    } catch (e) { alert(e.message); }
};

// ============ SSH Keys ============
pages.sshkeys = async (el) => {
    el.innerHTML = `<h1 class="page-title">SSH Key Management</h1>
        <div class="grid grid-2 mb-4">
            <div class="card">
                <h3>Add SSH Key</h3>
                <textarea id="ssh-key-input" placeholder="Paste your public key (ssh-rsa AAAA... or ssh-ed25519 AAAA...)" style="width:100%;height:80px;font-family:monospace;font-size:12px;background:var(--bg3);color:var(--fg);border:1px solid var(--border);border-radius:var(--radius);padding:8px;resize:vertical"></textarea>
                <button class="btn btn-primary btn-sm mt-2" onclick="sshAddKey()">${icon('plus',14)} Add Key</button>
            </div>
            <div class="card">
                <h3>SSH Config</h3>
                <div id="ssh-config">Loading...</div>
            </div>
        </div>
        <div class="card mb-4">
            <h3>Generate Key Pair</h3>
            <div class="form-row">
                <select id="ssh-gen-type"><option value="ed25519">Ed25519 (recommended)</option><option value="rsa">RSA 4096</option></select>
                <input type="text" id="ssh-gen-comment" placeholder="Comment (e.g. my-laptop)">
                <button class="btn btn-secondary" onclick="sshGenerate()">${icon('key',14)} Generate</button>
            </div>
        </div>
        <div class="card" style="padding:0;overflow:auto">
            <table><thead><tr><th>Type</th><th>Comment</th><th>Fingerprint</th><th style="text-align:right">Actions</th></tr></thead>
            <tbody id="ssh-keys-list"><tr><td colspan="4" style="text-align:center;padding:30px;color:var(--fg3)">Loading...</td></tr></tbody></table>
        </div>`;

    try {
        const [keys, config] = await Promise.all([apiGet('/sshkeys'), apiGet('/sshkeys/config')]);

        // Render config
        document.getElementById('ssh-config').innerHTML = `
            <div class="form-row mb-2">
                <label style="min-width:100px">SSH Port:</label>
                <input type="text" id="ssh-port" value="${config.port || '22'}" style="width:80px;font-family:monospace">
            </div>
            <div class="form-row mb-2">
                <label style="min-width:100px">Root Login:</label>
                <select id="ssh-root"><option value="yes" ${config.permitRootLogin === 'yes' ? 'selected' : ''}>Yes</option><option value="no" ${config.permitRootLogin === 'no' ? 'selected' : ''}>No</option><option value="prohibit-password" ${config.permitRootLogin === 'prohibit-password' ? 'selected' : ''}>Key only</option></select>
            </div>
            <div class="form-row mb-2">
                <label style="min-width:100px">Password Auth:</label>
                <select id="ssh-pass-auth"><option value="yes" ${config.passwordAuthentication === 'yes' ? 'selected' : ''}>Yes</option><option value="no" ${config.passwordAuthentication === 'no' ? 'selected' : ''}>No</option></select>
            </div>
            <button class="btn btn-primary btn-sm" onclick="sshSaveConfig()">${icon('archive',12)} Save Config</button>`;

        // Render keys
        const tbody = document.getElementById('ssh-keys-list');
        const keyList = keys.keys || [];
        if (!keyList.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--fg3)">No SSH keys</td></tr>'; return; }
        tbody.innerHTML = keyList.map(k => `
            <tr>
                <td class="mono text-sm">${k.type}</td>
                <td>${k.comment}</td>
                <td class="mono text-xs text-muted">${k.fingerprint}</td>
                <td style="text-align:right"><button class="btn-icon danger" onclick="sshDelKey(${k.id})">${icon('trash',16)}</button></td>
            </tr>`).join('');
    } catch (e) { document.getElementById('ssh-keys-list').innerHTML = `<tr><td colspan="4" style="color:var(--red)">${e.message}</td></tr>`; }
};

window.sshAddKey = async () => {
    const key = document.getElementById('ssh-key-input').value.trim();
    if (!key) return alert('Paste an SSH public key');
    try { await apiPost('/sshkeys', { key }); alert('Key added'); navigate('sshkeys'); } catch (e) { alert(e.message); }
};

window.sshDelKey = async (id) => {
    if (!confirm('Delete this SSH key?')) return;
    try { await apiDelete(`/sshkeys/${id}`); navigate('sshkeys'); } catch (e) { alert(e.message); }
};

window.sshSaveConfig = async () => {
    try {
        await apiPost('/sshkeys/config', {
            port: document.getElementById('ssh-port').value,
            permitRootLogin: document.getElementById('ssh-root').value,
            passwordAuthentication: document.getElementById('ssh-pass-auth').value
        });
        alert('SSH config updated. Service reloaded.');
    } catch (e) { alert(e.message); }
};

window.sshGenerate = async () => {
    const type = document.getElementById('ssh-gen-type').value;
    const comment = document.getElementById('ssh-gen-comment').value || 'myvps-generated';
    try {
        const r = await apiPost('/sshkeys/generate', { type, comment });
        const w = window.open('', '_blank', 'width=700,height=500');
        w.document.write(`<pre style="background:#1a1b26;color:#a9b1d6;padding:16px;font-size:13px;margin:0;white-space:pre-wrap">== PUBLIC KEY (add to remote servers) ==\n\n${r.publicKey}\n\n== PRIVATE KEY (save securely, do NOT share) ==\n\n${r.privateKey}</pre>`);
    } catch (e) { alert(e.message); }
};

// ============ Cloud Backup ============
pages.cloudbackup = async (el) => {
    el.innerHTML = `<h1 class="page-title">Cloud Backup</h1>
        <div class="card mb-4">
            <h3>Add Backup Destination</h3>
            <div class="form-row mb-2">
                <input type="text" id="cb-name" placeholder="Destination name">
                <select id="cb-type" onchange="cbTypeChange()">
                    <option value="s3">Amazon S3 / Wasabi</option>
                    <option value="gdrive">Google Drive</option>
                    <option value="pcloud">pCloud</option>
                    <option value="rsync">Remote Server (rsync)</option>
                    <option value="rclone">Rclone (Other)</option>
                </select>
            </div>
            <div id="cb-s3-fields">
                <div class="form-row mb-2">
                    <input type="text" id="cb-bucket" placeholder="Bucket name">
                    <input type="text" id="cb-region" placeholder="Region (us-east-1)" value="us-east-1">
                </div>
                <div class="form-row mb-2">
                    <input type="text" id="cb-access-key" placeholder="Access Key" class="mono">
                    <input type="password" id="cb-secret-key" placeholder="Secret Key" class="mono">
                </div>
            </div>
            <div id="cb-gdrive-fields" style="display:none">
                <p class="text-muted text-sm mb-2">Run <code>rclone authorize "drive"</code> on a PC with browser, then paste the token below</p>
                <div class="form-row mb-2">
                    <input type="text" id="cb-gdrive-client-id" placeholder="Client ID (optional)">
                    <input type="password" id="cb-gdrive-client-secret" placeholder="Client Secret (optional)">
                </div>
                <div class="form-row mb-2">
                    <textarea id="cb-gdrive-token" placeholder='Paste rclone token JSON here...' rows="3" style="width:100%;font-family:monospace;font-size:12px"></textarea>
                </div>
                <div class="form-row mb-2">
                    <input type="text" id="cb-gdrive-folder" placeholder="Folder ID (optional - leave blank for root)">
                    <input type="text" id="cb-gdrive-path" placeholder="Backup path (e.g. /myvps-backup)" value="/myvps-backup">
                </div>
            </div>
            <div id="cb-pcloud-fields" style="display:none">
                <p class="text-muted text-sm mb-2">Run <code>rclone authorize "pcloud"</code> on a PC with browser, then paste the token below</p>
                <div class="form-row mb-2">
                    <input type="text" id="cb-pcloud-user" placeholder="pCloud username/email">
                    <input type="password" id="cb-pcloud-pass" placeholder="pCloud password (or use token)">
                </div>
                <div class="form-row mb-2">
                    <textarea id="cb-pcloud-token" placeholder='Paste rclone token JSON here...' rows="3" style="width:100%;font-family:monospace;font-size:12px"></textarea>
                </div>
                <div class="form-row mb-2">
                    <select id="cb-pcloud-host"><option value="api.pcloud.com">pCloud (US)</option><option value="eapi.pcloud.com">pCloud (EU)</option></select>
                    <input type="text" id="cb-pcloud-path" placeholder="Backup path (e.g. /myvps-backup)" value="/myvps-backup">
                </div>
            </div>
            <div id="cb-rsync-fields" style="display:none">
                <div class="form-row mb-2">
                    <input type="text" id="cb-host" placeholder="Remote host IP">
                    <input type="text" id="cb-username" placeholder="Username" value="root">
                    <input type="text" id="cb-remote-path" placeholder="/backup" value="/backup">
                </div>
            </div>
            <div id="cb-rclone-fields" style="display:none">
                <div class="form-row mb-2">
                    <input type="text" id="cb-rclone-path" placeholder="remote:path/to/backup">
                </div>
            </div>
            <button class="btn btn-primary" id="cb-add">${icon('plus',14)} Add Destination</button>
        </div>
        <div class="grid grid-2 mb-4">
            <div class="card">
                <h3>Run Backup</h3>
                <div class="form-row mb-2">
                    <select id="cb-dest-sel"><option value="">Select destination...</option></select>
                    <select id="cb-domain-sel"><option value="">Full server backup</option></select>
                    <select id="cb-bk-type"><option value="full">Files</option><option value="database">Database</option></select>
                </div>
                <button class="btn btn-primary" onclick="cbRunBackup()">${icon('cloud',14)} Backup Now</button>
            </div>
            <div class="card">
                <h3>Available Tools</h3>
                <div id="cb-tools">Loading...</div>
            </div>
        </div>
        <div class="card" style="padding:0;overflow:auto">
            <h3 style="padding:16px 16px 0">Backup History</h3>
            <table><thead><tr><th>Destination</th><th>File</th><th>Size</th><th>Date</th><th>Status</th></tr></thead>
            <tbody id="cb-history"><tr><td colspan="5" style="text-align:center;padding:30px;color:var(--fg3)">Loading...</td></tr></tbody></table>
        </div>`;

    try {
        const [dests, tools, history, domains] = await Promise.all([
            apiGet('/cloudbackup/destinations'), apiGet('/cloudbackup/tools'),
            apiGet('/cloudbackup/history'), apiGet('/domains')
        ]);

        // Populate selects
        const destSel = document.getElementById('cb-dest-sel');
        (dests.destinations || []).forEach(d => { const o = document.createElement('option'); o.value = d.id; o.textContent = `${d.name} (${d.type})`; destSel.appendChild(o); });
        const domSel = document.getElementById('cb-domain-sel');
        (domains.domains || []).forEach(d => { const o = document.createElement('option'); o.value = d.domain; o.textContent = d.domain; domSel.appendChild(o); });

        // Tools
        document.getElementById('cb-tools').innerHTML = `
            <div class="flex gap-sm" style="flex-wrap:wrap">
                <span class="badge ${tools.aws ? 'badge-green' : 'badge-red'}">AWS CLI ${tools.aws ? '' : '(not installed)'}</span>
                <span class="badge ${tools.rclone ? 'badge-green' : 'badge-red'}">rclone ${tools.rclone ? '' : '(not installed)'}</span>
                <span class="badge ${tools.rsync ? 'badge-green' : 'badge-red'}">rsync ${tools.rsync ? '' : '(not installed)'}</span>
            </div>`;

        // History
        const tbody = document.getElementById('cb-history');
        const hist = history.history || [];
        if (!hist.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--fg3)">No backup history</td></tr>'; }
        else tbody.innerHTML = hist.map(h => `
            <tr>
                <td>${h.destination}</td>
                <td class="mono text-sm">${h.file || '—'}</td>
                <td class="mono text-sm">${h.size ? formatBytes(h.size) : '—'}</td>
                <td class="text-sm">${new Date(h.date).toLocaleString()}</td>
                <td>${badge(h.status === 'success' ? 'active' : 'inactive')}</td>
            </tr>`).join('');
    } catch (e) { document.getElementById('cb-history').innerHTML = `<tr><td colspan="5" style="color:var(--red)">${e.message}</td></tr>`; }

    document.getElementById('cb-add').onclick = async () => {
        const type = document.getElementById('cb-type').value;
        const body = { name: document.getElementById('cb-name').value.trim(), type };
        if (type === 's3') {
            body.bucket = document.getElementById('cb-bucket').value.trim();
            body.region = document.getElementById('cb-region').value.trim();
            body.accessKey = document.getElementById('cb-access-key').value.trim();
            body.secretKey = document.getElementById('cb-secret-key').value;
        } else if (type === 'gdrive') {
            body.clientId = document.getElementById('cb-gdrive-client-id').value.trim();
            body.clientSecret = document.getElementById('cb-gdrive-client-secret').value;
            body.token = document.getElementById('cb-gdrive-token').value.trim();
            body.folderId = document.getElementById('cb-gdrive-folder').value.trim();
            body.path = document.getElementById('cb-gdrive-path').value.trim();
        } else if (type === 'pcloud') {
            body.username = document.getElementById('cb-pcloud-user').value.trim();
            body.password = document.getElementById('cb-pcloud-pass').value;
            body.token = document.getElementById('cb-pcloud-token').value.trim();
            body.host = document.getElementById('cb-pcloud-host').value;
            body.path = document.getElementById('cb-pcloud-path').value.trim();
        } else if (type === 'rsync') {
            body.host = document.getElementById('cb-host').value.trim();
            body.username = document.getElementById('cb-username').value.trim();
            body.path = document.getElementById('cb-remote-path').value.trim();
        } else if (type === 'rclone') {
            body.path = document.getElementById('cb-rclone-path').value.trim();
        }
        if (!body.name) return alert('Name required');
        try { await apiPost('/cloudbackup/destinations', body); alert('Destination added'); navigate('cloudbackup'); } catch (e) { alert(e.message); }
    };
};

window.cbTypeChange = () => {
    const type = document.getElementById('cb-type').value;
    document.getElementById('cb-s3-fields').style.display = type === 's3' ? '' : 'none';
    document.getElementById('cb-gdrive-fields').style.display = type === 'gdrive' ? '' : 'none';
    document.getElementById('cb-pcloud-fields').style.display = type === 'pcloud' ? '' : 'none';
    document.getElementById('cb-rsync-fields').style.display = type === 'rsync' ? '' : 'none';
    document.getElementById('cb-rclone-fields').style.display = type === 'rclone' ? '' : 'none';
};

window.cbRunBackup = async () => {
    const destinationId = document.getElementById('cb-dest-sel').value;
    const domain = document.getElementById('cb-domain-sel').value;
    const type = document.getElementById('cb-bk-type').value;
    if (!destinationId) return alert('Select a destination');
    if (!confirm('Start backup now?')) return;
    try {
        const r = await apiPost('/cloudbackup/run', { destinationId, domain, type });
        alert(r.message);
        navigate('cloudbackup');
    } catch (e) { alert(e.message); }
};

// ============ Server Migration ============
pages.migrate = async (el) => {
    const srv = activeServer();
    el.innerHTML = `<h1 class="page-title">Server Migration</h1>
        <p class="text-muted mb-4">Export config from this server or import from another</p>
        <div class="grid grid-2 mb-4">
            <div class="card">
                <h3>${icon('upload',18)} Export from ${srv?.name || 'this server'}</h3>
                <p class="text-sm text-muted mb-2">Export domains, databases, nginx configs, PHP pools, crontab</p>
                <button class="btn btn-primary" onclick="migrateExport()">${icon('download',14)} Export Config</button>
            </div>
            <div class="card">
                <h3>${icon('download',18)} Import to ${srv?.name || 'this server'}</h3>
                <p class="text-sm text-muted mb-2">Import config JSON exported from another server</p>
                <textarea id="mig-import" placeholder="Paste exported JSON here..." style="width:100%;height:100px;font-family:monospace;font-size:12px;background:var(--bg3);color:var(--fg);border:1px solid var(--border);border-radius:var(--radius);padding:8px;resize:vertical"></textarea>
                <button class="btn btn-primary mt-2" onclick="migrateImport()">${icon('upload',14)} Import Config</button>
            </div>
        </div>
        <div class="card mb-4">
            <h3>${icon('shuffle',18)} Sync Files (rsync)</h3>
            <p class="text-sm text-muted mb-2">Sync files from a remote server to this server</p>
            <div class="form-row mb-2">
                <input type="text" id="mig-source" placeholder="root@old-server:/var/www/" style="flex:1;font-family:monospace">
                <input type="text" id="mig-dest" placeholder="/var/www/" value="/var/www/" style="font-family:monospace">
            </div>
            <button class="btn btn-secondary" onclick="migrateSync()">${icon('refresh',14)} Sync Files</button>
        </div>
        ${state.servers.length > 1 ? `
        <div class="card">
            <h3>${icon('server',18)} Cross-Server Migration</h3>
            <p class="text-sm text-muted mb-2">Export from one connected server and import to another</p>
            <div class="form-row">
                <select id="mig-from"><option value="">Source server...</option>${state.servers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select>
                <span style="padding:6px">&rarr;</span>
                <select id="mig-to"><option value="">Target server...</option>${state.servers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select>
                <button class="btn btn-primary" onclick="migrateCross()">${icon('truck',14)} Migrate</button>
            </div>
        </div>` : '<div class="card"><p class="text-muted">Add more servers to enable cross-server migration</p></div>'}
        <div class="card hidden mt-4" id="mig-result">
            <h3>Result</h3>
            <pre id="mig-output" class="mono text-sm" style="background:var(--bg3);padding:12px;border-radius:var(--radius);white-space:pre-wrap;max-height:400px;overflow-y:auto"></pre>
        </div>`;
};

window.migrateExport = async () => {
    try {
        const data = await apiGet('/migrate/export');
        const json = JSON.stringify(data, null, 2);
        document.getElementById('mig-result').classList.remove('hidden');
        document.getElementById('mig-output').textContent = json;
        // Also copy to clipboard
        navigator.clipboard.writeText(json).then(() => {}).catch(() => {});
        alert(`Exported: ${data.domains?.length || 0} domains, ${data.databases?.length || 0} databases, ${Object.keys(data.nginx || {}).length} nginx configs`);
    } catch (e) { alert(e.message); }
};

window.migrateImport = async () => {
    const json = document.getElementById('mig-import').value.trim();
    if (!json) return alert('Paste export JSON');
    try {
        const data = JSON.parse(json);
        if (!confirm(`Import ${data.domains?.length || 0} domains, ${Object.keys(data.nginx || {}).length} nginx configs?`)) return;
        const r = await apiPost('/migrate/import', data);
        document.getElementById('mig-result').classList.remove('hidden');
        document.getElementById('mig-output').textContent = JSON.stringify(r.results, null, 2);
        alert(r.message);
    } catch (e) { alert(e.message); }
};

window.migrateSync = async () => {
    const source = document.getElementById('mig-source').value.trim();
    const destination = document.getElementById('mig-dest').value.trim();
    if (!source || !destination) return alert('Source and destination required');
    if (!confirm(`Sync files from ${source} to ${destination}?`)) return;
    try {
        const r = await apiPost('/migrate/sync', { source, destination });
        document.getElementById('mig-result').classList.remove('hidden');
        document.getElementById('mig-output').textContent = r.output || r.message;
    } catch (e) { alert(e.message); }
};

window.migrateCross = async () => {
    const fromId = document.getElementById('mig-from').value;
    const toId = document.getElementById('mig-to').value;
    if (!fromId || !toId) return alert('Select source and target servers');
    if (fromId === toId) return alert('Source and target must be different');
    const fromSrv = state.servers.find(s => s.id === fromId);
    const toSrv = state.servers.find(s => s.id === toId);
    if (!confirm(`Migrate config from ${fromSrv.name} to ${toSrv.name}?`)) return;

    try {
        // Export from source
        const exportRes = await fetch(`${fromSrv.url}/api/migrate/export`, {
            headers: { 'Authorization': `Bearer ${fromSrv.token}` }
        });
        const exportData = await exportRes.json();

        // Import to target
        const importRes = await fetch(`${toSrv.url}/api/migrate/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${toSrv.token}` },
            body: JSON.stringify(exportData)
        });
        const importResult = await importRes.json();

        document.getElementById('mig-result').classList.remove('hidden');
        document.getElementById('mig-output').textContent = JSON.stringify(importResult.results, null, 2);
        alert(`Migration complete: ${importResult.results?.domains?.length || 0} domains, ${importResult.results?.nginx?.length || 0} nginx configs`);
    } catch (e) { alert(e.message); }
};
