# MyVPS Architecture

## Overview

MyVPS is a VPS management tool with two interfaces:
1. **CLI (Bash)** - Terminal-based management via `myvps` command
2. **Web Dashboard (Node.js + React)** - Browser-based management

Both interfaces manage the same underlying system through shared configurations and direct system commands.

## System Architecture

```
                    ┌─────────────────────┐
                    │    Web Dashboard     │
                    │  (React + Tailwind)  │
                    └─────────┬───────────┘
                              │ HTTP/WS
                    ┌─────────▼───────────┐
                    │    API Server        │
                    │  (Node.js/Express)   │
                    │  - JWT Auth          │
                    │  - Rate Limiting     │
                    │  - SQLite DB         │
                    │  - WebSocket         │
                    └─────────┬───────────┘
                              │ exec/spawn
        ┌─────────────────────▼─────────────────────┐
        │              CLI Core                      │
        │  ┌──────────┬──────────┬──────────┐       │
        │  │ config   │functions │ colors   │       │
        │  └──────────┴──────────┴──────────┘       │
        │                                            │
        │  ┌─────────────── Modules ──────────────┐ │
        │  │ domain   │ database │ php     │ nginx │ │
        │  │ ssl      │ ssh      │ firewall│ cache │ │
        │  │ swap     │ backup   │ wordpress│ laravel│ │
        │  │ monitor  │ log      │ fail2ban │ cron  │ │
        │  │ utility  │ admin    │ port     │       │ │
        │  └──────────────────────────────────────┘ │
        └─────────────────────┬─────────────────────┘
                              │
        ┌─────────────────────▼─────────────────────┐
        │           System Services                  │
        │  Nginx  PHP-FPM  MariaDB  Redis  Memcached│
        │  Fail2Ban  SSHD  Firewall  Cron           │
        └───────────────────────────────────────────┘
```

## Directory Structure

### Configuration
```
/etc/myvps/
├── .myvps.conf          # Global config (IP, ports, passwords)
├── user/                # Domain configs (.domain.conf)
├── cron/                # Scheduled tasks
│   ├── backup/
│   └── alert/
├── nginx/               # Custom nginx configs
├── ssl/                 # SSL certificates
├── backup/              # Backup storage
│   ├── db/
│   └── source/
└── menu/                # CLI scripts
```

### Domain Directory
```
/home/{username}/
└── {domain}/
    ├── public_html/     # Web root
    ├── logs/            # Access/error/PHP logs
    ├── tmp/             # Temp files
    ├── ssl/             # SSL certs
    ├── session/         # PHP sessions
    └── restore/         # Restore files
```

## Security Model

### User Isolation
- Each domain gets a dedicated Linux user
- SFTP chroot jail per user (`/home/{user}/`)
- PHP-FPM pool per domain (separate port, separate process user)
- SELinux contexts for web content

### Authentication
- CLI: Requires root access
- Web: JWT tokens + HTTP-only cookies
- phpMyAdmin: HTTP Basic Auth
- SFTP: Linux user credentials

### Network
- Firewall (firewalld/ufw) with explicit port management
- Fail2Ban for SSH brute-force protection
- Admin panel on custom port (default 8080)
- SSL/TLS with modern cipher suites

## Web API Design

### Authentication
- `POST /api/auth/login` - Login (returns JWT)
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user
- `POST /api/auth/change-password` - Change password

### Domains
- `GET /api/domains` - List domains
- `GET /api/domains/:domain` - Domain info
- `POST /api/domains` - Add domain
- `DELETE /api/domains/:domain` - Delete domain
- `POST /api/domains/:domain/suspend` - Suspend
- `POST /api/domains/:domain/unsuspend` - Unsuspend

### Databases
- `GET /api/databases` - List
- `POST /api/databases` - Create
- `DELETE /api/databases/:name` - Delete
- `POST /api/databases/:name/export` - Export

### Services
- `GET /api/services` - All service statuses
- `POST /api/services/:name/:action` - Control (start/stop/restart)

### Monitor
- `GET /api/monitor/status` - System status
- `GET /api/monitor/processes` - Top processes
- `GET /api/monitor/disk` - Disk usage
- `GET /api/monitor/audit-log` - Action audit log
- `WS /ws` - Real-time stats (WebSocket)

### SSL, PHP, Firewall, Cache, Backup, WordPress
- Standard CRUD endpoints for each module

## Tech Stack

### CLI
- **Language**: Bash
- **Config Format**: Key-value files
- **Template Engine**: Heredocs

### Web Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Auth**: JWT + bcrypt
- **Database**: SQLite (better-sqlite3)
- **Real-time**: WebSocket (ws)
- **Security**: Helmet, CORS, Rate limiting

### Web Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **HTTP Client**: Axios
- **Routing**: React Router v6

## Development Setup

```bash
# Backend
cd web/backend
npm install
npm run dev

# Frontend
cd web/frontend
npm install
npm run dev

# Full install on VPS
bash install.sh
```
