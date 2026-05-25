#!/bin/bash
#
# MyVPS - Cache Management Module
# Manages: Redis, Memcached, OPcache
#

cache_handler() {
    local action="$1"
    shift
    case "$action" in
        redis)     cache_redis "$@" ;;
        memcached) cache_memcached "$@" ;;
        opcache)   cache_opcache "$@" ;;
        clear)     cache_clear_all ;;
        *)
            if [[ -n "$action" ]]; then
                print_error "Unknown cache action: $action"
            fi
            cache_menu
            ;;
    esac
}

cache_menu() {
    load_config
    echo ""
    print_subheader "Cache Management"
    echo ""
    echo "  Redis:     $(service_status redis)"
    echo "  Memcached: $(service_status memcached)"
    echo "  OPcache:   enabled"
    echo ""
    echo "  OPcache GUI:         http://${ip:-localhost}:${port_admin:-$MYVPS_PORT_ADMIN}/opcache"
    echo "  MemcachedAdmin:      http://${ip:-localhost}:${port_admin:-$MYVPS_PORT_ADMIN}/phpmemcachedadmin"
    echo ""

    local options=(
        "Redis Management"
        "Memcached Management"
        "OPcache Management"
        "Clear All Cache"
    )

    PS3=$'\n'"Select (1-${#options[@]}) [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "${options[0]}") cache_redis ;;
            "${options[1]}") cache_memcached ;;
            "${options[2]}") cache_opcache ;;
            "${options[3]}") cache_clear_all ;;
            *) return ;;
        esac
    done
}

cache_redis() {
    echo ""
    print_subheader "Redis Management"
    echo ""
    echo "  Status: $(service_status redis)"
    echo ""

    local options=("Start" "Stop" "Restart" "Status" "Flush All Data")
    PS3=$'\n'"Select [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "Start")   service_start redis ;;
            "Stop")    service_stop redis ;;
            "Restart") service_restart redis ;;
            "Status")  systemctl status redis 2>/dev/null ;;
            "Flush All Data")
                if confirm "Flush all Redis data?"; then
                    redis-cli FLUSHALL 2>/dev/null
                    print_success "Redis flushed."
                fi
                ;;
            *) return ;;
        esac
    done
}

cache_memcached() {
    echo ""
    print_subheader "Memcached Management"
    echo ""
    echo "  Status: $(service_status memcached)"
    echo ""

    local options=("Start" "Stop" "Restart" "Status" "Edit Config")
    PS3=$'\n'"Select [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "Start")   service_start memcached ;;
            "Stop")    service_stop memcached ;;
            "Restart") service_restart memcached ;;
            "Status")  systemctl status memcached 2>/dev/null ;;
            "Edit Config")
                ${EDITOR:-nano} /etc/sysconfig/memcached 2>/dev/null || \
                ${EDITOR:-nano} /etc/memcached.conf 2>/dev/null
                service_restart memcached
                ;;
            *) return ;;
        esac
    done
}

cache_opcache() {
    echo ""
    print_subheader "OPcache Management"
    echo ""

    local options=("View Config" "Edit Config" "Reset OPcache")
    PS3=$'\n'"Select [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "View Config")
                php -i 2>/dev/null | grep -i opcache
                ;;
            "Edit Config")
                local opcache_conf=$(php --ini 2>/dev/null | grep opcache | head -1 | awk '{print $NF}')
                if [[ -n "$opcache_conf" ]] && [[ -f "$opcache_conf" ]]; then
                    ${EDITOR:-nano} "$opcache_conf"
                    restart_php
                else
                    print_warning "OPcache config not found. Check /etc/php.d/"
                fi
                ;;
            "Reset OPcache")
                php -r "opcache_reset();" 2>/dev/null
                print_success "OPcache reset."
                ;;
            *) return ;;
        esac
    done
}

cache_clear_all() {
    print_info "Clearing all caches..."
    redis-cli FLUSHALL 2>/dev/null
    php -r "opcache_reset();" 2>/dev/null
    print_success "All caches cleared."
}
