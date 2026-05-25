#!/bin/bash
#
# MyVPS - Database Management Module
#

database_handler() {
    local action="$1"
    shift
    case "$action" in
        create)   db_create "$@" ;;
        delete|rm) db_delete "$@" ;;
        list|ls)  db_list ;;
        info)     db_info "$@" ;;
        import)   db_import "$@" ;;
        export)   db_export "$@" ;;
        password) db_change_password "$@" ;;
        remote)   db_remote "$@" ;;
        backup)   db_backup "$@" ;;
        restore)  db_restore "$@" ;;
        *)
            if [[ -n "$action" ]]; then
                print_error "Unknown database action: $action"
            fi
            database_menu
            ;;
    esac
}

database_menu() {
    load_config
    echo ""
    print_subheader "Database Management - MariaDB"
    echo ""
    echo "  phpMyAdmin:  http://${ip:-localhost}:${port_admin:-$MYVPS_PORT_ADMIN}/phpmyadmin"
    echo "  DB Admin:    ${db_admin_user:-admin}"
    echo ""

    local options=(
        "List Databases"
        "Database Info"
        "Create Database"
        "Change DB User Password"
        "Delete Database"
        "Import Database"
        "Export Database"
        "Remote Database (on/off)"
        "Backup Database"
        "Restore Database"
    )

    PS3=$'\n'"Select (1-${#options[@]}) [0=Back]: "
    select opt in "${options[@]}"; do
        case $opt in
            "${options[0]}") db_list ;;
            "${options[1]}") db_info ;;
            "${options[2]}") db_create ;;
            "${options[3]}") db_change_password ;;
            "${options[4]}") db_delete ;;
            "${options[5]}") db_import ;;
            "${options[6]}") db_export ;;
            "${options[7]}") db_remote ;;
            "${options[8]}") db_backup ;;
            "${options[9]}") db_restore ;;
            *) return ;;
        esac
    done
}

db_list() {
    load_config
    echo ""
    print_subheader "Database List"
    echo ""
    mysql -u "$db_admin_user" -p"$db_admin_password" -e "SHOW DATABASES" 2>/dev/null | grep -v -E "^(Database|information_schema|performance_schema|mysql|sys)$"
}

db_info() {
    local db_name="${1:-}"
    load_config

    if [[ -z "$db_name" ]]; then
        read -p "Enter database name: " db_name
    fi

    echo ""
    print_subheader "Database Info: $db_name"
    echo ""

    echo "Tables:"
    mysql -u "$db_admin_user" -p"$db_admin_password" -e "USE \`$db_name\`; SHOW TABLES" 2>/dev/null

    echo ""
    echo "Size:"
    mysql -u "$db_admin_user" -p"$db_admin_password" -e "
        SELECT table_schema AS 'Database',
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
        FROM information_schema.tables
        WHERE table_schema = '$db_name'
        GROUP BY table_schema" 2>/dev/null
}

db_create() {
    local db_name="${1:-}"
    local db_user="${2:-}"
    local db_password="${3:-}"
    load_config

    echo ""
    print_subheader "Create Database"
    echo ""

    if [[ -z "$db_name" ]]; then
        read -p "Enter database name: " db_name
    fi
    if [[ -z "$db_user" ]]; then
        read -p "Enter database user: " db_user
    fi
    if [[ -z "$db_password" ]]; then
        db_password=$(generate_password 32)
        echo "Generated password: $db_password"
    fi

    mysql -u "$db_admin_user" -p"$db_admin_password" -e "CREATE DATABASE IF NOT EXISTS \`$db_name\`" 2>/dev/null
    mysql -u "$db_admin_user" -p"$db_admin_password" -e "CREATE USER IF NOT EXISTS '$db_user'@'localhost' IDENTIFIED BY '$db_password'" 2>/dev/null
    mysql -u "$db_admin_user" -p"$db_admin_password" -e "GRANT ALL PRIVILEGES ON \`$db_name\`.* TO '$db_user'@'localhost'" 2>/dev/null
    mysql -u "$db_admin_user" -p"$db_admin_password" -e "FLUSH PRIVILEGES" 2>/dev/null

    print_success "Database created:"
    echo "  DB Name:     $db_name"
    echo "  DB User:     $db_user"
    echo "  DB Password: $db_password"
}

