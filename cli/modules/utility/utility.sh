#!/bin/bash
#
# MyVPS - Utility Tools Module
#

utility_handler() {
    local action="$1"
    shift
    case "$action" in
        composer)   _install_composer ;;
        wpcli)      _install_wpcli ;;
        ioncube)    _toggle_ioncube "$@" ;;
        iframe)     _toggle_iframe ;;
        *) utility_menu ;;
    esac
}

utility_menu() {
    echo ""
    print_subheader "Utility Tools"
    echo ""

    local options=(
        "Install Composer"
        "Install WP-CLI"
        "Enable IonCube Loader"
        "Disable IonCube Loader"
        "Toggle Iframe (X-Frame-Options)"
        "Transfer from HocVPS/VPSSIM"
        "Transfer from cPanel Backup"
    )

    PS3=$'\n'"Select (1-${#options[@]}) [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "${options[0]}") _install_composer ;;
            "${options[1]}") _install_wpcli ;;
            "${options[2]}") _toggle_ioncube "enable" ;;
            "${options[3]}") _toggle_ioncube "disable" ;;
            "${options[4]}") _toggle_iframe ;;
            "${options[5]}") _transfer_hocvps ;;
            "${options[6]}") _transfer_cpanel ;;
            *) return ;;
        esac
    done
}

_install_composer() {
    if [[ -f /usr/local/bin/composer ]]; then
        print_info "Composer already installed: $(composer --version 2>/dev/null)"
        return
    fi
    cd /tmp
    php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
    php -d memory_limit=-1 composer-setup.php
    mv composer.phar /usr/local/bin/composer
    rm -f composer-setup.php
    print_success "Composer installed."
}

_install_wpcli() {
    if [[ -f /usr/local/bin/wp ]]; then
        print_info "WP-CLI already installed."
        return
    fi
    curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
    chmod +x wp-cli.phar
    mv wp-cli.phar /usr/local/bin/wp
    print_success "WP-CLI installed."
}

_toggle_ioncube() {
    local action="${1:-enable}"
    local ioncube_path="/usr/local/ioncube"

    if [[ "$action" == "enable" ]]; then
        if [[ -d "$ioncube_path" ]]; then
            local php_ext_dir=$(php -r "echo ini_get('extension_dir');" 2>/dev/null)
            local php_version=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;" 2>/dev/null)
            local loader="ioncube_loader_lin_${php_version}.so"

            if [[ -f "$ioncube_path/$loader" ]]; then
                cp "$ioncube_path/$loader" "$php_ext_dir/"
                echo "zend_extension=$loader" > /etc/php.d/00-ioncube.ini
                restart_php
                print_success "IonCube Loader enabled for PHP $php_version"
            else
                print_error "IonCube loader not found for PHP $php_version"
            fi
        else
            print_error "IonCube not installed. Download from https://www.ioncube.com/loaders.php"
        fi
    else
        rm -f /etc/php.d/00-ioncube.ini
        restart_php
        print_success "IonCube Loader disabled."
    fi
}

_toggle_iframe() {
    local nginx_conf="/etc/nginx/nginx.conf"
    if grep -q "X-Frame-Options" "$nginx_conf" 2>/dev/null; then
        sed -i '/X-Frame-Options/d' "$nginx_conf"
        reload_nginx
        print_success "X-Frame-Options removed (iframes allowed)."
    else
        sed -i '/http {/a\    add_header X-Frame-Options "SAMEORIGIN";' "$nginx_conf"
        reload_nginx
        print_success "X-Frame-Options SAMEORIGIN added."
    fi
}

_transfer_hocvps() {
    print_info "Transfer from HocVPS/VPSSIM - Manual process:"
    echo "  1. Backup source code from old VPS"
    echo "  2. Export database from old VPS"
    echo "  3. Create domain on this VPS: myvps domain add"
    echo "  4. Upload source to new domain's public_html"
    echo "  5. Import database: myvps db import"
    echo "  6. Update config files (wp-config.php, .env, etc.)"
}

_transfer_cpanel() {
    print_info "Transfer from cPanel backup:"
    echo "  1. Download full cPanel backup (.tar.gz)"
    echo "  2. Extract: tar -xzf backup.tar.gz"
    echo "  3. Find public_html and database dump"
    echo "  4. Create domain: myvps domain add"
    echo "  5. Copy files and import database"
}
