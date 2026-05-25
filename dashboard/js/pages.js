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

// ============ Servers ============
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
        <div class="grid grid-3" id="srv-grid"></div>`;

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

    // Render server cards
    const grid = document.getElementById('srv-grid');
    state.servers.forEach(s => {
        const isActive = s.id === state.activeId;
        grid.innerHTML += `
            <div class="card" style="${isActive ? 'border-color:var(--primary);box-shadow:0 0 0 2px var(--primary-light)' : ''};cursor:pointer" onclick="switchServer('${s.id}')">
                <div class="flex-between mb-2">
                    <strong>${s.name}</strong>
                    ${isActive ? '<span class="badge badge-green">Active</span>' : ''}
                </div>
                <p class="mono text-xs text-muted mb-2">${s.url}</p>
                <div class="flex gap-sm" onclick="event.stopPropagation()">
                    <button class="btn btn-danger btn-sm" onclick="removeSrv('${s.id}','${s.name}')">${icon('trash',12)} Remove</button>
                </div>
            </div>`;
    });

    // Check health
    state.servers.forEach(async s => {
        try {
            await fetch(`${s.url}/api/health`, { signal: AbortSignal.timeout(5000) });
        } catch {}
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
