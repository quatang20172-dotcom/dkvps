#!/bin/bash
#
# MyVPS - SSL Management Module
# Supports: Let's Encrypt (acme.sh), ZeroSSL, Custom/Paid SSL
#

ssl_handler() {
    local action="$1"
    shift
    case "$action" in
        install|create)  ssl_install "$@" ;;
        delete|rm)       ssl_delete "$@" ;;
        renew)           ssl_renew "$@" ;;
        list|ls)         ssl_list ;;
        redirect)        ssl_redirect "$@" ;;
        test)            ssl_test "$@" ;;
        setup-acme)      ssl_setup_acme ;;
        *)
            if [[ -n "$action" ]]; then
                print_error "Unknown SSL action: $action"
            fi
            ssl_menu
            ;;
    esac
}

ssl_menu() {
    echo ""
    print_subheader "SSL Management"
    echo ""

    local options=(
        "Install SSL (Let's Encrypt)"
        "Install SSL (ZeroSSL)"
        "Install Custom/Paid SSL"
        "Test SSL for Domain"
        "Renew SSL"
        "Enable HTTPS Redirect"
        "WWW Redirect (domain.com -> www.domain.com)"
        "Redirect Domain A -> B"
        "List SSL Certificates"
        "Delete SSL"
        "Setup/Reinstall acme.sh"
    )

    PS3=$'\n'"Select (1-${#options[@]}) [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "${options[0]}") ssl_install_letsencrypt ;;
            "${options[1]}") ssl_install_zerossl ;;
            "${options[2]}") ssl_install_custom ;;
            "${options[3]}") ssl_test ;;
            "${options[4]}") ssl_renew ;;
            "${options[5]}") ssl_redirect ;;
            "${options[6]}") ssl_www_redirect ;;
            "${options[7]}") ssl_301_redirect ;;
            "${options[8]}") ssl_list ;;
            "${options[9]}") ssl_delete ;;
            "${options[10]}") ssl_setup_acme ;;
            *) return ;;
        esac
    done
}

ssl_setup_acme() {
    if [[ -f "$HOME/.acme.sh/acme.sh" ]]; then
        print_info "acme.sh is already installed."
        read -p "Reinstall? (y/n): " confirm
        [[ "$confirm" != "y" ]] && return
    fi

    print_info "Installing acme.sh..."
    curl https://get.acme.sh | sh -s email="${ACME_EMAIL:-admin@$(hostname -f)}"
    source ~/.bashrc

    # Auto upgrade
    sed -i "/AUTO_UPGRADE=/d" "$HOME/.acme.sh/account.conf" 2>/dev/null
    echo 'AUTO_UPGRADE=1' >> "$HOME/.acme.sh/account.conf"

    # Generate DH params if needed
    if [[ ! -f /etc/nginx/ssl/dhparam.pem ]]; then
        mkdir -p /etc/nginx/ssl
        openssl dhparam -out /etc/nginx/ssl/dhparam.pem 2048
    fi

    _create_ssl_config
    print_success "acme.sh installed successfully."
}

ssl_test() {
    local domain="${1:-}"
    if [[ -z "$domain" ]]; then
        choose_domain || return
        domain="$SELECTED_DOMAIN"
    fi

    print_info "Testing SSL issuance for $domain..."
    "$HOME/.acme.sh/acme.sh" --issue --test -d "$domain" -w "/home/$(get_username $domain)/$domain/public_html" 2>&1
}

ssl_install_letsencrypt() {
    local domain="${1:-}"
    if [[ -z "$domain" ]]; then
        choose_domain || return
        domain="$SELECTED_DOMAIN"
    fi

    ssl_setup_acme 2>/dev/null

    local username=$(get_username "$domain")
    local webroot="/home/$username/$domain/public_html"
    local ssl_dir="/home/$username/$domain/ssl"

    print_info "Installing Let's Encrypt SSL for $domain..."

    "$HOME/.acme.sh/acme.sh" --issue -d "$domain" -d "www.$domain" -w "$webroot" \
        --key-file "$ssl_dir/$domain.key" \
        --cert-file "$ssl_dir/$domain.crt" \
        --fullchain-file "$ssl_dir/$domain.fullchain.crt" \
        --reloadcmd "systemctl reload nginx"

    if [[ $? -eq 0 ]]; then
        _apply_ssl_nginx "$domain" "$username" "$ssl_dir"
        print_success "SSL installed for $domain"
    else
        print_error "SSL installation failed. Make sure domain DNS points to this server."
    fi
}

ssl_install_zerossl() {
    local domain="${1:-}"
    if [[ -z "$domain" ]]; then
        choose_domain || return
        domain="$SELECTED_DOMAIN"
    fi

    ssl_setup_acme 2>/dev/null

    local username=$(get_username "$domain")
    local webroot="/home/$username/$domain/public_html"
    local ssl_dir="/home/$username/$domain/ssl"

    print_info "Installing ZeroSSL for $domain..."

    "$HOME/.acme.sh/acme.sh" --issue -d "$domain" -d "www.$domain" -w "$webroot" \
        --server zerossl \
        --key-file "$ssl_dir/$domain.key" \
        --cert-file "$ssl_dir/$domain.crt" \
        --fullchain-file "$ssl_dir/$domain.fullchain.crt" \
        --reloadcmd "systemctl reload nginx"

    if [[ $? -eq 0 ]]; then
        _apply_ssl_nginx "$domain" "$username" "$ssl_dir"
        print_success "ZeroSSL installed for $domain"
    else
        print_error "ZeroSSL installation failed."
    fi
}

