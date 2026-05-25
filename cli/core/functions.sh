#!/bin/bash
#
# MyVPS - Shared Functions Library
# Common utilities used across all modules
#

source "$(dirname "${BASH_SOURCE[0]}")/config.sh"
source "$(dirname "${BASH_SOURCE[0]}")/colors.sh"

# ============================================================
# System Information
# ============================================================

get_public_ip() {
    curl -s https://api.ipify.org 2>/dev/null || \
    curl -s https://ifconfig.me 2>/dev/null || \
    hostname -I | awk '{print $1}'
}

get_os_name() {
    if [[ -f /etc/os-release ]]; then
        source /etc/os-release
        echo "$ID"
    fi
}

get_os_version() {
    if [[ -f /etc/os-release ]]; then
        source /etc/os-release
        echo "$VERSION_ID"
    fi
}

get_cpu_usage() {
    grep 'cpu ' /proc/stat | awk '{usage=($2+$4)*100/($2+$4+$5)} END {printf "%.1f%%", usage}'
}

get_ram_total() {
    awk '/MemTotal/ {print $2}' /proc/meminfo
}

get_ram_available() {
    awk '/MemAvailable/ {print $2}' /proc/meminfo
}

get_swap_total() {
    awk '/SwapTotal/ {print $2}' /proc/meminfo
}

get_swap_free() {
    awk '/SwapFree/ {print $2}' /proc/meminfo
}

get_disk_info() {
    local disk=$(mount | grep ' / ' | cut -d' ' -f1)
    df -h "$disk" | tail -1 | awk '{print $2 "|" $3 "|" $4 "|" $5}'
}

human_readable() {
    local -i bytes=$1
    if [[ $bytes -lt 1024 ]]; then
        echo "${bytes}B"
    elif [[ $bytes -lt 1048576 ]]; then
        echo "$(( (bytes + 1023)/1024 ))MB"
    else
        echo "$(( (bytes + 1048575)/1048576 ))GB"
    fi
}

# ============================================================
# Service Management
# ============================================================

service_status() {
    local service="$1"
    local st
    st=$(systemctl is-active "$service" 2>/dev/null) || true
    echo "${st:-inactive}"
}

service_restart() {
    local service="$1"
    systemctl restart "$service" 2>/dev/null
    if [[ $? -eq 0 ]]; then
        print_success "$service restarted successfully"
    else
        print_error "Failed to restart $service"
    fi
}

service_start() {
    local service="$1"
    systemctl start "$service" 2>/dev/null
    systemctl enable "$service" 2>/dev/null
}

service_stop() {
    local service="$1"
    systemctl stop "$service" 2>/dev/null
}

# ============================================================
# Domain Helpers
# ============================================================

# Generate username from domain (strip special chars, max 32 chars)
get_username() {
    local domain="$1"
    echo "${domain//[-._]/}" | cut -c1-32
}

# Check if domain exists in config
domain_exists() {
    local domain="$1"
    [[ -f "$MYVPS_USER_DIR/.$domain.conf" ]]
}

# List all domains
list_domains() {
    if [[ -d "$MYVPS_USER_DIR" ]] && [[ "$(ls -A "$MYVPS_USER_DIR" 2>/dev/null)" ]]; then
        local i=1
        for entry in $(ls -A "$MYVPS_USER_DIR"); do
            local domain=$(echo "$entry" | sed 's/^\.//' | sed 's/\.conf$//')
            if [[ "$domain" == *"."* ]]; then
                echo "$i) $domain"
                i=$((i + 1))
            fi
        done
        echo "---"
        echo "Total: $((i - 1))"
    else
        echo "No domains found."
    fi
}

