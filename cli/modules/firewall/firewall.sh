#!/bin/bash
#
# MyVPS - Firewall/Port Management Module
#

firewall_handler() {
    local action="$1"
    shift
    case "$action" in
        open)   fw_open_port "$@" ;;
        close)  fw_close_port "$@" ;;
        list)   fw_list_ports ;;
        status) fw_status ;;
        *)
            if [[ -n "$action" ]]; then
                print_error "Unknown firewall action: $action"
            fi
            firewall_menu
            ;;
    esac
}

firewall_menu() {
    echo ""
    print_subheader "Firewall Management"
    echo ""
    echo "  Status: $(firewall-cmd --state 2>/dev/null || echo 'N/A')"
    echo "  Open Ports: $(firewall-cmd --list-ports 2>/dev/null || echo 'N/A')"
    echo ""

    local options=(
        "List Open Ports"
        "Open Port"
        "Close Port"
        "Open Essential Ports (80, 443, SSH)"
        "Firewall Status"
    )

    PS3=$'\n'"Select (1-${#options[@]}) [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "${options[0]}") fw_list_ports ;;
            "${options[1]}") fw_open_port ;;
            "${options[2]}") fw_close_port ;;
            "${options[3]}") fw_open_essential ;;
            "${options[4]}") fw_status ;;
            *) return ;;
        esac
    done
}

fw_list_ports() {
    echo ""
    print_subheader "Open Ports"
    echo ""
    firewall-cmd --list-ports 2>/dev/null || echo "Firewall not available"
    echo ""
    echo "Open services:"
    firewall-cmd --list-services 2>/dev/null
}

fw_open_port() {
    local port="${1:-}"
    if [[ -z "$port" ]]; then
        read -p "Enter port to open: " port
    fi
    firewall_open_port "$port"
    print_success "Port $port opened."
}

fw_close_port() {
    local port="${1:-}"
    if [[ -z "$port" ]]; then
        read -p "Enter port to close: " port
    fi
    firewall_close_port "$port"
    print_success "Port $port closed."
}

fw_open_essential() {
    load_config
    firewall-cmd --permanent --zone=public --add-service=http --add-service=https 2>/dev/null
    firewall_open_port "${port_ssh:-22}"
    firewall_open_port "${port_admin:-$MYVPS_PORT_ADMIN}"
    firewall-cmd --reload 2>/dev/null
    print_success "Essential ports opened (80, 443, SSH, Admin)"
}

fw_status() {
    echo ""
    print_subheader "Firewall Status"
    echo ""
    firewall-cmd --state 2>/dev/null
    echo ""
    firewall-cmd --list-all 2>/dev/null
}

# Port management (alias module)
port_handler() {
    firewall_handler "$@"
}

port_menu() {
    firewall_menu
}
