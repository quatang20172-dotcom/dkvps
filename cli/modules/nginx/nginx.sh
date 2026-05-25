#!/bin/bash
#
# MyVPS - Nginx Management Module
#

nginx_handler() {
    local action="$1"
    shift
    case "$action" in
        config)     nginx_edit_config ;;
        domain)     nginx_domain_config "$@" ;;
        restart|-r) restart_nginx ;;
        reload)     reload_nginx ;;
        test|-t)    nginx -t ;;
        log-on)     nginx_access_log_on "$@" ;;
        log-off)    nginx_access_log_off "$@" ;;
        deny)       nginx_deny_ip "$@" ;;
        *)
            if [[ -n "$action" ]]; then
                print_error "Unknown nginx action: $action"
            fi
            nginx_menu
            ;;
    esac
}

nginx_menu() {
    echo ""
    print_subheader "Nginx Management"
    echo ""
    echo "  Status: $(service_status nginx)"
    echo "  Version: $(nginx -v 2>&1 | cut -d'/' -f2)"
    echo ""

    local options=(
        "Edit nginx.conf"
        "Edit Domain Config"
        "Test Config"
        "Restart Nginx"
        "Reload Nginx"
        "Enable Access Log"
        "Disable Access Log"
        "Block IP Address"
        "Anti Referrer Spam"
    )

    PS3=$'\n'"Select (1-${#options[@]}) [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "${options[0]}") nginx_edit_config ;;
            "${options[1]}") nginx_domain_config ;;
            "${options[2]}") nginx -t ;;
            "${options[3]}") restart_nginx ;;
            "${options[4]}") reload_nginx ;;
            "${options[5]}") nginx_access_log_on ;;
            "${options[6]}") nginx_access_log_off ;;
            "${options[7]}") nginx_deny_ip ;;
            "${options[8]}") nginx_referrer_spam ;;
            *) return ;;
        esac
    done
}

nginx_edit_config() {
    ${EDITOR:-nano} /etc/nginx/nginx.conf
    nginx -t && print_success "Config valid" || print_error "Config has errors"
}

nginx_domain_config() {
    local domain="${1:-}"

    if [[ -z "$domain" ]]; then
        choose_domain || return
        domain="$SELECTED_DOMAIN"
    fi

    local conf="/etc/nginx/conf.d/$domain.conf"
    if [[ -f "$conf" ]]; then
        ${EDITOR:-nano} "$conf"
        nginx -t && reload_nginx
    else
        print_error "Nginx config not found: $conf"
    fi
}

nginx_access_log_on() {
    local domain="${1:-}"
    if [[ -z "$domain" ]]; then
        choose_domain || return
        domain="$SELECTED_DOMAIN"
    fi

    local conf="/etc/nginx/conf.d/$domain.conf"
    sed -i 's/access_log off;/access_log \/home\/'"$(get_username $domain)"'\/'$domain'\/logs\/access.log;/' "$conf"
    reload_nginx
    print_success "Access log enabled for $domain"
}

nginx_access_log_off() {
    local domain="${1:-}"
    if [[ -z "$domain" ]]; then
        choose_domain || return
        domain="$SELECTED_DOMAIN"
    fi

    local conf="/etc/nginx/conf.d/$domain.conf"
    local username=$(get_username "$domain")
    sed -i "s|access_log /home/$username/$domain/logs/access.log;|access_log off;|" "$conf"
    reload_nginx
    print_success "Access log disabled for $domain"
}

nginx_deny_ip() {
    local ip="${1:-}"
    if [[ -z "$ip" ]]; then
        read -p "Enter IP to block: " ip
    fi

    choose_domain || return
    local domain="$SELECTED_DOMAIN"
    local conf="/etc/nginx/conf.d/$domain.conf"

    sed -i "/server_name/a\\    deny $ip;" "$conf"
    reload_nginx
    print_success "IP $ip blocked for $domain"
}

nginx_referrer_spam() {
    echo ""
    print_subheader "Anti Referrer Spam"
    echo ""

    local global_conf="$MYVPS_NGINX_DIR/global.conf"

    if ! grep -q "referer_spam" "$global_conf" 2>/dev/null; then
        cat >> "$global_conf" <<'EOF'

# Anti referrer spam
map $http_referer $bad_referer {
    default 0;
    ~*semalt\.com 1;
    ~*buttons-for-website\.com 1;
    ~*darodar\.com 1;
    ~*makemoneyonline 1;
    ~*blackhatworth 1;
}
EOF
        print_success "Referrer spam blocking added to global config."
        print_info "Add 'if (\$bad_referer) { return 403; }' to domain configs as needed."
    else
        print_info "Referrer spam blocking already configured."
    fi
}
