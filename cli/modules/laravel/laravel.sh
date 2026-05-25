#!/bin/bash
#
# MyVPS - Laravel Management Module
#

laravel_handler() {
    local action="$1"
    shift
    case "$action" in
        install) laravel_install "$@" ;;
        clear)   laravel_clear_cache "$@" ;;
        public)  laravel_config_public "$@" ;;
        *) laravel_menu ;;
    esac
}

laravel_menu() {
    echo ""
    print_subheader "Laravel Management"
    echo ""

    local options=("Install Laravel" "Clear Cache" "Config Public Path" "Install Composer")
    PS3=$'\n'"Select (1-${#options[@]}) [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "${options[0]}") laravel_install ;;
            "${options[1]}") laravel_clear_cache ;;
            "${options[2]}") laravel_config_public ;;
            "${options[3]}") laravel_install_composer ;;
            *) return ;;
        esac
    done
}

laravel_install() {
    echo ""
    print_subheader "Install Laravel"
    echo ""

    choose_domain || return
    local domain="$SELECTED_DOMAIN"
    local username=$(get_username "$domain")

    if ! confirm "Install Laravel (latest) for $domain?"; then
        return
    fi

    laravel_install_composer

    load_config
    local db_name=$(openssl rand -hex 4)_db
    local db_user=$(openssl rand -hex 4)_user
    local db_password=$(generate_password 32)

    # Create database
    mysql -u "$db_admin_user" -p"$db_admin_password" -e "CREATE DATABASE IF NOT EXISTS \`$db_name\`" 2>/dev/null
    mysql -u "$db_admin_user" -p"$db_admin_password" -e "CREATE USER IF NOT EXISTS '$db_user'@'localhost' IDENTIFIED BY '$db_password'" 2>/dev/null
    mysql -u "$db_admin_user" -p"$db_admin_password" -e "GRANT ALL PRIVILEGES ON \`$db_name\`.* TO '$db_user'@'localhost'" 2>/dev/null
    mysql -u "$db_admin_user" -p"$db_admin_password" -e "FLUSH PRIVILEGES" 2>/dev/null

    rm -rf "/home/$username/$domain/public_html/"*
    cd "/home/$username/$domain/public_html/"
    composer create-project --prefer-dist laravel/laravel ./

    # Configure .env
    sed -i "s/APP_ENV=local/APP_ENV=production/" .env
    sed -i "s/DB_DATABASE=laravel/DB_DATABASE=$db_name/" .env
    sed -i "s/DB_USERNAME=root/DB_USERNAME=$db_user/" .env
    sed -i "s/DB_PASSWORD=/DB_PASSWORD=$db_password/" .env

    # Point Nginx to /public
    sed -i "s|$domain/public_html;|$domain/public_html/public;|" "/etc/nginx/conf.d/$domain.conf"

    chown -R "$username:$username" "/home/$username/$domain/public_html"
    reload_nginx

    set_config "db_name" "$db_name" "$MYVPS_USER_DIR/.$domain.conf"
    set_config "db_user" "$db_user" "$MYVPS_USER_DIR/.$domain.conf"
    set_config "db_password" "$db_password" "$MYVPS_USER_DIR/.$domain.conf"

    print_success "Laravel installed for $domain"
    echo "  DB Name:     $db_name"
    echo "  DB User:     $db_user"
    echo "  DB Password: $db_password"
}

laravel_clear_cache() {
    choose_domain || return
    local domain="$SELECTED_DOMAIN"
    local username=$(get_username "$domain")
    local path="/home/$username/$domain/public_html"

    cd "$path"
    php artisan cache:clear 2>/dev/null
    php artisan config:clear 2>/dev/null
    php artisan route:clear 2>/dev/null
    php artisan view:clear 2>/dev/null
    print_success "Laravel cache cleared for $domain"
}

laravel_config_public() {
    choose_domain || return
    local domain="$SELECTED_DOMAIN"
    sed -i "s|$domain/public_html;|$domain/public_html/public;|" "/etc/nginx/conf.d/$domain.conf"
    reload_nginx
    print_success "Nginx root set to /public for $domain"
}

laravel_install_composer() {
    if [[ -f /usr/local/bin/composer ]]; then
        print_info "Composer already installed."
        return
    fi

    print_info "Installing Composer..."
    cd /tmp
    php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
    php -d memory_limit=-1 composer-setup.php
    mv composer.phar /usr/local/bin/composer
    rm -f composer-setup.php
    print_success "Composer installed."
}
