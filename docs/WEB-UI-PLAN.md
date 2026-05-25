# Web UI Plan - MyVPS Dashboard

## Mục tiêu
Xây dựng một Web Dashboard hiện đại kết nối với CLI tools để quản lý VPS qua giao diện trình duyệt.

## Kiến trúc

```
Browser → React SPA → Express API → CLI Scripts/System Commands → Linux Services
                    ↗ WebSocket (real-time monitoring)
```

## Phase 1: Core (MVP)
- [x] Login/Auth (JWT + cookie)
- [x] Dashboard (CPU, RAM, Disk, Services status)
- [x] Domain management (list, add, delete, suspend)
- [x] Database management (list, create, delete, export)
- [x] Service control (start/stop/restart)
- [x] Real-time monitoring via WebSocket
- [x] Audit log

## Phase 2: Full Features
- [ ] SSL management (install/renew/delete via Web)
- [ ] PHP version switching
- [ ] Nginx config editor (Monaco editor)
- [ ] File manager (browse domain files)
- [ ] WordPress 1-click install + management
- [ ] Backup scheduler with UI
- [ ] Firewall rules management
- [ ] Cache management dashboard

## Phase 3: Advanced
- [ ] Multi-server management (connect to multiple VPS)
- [ ] SSH terminal in browser (xterm.js)
- [ ] DNS management integration
- [ ] Email notifications
- [ ] Mobile responsive improvements
- [ ] Dark mode toggle
- [ ] 2FA authentication
- [ ] API key management
- [ ] User roles (admin, viewer)
- [ ] Cloudflare integration

## Phase 4: Premium Features
- [ ] Auto-scaling recommendations
- [ ] Performance analytics
- [ ] Security audit reports
- [ ] Auto backup to cloud (S3, Google Drive)
- [ ] WordPress staging environments
- [ ] Team collaboration
- [ ] White-label support

## Tech Choices

### Tại sao Node.js (không phải Go/Rust)?
- Dễ học, cùng ecosystem JavaScript với frontend
- Đủ nhanh cho VPS management API (không phải high-throughput service)
- Có thể migrate sang Go sau nếu cần performance

### Tại sao React + Tailwind?
- React: Ecosystem lớn nhất, nhiều tài liệu
- Tailwind: Rapid development, consistent design
- Vite: Build nhanh, HMR tốt

### Tại sao SQLite?
- Không cần external database server
- Đơn giản, file-based, dễ backup
- Đủ cho single-server management

### Tại sao WebSocket?
- Real-time monitoring (CPU, RAM, Disk)
- Live log streaming
- Instant service status updates

## API Security
1. JWT tokens trong HTTP-only cookies
2. CSRF protection via SameSite cookie
3. Rate limiting (20 login/15min, 120 api/min)
4. Helmet security headers
5. Input validation trên mọi endpoint
6. Audit log cho mọi action
7. API chỉ chạy trên localhost hoặc behind Nginx reverse proxy

## Deployment
1. Frontend được build thành static files
2. Nginx serve static files + proxy API requests to Node.js
3. Node.js server chạy via systemd/PM2
4. SSL certificate cho admin domain
5. Admin port riêng biệt (8080)

## Cách CLI và Web UI kết nối
- Web API gọi CLI commands qua `child_process.exec()`
- Config files chia sẻ giữa CLI và Web (`/etc/myvps/`)
- Domain configs đọc/ghi cùng format
- System commands (systemctl, mysql, nginx, etc.) gọi trực tiếp
- CLI output parse thành JSON cho API responses

## Monitoring Flow
```
1. Client connects WebSocket
2. Server starts 5-second interval timer
3. Each tick: read /proc/stat, /proc/meminfo, df, systemctl
4. Package as JSON, broadcast to all connected clients
5. Client updates React state, re-renders gauges/charts
```
