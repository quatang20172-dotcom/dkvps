#!/bin/bash
#
# MyVPS - Configuration Management
# Handles reading/writing global and per-domain config
#

MYVPS_DIR="/etc/myvps"
MYVPS_CONF="$MYVPS_DIR/.myvps.conf"
MYVPS_USER_DIR="$MYVPS_DIR/user"
MYVPS_CRON_DIR="$MYVPS_DIR/cron"
MYVPS_NGINX_DIR="$MYVPS_DIR/nginx"
MYVPS_SSL_DIR="$MYVPS_DIR/ssl"
MYVPS_BACKUP_DIR="$MYVPS_DIR/backup"
MYVPS_LOG_DIR="/var/log/myvps"
MYVPS_WEB_DIR="/usr/share/nginx/myvps"
MYVPS_MENU_DIR="$MYVPS_DIR/menu"
MYVPS_VERSION="1.0.0"
MYVPS_PORT_ADMIN=8080
MYVPS_PHP_FPM_PORT_START=9001
MYVPS_PHP_FPM_PORT_END=9500
MYVPS_SCRIPT_URL="https://yourdomain.com/scripts"

# Load global config if exists
load_config() {
    if [[ -f "$MYVPS_CONF" ]]; then
        source "$MYVPS_CONF"
    fi
}

# Save global config
save_config() {
    local ip=$(get_public_ip)
    cat > "$MYVPS_CONF" <<EOF
# MyVPS Global Configuration
# Generated: $(date '+%Y-%m-%d %H:%M:%S')
ip=$ip
version=$MYVPS_VERSION
port_ssh=${port_ssh:-22}
port_admin=${port_admin:-$MYVPS_PORT_ADMIN}
db_admin_user=${db_admin_user:-admin}
db_admin_password=${db_admin_password}
admin_password=${admin_password}
timezone=${timezone:-Asia/Ho_Chi_Minh}
php_default_version=${php_default_version:-8.1}
telegram_api=${telegram_api:-}
telegram_user_id=${telegram_user_id:-}
alert_login_ssh=${alert_login_ssh:-0}
EOF
    chmod 600 "$MYVPS_CONF"
}

# Load domain config
load_domain_config() {
    local domain="$1"
    local conf_file="$MYVPS_USER_DIR/.$domain.conf"
    if [[ -f "$conf_file" ]]; then
        source "$conf_file"
        return 0
    fi
    return 1
}

# Save domain config
save_domain_config() {
    local domain="$1"
    local username="$2"
    local password_auth="$3"
    local password_sftp="$4"
    local db_name="$5"
    local db_user="$6"
    local db_password="$7"

    cat > "$MYVPS_USER_DIR/.$domain.conf" <<EOF
# Domain Configuration: $domain
# Created: $(date '+%Y-%m-%d %H:%M:%S')
username=$username
password=$password_auth
password_sftp=$password_sftp
domain=$domain
db_name=$db_name
db_user=$db_user
db_password=$db_password
public_html=/home/$username/$domain/public_html
php_version=${php_default_version:-8.1}
created_at='$(date '+%Y-%m-%d %H:%M:%S')'
status=active
EOF
    chmod 600 "$MYVPS_USER_DIR/.$domain.conf"
}

# Delete domain config
delete_domain_config() {
    local domain="$1"
    rm -f "$MYVPS_USER_DIR/.$domain.conf"
}

# List all domain configs
list_domain_configs() {
    if [[ -d "$MYVPS_USER_DIR" ]]; then
        ls -A "$MYVPS_USER_DIR" 2>/dev/null | sed 's/^\.//' | sed 's/\.conf$//'
    fi
}

# Get config value
get_config() {
    local key="$1"
    local file="${2:-$MYVPS_CONF}"
    if [[ -f "$file" ]]; then
        grep "^${key}=" "$file" 2>/dev/null | cut -d'=' -f2-
    fi
}

# Set config value
set_config() {
    local key="$1"
    local value="$2"
    local file="${3:-$MYVPS_CONF}"
    if grep -q "^${key}=" "$file" 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    else
        echo "${key}=${value}" >> "$file"
    fi
}

# Initialize directories
init_dirs() {
    mkdir -p "$MYVPS_DIR"
    mkdir -p "$MYVPS_USER_DIR"
    mkdir -p "$MYVPS_CRON_DIR"/{backup,alert}
    mkdir -p "$MYVPS_NGINX_DIR"
    mkdir -p "$MYVPS_SSL_DIR"
    mkdir -p "$MYVPS_BACKUP_DIR"/{db,source}
    mkdir -p "$MYVPS_LOG_DIR"
    mkdir -p "$MYVPS_WEB_DIR"/{passwd,backup/{db,source}}
    mkdir -p "$MYVPS_MENU_DIR"
}
