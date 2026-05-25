#!/bin/bash
#
# MyVPS - Crontab Management Module
#

crontab_handler() {
    local action="$1"
    shift
    case "$action" in
        list) crontab -l 2>/dev/null ;;
        edit) crontab -e ;;
        *) crontab_menu ;;
    esac
}

crontab_menu() {
    echo ""
    print_subheader "Crontab Management"
    echo ""

    local options=("List Crontab" "Edit Crontab")
    PS3=$'\n'"Select (1-${#options[@]}) [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "${options[0]}") crontab -l 2>/dev/null || echo "No crontab entries." ;;
            "${options[1]}") crontab -e ;;
            *) return ;;
        esac
    done
}
