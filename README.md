# MyVPS - VPS Management Tool

A comprehensive VPS management tool with CLI interface and Web Dashboard. Inspired by LarVPS, built from scratch with modern architecture.

## Features

- **LEMP Stack Auto-Install**: Nginx + PHP-FPM + MariaDB + Redis + Memcached
- **Domain Management**: Add/remove/suspend domains with isolated users
- **SSL Management**: Let's Encrypt, ZeroSSL, Custom SSL
- **Database Management**: Create/delete/import/export MariaDB databases
- **PHP Management**: Multi-version PHP (7.4 - 8.3), per-domain PHP pools
- **WordPress & Laravel**: One-click installer
- **Cache Management**: OPcache, Memcached, Redis
- **Security**: Fail2Ban, Firewall, SSH hardening, SFTP isolation
- **Backup & Restore**: Scheduled backups with cloud storage (rclone)
- **Web Dashboard**: Modern UI to manage everything visually
- **Monitoring**: Real-time CPU, RAM, Disk, Service status
- **Telegram Alerts**: SSH login notifications

## Architecture

```
MyVPS
├── CLI (Bash Scripts)          # Terminal-based management
│   ├── myvps                   # Main entry point
│   ├── core/                   # Core functions & config
│   ├── modules/                # Feature modules
│   └── templates/              # Config templates
│
└── Web Dashboard               # Browser-based management
    ├── Backend (Node.js)       # REST API + WebSocket
    └── Frontend (React)        # Modern SPA dashboard
```

## Supported OS

- AlmaLinux 8, 9
- RockyLinux 8, 9
- Ubuntu 20.04, 22.04

## Quick Install

```bash
curl -sO https://yourdomain.com/install.sh && bash install.sh
```

## CLI Usage

```bash
myvps                    # Open main menu
myvps domain add         # Add domain
myvps domain list        # List domains
myvps db create          # Create database
myvps ssl install        # Install SSL
myvps wp install          # Install WordPress
myvps status             # Show system status
```

## Web Dashboard

Access at: `http://your-ip:8080`

Default credentials:
- Username: admin
- Password: (generated during install)

## License

MIT
