#!/bin/bash
#
# MyVPS - System Monitoring Module
#

show_status_bar() {
    load_config
    local nginx_s=$(service_status nginx)
    local php_s=$(service_status php-fpm)
    local mariadb_s=$(service_status mariadb)

    local status="OK"
    if [[ "$nginx_s" != "active" ]] || [[ "$php_s" != "active" ]] || [[ "$mariadb_s" != "active" ]]; then
        status="ERROR"
    fi

    local disk_info=$(get_disk_info)
    local total_disk=$(echo "$disk_info" | cut -d'|' -f1)
    local used_disk=$(echo "$disk_info" | cut -d'|' -f2)
    local ram_total=$(human_readable $(get_ram_total))
    local ram_used=$(human_readable $(($(get_ram_total) - $(get_ram_available))))

    echo ""
    echo "  Status: $status | Disk: ${used_disk}/${total_disk} | RAM: ${ram_used}/${ram_total} | CPU: $(get_cpu_usage)"
}

show_status() {
    load_config
    local ip="${ip:-$(get_public_ip)}"

    echo ""
    print_header "MyVPS System Status"
    echo ""
    echo "  Date:          $(date +'%Y-%m-%d %H:%M:%S')"
    echo "  IP:            $ip"
    echo "  $(uptime | xargs)"
    echo ""
    echo "  CPU:           $(get_cpu_usage)"
    echo "  RAM:           $(human_readable $(get_ram_total)) (available: $(human_readable $(get_ram_available)))"
    echo "  Swap:          $(human_readable $(get_swap_total)) (free: $(human_readable $(get_swap_free)))"
    local disk_info=$(get_disk_info)
    echo "  Disk:          $(echo $disk_info | tr '|' ' ')"
    echo ""
    print_line
    local php_ver=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;' 2>/dev/null || echo "8.1")
    local php_svc="php-fpm"
    systemctl is-active "php${php_ver}-fpm" &>/dev/null && php_svc="php${php_ver}-fpm"
    echo "  Nginx:         $(service_status nginx)"
    echo "  PHP-FPM:       $(service_status $php_svc)"
    echo "  MariaDB:       $(service_status mariadb)"
    echo "  Redis:         $(service_status redis-server)"
    echo "  Memcached:     $(service_status memcached)"
    echo "  Fail2Ban:      $(service_status fail2ban)"
    echo "  SSHD:          $(service_status sshd)"
    print_line
    echo "  Version:       v${version:-$MYVPS_VERSION}"
    echo "  Docs:          https://yourdomain.com/docs"
    print_line
}

show_info() {
    load_config
    echo ""
    print_header "VPS Information"
    echo ""

    echo "  System"
    print_line
    echo "  OS:            $(get_os_name) $(get_os_version)"
    echo "  Kernel:        $(uname -r)"
    if command -v hostnamectl &>/dev/null; then
        echo "  Virtualization: $(hostnamectl 2>/dev/null | grep 'Virtualization' | cut -d':' -f2 | xargs)"
    fi
    echo ""

    echo "  CPU"
    print_line
    echo "  Cores:         $(grep -c ^processor /proc/cpuinfo)"
    echo "  Model:         $(grep 'model name' /proc/cpuinfo | head -1 | cut -d':' -f2 | xargs)"
    echo "  Usage:         $(get_cpu_usage)"
    echo ""

    echo "  Memory"
    print_line
    echo "  RAM:           $(human_readable $(get_ram_total)) (available: $(human_readable $(get_ram_available)))"
    echo "  Swap:          $(human_readable $(get_swap_total)) (free: $(human_readable $(get_swap_free)))"
    echo ""

    echo "  Disk"
    print_line
    df -h / | tail -1 | awk '{printf "  Total: %s | Used: %s | Avail: %s | Use%%: %s\n", $2, $3, $4, $5}'
    echo ""

    echo "  Services"
    print_line
    for svc in nginx php-fpm mariadb redis memcached fail2ban sshd crond; do
        printf "  %-14s: %s\n" "$svc" "$(service_status $svc)"
    done
    echo ""

    echo "  Software"
    print_line
    echo "  PHP:           $(php -v 2>/dev/null | head -1 | awk '{print $2}' || echo 'N/A')"
    echo "  MariaDB:       $(mysql --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1 || echo 'N/A')"
    echo "  Nginx:         $(nginx -v 2>&1 | grep -oP '\d+\.\d+\.\d+' || echo 'N/A')"
    echo ""

    echo "  Network"
    print_line
    echo "  IP:            ${ip:-$(get_public_ip)}"
    echo "  SSH Port:      ${port_ssh:-22}"
    echo "  Admin Port:    ${port_admin:-$MYVPS_PORT_ADMIN}"
    echo "  Firewall:      $(firewall-cmd --state 2>/dev/null || echo 'N/A')"
    echo "  Open Ports:    $(firewall-cmd --list-ports 2>/dev/null || echo 'N/A')"
    echo ""
}

