#!/bin/bash
#
# MyVPS - WordPress Management Module
# Uses WP-CLI for advanced management
#

wordpress_handler() {
    local action="$1"
    shift
    case "$action" in
        install)       wordpress_install "$@" ;;
        update)        wp_update_all "$@" ;;
        clear-cache)   wp_clear_cache "$@" ;;
        delete-spam)   wp_delete_spam "$@" ;;
        *)
            if [[ -n "$action" ]]; then
                print_error "Unknown WordPress action: $action"
            fi
            wordpress_menu
            ;;
    esac
}

wordpress_menu() {
    echo ""
    print_subheader "WordPress Management"
    echo ""

    local options=(
        "Install WordPress"
        "Clear Cache (All Domains)"
        "Clear Cache (One Domain)"
        "Update All (Core + Theme + Plugin)"
        "Update WordPress Core"
        "Update Themes"
        "Update Plugins"
        "Delete Inactive Themes/Plugins"
        "Delete Draft/Trash/Revision Posts"
        "Delete Spam Comments"
        "Support WebP (Nginx)"
        "Move wp-config.php (Security)"
        "Disable File Edit in WP Dashboard"
    )

    PS3=$'\n'"Select (1-${#options[@]}) [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "${options[0]}")  wordpress_install ;;
            "${options[1]}")  wp_clear_cache_all ;;
            "${options[2]}")  wp_clear_cache ;;
            "${options[3]}")  wp_update_all ;;
            "${options[4]}")  wp_update_core ;;
            "${options[5]}")  wp_update_themes ;;
            "${options[6]}")  wp_update_plugins ;;
            "${options[7]}")  wp_delete_inactive ;;
            "${options[8]}")  wp_delete_drafts ;;
            "${options[9]}")  wp_delete_spam ;;
            "${options[10]}") wp_webp_support ;;
            "${options[11]}") wp_move_config ;;
            "${options[12]}") wp_disable_file_edit ;;
            *) return ;;
        esac
    done
}

