#!/bin/bash
#
# MyVPS - Log Management Module
#

log_handler() {
    local action="$1"
    shift
    case "$action" in
        nginx)   log_nginx ;;
        php)     log_php ;;
        mariadb) log_mariadb ;;
        domain)  log_domain "$@" ;;
        clear)   log_clear_all ;;
        *) log_menu ;;
    esac
}

log_menu() {
    echo ""
    print_subheader "Log Management"
    echo ""

    local options=(
        "Nginx Error Log"
        "PHP-FPM Log"
        "MariaDB Log"
        "Domain Log"
        "Clear All Logs"
    )

    PS3=$'\n'"Select (1-${#options[@]}) [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "${options[0]}") log_nginx ;;
            "${options[1]}") log_php ;;
            "${options[2]}") log_mariadb ;;
            "${options[3]}") log_domain ;;
            "${options[4]}") log_clear_all ;;
            *) return ;;
        esac
    done
}

log_nginx() {
    echo ""
    print_subheader "Nginx Error Log (last 50 lines)"
    echo ""
    tail -50 /var/log/nginx/error.log 2>/dev/null
}

log_php() {
    echo ""
    print_subheader "PHP-FPM Log (last 50 lines)"
    echo ""
    local log_file=$(php -i 2>/dev/null | grep error_log | head -1 | awk '{print $NF}')
    if [[ -n "$log_file" ]] && [[ -f "$log_file" ]]; then
        tail -50 "$log_file"
    else
        tail -50 /var/log/php-fpm/error.log 2>/dev/null || echo "Log file not found."
    fi
}

log_mariadb() {
    echo ""
    print_subheader "MariaDB Log (last 50 lines)"
    echo ""
    tail -50 /var/log/mysql/error.log 2>/dev/null || \
    tail -50 /var/log/mariadb/mariadb.log 2>/dev/null || echo "Log file not found."
}

log_domain() {
    choose_domain || return
    local domain="$SELECTED_DOMAIN"
    local username=$(get_username "$domain")
    local log_dir="/home/$username/$domain/logs"

    echo ""
    print_subheader "Logs for $domain"
    echo ""

    local options=("Access Log" "Error Log" "PHP Error Log")
    PS3=$'\n'"Select [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "Access Log")   tail -50 "$log_dir/access.log" 2>/dev/null ;;
            "Error Log")    tail -50 "$log_dir/error.log" 2>/dev/null ;;
            "PHP Error Log") tail -50 "$log_dir/php-error.log" 2>/dev/null ;;
            *) return ;;
        esac
    done
}

log_clear_all() {
    if confirm "Clear all log files?"; then
        > /var/log/nginx/error.log 2>/dev/null
        > /var/log/nginx/access.log 2>/dev/null
        for entry in $(ls -A "$MYVPS_USER_DIR" 2>/dev/null); do
            local domain=$(echo "$entry" | sed 's/^\.//' | sed 's/\.conf$//')
            local username=$(get_username "$domain")
            > "/home/$username/$domain/logs/access.log" 2>/dev/null
            > "/home/$username/$domain/logs/error.log" 2>/dev/null
            > "/home/$username/$domain/logs/php-error.log" 2>/dev/null
        done
        print_success "All logs cleared."
    fi
}
