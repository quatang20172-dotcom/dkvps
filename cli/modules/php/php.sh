#!/bin/bash
#
# MyVPS - PHP Management Module
#

PHP_VERSIONS=("7.4" "8.0" "8.1" "8.2" "8.3")

php_handler() {
    local action="$1"
    shift
    case "$action" in
        version)  php_change_version "$@" ;;
        config)   php_edit_config "$@" ;;
        info)     php_info ;;
        install)  php_install_version "$@" ;;
        *)
            if [[ -n "$action" ]]; then
                print_error "Unknown PHP action: $action"
            fi
            php_menu
            ;;
    esac
}

php_menu() {
    echo ""
    print_subheader "PHP Management"
    echo ""
    echo "  Current PHP: $(php -v 2>/dev/null | head -1 || echo 'Not installed')"
    echo "  PHP-FPM:     $(service_status php-fpm)"
    echo ""

    local options=(
        "PHP Info"
        "Change PHP Version (Global)"
        "Change PHP Version (Per Domain)"
        "Edit php.ini"
        "Change Process Manager Mode"
        "Install Additional PHP Version"
        "Restart PHP-FPM"
    )

    PS3=$'\n'"Select (1-${#options[@]}) [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "${options[0]}") php_info ;;
            "${options[1]}") php_change_version ;;
            "${options[2]}") php_change_domain_version ;;
            "${options[3]}") php_edit_config ;;
            "${options[4]}") php_change_pm ;;
            "${options[5]}") php_install_version ;;
            "${options[6]}") restart_php ;;
            *) return ;;
        esac
    done
}

php_info() {
    echo ""
    print_subheader "PHP Info"
    echo ""
    php -v 2>/dev/null
    echo ""
    echo "Loaded modules:"
    php -m 2>/dev/null
    echo ""
    echo "PHP-FPM pools:"
    ls /etc/php-fpm.d/*.conf 2>/dev/null | while read f; do
        local pool=$(basename "$f" .conf)
        echo "  - $pool"
    done
}

php_change_version() {
    local version="${1:-}"
    local os_name=$(get_os_name)

    echo ""
    print_subheader "Change PHP Version"
    echo ""
    echo "Available versions:"
    for i in "${!PHP_VERSIONS[@]}"; do
        echo "  $((i+1))) PHP ${PHP_VERSIONS[$i]}"
    done
    echo ""

    if [[ -z "$version" ]]; then
        read -p "Select version number (1-${#PHP_VERSIONS[@]}): " choice
        version="${PHP_VERSIONS[$((choice-1))]}"
    fi

    if [[ -z "$version" ]]; then
        print_error "Invalid selection."
        return 1
    fi

    print_info "Switching to PHP $version..."

    if [[ "$os_name" == "almalinux" ]] || [[ "$os_name" == "rocky" ]] || [[ "$os_name" == "centos" ]]; then
        dnf module reset php -y 2>/dev/null
        dnf module enable "php:remi-$version" -y 2>/dev/null
        dnf module install "php:remi-$version" -y --allowerasing 2>/dev/null
    elif [[ "$os_name" == "ubuntu" ]]; then
        apt-get install -y "php$version" "php$version-fpm" "php$version-cli" "php$version-common" \
            "php$version-mysql" "php$version-curl" "php$version-gd" "php$version-mbstring" \
            "php$version-xml" "php$version-zip" "php$version-bcmath" "php$version-opcache" 2>/dev/null
    fi

    restart_php
    set_config "php_default_version" "$version"
    print_success "PHP switched to version $version"
}

php_change_domain_version() {
    choose_domain || return
    local domain="$SELECTED_DOMAIN"

    echo ""
    echo "Available versions:"
    for i in "${!PHP_VERSIONS[@]}"; do
        echo "  $((i+1))) PHP ${PHP_VERSIONS[$i]}"
    done
    echo ""

    read -p "Select version for $domain: " choice
    local version="${PHP_VERSIONS[$((choice-1))]}"

    if [[ -z "$version" ]]; then
        print_error "Invalid selection."
        return 1
    fi

    set_config "php_version" "$version" "$MYVPS_USER_DIR/.$domain.conf"
    print_success "PHP version for $domain set to $version"
    print_info "Note: You may need to install PHP $version and update the FPM pool config."
}

php_edit_config() {
    local config_file="/etc/php.ini"
    if [[ -f "$config_file" ]]; then
        ${EDITOR:-nano} "$config_file"
        restart_php
    else
        print_error "PHP config file not found at $config_file"
    fi
}

php_change_pm() {
    echo ""
    print_subheader "Change Process Manager Mode"
    echo ""

    choose_domain || return
    local domain="$SELECTED_DOMAIN"

    local pool_file="/etc/php-fpm.d/$domain.conf"
    if [[ ! -f "$pool_file" ]]; then
        print_error "PHP-FPM pool not found for $domain"
        return 1
    fi

    local options=("dynamic" "static" "ondemand")
    PS3=$'\n'"Select PM mode: "
    select mode in "${options[@]}"; do
        if [[ -n "$mode" ]]; then
            sed -i "s/^pm = .*/pm = $mode/" "$pool_file"
            restart_php
            print_success "PM mode changed to $mode for $domain"
            break
        fi
    done
}

php_install_version() {
    local version="${1:-}"

    if [[ -z "$version" ]]; then
        echo "Available versions: ${PHP_VERSIONS[*]}"
        read -p "Enter PHP version to install: " version
    fi

    print_info "Installing PHP $version..."
    local os_name=$(get_os_name)

    if [[ "$os_name" == "almalinux" ]] || [[ "$os_name" == "rocky" ]] || [[ "$os_name" == "centos" ]]; then
        dnf install -y "php${version//./}-php-fpm" "php${version//./}-php-cli" "php${version//./}-php-common" \
            "php${version//./}-php-mysqlnd" "php${version//./}-php-gd" "php${version//./}-php-mbstring" \
            "php${version//./}-php-xml" "php${version//./}-php-opcache" "php${version//./}-php-bcmath" 2>/dev/null
    elif [[ "$os_name" == "ubuntu" ]]; then
        add-apt-repository -y ppa:ondrej/php 2>/dev/null
        apt-get update 2>/dev/null
        apt-get install -y "php$version" "php$version-fpm" "php$version-cli" "php$version-common" \
            "php$version-mysql" "php$version-curl" "php$version-gd" "php$version-mbstring" \
            "php$version-xml" "php$version-zip" "php$version-bcmath" "php$version-opcache" 2>/dev/null
    fi

    print_success "PHP $version installed"
}
