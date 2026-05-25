#!/bin/bash
#
# MyVPS - Domain Management Module
#

domain_handler() {
    local action="$1"
    shift
    case "$action" in
        add|create) domain_add "$@" ;;
        list|ls)    domain_list ;;
        delete|rm)  domain_delete "$@" ;;
        suspend)    domain_suspend "$@" ;;
        unsuspend)  domain_unsuspend "$@" ;;
        info)       domain_info "$@" ;;
        change)     domain_change "$@" ;;
        subfolder)  domain_subfolder "$@" ;;
        permission) domain_permission "$@" ;;
        *)
            if [[ -n "$action" ]]; then
                print_error "Unknown domain action: $action"
            fi
            domain_menu
            ;;
    esac
}

domain_menu() {
    echo ""
    print_subheader "Domain Management"
    echo ""

    local options=(
        "List Domains"
        "Add Domain/SubDomain"
        "Delete Domain/SubDomain"
        "Domain Info"
        "Suspend/Unsuspend Domain"
        "Change Domain (A -> B)"
        "Restore Nginx Config"
        "Fix Permissions (Chown/Chmod)"
        "Setup SubFolder"
        "Setup IP-based Domain"
    )

    PS3=$'\n'"Select (1-${#options[@]}) [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "${options[0]}") domain_list ;;
            "${options[1]}") domain_add ;;
            "${options[2]}") domain_delete ;;
            "${options[3]}") domain_info ;;
            "${options[4]}") domain_suspend_menu ;;
            "${options[5]}") domain_change ;;
            "${options[6]}") domain_restore_nginx ;;
            "${options[7]}") domain_permission ;;
            "${options[8]}") domain_subfolder ;;
            "${options[9]}") domain_ip_setup ;;
            *) return ;;
        esac
    done
}

domain_list() {
    echo ""
    print_subheader "Domain List"
    echo ""
    list_domains
}

