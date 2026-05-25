#!/bin/bash
#
# MyVPS - Port Management Module (delegates to firewall)
#
source "$(dirname "${BASH_SOURCE[0]}")/../firewall/firewall.sh" 2>/dev/null

port_handler() {
    firewall_handler "$@"
}

port_menu() {
    firewall_menu
}
