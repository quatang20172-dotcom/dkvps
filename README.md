# MyVPS - VPS Management Tool

A complete VPS management solution inspired by LarVPS. Features a **Bash CLI** for server management, a **lightweight API Agent** running on the VPS, and a **Web Dashboard** that can run anywhere to remotely manage your servers.

## Architecture

```
┌──────────────────────────┐         ┌───────────────────────────────────┐
│  Dashboard (48KB HTML/JS)│──API──▶ │  VPS Server                      │
│   Runs anywhere:         │         │  ┌──────────────────────────┐    │
│   - Agent built-in       │◀──WS─── │  │  Agent (Node.js ~15MB)   │    │
│   - Any static host      │         │  │  Port 9090               │    │
│   - Just open HTML       │         │  └──────────┬───────────────┘    │
│                          │         │             │ exec                │
│   Zero dependencies:     │         │  ┌──────────▼───────────────┐    │
│   - No npm, no build     │         │  │  CLI (myvps)             │    │
│   - Pure HTML/CSS/JS     │         │  │  Bash scripts            │    │
│   - 4 files, 48KB total  │         │  └──────────┬───────────────┘    │
│   - Multi-server mgmt    │         │             │                    │
└──────────────────────────┘         │  ┌──────────▼───────────────┐    │
                                     │  │  Nginx  PHP-FPM  MariaDB │    │
                                     │  │  Redis  Memcached  etc   │    │
                                     │  └──────────────────────────┘    │
                                     └───────────────────────────────────┘
```

## Key Design Decisions

- **Agent is ultra-lightweight** (~15MB RAM) - runs on the VPS with minimal impact
- **Dashboard is ultra-lightweight** (~48KB) - pure HTML/CSS/JS, zero dependencies, no npm/build
- **Multi-server support** - one dashboard manages multiple VPS servers
- **API-first** - all operations via REST API + WebSocket for real-time data
- **CLI still works independently** - SSH into server and use `myvps` command directly

## Components

### 1. CLI (`cli/`)
Bash-based VPS management with 20+ modules:
- Domain management (add, delete, suspend, unsuspend)
- Database management (MariaDB: create, delete, import, export)
- PHP management (multi-version: 7.4, 8.0, 8.1, 8.2, 8.3)
- Nginx config management
- SSL certificates (Let's Encrypt, ZeroSSL via acme.sh)
- SSH/SFTP management with chroot jail
- Firewall management (firewalld/ufw)
- Cache management (Redis, Memcached, OPcache)
- Backup with cloud sync (rclone)
- WordPress & Laravel auto-installer
- System monitoring & logging
- Fail2Ban, Swap, Crontab management

### 2. Agent (`agent/`)
Lightweight Node.js API server running on the VPS:
- **4 dependencies only**: express, helmet, jsonwebtoken, ws
- JWT authentication via API key
- REST API for all management operations
- WebSocket for real-time monitoring (CPU, RAM, Disk, Services)
- Port 9090 by default

### 3. Dashboard (`dashboard/`)
Ultra-lightweight web UI (~48KB total, pure HTML/CSS/JS):
- **Zero dependencies** - no npm, no build step, no React, no framework
- 4 files: `index.html` + `css/style.css` + `js/app.js` + `js/ui.js` + `js/pages.js`
- Served directly by Agent or open as standalone HTML
- Multi-server support - manage multiple VPS from one dashboard
- Real-time monitoring via WebSocket
- Domain, Database, SSL, PHP, Service, Firewall, Cache, Backup management

### 4. Installer (`install.sh`)
Auto-setup script for LEMP stack:
- Supports: AlmaLinux 8/9, RockyLinux 8/9, Ubuntu 20.04/22.04
- Installs: Nginx, PHP 8.1, MariaDB 10.5, Redis, Memcached
- Configures: Firewall, Fail2Ban, SFTP, phpMyAdmin, WP-CLI

## Quick Start

### Install on VPS
```bash
curl -sO https://your-domain/install && bash install
```

### Run Agent on VPS
```bash
cd /path/to/myvps/agent
npm install
npm start
# Agent runs on port 9090
```

### Access Dashboard
```bash
# Option 1: Built into Agent - just open browser
open http://your-vps:9090

# Option 2: Standalone - just open the HTML file
open dashboard/index.html
# No npm install, no build, nothing to install
```

### CLI Usage
```bash
myvps                    # Interactive menu
myvps domain add         # Add domain
myvps db create          # Create database
myvps ssl install        # Install SSL
myvps status             # System status
myvps help               # Help
```

## Features

| Feature | CLI | Agent API | Dashboard |
|---------|-----|-----------|-----------|
| Domain management | ✓ | ✓ | ✓ |
| Database management | ✓ | ✓ | ✓ |
| PHP version switching | ✓ | ✓ | ✓ |
| SSL certificates | ✓ | ✓ | ✓ |
| Service control | ✓ | ✓ | ✓ |
| Firewall/Ports | ✓ | ✓ | ✓ |
| Cache management | ✓ | ✓ | ✓ |
| Backup/Restore | ✓ | ✓ | ✓ |
| WordPress installer | ✓ | ✓ | ✓ |
| Real-time monitoring | ✓ | WebSocket | ✓ |
| Multi-server | - | - | ✓ |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - System design and API reference
- [Web UI Plan](docs/WEB-UI-PLAN.md) - Roadmap and technical decisions

## License

MIT