domain_add() {
    local domain="${1:-}"

    echo ""
    print_subheader "Add Domain"
    echo ""

    check_services || return 1

    if [[ -z "$domain" ]]; then
        read -p "Enter Domain/SubDomain [0=Cancel]: " domain
    fi

    [[ "$domain" == "0" ]] && return
    validate_domain "$domain" || return 1

    if domain_exists "$domain"; then
        print_error "Domain $domain already exists."
        return 1
    fi

    # Ask about applications
    local install_wp="n"
    local install_laravel="n"
    local create_db="n"
    local custom_prefix="n"

    read -p "Install WordPress for $domain? (y/n): " install_wp
    if [[ "$install_wp" == "y" ]]; then
        read -p "Use custom table prefix for security? (y/n): " custom_prefix
    else
        read -p "Install Laravel (latest) for $domain? (y/n): " install_laravel
    fi

    if [[ "$install_wp" != "y" ]] && [[ "$install_laravel" != "y" ]]; then
        read -p "Create database for $domain? (y/n): " create_db
    fi

    # Generate credentials
    local username=$(get_username "$domain")
    local password_sftp=$(generate_password 32)
    local password_auth=$(generate_password 24)
    local db_name="" db_user="" db_password=""

    if [[ "$install_wp" == "y" ]] || [[ "$install_laravel" == "y" ]] || [[ "$create_db" == "y" ]]; then
        db_name="${username}_db"
        db_user="${username}_user"
        db_password=$(generate_password 32)
    fi

    print_info "Creating domain $domain..."

    # 1. Create Linux user
    useradd "$username" 2>/dev/null
    echo "$username:$password_sftp" | chpasswd

    # 2. Create HTTP auth user
    if command -v htpasswd &>/dev/null; then
        htpasswd -b "$MYVPS_WEB_DIR/passwd/.htpasswd" "$username" "$password_auth" 2>/dev/null
    fi

    # 3. Create directory structure
    mkdir -p "/home/$username/$domain/public_html"
    mkdir -p "/home/$username/$domain/logs"
    mkdir -p "/home/$username/$domain/tmp"
    mkdir -p "/home/$username/$domain/ssl"
    mkdir -p "/home/$username/$domain/session"
    mkdir -p "/home/$username/$domain/restore"

    # 4. Set permissions
    chmod 755 "/home/$username"
    chmod 755 "/home/$username/$domain/public_html"
    chmod 700 "/home/$username/$domain/logs"
    chmod 700 "/home/$username/$domain/tmp"
    chmod 700 "/home/$username/$domain/ssl"
    chmod 700 "/home/$username/$domain/session"
    chmod 700 "/home/$username/$domain/restore"

    chown root:root "/home/$username"
    chown -R "$username:$username" "/home/$username/$domain/"
    chmod g+s "/home/$username/$domain/public_html"

    # 5. Add to SFTP group
    usermod -G sftp_users "$username" 2>/dev/null

    # 6. Create default index
    cat > "/home/$username/$domain/public_html/index.html" <<EOF
<!DOCTYPE html>
<html>
<head><title>$domain</title></head>
<body>
<h1>Welcome to $domain</h1>
<p>MyVPS has been configured successfully.</p>
</body>
</html>
EOF
    chown "$username:$username" "/home/$username/$domain/public_html/index.html"

    # 7. SELinux context (if available)
    if command -v chcon &>/dev/null; then
        chcon -R -t httpd_sys_content_t "/home/$username/$domain/public_html" 2>/dev/null
        chcon -R -t httpd_sys_rw_content_t "/home/$username/$domain/public_html" 2>/dev/null
    fi

    # 8. Find available PHP-FPM port
    local fpm_port=$(find_available_fpm_port)
    if [[ -z "$fpm_port" ]]; then
        print_error "Cannot find available PHP-FPM port"
        return 1
    fi

    # 9. Create PHP-FPM pool
    _create_phpfpm_pool "$domain" "$username" "$fpm_port"

    # 10. Create Nginx vhost
    _create_nginx_vhost "$domain" "$username" "$fpm_port"

    # 11. Create database if needed
    if [[ -n "$db_name" ]]; then
        load_config
        mysql -u "$db_admin_user" -p"$db_admin_password" -e "CREATE DATABASE IF NOT EXISTS \`$db_name\`" 2>/dev/null
        mysql -u "$db_admin_user" -p"$db_admin_password" -e "CREATE USER IF NOT EXISTS '$db_user'@'localhost' IDENTIFIED BY '$db_password'" 2>/dev/null
        mysql -u "$db_admin_user" -p"$db_admin_password" -e "GRANT ALL PRIVILEGES ON \`$db_name\`.* TO '$db_user'@'localhost'" 2>/dev/null
        mysql -u "$db_admin_user" -p"$db_admin_password" -e "FLUSH PRIVILEGES" 2>/dev/null
        print_success "Database $db_name created"
    fi

    # 12. Install WordPress if requested
    if [[ "$install_wp" == "y" ]]; then
        local prefix="wp"
        if [[ "$custom_prefix" == "y" ]]; then
            prefix=$(openssl rand -hex 3)
        fi
        _install_wordpress "$domain" "$username" "$db_name" "$db_user" "$db_password" "$prefix"
    fi

    # 13. Install Laravel if requested
    if [[ "$install_laravel" == "y" ]]; then
        _install_laravel "$domain" "$username" "$db_name" "$db_user" "$db_password"
    fi

    # 14. Save domain config
    save_domain_config "$domain" "$username" "$password_auth" "$password_sftp" "$db_name" "$db_user" "$db_password"

    # 15. Restart services
    restart_nginx
    restart_php

    # Show results
    echo ""
    print_success "Domain $domain created successfully!"
    print_line
    echo ""
    echo "  Domain:        $domain"
    echo ""
    echo "  SFTP Access:"
    echo "    Host:        ${ip:-$(get_public_ip)}"
    echo "    Port:        ${port_ssh:-22}"
    echo "    Username:    $username"
    echo "    Password:    $password_sftp"
    echo "    Path:        /$domain/public_html"
    echo ""
    echo "  HTTP Auth:"
    echo "    URL:         http://${ip:-$(get_public_ip)}:${port_admin:-$MYVPS_PORT_ADMIN}"
    echo "    Username:    $username"
    echo "    Password:    $password_auth"
    echo ""
    if [[ -n "$db_name" ]]; then
        echo "  Database:"
        echo "    DB Name:     $db_name"
        echo "    DB User:     $db_user"
        echo "    DB Password: $db_password"
        echo ""
    fi
    print_line
}