db_delete() {
    local db_name="${1:-}"
    load_config

    if [[ -z "$db_name" ]]; then
        read -p "Enter database name to delete: " db_name
    fi

    if confirm "Delete database '$db_name' and its user?"; then
        local db_user="${db_name/_db/_user}"
        mysql -u "$db_admin_user" -p"$db_admin_password" -e "DROP DATABASE IF EXISTS \`$db_name\`" 2>/dev/null
        mysql -u "$db_admin_user" -p"$db_admin_password" -e "DROP USER IF EXISTS '$db_user'@'localhost'" 2>/dev/null
        mysql -u "$db_admin_user" -p"$db_admin_password" -e "FLUSH PRIVILEGES" 2>/dev/null
        print_success "Database $db_name deleted."
    fi
}

db_change_password() {
    local db_user="${1:-}"
    load_config

    if [[ -z "$db_user" ]]; then
        read -p "Enter database user: " db_user
    fi

    local new_password=$(generate_password 32)
    mysql -u "$db_admin_user" -p"$db_admin_password" -e "ALTER USER '$db_user'@'localhost' IDENTIFIED BY '$new_password'" 2>/dev/null
    mysql -u "$db_admin_user" -p"$db_admin_password" -e "FLUSH PRIVILEGES" 2>/dev/null

    print_success "Password changed for $db_user"
    echo "  New Password: $new_password"
}

db_import() {
    local db_name="${1:-}"
    local sql_file="${2:-}"
    load_config

    if [[ -z "$db_name" ]]; then
        read -p "Enter database name: " db_name
    fi
    if [[ -z "$sql_file" ]]; then
        read -p "Enter SQL file path: " sql_file
    fi

    if [[ ! -f "$sql_file" ]]; then
        print_error "File not found: $sql_file"
        return 1
    fi

    print_info "Importing $sql_file into $db_name..."

    if [[ "$sql_file" == *.gz ]]; then
        zcat "$sql_file" | mysql -u "$db_admin_user" -p"$db_admin_password" "$db_name" 2>/dev/null
    else
        mysql -u "$db_admin_user" -p"$db_admin_password" "$db_name" < "$sql_file" 2>/dev/null
    fi

    if [[ $? -eq 0 ]]; then
        print_success "Database imported successfully."
    else
        print_error "Import failed."
    fi
}

db_export() {
    local db_name="${1:-}"
    load_config

    if [[ -z "$db_name" ]]; then
        read -p "Enter database name: " db_name
    fi

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local export_file="$MYVPS_BACKUP_DIR/db/${db_name}_${timestamp}.sql.gz"

    print_info "Exporting $db_name..."
    mysqldump -u "$db_admin_user" -p"$db_admin_password" "$db_name" 2>/dev/null | gzip > "$export_file"

    if [[ $? -eq 0 ]]; then
        print_success "Database exported to: $export_file"
    else
        print_error "Export failed."
    fi
}

db_remote() {
    load_config
    local current_status="Disabled"
    if grep -q "#bind-address" /etc/my.cnf 2>/dev/null; then
        current_status="Enabled"
    fi

    echo ""
    echo "Remote Database: $current_status"
    echo ""

    if [[ "$current_status" == "Disabled" ]]; then
        if confirm "Enable remote database access?"; then
            sed -i 's/^bind-address/#bind-address/' /etc/my.cnf
            firewall_open_port 3306
            systemctl restart mariadb
            print_success "Remote database access enabled."
        fi
    else
        if confirm "Disable remote database access?"; then
            sed -i 's/^#bind-address/bind-address/' /etc/my.cnf
            firewall_close_port 3306
            systemctl restart mariadb
            print_success "Remote database access disabled."
        fi
    fi
}

db_backup() {
    db_export "$@"
}

db_restore() {
    db_import "$@"
}
