# Hướng dẫn Cài đặt MyVPS

## Yêu cầu hệ thống

- **OS**: Ubuntu 20.04/22.04 hoặc AlmaLinux/RockyLinux 8/9
- **RAM**: Tối thiểu 512MB (khuyến nghị 1GB+)
- **Node.js**: v16+ (cho Agent)
- **Quyền**: root

## Bước 1: Cài đặt LEMP Stack + CLI

```bash
# Tải và chạy installer
cd /root
git clone https://github.com/quatang20172-dotcom/dkvps.git myvps
cd myvps
bash install.sh
```

Installer sẽ tự động cài:
- Nginx (web server)
- PHP 8.1 (PHP-FPM)
- MariaDB 10.5 (database server)
- Redis + Memcached (cache)
- Fail2Ban (bảo mật)
- phpMyAdmin (quản lý DB)
- WP-CLI (quản lý WordPress)
- acme.sh (SSL certificates)
- CLI tool `myvps` tại `/usr/bin/myvps`

## Bước 2: Cài đặt Agent (API Server)

```bash
cd /root/myvps/agent
npm install
```

### Cấu hình Agent

File cấu hình: `/etc/myvps/.myvps.conf`

```ini
# API key để xác thực - thay đổi cho bảo mật!
agent_api_key=YOUR_RANDOM_API_KEY_HERE

# JWT secret
jwt_secret=YOUR_RANDOM_JWT_SECRET

# Port (mặc định 9090)
agent_port=9090
```

**Tạo API key ngẫu nhiên:**
```bash
# Tạo API key
openssl rand -base64 36

# Tạo JWT secret
openssl rand -hex 32
```

### Chạy Agent

```bash
# Chạy trực tiếp
cd /root/myvps/agent && node server.js

# Chạy với PM2 (khuyến nghị)
npm install -g pm2
pm2 start /root/myvps/agent/server.js --name myvps-agent
pm2 save
pm2 startup

# Chạy với systemd
sudo tee /etc/systemd/system/myvps-agent.service << 'EOF'
[Unit]
Description=MyVPS Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/myvps/agent
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=PORT=9090

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable myvps-agent
sudo systemctl start myvps-agent
```

### Verify Agent

```bash
# Kiểm tra health
curl http://localhost:9090/api/health

# Đăng nhập lấy token
curl -X POST http://localhost:9090/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"api_key":"YOUR_API_KEY"}'

# Kiểm tra system status
curl http://localhost:9090/api/system/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Bước 3: Truy cập Dashboard

### Cách 1: Qua Agent (khuyến nghị)

Mở trình duyệt, truy cập:
```
http://YOUR_VPS_IP:9090
```

### Cách 2: File HTML trực tiếp

```bash
# Mở file dashboard/index.html trên bất kỳ máy nào
# Không cần cài gì - zero dependencies
open dashboard/index.html
```

### Đăng nhập Dashboard

1. Mở `http://YOUR_VPS_IP:9090`
2. Nhập **Server URL**: `http://YOUR_VPS_IP:9090`
3. Nhập **API Key**: API key đã cấu hình ở Bước 2
4. Click **Connect**

## Bước 4: Mở Port Firewall

```bash
# UFW (Ubuntu)
ufw allow 9090/tcp

# firewalld (RHEL/AlmaLinux)
firewall-cmd --permanent --add-port=9090/tcp
firewall-cmd --reload
```

## Bước 5: Bảo mật (Khuyến nghị)

### SSL cho Agent (reverse proxy qua Nginx)

```nginx
# /etc/nginx/sites-available/panel.yourdomain.com
server {
    listen 443 ssl http2;
    server_name panel.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:9090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Giới hạn IP truy cập Agent

```bash
# Chỉ cho phép IP của bạn
ufw allow from YOUR_IP to any port 9090
ufw deny 9090
```

## Multi-Server Setup

Dashboard hỗ trợ quản lý nhiều VPS cùng lúc:

1. Cài Agent lên mỗi VPS (lặp lại Bước 1-4)
2. Mở Dashboard, click **"+ Add Server"** trong trang Servers
3. Nhập URL và API key của VPS mới
4. Dashboard hiển thị health status, CPU/RAM/Disk của tất cả servers

## Cấu trúc thư mục

```
myvps/
├── install.sh              # Auto-setup LEMP stack
├── cli/                    # CLI tool
│   ├── core/               # Core functions, config, colors
│   └── modules/            # 20+ management modules
│       ├── domain/         # Domain management
│       ├── database/       # Database (MariaDB)
│       ├── php/            # PHP management
│       ├── nginx/          # Nginx management
│       ├── ssl/            # SSL certificates
│       ├── ssh/            # SSH/SFTP
│       ├── firewall/       # Firewall
│       ├── cache/          # Redis, Memcached, OPcache
│       ├── backup/         # Backup & restore
│       ├── wordpress/      # WordPress management
│       ├── laravel/        # Laravel management
│       ├── monitor/        # System monitoring
│       ├── log/            # Log management
│       ├── crontab/        # Crontab management
│       ├── fail2ban/       # Fail2Ban
│       ├── swap/           # Swap management
│       └── ...
├── agent/                  # API server
│   ├── server.js           # Main entry point
│   ├── package.json        # 4 dependencies only
│   └── src/
│       ├── routes/         # 22 API route modules
│       └── utils/          # exec, config, WebSocket
├── dashboard/              # Web UI (~48KB)
│   ├── index.html          # Single HTML file
│   ├── css/style.css       # Styles
│   └── js/
│       ├── app.js          # Core app logic
│       ├── ui.js           # UI components, sidebar
│       └── pages.js        # 23 page renderers
└── docs/                   # Documentation
    ├── ARCHITECTURE.md
    ├── SETUP.md            # This file
    ├── UI-GUIDE.md         # Dashboard usage guide
    └── screenshots/
        ├── cli/            # CLI module screenshots
        └── ui/             # Dashboard screenshots
```

## Gỡ lỗi

### Agent không khởi động
```bash
# Kiểm tra log
journalctl -u myvps-agent -f
# hoặc
cat /tmp/agent.log

# Kiểm tra port đã bị chiếm chưa
ss -tlnp | grep 9090
```

### Không kết nối được Dashboard
```bash
# Kiểm tra Agent đang chạy
curl http://localhost:9090/api/health

# Kiểm tra firewall
ufw status
# hoặc
firewall-cmd --list-ports
```

### CORS errors
Agent đã cấu hình CORS cho phép tất cả origins. Nếu gặp lỗi, kiểm tra Nginx reverse proxy headers.