domain_delete() {
    local domain="${1:-}"

    echo ""
    print_subheader "Delete Domain"
    echo ""

    if [[ -z "$domain" ]]; then
        choose_domain || return
        domain="$SELECTED_DOMAIN"
    fi

    if ! domain_exists "$domain"; then
        print_error "Domain $domain not found."
        return 1
    fi

    local username=$(get_username "$domain")

    if ! confirm "Delete domain $domain and ALL its data?"; then
        return
    fi

    print_info "Deleting domain $domain..."

    # Remove Nginx config
    rm -f "/etc/nginx/conf.d/$domain.conf"

    # Remove PHP-FPM pool
    rm -f "/etc/php-fpm.d/$domain.conf"

    # Remove home directory
    rm -rf "/home/$username"

    # Remove database
    load_config
    if load_domain_config "$domain"; then
        if [[ -n "$db_name" ]]; then
            mysql -u "$db_admin_user" -p"$db_admin_password" -e "DROP DATABASE IF EXISTS \`$db_name\`" 2>/dev/null
            mysql -u "$db_admin_user" -p"$db_admin_password" -e "DROP USER IF EXISTS '$db_user'@'localhost'" 2>/dev/null
        fi
    fi

    # Remove Linux user
    userdel "$username" 2>/dev/null

    # Remove htpasswd entry
    if command -v htpasswd &>/dev/null; then
        htpasswd -D "$MYVPS_WEB_DIR/passwd/.htpasswd" "$username" 2>/dev/null
    fi

    # Remove domain config
    delete_domain_config "$domain"

    restart_nginx
    restart_php

    print_success "Domain $domain deleted."
}

domain_info() {
    local domain="${1:-}"

    if [[ -z "$domain" ]]; then
        choose_domain || return
        domain="$SELECTED_DOMAIN"
    fi

    if ! domain_exists "$domain"; then
        print_error "Domain $domain not found."
        return 1
    fi

    load_domain_config "$domain"

    echo ""
    print_subheader "Domain Info: $domain"
    echo ""
    print_status_line "Domain" "$domain"
    print_status_line "Username" "$username"
    print_status_line "Public HTML" "/home/$username/$domain/public_html"
    print_status_line "PHP Version" "${php_version:-8.1}"
    print_status_line "Status" "${status:-active}"
    print_status_line "Created" "${created_at:-N/A}"
    if [[ -n "$db_name" ]]; then
        print_status_line "DB Name" "$db_name"
        print_status_line "DB User" "$db_user"
    fi
    echo ""
}

domain_suspend_menu() {
    echo ""
    local options=("Suspend Domain" "Unsuspend Domain")
    PS3=$'\n'"Select [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "${options[0]}") domain_suspend ;;
            "${options[1]}") domain_unsuspend ;;
            *) return ;;
        esac
    done
}

domain_suspend() {
    local domain="${1:-}"
    if [[ -z "$domain" ]]; then
        choose_domain || return
        domain="$SELECTED_DOMAIN"
    fi

    if ! domain_exists "$domain"; then
        print_error "Domain $domain not found."
        return 1
    fi

    # Rename nginx config to disable
    if [[ -f "/etc/nginx/conf.d/$domain.conf" ]]; then
        mv "/etc/nginx/conf.d/$domain.conf" "/etc/nginx/conf.d/$domain.conf.suspended"
        set_config "status" "suspended" "$MYVPS_USER_DIR/.$domain.conf"
        reload_nginx
        print_success "Domain $domain suspended."
    fi
}

