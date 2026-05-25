# MyVPS Architecture

## Design Philosophy

**Dashboard chạy riêng, Agent chạy trên VPS** - tách biệt hoàn toàn để:
1. Dashboard không tốn tài nguyên VPS
2. Một dashboard quản lý được nhiều VPS
3. Agent nhẹ (~15MB RAM, 4 dependencies)
4. Dashboard có thể deploy miễn phí (Vercel, Netlify)

## System Architecture

```
                    ┌─────────────────────────┐
                    │   Web Dashboard (React)  │
                    │   Runs separately:       │
                    │   - Vercel / Netlify     │
                    │   - Docker               │
                    │   - Local dev server     │
                    └─────────┬───────────────┘
                              │ HTTPS + WSS
                    ┌─────────▼──────────────────┐
                    │   VPS Server                │
                    │   ┌────────────────────┐   │
                    │   │  Agent (Port 9090) │   │
                    │   │  express + ws      │   │
                    │   │  JWT auth          │   │
                    │   │  4 packages only   │   │
                    │   └────────┬───────────┘   │
                    │            │ child_process  │
                    │   ┌────────▼───────────┐   │
                    │   │  CLI (myvps)       │   │
                    │   │  Bash modules      │   │
                    │   └────────┬───────────┘   │
                    │            │ systemctl      │
                    │   ┌────────▼───────────┐   │
                    │   │  Nginx PHP MariaDB │   │
                    │   │  Redis Memcached   │   │
                    │   └────────────────────┘   │
                    └────────────────────────────┘
```

## Component Separation

### Agent (runs on VPS) - `agent/`
- **Purpose**: Minimal API bridge between Dashboard and CLI
- **Resources**: ~15-20MB RAM, negligible CPU when idle
- **Dependencies**: express, helmet, jsonwebtoken, ws
- **Port**: 9090 (configurable)
- **Auth**: API key → JWT token
- **Endpoints**: REST for all management + WebSocket for monitoring
- **Security**: Runs behind VPS firewall, JWT-protected

### Dashboard (runs anywhere) - `web/frontend/`
- **Purpose**: Rich UI for managing VPS servers
- **Deployment**: Static SPA - Vercel, Netlify, Docker, local
- **Auth**: Connects to Agent using API key, stores JWT in localStorage
- **Multi-server**: Manages multiple VPS agents from one UI
- **Framework**: React 18 + Tailwind CSS + Vite
- **State**: ServerContext manages connections, api clients

### CLI (runs on VPS) - `cli/`
- **Purpose**: Direct server management via SSH
- **Usage**: `myvps domain add`, `myvps ssl install`, etc
- **Independent**: Works without Agent or Dashboard

## API Reference

### Authentication
```
POST /api/auth/login        { api_key: "..." } → { token: "jwt..." }
POST /api/auth/generate-key { password: "..." } → { api_key: "..." }
GET  /api/auth/verify        → { valid: true, role: "admin" }
GET  /api/health              → { status: "ok", hostname, uptime }
```

### System (requires auth)
```
GET /api/system/status      → { ip, cpu, memory, disk, uptime, services }
GET /api/system/info         → { kernel, software, timezone }
GET /api/system/processes    → { processes: [...] }
GET /api/system/disk         → { disks: [...] }
GET /api/system/network      → { connections: [...] }
```

### Domains
```
GET    /api/domains              → { domains: [...] }
GET    /api/domains/:domain      → { domain, username, php_version, ... }
POST   /api/domains              { domain: "..." }
DELETE /api/domains/:domain
POST   /api/domains/:domain/suspend
POST   /api/domains/:domain/unsuspend
POST   /api/domains/:domain/fix-permissions
```

### Databases
```
GET    /api/databases            → { databases: [...] }
GET    /api/databases/:name/info → { name, tables, size_mb }
POST   /api/databases            { name, user }  → { name, user, password }
DELETE /api/databases/:name
POST   /api/databases/:name/export → { file }
```

### Services
```
GET    /api/services             → { services: { nginx: "active", ... } }
POST   /api/services/:name/:action   (start|stop|restart|reload)
```

### SSL
```
GET    /api/ssl                  → { certificates }
POST   /api/ssl/install          { domain, provider }
POST   /api/ssl/renew
DELETE /api/ssl/:domain
```

### PHP
```
GET    /api/php/info             → { version, modules, pools }
POST   /api/php/version          { version }
POST   /api/php/restart
```

### Firewall
```
GET    /api/firewall/status      → { state, ports }
POST   /api/firewall/open        { port, protocol }
POST   /api/firewall/close       { port, protocol }
```

### Cache
```
GET    /api/cache/status         → { redis, memcached }
POST   /api/cache/redis/flush
POST   /api/cache/opcache/reset
POST   /api/cache/clear-all
```

### Backup
```
GET    /api/backup               → { backups: [...] }
POST   /api/backup/create        { domain, type }
DELETE /api/backup/:filename
```

### WebSocket
```
WS /ws?token=jwt_token
→ Every 5s: { type: "stats", data: { cpu, memory, disk, services }, ts }
```

## Security

1. **Agent protected by API key** - generated during install
2. **JWT tokens** - short-lived, rotatable
3. **Agent only on localhost/firewall** - expose through reverse proxy if needed
4. **No secrets stored on Dashboard** - only JWT tokens in localStorage
5. **HTTPS recommended** - especially for remote connections
