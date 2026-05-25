# Hướng dẫn sử dụng Dashboard

MyVPS Dashboard là giao diện web siêu nhẹ (~48KB) để quản lý VPS từ xa. Không cần cài đặt npm, không framework - pure HTML/CSS/JS.

## Đăng nhập

![Dashboard](screenshots/ui/dashboard.png)

1. Mở `http://VPS_IP:9090`
2. Nhập API Key → Click **Connect**
3. Dashboard hiển thị ngay với real-time data

---

## 1. Dashboard (Tổng quan)

![Dashboard](screenshots/ui/dashboard.png)

Trang chính hiển thị:
- **CPU/RAM/Disk** gauges - cập nhật real-time qua WebSocket
- **Domains** count - số domain đang quản lý
- **Services** - trạng thái nginx, php-fpm, mariadb, redis, memcached, sshd, fail2ban
- **Server Info** - IP, hostname, OS, uptime, CPU cores, version

---

## 2. Domains (Quản lý Domain)

![Domains](screenshots/ui/domains.png)

- **Danh sách domain** với user, PHP version, status
- **+ Add Domain** - thêm domain/subdomain mới
- **Suspend/Unsuspend** - tạm dừng/kích hoạt domain
- **Delete** - xóa domain

---

## 3. Databases (Quản lý Database)

![Databases](screenshots/ui/databases.png)

- **Danh sách database** MariaDB
- **Create Database** - tạo DB mới kèm user
- **Delete** - xóa database

---

## 4. Services (Quản lý Dịch vụ)

![Services](screenshots/ui/services.png)

- Xem trạng thái tất cả services
- **Start/Stop/Restart** từng service
- Services: nginx, php-fpm, mariadb, redis, memcached, fail2ban, sshd

---

## 5. SSL (Chứng chỉ SSL)

![SSL](screenshots/ui/ssl.png)

- Xem danh sách SSL certificates
- Cài SSL cho domain

---

## 6. PHP (Quản lý PHP)

![PHP](screenshots/ui/php.png)

- **PHP Info** - version, modules (50+)
- **Change Version** - đổi PHP version
- **Restart PHP-FPM**

---

## 7. Firewall

![Firewall](screenshots/ui/firewall.png)

- Xem trạng thái firewall
- **Open/Close Port**
- Danh sách ports đang mở

---

## 8. Cache

![Cache](screenshots/ui/cache.png)

- **Redis** - status, flush
- **Memcached** - status
- **OPcache** - reset
- **Clear All** - xóa tất cả cache

---

## 9. Backup

![Backup](screenshots/ui/backup.png)

- Danh sách backup files
- Backup domain (source + database)

---

## 10. Monitor (Giám sát)

![Monitor](screenshots/ui/monitor.png)

- System monitoring real-time
- CPU, RAM, Disk usage

---

## 11. File Manager (Quản lý File)

![File Manager](screenshots/ui/files.png)

- **Browse** thư mục trên VPS
- **Navigate** - nhập đường dẫn, click thư mục
- **New File / New Folder** - tạo file/thư mục mới
- **Edit** - click vào file để xem/sửa nội dung
- **Save** - lưu thay đổi
- **Delete** - xóa file/thư mục
- Hiển thị: tên, size, permissions, ngày sửa

---

## 12. Terminal (Web Terminal)

![Terminal](screenshots/ui/terminal.png)

- **Chạy command** trực tiếp trên VPS từ browser
- Nhập lệnh → Click **Run** hoặc Enter
- Hiển thị output giống terminal thật
- ⚠️ Commands chạy với quyền root - cẩn thận!

---

## 13. Proxy (Reverse Proxy)

![Proxy](screenshots/ui/proxy.png)

- **Create Proxy** - route domain đến backend app (Node.js, Python, etc.)
- Nhập domain + target URL (ví dụ: `http://127.0.0.1:3000`)
- Tự động tạo Nginx config
- Danh sách proxies + delete

---

## 14. Cron Jobs (Lịch trình)

![Cron Jobs](screenshots/ui/cron.png)

- **Add Cron Job** với presets: mỗi phút, mỗi giờ, hàng ngày, hàng tuần, hàng tháng
- Hoặc nhập custom schedule (cron expression)
- Danh sách jobs + delete

---

## 15. Auto Deploy (Webhook)

![Deploy](screenshots/ui/deploy.png)

- **Create Webhook** cho auto-deploy từ GitHub/GitLab
- Nhập: project name, directory, command (ví dụ: `git pull && npm run build`)
- Agent tạo webhook URL + token
- Copy URL → paste vào GitHub webhook settings
- Danh sách webhooks + delete

---

## 16. FTP Management

![FTP](screenshots/ui/ftp.png)

- **FTP Server Status** - vsftpd/pure-ftpd
- **Create FTP User** - username, password, home directory
- Danh sách FTP users + delete

---

## 17. Docker Manager

![Docker](screenshots/ui/docker.png)

