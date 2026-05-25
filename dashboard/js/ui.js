/**
 * UI rendering - login screen & app shell
 */

function renderLogin() {
    document.body.innerHTML = `
    <div class="login-wrap">
        <div class="login-box">
            <div class="login-logo">
                ${icon('server', 40)}
                <h1>MyVPS</h1>
                <p>Connect to your VPS to start managing</p>
            </div>
            <div class="login-form card">
                <h2>Connect VPS</h2>
                <div id="login-err" class="login-err hidden"></div>
                <form id="login-form">
                    <div class="form-group">
                        <label>Server Name</label>
                        <input type="text" id="srv-name" placeholder="My VPS" style="width:100%">
                    </div>
                    <div class="form-group">
                        <label>Agent URL</label>
                        <input type="text" id="srv-url" placeholder="https://your-ip:9090" required style="width:100%">
                    </div>
                    <div class="form-group">
                        <label>API Key</label>
                        <input type="password" id="srv-key" placeholder="API key from installation" required style="width:100%" class="mono">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;padding:10px">
                        Connect
                    </button>
                </form>
                <p class="text-sm text-muted mt-2" style="text-align:center">
                    Agent running on VPS port 9090
                </p>
            </div>
        </div>
    </div>`;

    document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('login-err');
        errEl.classList.add('hidden');
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Connecting...';
        try {
            await addServer(
                document.getElementById('srv-name').value,
                document.getElementById('srv-url').value,
                document.getElementById('srv-key').value
            );
            renderApp();
            connectWS();
        } catch (err) {
            errEl.textContent = err.message;
            errEl.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = 'Connect';
        }
    };
}

function renderApp() {
    const srv = activeServer();
    const navLinks = [
        ['dashboard', 'grid', 'Dashboard'],
        ['domains', 'globe', 'Domains'],
        ['databases', 'database', 'Databases'],
        ['services', 'server', 'Services'],
        ['ssl', 'lock', 'SSL'],
        ['php', 'code', 'PHP'],
        ['firewall', 'shield', 'Firewall'],
        ['cache', 'hdd', 'Cache'],
        ['backup', 'archive', 'Backup'],
        ['monitor', 'activity', 'Monitor'],
        ['files', 'folder', 'File Manager'],
        ['terminal', 'terminal', 'Terminal'],
        ['proxy', 'shuffle', 'Proxy'],
        ['cron', 'clock', 'Cron Jobs'],
        ['deploy', 'rocket', 'Deploy'],
        ['ftp', 'upload', 'FTP'],
        ['docker', 'box', 'Docker'],
        ['pm2', 'cpu', 'PM2'],
        ['servers', 'monitor', 'Servers'],
    ];

    document.body.innerHTML = `
    <div class="app">
        <div class="overlay" id="overlay"></div>
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">${icon('server', 22)} MyVPS</div>
            ${state.servers.length > 1 ? `
            <div class="server-switch">
                <select id="server-select">
                    ${state.servers.map(s => `<option value="${s.id}" ${s.id === state.activeId ? 'selected' : ''}>${s.name}</option>`).join('')}
                </select>
            </div>` : ''}
            <nav class="sidebar-nav">
                ${navLinks.map(([page, ic, label]) =>
                    `<a href="#${page}" data-page="${page}" class="${state.page === page ? 'active' : ''}">${icon(ic)} ${label}</a>`
                ).join('')}
            </nav>
            <div class="sidebar-footer">${srv?.name || 'No server'}<br><span class="text-xs mono">${srv?.url || ''}</span></div>
        </aside>
        <div class="main">
            <div class="topbar">
                <button class="menu-btn" id="menu-btn">${icon('menu', 24)}</button>
                <div style="flex:1"></div>
                <span id="ws-status" class="text-sm" style="color:var(--fg3)">○ Connecting...</span>
            </div>
            <div class="content" id="page-content"></div>
        </div>
    </div>`;

    // Sidebar toggle (mobile)
    document.getElementById('menu-btn').onclick = () => {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('overlay').classList.toggle('show');
    };
    document.getElementById('overlay').onclick = () => {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('overlay').classList.remove('show');
    };

    // Navigation
    document.querySelectorAll('.sidebar-nav a').forEach(a => {
        a.onclick = (e) => {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('overlay').classList.remove('show');
        };
    });

    // Server switcher
    const sel = document.getElementById('server-select');
    if (sel) sel.onchange = () => switchServer(sel.value);

    renderPage();
}