# Interactive domain chooser
choose_domain() {
    local domains=()
    if [[ -d "$MYVPS_USER_DIR" ]] && [[ "$(ls -A "$MYVPS_USER_DIR" 2>/dev/null)" ]]; then
        for entry in $(ls -A "$MYVPS_USER_DIR"); do
            local d=$(echo "$entry" | sed 's/^\.//' | sed 's/\.conf$//')
            if [[ "$d" == *"."* ]]; then
                domains+=("$d")
            fi
        done
    fi

    if [[ ${#domains[@]} -eq 0 ]]; then
        print_warning "No domains found on this server."
        return 1
    fi

    echo ""
    PS3=$'\n'"Select domain [0=Cancel]: "
    select domain in "${domains[@]}"; do
        if [[ -n "$domain" ]]; then
            SELECTED_DOMAIN="$domain"
            return 0
        else
            return 1
        fi
    done
}

# Check if domain is a subdomain
is_subdomain() {
    local domain="$1"
    local parts=($(echo "$domain" | tr '.' "\n"))
    if [[ ${#parts[@]} -ge 3 ]]; then
        echo "yes"
    else
        echo "no"
    fi
}

# Validate domain format
validate_domain() {
    local domain="$1"
    if [[ -z "$domain" ]]; then
        print_error "Domain cannot be empty."
        return 1
    fi
    if [[ "$domain" != *"."* ]]; then
        print_error "Invalid domain format: $domain"
        return 1
    fi
    if [[ "$domain" == www.* ]]; then
        print_error "Please enter root domain without www prefix."
        return 1
    fi
    return 0
}

# ============================================================
# Password Generation
# ============================================================

generate_password() {
    local length="${1:-32}"
    openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c "$length"
}

generate_password_simple() {
    local length="${1:-24}"
    openssl rand -base64 48 | tr -dc 'a-z0-9' | head -c "$length"
}

# ============================================================
# Nginx Helpers
# ============================================================

restart_nginx() {
    nginx -t 2>&1
    if [[ $? -eq 0 ]]; then
        systemctl restart nginx.service
        print_success "Nginx restarted"
    else
        print_error "Nginx config error. Run: nginx -t"
    fi
}

reload_nginx() {
    nginx -t 2>&1
    if [[ $? -eq 0 ]]; then
        systemctl reload nginx.service
    else
        print_error "Nginx config error. Run: nginx -t"
    fi
}

restart_php() {
    local php_ver=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;' 2>/dev/null || echo "8.1")
    if systemctl list-units --type=service | grep -q "php${php_ver}-fpm"; then
        systemctl restart "php${php_ver}-fpm.service"
    else
        systemctl restart php-fpm.service 2>/dev/null
    fi
    print_success "PHP-FPM restarted"
}

# Find next available PHP-FPM port
find_available_fpm_port() {
    local fpm_conf_dirs=("/etc/php-fpm.d" "/etc/php/*/fpm/pool.d")
    for (( n = $MYVPS_PHP_FPM_PORT_START; n <= $MYVPS_PHP_FPM_PORT_END; n++ )); do
        local found=false
        for dir in ${fpm_conf_dirs[@]}; do
            if grep -rnw "$dir" -e "$n" >> /dev/null 2>&1; then
                found=true
                break
            fi
        done
        if [[ "$found" == false ]]; then
            echo "$n"
            return 0
        fi
    done
    print_error "No available PHP-FPM ports (${MYVPS_PHP_FPM_PORT_START}-${MYVPS_PHP_FPM_PORT_END})"
    return 1
}

# ============================================================
# Firewall Helpers
# ============================================================

firewall_open_port() {
    local port="$1"
    local protocol="${2:-tcp}"
    firewall-cmd --permanent --zone=public --add-port="${port}/${protocol}" 2>/dev/null
    firewall-cmd --reload 2>/dev/null
}

firewall_close_port() {
    local port="$1"
    local protocol="${2:-tcp}"
    firewall-cmd --permanent --zone=public --remove-port="${port}/${protocol}" 2>/dev/null
    firewall-cmd --reload 2>/dev/null
}

# ============================================================
# Validation Helpers
# ============================================================

require_root() {
    if [[ "$EUID" -ne 0 ]]; then
        print_error "This command requires root privileges."
        echo "Run: sudo myvps"
        exit 1
    fi
}

check_services() {
    local nginx_status=$(service_status nginx)
    local php_ver=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;' 2>/dev/null || echo "8.1")
    local php_status=$(service_status "php${php_ver}-fpm")
    [[ "$php_status" != "active" ]] && php_status=$(service_status php-fpm)
    local mariadb_status=$(service_status mariadb)

    if [[ "$nginx_status" != "active" ]] || [[ "$php_status" != "active" ]] || [[ "$mariadb_status" != "active" ]]; then
        print_warning "Some services are not running:"
        echo "  Nginx:   $nginx_status"
        echo "  PHP-FPM: $php_status"
        echo "  MariaDB: $mariadb_status"
        return 1
    fi
    return 0
}

# ============================================================
# JSON Output (for Web UI API)
# ============================================================

json_status() {
    local php_ver=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;' 2>/dev/null || echo "8.1")
    local php_svc="php-fpm"
    systemctl is-active "php${php_ver}-fpm" &>/dev/null && php_svc="php${php_ver}-fpm"
    cat <<EOF
{
  "ip": "$(get_public_ip)",
  "cpu_usage": "$(get_cpu_usage)",
  "ram_total": $(get_ram_total),
  "ram_available": $(get_ram_available),
  "swap_total": $(get_swap_total),
  "swap_free": $(get_swap_free),
  "disk": "$(get_disk_info)",
  "services": {
    "nginx": "$(service_status nginx)",
    "php_fpm": "$(service_status $php_svc)",
    "mariadb": "$(service_status mariadb)",
    "redis": "$(service_status redis-server)",
    "memcached": "$(service_status memcached)",
    "fail2ban": "$(service_status fail2ban)"
  },
  "uptime": "$(uptime -p 2>/dev/null || uptime)",
  "os": "$(get_os_name) $(get_os_version)",
  "version": "$MYVPS_VERSION"
}
EOF
}

json_domains() {
    echo "["
    local first=true
    if [[ -d "$MYVPS_USER_DIR" ]]; then
        for entry in $(ls -A "$MYVPS_USER_DIR" 2>/dev/null); do
            local domain=$(echo "$entry" | sed 's/^\.//' | sed 's/\.conf$//')
            if [[ "$domain" == *"."* ]]; then
                source "$MYVPS_USER_DIR/$entry"
                if [[ "$first" != true ]]; then echo ","; fi
                cat <<EOF
  {
    "domain": "$domain",
    "username": "$username",
    "db_name": "${db_name:-}",
    "public_html": "/home/$username/$domain/public_html",
    "status": "${status:-active}",
    "php_version": "${php_version:-8.1}",
    "created_at": "${created_at:-}"
  }
EOF
                first=false
            fi
        done
    fi
    echo "]"
}
