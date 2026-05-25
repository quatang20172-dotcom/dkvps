#!/bin/bash
#
# MyVPS - VPS Management Tool Installer
# Supports: AlmaLinux 8/9, RockyLinux 8/9, Ubuntu 20.04/22.04
#
# Usage: curl -sO https://yourdomain.com/install.sh && bash install.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'
BOLD='\033[1m'

MYVPS_VERSION="1.0.0"

echo -e "${CYAN}=========================================================================${NC}"
echo -e "${WHITE}${BOLD}          MyVPS v${MYVPS_VERSION} - VPS Management Tool Installer${NC}"
echo -e "${CYAN}=========================================================================${NC}"
echo ""

# ============================================================
# Pre-flight checks
# ============================================================

if [[ "$EUID" -ne 0 ]]; then
    echo -e "${RED}[ERROR]${NC} Please run as root: sudo bash install.sh"
    exit 1
fi

# Detect OS
if [[ -f /etc/os-release ]]; then
    source /etc/os-release
    OS_NAME="$ID"
    OS_VERSION="$VERSION_ID"
else
    echo -e "${RED}[ERROR]${NC} Cannot detect OS."
    exit 1
fi

echo -e "${GREEN}[OK]${NC} Detected: $OS_NAME $OS_VERSION"

# Supported OS check
case "$OS_NAME" in
    almalinux|rocky|centos) PKG_MANAGER="dnf" ;;
    ubuntu|debian) PKG_MANAGER="apt-get" ;;
    *)
        echo -e "${RED}[ERROR]${NC} Unsupported OS: $OS_NAME"
        echo "Supported: AlmaLinux 8/9, RockyLinux 8/9, Ubuntu 20.04/22.04"
        exit 1
        ;;
esac

# ============================================================
# Configuration
# ============================================================

read -p "Change SSH port? Enter new port or press Enter to keep 22: " PORT_SSH
PORT_SSH=${PORT_SSH:-22}