domain_unsuspend() {
    local domain="${1:-}"
    if [[ -z "$domain" ]]; then
        choose_domain || return
        domain="$SELECTED_DOMAIN"
    fi

    if [[ -f "/etc/nginx/conf.d/$domain.conf.suspended" ]]; then
        mv "/etc/nginx/conf.d/$domain.conf.suspended" "/etc/nginx/conf.d/$domain.conf"
        set_config "status" "active" "$MYVPS_USER_DIR/.$domain.conf"
        reload_nginx
        print_success "Domain $domain unsuspended."
    fi
}

domain_restore_nginx() {
    local domain="${1:-}"
    if [[ -z "$domain" ]]; then
        choose_domain || return
        domain="$SELECTED_DOMAIN"
    fi

    local username=$(get_username "$domain")
    local fpm_port=$(find_available_fpm_port)
    _create_nginx_vhost "$domain" "$username" "$fpm_port"
    reload_nginx
    print_success "Nginx config restored for $domain"
}

domain_permission() {
    local domain="${1:-}"
    if [[ -z "$domain" ]]; then
        choose_domain || return
        domain="$SELECTED_DOMAIN"
    fi

    local username=$(get_username "$domain")
    chown -R "$username:$username" "/home/$username/$domain/"
    chmod 755 "/home/$username/$domain/public_html"
    print_success "Permissions fixed for $domain"
}

domain_change() {
    echo ""
    print_subheader "Change Domain"
    echo ""
    choose_domain || return
    local old_domain="$SELECTED_DOMAIN"
    read -p "Enter new domain: " new_domain
    validate_domain "$new_domain" || return 1

    print_info "Changing $old_domain -> $new_domain"
    # This is complex - would need to rename configs, directories, DB entries etc.
    print_warning "This feature requires manual verification. Please backup first."
}

domain_subfolder() {
    print_info "SubFolder management - use Nginx config to set up subfolder routing."
}

domain_ip_setup() {
    print_info "IP-based domain setup - configure Nginx default server to serve a domain."
}

# ============================================================
# Internal helpers
# ============================================================

_create_phpfpm_pool() {
    local domain="$1"
    local username="$2"
    local port="$3"
    local php_ver=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;' 2>/dev/null || echo "8.1")

    local pool_dir="/etc/php-fpm.d"
    [[ -d "/etc/php/${php_ver}/fpm/pool.d" ]] && pool_dir="/etc/php/${php_ver}/fpm/pool.d"
    mkdir -p "$pool_dir"

    cat > "$pool_dir/$domain.conf" <<EOF
[$domain]
user = $username
group = $username
listen = 127.0.0.1:$port
listen.allowed_clients = 127.0.0.1
pm = dynamic
pm.max_children = 10
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 5
pm.max_requests = 500
pm.status_path = /fpm-status
request_terminate_timeout = 300s
request_slowlog_timeout = 10s
slowlog = /home/$username/$domain/logs/php-fpm-slow.log
php_admin_value[error_log] = /home/$username/$domain/logs/php-error.log
php_admin_flag[log_errors] = on
php_value[session.save_path] = /home/$username/$domain/session
php_value[upload_tmp_dir] = /home/$username/$domain/tmp
php_value[soap.wsdl_cache_dir] = /home/$username/$domain/tmp
security.limit_extensions = .php
EOF
}

