#!/bin/bash
#
# MyVPS - Backup & Restore Module
# Supports: Local backup, Cloud backup (rclone)
#

backup_handler() {
    local action="$1"
    shift
    case "$action" in
        create)  backup_create "$@" ;;
        restore) backup_restore "$@" ;;
        list)    backup_list ;;
        cloud)   backup_cloud_setup ;;
        *)
            if [[ -n "$action" ]]; then
                print_error "Unknown backup action: $action"
            fi
            backup_menu
            ;;
    esac
}

backup_menu() {
    echo ""
    print_subheader "Backup & Restore"
    echo ""

    local options=(
        "Backup Domain (Source + Database)"
        "Backup Database Only"
        "Restore Domain"
        "Restore Database"
        "List Backups"
        "Cloud Backup Setup (rclone)"
        "Scheduled Backup Settings"
    )

    PS3=$'\n'"Select (1-${#options[@]}) [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "${options[0]}") backup_create ;;
            "${options[1]}") backup_db_only ;;
            "${options[2]}") backup_restore ;;
            "${options[3]}") backup_restore_db ;;
            "${options[4]}") backup_list ;;
            "${options[5]}") backup_cloud_setup ;;
            "${options[6]}") backup_schedule ;;
            *) return ;;
        esac
    done
}

backup_create() {
    local domain="${1:-}"

    if [[ -z "$domain" ]]; then
        choose_domain || return
        domain="$SELECTED_DOMAIN"
    fi

    load_config
    load_domain_config "$domain"

    local username=$(get_username "$domain")
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="$MYVPS_BACKUP_DIR/source"
    local backup_file="${backup_dir}/${domain}_${timestamp}.tar.gz"

    print_info "Backing up $domain..."

    # Backup database
    if [[ -n "$db_name" ]]; then
        local db_file="/tmp/${db_name}_${timestamp}.sql.gz"
        mysqldump -u "$db_admin_user" -p"$db_admin_password" "$db_name" 2>/dev/null | gzip > "$db_file"
        cp "$db_file" "/home/$username/$domain/public_html/.database.sql.gz"
    fi

    # Backup source + config
    mkdir -p "/home/$username/$domain/public_html/.backup"
    cp "$MYVPS_USER_DIR/.$domain.conf" "/home/$username/$domain/public_html/.backup/"
    cp "/etc/nginx/conf.d/$domain.conf" "/home/$username/$domain/public_html/.backup/" 2>/dev/null
    cp "/etc/php-fpm.d/$domain.conf" "/home/$username/$domain/public_html/.backup/" 2>/dev/null

    # Create archive
    tar -czf "$backup_file" -C "/home/$username" "$domain"

    # Cleanup temp files
    rm -rf "/home/$username/$domain/public_html/.backup"
    rm -f "/home/$username/$domain/public_html/.database.sql.gz"
    rm -f "/tmp/${db_name}_${timestamp}.sql.gz" 2>/dev/null

    local size=$(du -sh "$backup_file" | cut -f1)
    print_success "Backup created: $backup_file ($size)"
}

backup_db_only() {
    local domain="${1:-}"

    if [[ -z "$domain" ]]; then
        choose_domain || return
        domain="$SELECTED_DOMAIN"
    fi

    load_config
    load_domain_config "$domain"

    if [[ -z "$db_name" ]]; then
        print_error "No database configured for $domain"
        return 1
    fi

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$MYVPS_BACKUP_DIR/db/${db_name}_${timestamp}.sql.gz"

    print_info "Backing up database $db_name..."
    mysqldump -u "$db_admin_user" -p"$db_admin_password" "$db_name" 2>/dev/null | gzip > "$backup_file"

    print_success "Database backup: $backup_file"
}

backup_restore() {
    echo ""
    print_subheader "Restore Domain"
    echo ""
    read -p "Enter backup file path: " backup_file

    if [[ ! -f "$backup_file" ]]; then
        print_error "Backup file not found: $backup_file"
        return 1
    fi

    print_warning "This will restore domain data from backup."
    if confirm "Continue?"; then
        print_info "Restoring from $backup_file..."
        tar -xzf "$backup_file" -C /tmp/

        local domain_dir=$(ls /tmp/ | head -1)
        if [[ -d "/tmp/$domain_dir" ]]; then
            print_success "Backup extracted. Manual configuration may be needed."
            echo "  Extracted to: /tmp/$domain_dir"
        fi
    fi
}

backup_restore_db() {
    load_config
    read -p "Database name: " db_name
    read -p "Backup file path (.sql or .sql.gz): " backup_file

    if [[ ! -f "$backup_file" ]]; then
        print_error "File not found."
        return 1
    fi

    if [[ "$backup_file" == *.gz ]]; then
        zcat "$backup_file" | mysql -u "$db_admin_user" -p"$db_admin_password" "$db_name" 2>/dev/null
    else
        mysql -u "$db_admin_user" -p"$db_admin_password" "$db_name" < "$backup_file" 2>/dev/null
    fi

    print_success "Database $db_name restored."
}

backup_list() {
    echo ""
    print_subheader "Available Backups"
    echo ""
    echo "Source backups:"
    ls -lh "$MYVPS_BACKUP_DIR/source/" 2>/dev/null || echo "  No backups found."
    echo ""
    echo "Database backups:"
    ls -lh "$MYVPS_BACKUP_DIR/db/" 2>/dev/null || echo "  No backups found."
}

backup_cloud_setup() {
    echo ""
    print_subheader "Cloud Backup Setup (rclone)"
    echo ""

    if ! command -v rclone &>/dev/null; then
        print_info "Installing rclone..."
        curl https://rclone.org/install.sh | bash
    fi

    print_info "Run 'rclone config' to set up cloud storage."
    print_info "Supported: Google Drive, S3, Backblaze, OneDrive, etc."
    echo ""
    rclone config
}

backup_schedule() {
    echo ""
    print_subheader "Scheduled Backup Settings"
    echo ""
    echo "Current cron backup schedules:"
    crontab -l 2>/dev/null | grep backup
    echo ""
    print_info "Edit crontab to modify backup schedules."
}
