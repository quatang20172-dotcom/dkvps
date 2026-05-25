#!/bin/bash
#
# MyVPS - Terminal Colors & UI
#

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Print functions
print_header() {
    echo -e "${CYAN}=========================================================================${NC}"
    echo -e "${WHITE}${BOLD}  $1${NC}"
    echo -e "${CYAN}=========================================================================${NC}"
}

print_subheader() {
    echo -e "${BLUE}-------------------------------------------------------------------------${NC}"
    echo -e "${WHITE}  $1${NC}"
    echo -e "${BLUE}-------------------------------------------------------------------------${NC}"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_line() {
    echo -e "${BLUE}-------------------------------------------------------------------------${NC}"
}

print_status_line() {
    local label="$1"
    local value="$2"
    local color="${3:-$WHITE}"
    printf "  ${BOLD}%-20s${NC}: ${color}%s${NC}\n" "$label" "$value"
}

# Confirm prompt
confirm() {
    local message="${1:-Are you sure?}"
    read -p "$message (y/n): " answer
    [[ "$answer" == "y" || "$answer" == "Y" ]]
}

# Input prompt with default
input_with_default() {
    local prompt="$1"
    local default="$2"
    local result
    if [[ -n "$default" ]]; then
        read -p "$prompt [$default]: " result
        echo "${result:-$default}"
    else
        read -p "$prompt: " result
        echo "$result"
    fi
}