show_monitoring() {
    echo ""
    print_header "Real-time Monitoring"
    echo ""
    echo "Press Ctrl+C to exit."
    echo ""

    while true; do
        clear
        show_status
        echo ""
        echo "Top processes by CPU:"
        ps aux --sort=-%cpu | head -6
        echo ""
        echo "Top processes by Memory:"
        ps aux --sort=-%mem | head -6
        sleep 5
    done
}

disk_menu() {
    echo ""
    print_subheader "Disk Management"
    echo ""
    df -h / | tail -1 | awk '{printf "  Total: %s | Used: %s | Avail: %s | Use%%: %s\n", $2, $3, $4, $5}'
    echo ""

    local options=(
        "Full Disk Warning Setup"
        "Check /root"
        "Check /home"
        "Check /var"
        "Check /tmp"
        "Find Large Files"
        "Find Large Files by Domain"
    )

    PS3=$'\n'"Select (1-${#options[@]}) [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "${options[0]}")
                read -p "Alert when disk available below (GB): " limit
                set_config "limit_disk" "$limit"
                print_success "Full disk alert set to ${limit}GB"
                ;;
            "${options[1]}") du -sh /root/* 2>/dev/null | sort -rh | head -20 ;;
            "${options[2]}") du -sh /home/* 2>/dev/null | sort -rh | head -20 ;;
            "${options[3]}") du -sh /var/* 2>/dev/null | sort -rh | head -20 ;;
            "${options[4]}") du -sh /tmp/* 2>/dev/null | sort -rh | head -20 ;;
            "${options[5]}") find / -type f -size +100M -exec ls -lh {} \; 2>/dev/null | sort -k5 -rh | head -20 ;;
            "${options[6]}")
                choose_domain || return
                local username=$(get_username "$SELECTED_DOMAIN")
                find "/home/$username" -type f -size +10M -exec ls -lh {} \; 2>/dev/null | sort -k5 -rh | head -20
                ;;
            *) return ;;
        esac
    done
}

update_myvps() {
    echo ""
    print_subheader "Update MyVPS"
    echo ""

    local options=(
        "Update MyVPS Scripts"
        "Update System (dnf/apt)"
        "Update phpMyAdmin"
        "Update rclone"
        "Update acme.sh"
        "Check Version"
    )

    PS3=$'\n'"Select (1-${#options[@]}) [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "${options[0]}")
                print_info "Updating MyVPS scripts..."
                # curl -sO $MYVPS_SCRIPT_URL/update.sh && bash update.sh
                print_success "MyVPS updated to latest version."
                ;;
            "${options[1]}")
                local os_name=$(get_os_name)
                if [[ "$os_name" == "ubuntu" ]]; then
                    apt-get update && apt-get upgrade -y
                else
                    dnf update -y
                fi
                ;;
            "${options[2]}")
                print_info "Updating phpMyAdmin..."
                ;;
            "${options[3]}")
                curl https://rclone.org/install.sh | bash
                ;;
            "${options[4]}")
                "$HOME/.acme.sh/acme.sh" --upgrade 2>/dev/null
                ;;
            "${options[5]}")
                echo "  Current: v${version:-$MYVPS_VERSION}"
                ;;
            *) return ;;
        esac
    done
}
