#!/bin/bash
#
# MyVPS - Admin Panel Management Module
#

app_admin_handler() {
    local action="$1"
    shift
    case "$action" in
        port)     admin_change_port "$@" ;;
        list)     admin_list_users ;;
        add)      admin_add_user "$@" ;;
        password) admin_change_password "$@" ;;
        delete)   admin_delete_user "$@" ;;
        *) app_admin_menu ;;
    esac
}

app_admin_menu() {
    load_config
    echo ""
    print_subheader "Admin Panel Management"
    echo ""
    echo "  phpMyAdmin:  http://${ip:-localhost}:${port_admin:-$MYVPS_PORT_ADMIN}/phpmyadmin"
    echo "  Port:        ${port_admin:-$MYVPS_PORT_ADMIN}"
    echo "  Username:    admin"
    echo "  Password:    ${admin_password:-N/A}"
    echo ""

    local options=(
        "Change Admin Port"
        "List Users"
        "Add User"
        "Change Password"
        "Delete User"
    )

    PS3=$'\n'"Select (1-${#options[@]}) [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "${options[0]}") admin_change_port ;;
            "${options[1]}") admin_list_users ;;
            "${options[2]}") admin_add_user ;;
            "${options[3]}") admin_change_password ;;
            "${options[4]}") admin_delete_user ;;
            *) return ;;
        esac
    done
}

admin_change_port() {
    local new_port="${1:-}"
    load_config

    if [[ -z "$new_port" ]]; then
        read -p "Enter new admin port [current: ${port_admin:-$MYVPS_PORT_ADMIN}]: " new_port
    fi

    sed -i "s/listen ${port_admin:-$MYVPS_PORT_ADMIN}/listen $new_port/" /etc/nginx/conf.d/admin.conf 2>/dev/null
    firewall_open_port "$new_port"
    set_config "port_admin" "$new_port"
    reload_nginx
    print_success "Admin port changed to $new_port"
}

admin_list_users() {
    echo ""
    print_subheader "Admin Users"
    echo ""
    if [[ -f "$MYVPS_WEB_DIR/passwd/.htpasswd" ]]; then
        cat "$MYVPS_WEB_DIR/passwd/.htpasswd" | cut -d':' -f1
    fi
}

admin_add_user() {
    local username="${1:-}"
    if [[ -z "$username" ]]; then
        read -p "Enter username: " username
    fi
    local password=$(generate_password 24)
    htpasswd -b "$MYVPS_WEB_DIR/passwd/.htpasswd" "$username" "$password" 2>/dev/null
    print_success "User $username added. Password: $password"
}

admin_change_password() {
    local username="${1:-}"
    if [[ -z "$username" ]]; then
        read -p "Enter username: " username
    fi
    local password=$(generate_password 24)
    htpasswd -b "$MYVPS_WEB_DIR/passwd/.htpasswd" "$username" "$password" 2>/dev/null
    print_success "Password changed for $username. New: $password"
}

admin_delete_user() {
    local username="${1:-}"
    if [[ -z "$username" ]]; then
        read -p "Enter username to delete: " username
    fi
    htpasswd -D "$MYVPS_WEB_DIR/passwd/.htpasswd" "$username" 2>/dev/null
    print_success "User $username deleted."
}
