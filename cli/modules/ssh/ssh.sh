#!/bin/bash
#
# MyVPS - SSH/SFTP Management Module
#

ssh_handler() {
    local action="$1"
    shift
    case "$action" in
        port)     ssh_change_port "$@" ;;
        password) ssh_change_password "$@" ;;
        sftp)     ssh_change_sftp_password "$@" ;;
        *)
            if [[ -n "$action" ]]; then
                print_error "Unknown SSH action: $action"
            fi
            ssh_menu
            ;;
    esac
}

ssh_menu() {
    load_config
    echo ""
    print_subheader "SSH/SFTP Management"
    echo ""
    echo "  SSH Port: ${port_ssh:-22}"
    echo "  SSHD:     $(service_status sshd)"
    echo ""

    local options=(
        "Change SSH/SFTP Port"
        "Change Root Password"
        "Change SFTP User Password"
        "View Failed Login Attempts"
    )

    PS3=$'\n'"Select (1-${#options[@]}) [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "${options[0]}") ssh_change_port ;;
            "${options[1]}") ssh_change_password ;;
            "${options[2]}") ssh_change_sftp_password ;;
            "${options[3]}") ssh_login_failed ;;
            *) return ;;
        esac
    done
}

ssh_change_port() {
    local new_port="${1:-}"
    load_config

    echo ""
    echo "Current SSH port: ${port_ssh:-22}"
    if [[ -z "$new_port" ]]; then
        read -p "Enter new SSH port: " new_port
    fi

    if [[ -z "$new_port" ]] || [[ "$new_port" -lt 1 ]] || [[ "$new_port" -gt 65535 ]]; then
        print_error "Invalid port number."
        return 1
    fi

    # Update sshd_config
    sed -i "s/^#*Port .*/Port $new_port/" /etc/ssh/sshd_config

    # SELinux
    if command -v semanage &>/dev/null; then
        semanage port -a -t ssh_port_t -p tcp "$new_port" 2>/dev/null
    fi

    # Firewall
    firewall_open_port "$new_port"
    systemctl reload sshd

    # Save config
    set_config "port_ssh" "$new_port"

    print_success "SSH port changed to $new_port"
    print_warning "Remember: ssh -p $new_port user@${ip:-$(get_public_ip)}"
}

ssh_change_password() {
    echo ""
    print_info "Changing root password..."
    passwd root
}

ssh_change_sftp_password() {
    choose_domain || return
    local domain="$SELECTED_DOMAIN"
    local username=$(get_username "$domain")

    echo ""
    print_info "Changing SFTP password for user: $username"
    local new_password=$(generate_password 32)
    echo "$username:$new_password" | chpasswd

    set_config "password_sftp" "$new_password" "$MYVPS_USER_DIR/.$domain.conf"

    print_success "SFTP password changed for $username"
    echo "  New Password: $new_password"
}

ssh_login_failed() {
    echo ""
    print_subheader "Failed Login Attempts"
    echo ""

    if [[ -f /var/log/secure ]]; then
        grep 'authentication failure' /var/log/secure 2>/dev/null | awk '{ print $13 }' | cut -b7- | sort | uniq -c | sort -rn | head -20
    elif [[ -f /var/log/auth.log ]]; then
        grep 'Failed password' /var/log/auth.log 2>/dev/null | awk '{print $(NF-3)}' | sort | uniq -c | sort -rn | head -20
    else
        print_warning "No auth log found."
    fi

    echo ""
    echo "Last successful logins:"
    last | grep -v "tty" | head -10
}
