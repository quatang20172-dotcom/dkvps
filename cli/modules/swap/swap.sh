#!/bin/bash
#
# MyVPS - Swap Management Module
#

swap_handler() {
    local action="$1"
    shift
    case "$action" in
        create) swap_create "$@" ;;
        delete) swap_delete ;;
        list)   swap_list ;;
        *)
            if [[ -n "$action" ]]; then
                print_error "Unknown swap action: $action"
            fi
            swap_menu
            ;;
    esac
}

swap_menu() {
    echo ""
    print_subheader "Swap Management"
    echo ""
    echo "  Swap Total:     $(human_readable $(get_swap_total))"
    echo "  Swap Free:      $(human_readable $(get_swap_free))"
    echo "  Swappiness:     $(cat /proc/sys/vm/swappiness)"
    echo ""

    local options=("Create Swap" "Delete Swap" "Swap Info")
    PS3=$'\n'"Select (1-${#options[@]}) [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "${options[0]}") swap_create ;;
            "${options[1]}") swap_delete ;;
            "${options[2]}") swap_list ;;
            *) return ;;
        esac
    done
}

swap_create() {
    local size_mb="${1:-}"

    if [[ -z "$size_mb" ]]; then
        read -p "Enter swap size in MB (e.g., 1024, 2048): " size_mb
    fi

    if [[ -z "$size_mb" ]] || [[ "$size_mb" -lt 256 ]]; then
        print_error "Invalid swap size. Minimum 256 MB."
        return 1
    fi

    print_info "Creating ${size_mb}MB swap..."

    swapoff -a 2>/dev/null
    rm -f /var/swap.1

    dd if=/dev/zero of=/var/swap.1 bs=1M count="$size_mb" status=progress
    chmod 600 /var/swap.1
    mkswap /var/swap.1
    swapon /var/swap.1

    # Add to fstab
    sed -i '/swap.1/d' /etc/fstab
    echo "/var/swap.1 none swap defaults 0 0" >> /etc/fstab

    # Set swappiness
    sysctl vm.swappiness=10
    sed -i '/vm.swappiness/d' /etc/sysctl.conf
    echo "vm.swappiness=10" >> /etc/sysctl.conf

    print_success "Swap created: ${size_mb}MB"
}

swap_delete() {
    if confirm "Delete swap file?"; then
        swapoff -a 2>/dev/null
        rm -f /var/swap.1
        sed -i '/swap.1/d' /etc/fstab
        print_success "Swap deleted."
    fi
}

swap_list() {
    echo ""
    print_subheader "Swap Info"
    echo ""
    swapon --show 2>/dev/null || cat /proc/swaps
    echo ""
    free -h | head -1
    free -h | grep -i swap
}