_create_nginx_vhost() {
    local domain="$1"
    local username="$2"
    local port="$3"

    local nginx_dir="/etc/nginx/conf.d"
    if [[ -d "/etc/nginx/sites-available" ]]; then
        nginx_dir="/etc/nginx/sites-available"
    fi

    cat > "$nginx_dir/$domain.conf" <<EOF
server {
    listen 80;
    server_name $domain www.$domain;
    root /home/$username/$domain/public_html;

    index index.php index.html index.htm;

    access_log /home/$username/$domain/logs/access.log;
    error_log /home/$username/$domain/logs/error.log;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Static file caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        access_log off;
        add_header Cache-Control "public, immutable";
    }

    # Deny hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # PHP processing
    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \.php$ {
        try_files \$uri =404;
        fastcgi_intercept_errors on;
        fastcgi_index index.php;
        fastcgi_connect_timeout 300;
        fastcgi_send_timeout 300;
        fastcgi_read_timeout 300;
        fastcgi_buffer_size 256k;
        fastcgi_buffers 4 256k;
        fastcgi_busy_buffers_size 256k;
        fastcgi_temp_file_write_size 256k;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        fastcgi_pass 127.0.0.1:$port;
    }
}
EOF

    if [[ -d "/etc/nginx/sites-enabled" ]] && [[ "$nginx_dir" == *"sites-available"* ]]; then
        ln -sf "$nginx_dir/$domain.conf" "/etc/nginx/sites-enabled/$domain.conf"
    fi
}

_install_wordpress() {
    local domain="$1"
    local username="$2"
    local db_name="$3"
    local db_user="$4"
    local db_password="$5"
    local prefix="${6:-wp}"

    print_info "Installing WordPress for $domain..."

    cd /tmp
    curl -sO https://wordpress.org/latest.tar.gz
    tar -zxf latest.tar.gz
    cp -rf wordpress/* "/home/$username/$domain/public_html/"
    rm -rf wordpress latest.tar.gz

    # Generate salts
    local SALT=$(curl -sL https://api.wordpress.org/secret-key/1.1/salt/)

    cat > "/home/$username/$domain/public_html/wp-config.php" <<EOF
<?php
define('DISALLOW_FILE_EDIT', true);
define('WP_MEMORY_LIMIT', '256M');
define('WP_CACHE', true);
define('FS_METHOD', 'direct');
define('DB_NAME', '$db_name');
define('DB_USER', '$db_user');
define('DB_PASSWORD', '$db_password');
define('DB_HOST', 'localhost');
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', '');
define('DISABLE_WP_CRON', false);

$SALT

\$table_prefix = '${prefix}_';

define('WP_DEBUG', false);

if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__ . '/');
}
require_once ABSPATH . 'wp-settings.php';
EOF

    # Create robots.txt
    cat > "/home/$username/$domain/public_html/robots.txt" <<EOF
User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php

Sitemap: https://$domain/sitemap.xml
EOF

    # Set permissions
    chown -R "$username:$username" "/home/$username/$domain/public_html"
    chmod 0400 "/home/$username/$domain/public_html/wp-config.php"
    rm -f "/home/$username/$domain/public_html/readme.html"
    rm -f "/home/$username/$domain/public_html/license.txt"

    print_success "WordPress installed for $domain"
}

_install_laravel() {
    local domain="$1"
    local username="$2"
    local db_name="$3"
    local db_user="$4"
    local db_password="$5"

    print_info "Installing Laravel for $domain..."

    # Install composer if needed
    if [[ ! -f /usr/local/bin/composer ]]; then
        print_info "Installing Composer..."
        cd /tmp
        php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
        php -d memory_limit=-1 composer-setup.php
        mv composer.phar /usr/local/bin/composer
        rm -f composer-setup.php
    fi

    rm -rf "/home/$username/$domain/public_html/"*
    cd "/home/$username/$domain/public_html/"
    composer create-project --prefer-dist laravel/laravel ./

    # Configure .env
    sed -i "s/APP_ENV=local/APP_ENV=production/" .env
    sed -i "s/DB_DATABASE=laravel/DB_DATABASE=$db_name/" .env
    sed -i "s/DB_USERNAME=root/DB_USERNAME=$db_user/" .env
    sed -i "s/DB_PASSWORD=/DB_PASSWORD=$db_password/" .env

    # Point Nginx to /public
    sed -i "s|$domain/public_html;|$domain/public_html/public;|" "/etc/nginx/conf.d/$domain.conf"

    chown -R "$username:$username" "/home/$username/$domain/public_html"
    chmod -R a=r,u+w,a+X "/home/$username/$domain/public_html"

    print_success "Laravel installed for $domain"
}
