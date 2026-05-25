#!/bin/bash
#
# MyVPS - Fail2Ban Management Module
#

fail2ban_handler() {
    local action="$1"
    shift
    case "$action" in
        list)   f2b_list ;;
        block)  f2b_block "$@" ;;
        unblock) f2b_unblock "$@" ;;
        status) f2b_status ;;
        *) fail2ban_menu ;;
    esac
}

fail2ban_menu() {
    echo ""
    print_subheader "Fail2Ban Management"
    echo ""
    echo "  Status: $(service_status fail2ban)"
    echo ""

    local options=("Banned IP List" "Ban IP" "Unban IP" "Jail Status" "Restart Fail2Ban")
    PS3=$'\n'"Select (1-${#options[@]}) [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "${options[0]}") f2b_list ;;
            "${options[1]}") f2b_block ;;
            "${options[2]}") f2b_unblock ;;
            "${options[3]}") f2b_status ;;
            "${options[4]}") service_restart fail2ban ;;
            *) return ;;
        esac
    done
}

f2b_list() {
    echo ""
    print_subheader "Banned IPs"
    echo ""
    fail2ban-client status sshd 2>/dev/null
}

f2b_block() {
    local ip="${1:-}"
    if [[ -z "$ip" ]]; then
        read -p "Enter IP to ban: " ip
    fi
    fail2ban-client set sshd banip "$ip" 2>/dev/null
    print_success "IP $ip banned."
}

f2b_unblock() {
    local ip="${1:-}"
    if [[ -z "$ip" ]]; then
        read -p "Enter IP to unban: " ip
    fi
    fail2ban-client set sshd unbanip "$ip" 2>/dev/null
    print_success "IP $ip unbanned."
}

f2b_status() {
    echo ""
    fail2ban-client status 2>/dev/null
}