wordpress_install() {
    echo ""
    print_subheader "Install WordPress"
    echo ""

    choose_domain || return
    local domain="$SELECTED_DOMAIN"
    local username=$(get_username "$domain")

    if ! domain_exists "$domain"; then
        print_error "Domain $domain not found."
        return 1
    fi

    if ! confirm "Install WordPress (latest) for $domain?"; then
        return
    fi

    load_config

    local db_name=$(openssl rand -hex 4)_db
    local db_user=$(openssl rand -hex 4)_user
    local db_password=$(generate_password 32)
    local prefix=$(openssl rand -hex 3)

    # Create database
    mysql -u "$db_admin_user" -p"$db_admin_password" -e "CREATE DATABASE IF NOT EXISTS \`$db_name\`" 2>/dev/null
    mysql -u "$db_admin_user" -p"$db_admin_password" -e "CREATE USER IF NOT EXISTS '$db_user'@'localhost' IDENTIFIED BY '$db_password'" 2>/dev/null
    mysql -u "$db_admin_user" -p"$db_admin_password" -e "GRANT ALL PRIVILEGES ON \`$db_name\`.* TO '$db_user'@'localhost'" 2>/dev/null
    mysql -u "$db_admin_user" -p"$db_admin_password" -e "FLUSH PRIVILEGES" 2>/dev/null

    # Download & install WP
    rm -rf "/home/$username/$domain/public_html/"*
    cd /tmp
    curl -sO https://wordpress.org/latest.tar.gz
    tar -zxf latest.tar.gz
    cp -rf wordpress/* "/home/$username/$domain/public_html/"
    rm -rf wordpress latest.tar.gz

    # Configure
    local SALT=$(curl -sL https://api.wordpress.org/secret-key/1.1/salt/)

    cat > "/home/$username/$domain/public_html/wp-config.php" <<EOF
<?php
define('DISALLOW_FILE_EDIT', true);
define('WP_MEMORY_LIMIT', '256M');
define('WP_CACHE', true);
define('FS_METHOD', 'direct');
define('DB_NAME', '$db_name');
define('DB_USER', '$db_user');
define('DB_PASSWORD', '$db_password');
define('DB_HOST', 'localhost');
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', '');
define('DISABLE_WP_CRON', false);

$SALT

\$table_prefix = '${prefix}_';

define('WP_DEBUG', false);

if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__ . '/');
}
require_once ABSPATH . 'wp-settings.php';
EOF

    cat > "/home/$username/$domain/public_html/robots.txt" <<EOF
User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php
Sitemap: https://$domain/sitemap.xml
EOF

    chown -R "$username:$username" "/home/$username/$domain/public_html"
    chmod 0400 "/home/$username/$domain/public_html/wp-config.php"
    rm -f "/home/$username/$domain/public_html/readme.html"
    rm -f "/home/$username/$domain/public_html/license.txt"

    # Update domain config
    set_config "db_name" "$db_name" "$MYVPS_USER_DIR/.$domain.conf"
    set_config "db_user" "$db_user" "$MYVPS_USER_DIR/.$domain.conf"
    set_config "db_password" "$db_password" "$MYVPS_USER_DIR/.$domain.conf"

    print_success "WordPress installed for $domain"
    print_line
    echo "  Domain:      http://$domain"
    echo "  DB Name:     $db_name"
    echo "  DB User:     $db_user"
    echo "  DB Password: $db_password"
    print_line
}

# WP-CLI helper
_wp_cli() {
    local domain="$1"
    shift
    local username=$(get_username "$domain")
    local path="/home/$username/$domain/public_html"

    if [[ ! -f /usr/local/bin/wp ]]; then
        print_error "WP-CLI not installed. Run: myvps util install-wpcli"
        return 1
    fi

    wp --path="$path" --allow-root "$@"
}

wp_clear_cache() {
    choose_domain || return
    _wp_cli "$SELECTED_DOMAIN" cache flush 2>/dev/null
    print_success "Cache cleared for $SELECTED_DOMAIN"
}

wp_clear_cache_all() {
    print_info "Clearing cache for all WordPress sites..."
    for entry in $(ls -A "$MYVPS_USER_DIR" 2>/dev/null); do
        local domain=$(echo "$entry" | sed 's/^\.//' | sed 's/\.conf$//')
        local username=$(get_username "$domain")
        if [[ -f "/home/$username/$domain/public_html/wp-config.php" ]]; then
            _wp_cli "$domain" cache flush 2>/dev/null
            print_success "Cache cleared: $domain"
        fi
    done
}

wp_update_all() {
    choose_domain || return
    local domain="$SELECTED_DOMAIN"
    _wp_cli "$domain" core update 2>/dev/null
    _wp_cli "$domain" theme update --all 2>/dev/null
    _wp_cli "$domain" plugin update --all 2>/dev/null
    print_success "WordPress updated for $domain"
}

wp_update_core() {
    choose_domain || return
    _wp_cli "$SELECTED_DOMAIN" core update 2>/dev/null
    print_success "WordPress core updated."
}

wp_update_themes() {
    choose_domain || return
    _wp_cli "$SELECTED_DOMAIN" theme update --all 2>/dev/null
    print_success "Themes updated."
}

wp_update_plugins() {
    choose_domain || return
    _wp_cli "$SELECTED_DOMAIN" plugin update --all 2>/dev/null
    print_success "Plugins updated."
}

wp_delete_inactive() {
    choose_domain || return
    local domain="$SELECTED_DOMAIN"
    _wp_cli "$domain" theme delete $(_wp_cli "$domain" theme list --status=inactive --field=name 2>/dev/null) 2>/dev/null
    _wp_cli "$domain" plugin delete $(_wp_cli "$domain" plugin list --status=inactive --field=name 2>/dev/null) 2>/dev/null
    print_success "Inactive themes/plugins deleted."
}

wp_delete_drafts() {
    choose_domain || return
    _wp_cli "$SELECTED_DOMAIN" post delete $(_wp_cli "$SELECTED_DOMAIN" post list --post_status=draft,trash,auto-draft --format=ids 2>/dev/null) --force 2>/dev/null
    _wp_cli "$SELECTED_DOMAIN" post delete $(_wp_cli "$SELECTED_DOMAIN" post list --post_type=revision --format=ids 2>/dev/null) --force 2>/dev/null
    print_success "Draft/trash/revision posts deleted."
}

wp_delete_spam() {
    choose_domain || return
    _wp_cli "$SELECTED_DOMAIN" comment delete $(_wp_cli "$SELECTED_DOMAIN" comment list --status=spam --format=ids 2>/dev/null) --force 2>/dev/null
    print_success "Spam comments deleted."
}

wp_webp_support() {
    print_info "WebP support: Add WebP mapping to Nginx global config."
    print_info "Already configured in /etc/myvps/nginx/global.conf"
}

wp_move_config() {
    choose_domain || return
    local domain="$SELECTED_DOMAIN"
    local username=$(get_username "$domain")
    local src="/home/$username/$domain/public_html/wp-config.php"
    local dst="/home/$username/$domain/wp-config.php"

    if [[ -f "$src" ]]; then
        mv "$src" "$dst"
        chmod 0400 "$dst"
        print_success "wp-config.php moved outside public_html"
    else
        print_error "wp-config.php not found."
    fi
}

wp_disable_file_edit() {
    choose_domain || return
    local domain="$SELECTED_DOMAIN"
    local username=$(get_username "$domain")
    local config="/home/$username/$domain/public_html/wp-config.php"

    if [[ ! -f "$config" ]]; then
        config="/home/$username/$domain/wp-config.php"
    fi

    if [[ -f "$config" ]]; then
        if ! grep -q "DISALLOW_FILE_EDIT" "$config"; then
            sed -i "/<?php/a define('DISALLOW_FILE_EDIT', true);" "$config"
        fi
        if ! grep -q "DISALLOW_FILE_MODS" "$config"; then
            sed -i "/<?php/a define('DISALLOW_FILE_MODS', true);" "$config"
        fi
        print_success "File edit/mods disabled in WordPress."
    else
        print_error "wp-config.php not found."
    fi
}