- **Docker status** - installed, version, active/inactive
- **Containers** - danh sách containers, start/stop/restart/delete
- **Images** - danh sách images, delete

---

## 18. PM2 Manager

![PM2](screenshots/ui/pm2.png)

- **PM2 status** - installed/not installed
- **Add Application** - tên app, script/command, working directory
- Danh sách apps: status, CPU, memory, restarts
- Start/Stop/Restart/Delete apps

---

## 19. App Store (Kho ứng dụng)

![App Store](screenshots/ui/appstore.png)

Cài đặt 1-click cho 8 ứng dụng phổ biến:

| App | Loại | Mô tả |
|-----|------|-------|
| **WordPress** | CMS | Nền tảng blog/website phổ biến nhất |
| **phpMyAdmin** | Database | Quản lý MySQL/MariaDB qua web |
| **Tiny File Manager** | Tools | Quản lý file qua web (1 file PHP) |
| **Adminer** | Database | Quản lý DB nhẹ (1 file PHP) |
| **Laravel** | Framework | PHP web framework |
| **Node.js App** | Runtime | Express.js template |
| **Static HTML** | Web | HTML/CSS/JS starter |
| **Redis Commander** | Tools | Quản lý Redis qua web |

**Cách dùng**: Chọn domain → Click **Install**

---

## 20. SSH Key Management

![SSH Keys](screenshots/ui/sshkeys.png)

- **Add SSH Key** - paste public key (ssh-rsa hoặc ssh-ed25519)
- **SSH Config** - thay đổi:
  - SSH Port
  - Root Login (yes/no/key-only)
  - Password Authentication (yes/no)
- **Generate Key Pair** - tạo key mới (Ed25519 hoặc RSA 4096)
- **Danh sách keys** - type, comment, fingerprint + delete

---

## 21. Cloud Backup

![Cloud Backup](screenshots/ui/cloudbackup.png)

Backup lên cloud với 5 loại destination:

| Loại | Cấu hình |
|------|----------|
| **Amazon S3 / Wasabi** | Bucket, Region, Access Key, Secret Key |
| **Google Drive** | Client ID, Token (qua rclone authorize) |
| **pCloud** | Username/password hoặc token, US/EU region |
| **Remote Server (rsync)** | Host, Username, Path |
| **Rclone (Other)** | Bất kỳ remote nào rclone hỗ trợ |

**Cách backup Google Drive:**
1. Trên máy có browser: `rclone authorize "drive"`
2. Browser mở → đăng nhập Google → cho phép
3. Copy token JSON
4. Trong Dashboard: chọn Google Drive → paste token → Add Destination
5. Click **Backup Now**

**Run Backup:**
- Chọn destination + domain (hoặc full server)
- Chọn Files hoặc Database
- Click **Backup Now**

**Available Tools** hiển thị: AWS CLI, rclone, rsync (installed/not installed)

---

## 22. Server Migration (Di chuyển Server)

![Migration](screenshots/ui/migrate.png)

- **Export from VPS** - xuất config: domains, databases, nginx configs, PHP pools, crontab, packages
- **Import to VPS** - paste JSON config từ server cũ → tự động rebuild
- **Sync Files (rsync)** - đồng bộ files giữa 2 servers
- **Cross-server Migration** - khi có nhiều server: export từ A → import vào B trực tiếp

---

## 23. Servers (Multi-Server)

![Servers](screenshots/ui/servers.png)

Quản lý nhiều VPS cùng lúc:

- **Add Server** - nhập URL + API key
- **Server Cards** hiển thị:
  - Online/Offline status
  - Version
  - CPU / RAM / Disk usage
  - IP address
  - Active badge (server đang chọn)
- **Switch** - click vào server card để chuyển
- **Remove** - xóa server khỏi dashboard

---

## Sidebar Navigation

Dashboard có 23 trang trong sidebar, chia theo nhóm:

**Tổng quan:**
- Dashboard, Domains, Databases

**Services:**
- Services, SSL, PHP, Firewall, Cache, Backup, Monitor

**Tools:**
- File Manager, Terminal, Proxy, Cron Jobs, Deploy, FTP

**Applications:**
- Docker, PM2, App Store

**Server:**
- SSH Keys, Cloud Backup, Migration, Servers

---

## Keyboard Shortcuts

- Sidebar tự collapse trên mobile/tablet
- Tất cả trang auto-refresh khi navigate
- WebSocket cập nhật real-time (Dashboard + Monitor)

---

## Troubleshooting

### Dashboard không load data
- Kiểm tra Agent đang chạy: `curl http://VPS_IP:9090/api/health`
- Kiểm tra API key đúng
- Kiểm tra firewall mở port 9090

### WebSocket không kết nối
- Nếu dùng reverse proxy, cần cấu hình WebSocket upgrade (xem SETUP.md)
- Kiểm tra `ws://` hoặc `wss://` protocol

### Trang trắng
- Mở Developer Console (F12) xem lỗi
- Thử hard refresh: Ctrl+Shift+R