ssl_install_custom() {
    echo ""
    print_subheader "Install Custom/Paid SSL"
    echo ""

    choose_domain || return
    local domain="$SELECTED_DOMAIN"
    local username=$(get_username "$domain")
    local ssl_dir="/home/$username/$domain/ssl"

    read -p "Path to certificate file (.crt): " cert_file
    read -p "Path to private key file (.key): " key_file
    read -p "Path to CA bundle file (optional): " ca_file

    if [[ ! -f "$cert_file" ]] || [[ ! -f "$key_file" ]]; then
        print_error "Certificate or key file not found."
        return 1
    fi

    cp "$cert_file" "$ssl_dir/$domain.crt"
    cp "$key_file" "$ssl_dir/$domain.key"
    if [[ -n "$ca_file" ]] && [[ -f "$ca_file" ]]; then
        cat "$cert_file" "$ca_file" > "$ssl_dir/$domain.fullchain.crt"
    else
        cp "$cert_file" "$ssl_dir/$domain.fullchain.crt"
    fi

    _apply_ssl_nginx "$domain" "$username" "$ssl_dir"
    print_success "Custom SSL installed for $domain"
}

ssl_install() {
    ssl_install_letsencrypt "$@"
}

ssl_renew() {
    local domain="${1:-}"
    if [[ -z "$domain" ]]; then
        print_info "Renewing all certificates..."
        "$HOME/.acme.sh/acme.sh" --renew-all 2>&1
    else
        print_info "Renewing SSL for $domain..."
        "$HOME/.acme.sh/acme.sh" --renew -d "$domain" 2>&1
    fi
}

ssl_redirect() {
    local domain="${1:-}"
    if [[ -z "$domain" ]]; then
        choose_domain || return
        domain="$SELECTED_DOMAIN"
    fi

    local conf="/etc/nginx/conf.d/$domain.conf"
    if grep -q "return 301 https" "$conf" 2>/dev/null; then
        print_info "HTTPS redirect already configured for $domain"
        return
    fi

    # Add redirect to HTTP block
    sed -i '/listen 80;/a\    return 301 https://$host$request_uri;' "$conf"
    reload_nginx
    print_success "HTTPS redirect enabled for $domain"
}

ssl_www_redirect() {
    choose_domain || return
    local domain="$SELECTED_DOMAIN"
    print_info "Configure in Nginx: redirect $domain -> www.$domain or vice versa"
}

ssl_301_redirect() {
    read -p "Source domain: " src_domain
    read -p "Destination domain: " dst_domain
    print_info "Configure 301 redirect: $src_domain -> $dst_domain"
}

ssl_list() {
    echo ""
    print_subheader "SSL Certificates"
    echo ""
    if [[ -f "$HOME/.acme.sh/acme.sh" ]]; then
        "$HOME/.acme.sh/acme.sh" --list 2>/dev/null
    else
        print_warning "acme.sh not installed."
    fi
}

ssl_delete() {
    local domain="${1:-}"
    if [[ -z "$domain" ]]; then
        choose_domain || return
        domain="$SELECTED_DOMAIN"
    fi

    if confirm "Delete SSL for $domain?"; then
        "$HOME/.acme.sh/acme.sh" --remove -d "$domain" 2>/dev/null
        print_success "SSL removed for $domain"
    fi
}

# Internal helpers
_create_ssl_config() {
    cat > "/etc/nginx/ssl_config.conf" <<'EOF'
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_ciphers "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384";
ssl_ecdh_curve secp384r1;
ssl_prefer_server_ciphers on;
ssl_session_tickets off;
ssl_protocols TLSv1.2 TLSv1.3;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;
ssl_dhparam /etc/nginx/ssl/dhparam.pem;
EOF
}

_apply_ssl_nginx() {
    local domain="$1"
    local username="$2"
    local ssl_dir="$3"
    local conf="/etc/nginx/conf.d/$domain.conf"

    # Check if SSL block already exists
    if grep -q "listen 443" "$conf" 2>/dev/null; then
        print_info "SSL block already exists in Nginx config."
        return
    fi

    # Append HTTPS server block
    cat >> "$conf" <<EOF

server {
    listen 443 ssl http2;
    server_name $domain www.$domain;
    root /home/$username/$domain/public_html;

    ssl_certificate $ssl_dir/$domain.fullchain.crt;
    ssl_certificate_key $ssl_dir/$domain.key;
    include /etc/nginx/ssl_config.conf;

    index index.php index.html index.htm;

    access_log /home/$username/$domain/logs/access.log;
    error_log /home/$username/$domain/logs/error.log;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        access_log off;
        add_header Cache-Control "public, immutable";
    }

    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

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
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        fastcgi_pass 127.0.0.1:$(grep 'listen' /etc/php-fpm.d/$domain.conf 2>/dev/null | head -1 | grep -oP '\d+$' || echo '9001');
    }
}
EOF

    reload_nginx
}