PORT_ADMIN=8080
DB_ROOT_PASSWORD=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 32)
ADMIN_PASSWORD=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 24)
IP=$(curl -s https://api.ipify.org 2>/dev/null || curl -s https://ifconfig.me)

echo ""
echo -e "${YELLOW}[INFO]${NC} SSH Port: $PORT_SSH"
echo -e "${YELLOW}[INFO]${NC} Admin Port: $PORT_ADMIN"
echo -e "${YELLOW}[INFO]${NC} IP: $IP"
echo ""
echo -e "${YELLOW}[INFO]${NC} Starting installation... This may take 5-10 minutes."
sleep 2

# ============================================================
# System Setup
# ============================================================

echo -e "${CYAN}[1/12]${NC} Setting timezone & updating system..."
timedatectl set-timezone Asia/Ho_Chi_Minh
export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8

if [[ "$PKG_MANAGER" == "dnf" ]]; then
    dnf -y install epel-release 2>/dev/null
    dnf -y update
    dnf -y install psmisc lsof bc gawk wget zip unzip nano git htop jq bind-utils \
        policycoreutils-python-utils httpd-tools expect
elif [[ "$PKG_MANAGER" == "apt-get" ]]; then
    apt-get update
    apt-get upgrade -y
    apt-get install -y wget zip unzip nano git htop jq dnsutils apache2-utils expect \
        software-properties-common curl gnupg2
fi

# ============================================================
# Firewall
# ============================================================

echo -e "${CYAN}[2/12]${NC} Configuring firewall..."
if [[ "$PKG_MANAGER" == "dnf" ]]; then
    systemctl start firewalld 2>/dev/null
    systemctl enable firewalld 2>/dev/null
    firewall-cmd --permanent --zone=public --add-service=http --add-service=https 2>/dev/null
    firewall-cmd --permanent --zone=public --add-port=$PORT_ADMIN/tcp 2>/dev/null
    if [[ "$PORT_SSH" != "22" ]]; then
        firewall-cmd --permanent --zone=public --add-port=$PORT_SSH/tcp 2>/dev/null
    fi
    firewall-cmd --reload 2>/dev/null
elif [[ "$PKG_MANAGER" == "apt-get" ]]; then
    apt-get install -y ufw 2>/dev/null
    ufw allow $PORT_SSH/tcp 2>/dev/null
    ufw allow 80/tcp 2>/dev/null
    ufw allow 443/tcp 2>/dev/null
    ufw allow $PORT_ADMIN/tcp 2>/dev/null
    echo "y" | ufw enable 2>/dev/null
fi

# SSH port change
if [[ "$PORT_SSH" != "22" ]]; then
    sed -i "s/^#*Port .*/Port $PORT_SSH/" /etc/ssh/sshd_config
    if command -v semanage &>/dev/null; then
        semanage port -a -t ssh_port_t -p tcp $PORT_SSH 2>/dev/null
    fi
    systemctl reload sshd 2>/dev/null
fi

# ============================================================
# Fail2Ban
# ============================================================

echo -e "${CYAN}[3/12]${NC} Installing Fail2Ban..."
if [[ "$PKG_MANAGER" == "dnf" ]]; then
    dnf install -y fail2ban fail2ban-systemd 2>/dev/null
else
    apt-get install -y fail2ban 2>/dev/null
fi

cat > "/etc/fail2ban/jail.d/sshd.local" <<EOF
[sshd]
enabled = true
port = $PORT_SSH
logpath = %(sshd_log)s
maxretry = 5
bantime = 3600
EOF

systemctl enable fail2ban 2>/dev/null
systemctl start fail2ban 2>/dev/null

# ============================================================
# Nginx
# ============================================================

echo -e "${CYAN}[4/12]${NC} Installing Nginx..."
if [[ "$PKG_MANAGER" == "dnf" ]]; then
    cat > "/etc/yum.repos.d/nginx.repo" <<EOF
[nginx-stable]
name=nginx stable repo
baseurl=http://nginx.org/packages/centos/\$releasever/\$basearch/
gpgcheck=1
enabled=1
gpgkey=https://nginx.org/keys/nginx_signing.key
module_hotfixes=true
EOF
    dnf install -y nginx
else
    apt-get install -y nginx
fi

systemctl enable nginx
systemctl start nginx

# ============================================================
# PHP
# ============================================================

echo -e "${CYAN}[5/12]${NC} Installing PHP 8.1..."
if [[ "$PKG_MANAGER" == "dnf" ]]; then
    dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-${OS_VERSION%%.*}.noarch.rpm 2>/dev/null
    dnf install -y yum-utils http://rpms.remirepo.net/enterprise/remi-release-${OS_VERSION%%.*}.rpm 2>/dev/null
    dnf module reset php -y 2>/dev/null
    dnf module enable php:remi-8.1 -y 2>/dev/null
    dnf module install php:remi-8.1 -y --allowerasing 2>/dev/null
    dnf install -y php-opcache php-fpm php-dom php-xml php-curl php-gd php-mbstring \
        php-mysqlnd php-bcmath php-zip php-json php-pecl-redis5 php-pecl-memcached \
        php-pecl-memcache php-soap php-pecl-zip 2>/dev/null
else
    add-apt-repository -y ppa:ondrej/php 2>/dev/null
    apt-get update
    apt-get install -y php8.1 php8.1-fpm php8.1-cli php8.1-common php8.1-mysql \
        php8.1-curl php8.1-gd php8.1-mbstring php8.1-xml php8.1-zip php8.1-bcmath \
        php8.1-opcache php8.1-redis php8.1-memcached php8.1-soap 2>/dev/null
fi

# Hide PHP version
sed -i "s/expose_php = On/expose_php = Off/" /etc/php.ini 2>/dev/null

systemctl enable php-fpm 2>/dev/null || systemctl enable php8.1-fpm 2>/dev/null
systemctl start php-fpm 2>/dev/null || systemctl start php8.1-fpm 2>/dev/null

# ============================================================
# MariaDB
# ============================================================

echo -e "${CYAN}[6/12]${NC} Installing MariaDB..."
if [[ "$PKG_MANAGER" == "dnf" ]]; then
    cat > /etc/yum.repos.d/mariadb.repo <<EOF
[mariadb]
name = MariaDB
baseurl = https://yum.mariadb.org/10.11/centos${OS_VERSION%%.*}-amd64
module_hotfixes=1
gpgkey=https://yum.mariadb.org/RPM-GPG-KEY-MariaDB
gpgcheck=1
EOF
    dnf makecache -y 2>/dev/null
    dnf install -y MariaDB-server MariaDB-client 2>/dev/null
else
    apt-get install -y mariadb-server mariadb-client 2>/dev/null
fi

systemctl enable mariadb 2>/dev/null
systemctl start mariadb 2>/dev/null

# Secure MariaDB
mysql <<EOF
USE mysql;
FLUSH PRIVILEGES;
CREATE USER IF NOT EXISTS 'admin'@'localhost' IDENTIFIED BY '$DB_ROOT_PASSWORD';
GRANT ALL PRIVILEGES ON *.* TO 'admin'@'localhost' WITH GRANT OPTION;
FLUSH PRIVILEGES;
EOF

# ============================================================
# Cache (Memcached + Redis)
# ============================================================

echo -e "${CYAN}[7/12]${NC} Installing Redis & Memcached..."
if [[ "$PKG_MANAGER" == "dnf" ]]; then
    dnf -y install memcached redis 2>/dev/null
else
    apt-get install -y memcached redis-server 2>/dev/null
fi

systemctl enable redis 2>/dev/null
systemctl start redis 2>/dev/null
systemctl enable memcached 2>/dev/null
systemctl start memcached 2>/dev/null

# ============================================================
# MyVPS Directory Structure
# ============================================================

echo -e "${CYAN}[8/12]${NC} Setting up MyVPS..."
mkdir -p /etc/myvps/{user,cron/{backup,alert},nginx,ssl,backup/{db,source},menu}
mkdir -p /usr/share/nginx/myvps/{passwd,backup/{db,source}}
mkdir -p /var/log/myvps

touch /usr/share/nginx/myvps/passwd/.htpasswd
chmod 755 /usr/share/nginx/myvps/passwd/.htpasswd

# SFTP group
groupadd sftp_users 2>/dev/null

# SFTP config
if ! grep -q "Match Group sftp_users" /etc/ssh/sshd_config; then
    sed -i "/Subsystem/d" /etc/ssh/sshd_config
    cat >> "/etc/ssh/sshd_config" <<EOF
Subsystem sftp internal-sftp -u 022
Match Group sftp_users
 ChrootDirectory /home/%u
 ForceCommand internal-sftp
 AllowTcpForwarding no
 X11Forwarding no
EOF
    systemctl restart sshd 2>/dev/null
fi

# ============================================================
# Nginx Configuration
# ============================================================

echo -e "${CYAN}[9/12]${NC} Configuring Nginx..."
PROCESS=$(grep -c ^processor /proc/cpuinfo)
MAX_CLIENT=$((1024 * PROCESS * 2))

# Global config
cat > "/etc/myvps/nginx/global.conf" <<EOF
map \$http_accept \$webp_suffix {
    default "";
    "~*webp" ".webp";
}
EOF

# Fix PHP-FPM user
if [[ "$PKG_MANAGER" == "dnf" ]]; then
    sed -i "s/user = apache/user = nginx/" /etc/php-fpm.d/www.conf 2>/dev/null
    sed -i "s/group = apache/group = nginx/" /etc/php-fpm.d/www.conf 2>/dev/null
fi

# Nginx main config
cat > "/etc/nginx/nginx.conf" <<EOF
user nginx;
worker_processes $PROCESS;
worker_rlimit_nofile 260000;
error_log /var/log/nginx/error.log;
pid /var/run/nginx.pid;

events {
    worker_connections $MAX_CLIENT;
    use epoll;
    multi_accept on;
}

http {
    log_format main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                    '\$status \$body_bytes_sent "\$http_referer" '
                    '"\$http_user_agent"';

    access_log off;

    add_header X-Frame-Options SAMEORIGIN;
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options nosniff;

    fastcgi_hide_header X-Powered-By;
    proxy_hide_header X-Powered-By;
    server_tokens off;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay off;
    types_hash_max_size 2048;
    server_names_hash_bucket_size 128;
    client_max_body_size 256m;
    client_body_buffer_size 256k;
    keepalive_timeout 15;
    send_timeout 300s;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 2;
    gzip_min_length 256;
    gzip_types text/css text/javascript text/xml text/plain
               application/javascript application/json application/xml
               application/rss+xml image/svg+xml font/truetype font/opentype;

    include /etc/myvps/nginx/global.conf;
    include /etc/nginx/conf.d/*.conf;
}
EOF

# SSL self-signed cert
mkdir -p /etc/nginx/ssl
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/nginx.key \
    -out /etc/nginx/ssl/nginx.crt \
    -subj "/C=VN/ST=MyVPS/L=MyVPS/O=MyVPS/CN=localhost" 2>/dev/null

openssl dhparam -out /etc/nginx/ssl/dhparam.pem 2048 2>/dev/null

# Default server config
cat > "/etc/nginx/conf.d/default.conf" <<EOF
server {
    listen 80 default_server;
    server_name _;
    return 404;
}

server {
    listen 443 ssl default_server;
    server_name _;
    ssl_certificate /etc/nginx/ssl/nginx.crt;
    ssl_certificate_key /etc/nginx/ssl/nginx.key;
    return 404;
}
EOF

# Admin panel config
cat > "/etc/nginx/conf.d/admin.conf" <<EOF
server {
    listen $PORT_ADMIN;
    server_name myvps;
    root /usr/share/nginx/myvps;

    auth_basic "MyVPS Admin";
    auth_basic_user_file /usr/share/nginx/myvps/passwd/.htpasswd;

    index index.php index.html;

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \.php$ {
        try_files \$uri =404;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        fastcgi_pass unix:/run/php-fpm/www.sock;
    }
}
EOF

# Admin htpasswd
htpasswd -bc /usr/share/nginx/myvps/passwd/.htpasswd admin "$ADMIN_PASSWORD" 2>/dev/null

# ============================================================
# phpMyAdmin
# ============================================================

echo -e "${CYAN}[10/12]${NC} Installing phpMyAdmin..."
PMA_VERSION="5.2.1"
cd /usr/share/nginx/myvps
wget -q "https://files.phpmyadmin.net/phpMyAdmin/$PMA_VERSION/phpMyAdmin-$PMA_VERSION-all-languages.zip"
unzip -q "phpMyAdmin-$PMA_VERSION-all-languages.zip"
mv "phpMyAdmin-$PMA_VERSION-all-languages" phpmyadmin
rm -f "phpMyAdmin-$PMA_VERSION-all-languages.zip"
cp phpmyadmin/config.sample.inc.php phpmyadmin/config.inc.php
PMA_SECRET=$(openssl rand -base64 32)
echo "\$cfg['blowfish_secret'] = '$PMA_SECRET';" >> phpmyadmin/config.inc.php
echo "\$cfg['TempDir'] = '/var/lib/phpmyadmin/tmp';" >> phpmyadmin/config.inc.php
mkdir -p /var/lib/phpmyadmin/tmp
chmod 700 /var/lib/phpmyadmin/tmp
chown -R nginx:nginx /usr/share/nginx/myvps 2>/dev/null

# ============================================================
# Install MyVPS CLI
# ============================================================

echo -e "${CYAN}[11/12]${NC} Installing MyVPS CLI..."

# Copy CLI scripts
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -d "$SCRIPT_DIR/cli" ]]; then
    cp -r "$SCRIPT_DIR/cli/"* /etc/myvps/menu/
    cp "$SCRIPT_DIR/cli/myvps" /usr/bin/myvps
    chmod +x /usr/bin/myvps
    find /etc/myvps/menu -type f -exec chmod +x {} \;
fi

# WP-CLI
curl -sO https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
chmod +x wp-cli.phar
mv wp-cli.phar /usr/local/bin/wp

# rclone
curl -s https://rclone.org/install.sh | bash 2>/dev/null

# ============================================================
# Save Configuration
# ============================================================

echo -e "${CYAN}[12/12]${NC} Saving configuration..."

cat > "/etc/myvps/.myvps.conf" <<EOF
ip=$IP
version=$MYVPS_VERSION
port_ssh=$PORT_SSH
port_admin=$PORT_ADMIN
db_admin_user=admin
db_admin_password=$DB_ROOT_PASSWORD
admin_password=$ADMIN_PASSWORD
timezone=Asia/Ho_Chi_Minh
php_default_version=8.1
EOF
chmod 600 /etc/myvps/.myvps.conf

# RAM-based tuning
RAM_TOTAL=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
if [[ "$RAM_TOTAL" -le 1048576 ]]; then
    INNODB_BUFFER="128M"
    PHP_MEMORY="128M"
elif [[ "$RAM_TOTAL" -le 2097152 ]]; then
    INNODB_BUFFER="256M"
    PHP_MEMORY="256M"
elif [[ "$RAM_TOTAL" -le 4194304 ]]; then
    INNODB_BUFFER="512M"
    PHP_MEMORY="256M"
else
    INNODB_BUFFER="1G"
    PHP_MEMORY="512M"
fi

# Swap (1GB)
if [[ ! -f /var/swap.1 ]]; then
    dd if=/dev/zero of=/var/swap.1 bs=1M count=1024 2>/dev/null
    chmod 600 /var/swap.1
    mkswap /var/swap.1
    swapon /var/swap.1
    echo "/var/swap.1 none swap defaults 0 0" >> /etc/fstab
    sysctl vm.swappiness=10
    echo "vm.swappiness=10" >> /etc/sysctl.conf
fi

# Setup cron
cat > /etc/myvps/cron/backup/daily <<'EOF'
#!/bin/bash
# Daily backup - customize as needed
EOF
chmod +x /etc/myvps/cron/backup/daily

(crontab -l 2>/dev/null; echo "0 2 * * * /etc/myvps/cron/backup/daily >> /dev/null 2>&1") | sort -u | crontab -

# Shortcuts
echo "alias myvps='/usr/bin/myvps'" >> /root/.bashrc
echo "alias 0='myvps'" >> /root/.bashrc

# Restart services
systemctl restart nginx php-fpm mariadb 2>/dev/null || \
systemctl restart nginx php8.1-fpm mariadb 2>/dev/null

# ============================================================
# Done!
# ============================================================

clear
echo -e "${CYAN}=========================================================================${NC}"
echo -e "${GREEN}${BOLD}              MyVPS v${MYVPS_VERSION} - Installation Complete!${NC}"
echo -e "${CYAN}=========================================================================${NC}"
echo ""
echo -e "  1. SSH:              ${WHITE}ssh -p $PORT_SSH root@$IP${NC}"
echo -e "  2. IP:               ${WHITE}$IP${NC}"
echo -e "  3. Version:          ${WHITE}$MYVPS_VERSION${NC}"
echo -e "  4. SSH Port:         ${WHITE}$PORT_SSH${NC}"
echo -e "  5. phpMyAdmin:       ${WHITE}http://$IP:$PORT_ADMIN/phpmyadmin${NC}"
echo -e "  6. DB Admin User:    ${WHITE}admin${NC}"
echo -e "  7. DB Admin Pass:    ${WHITE}$DB_ROOT_PASSWORD${NC}"
echo -e "  8. Admin Login:      ${WHITE}admin${NC}"
echo -e "  9. Admin Password:   ${WHITE}$ADMIN_PASSWORD${NC}"
echo ""
echo -e "${CYAN}------------------------------------------------------------------------${NC}"
echo -e "  Run ${WHITE}myvps${NC} to open management menu."
echo -e "  Documentation: ${WHITE}https://yourdomain.com/docs${NC}"
echo -e "${CYAN}------------------------------------------------------------------------${NC}"
echo ""

# Save install info
cat > "/etc/myvps/.info.conf" <<EOF
========================================================================
MyVPS v${MYVPS_VERSION} - Installation Info
========================================================================
SSH:              ssh -p $PORT_SSH root@$IP
IP:               $IP
SSH Port:         $PORT_SSH
phpMyAdmin:       http://$IP:$PORT_ADMIN/phpmyadmin
DB Admin User:    admin
DB Admin Pass:    $DB_ROOT_PASSWORD
Admin Login:      admin
Admin Password:   $ADMIN_PASSWORD
------------------------------------------------------------------------
EOF
chmod 600 /etc/myvps/.info.conf
