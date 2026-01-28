#!/bin/bash
#
# 03-create-database.sh
# Create Cloud SQL PostgreSQL instance for AI Accountant
#
# Usage: ./03-create-database.sh [--tier=TIER] [--storage=SIZE_GB]
#
set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$SCRIPT_DIR/../../.gcp-config" ] && source "$SCRIPT_DIR/../../.gcp-config"
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${GCP_REGION:-australia-southeast1}"
INSTANCE_NAME="ai-accountant-db"
DATABASE_NAME="ai_accountant"
DATABASE_USER="ai_accountant_app"
TIER="db-f1-micro"
STORAGE_SIZE="10"
POSTGRES_VERSION="POSTGRES_15"
while [[ $# -gt 0 ]]; do
    case $1 in
        --tier=*) TIER="${1#*=}"; shift ;;
        --storage=*) STORAGE_SIZE="${1#*=}"; shift ;;
        --instance=*) INSTANCE_NAME="${1#*=}"; shift ;;
        *) PROJECT_ID="$1"; shift ;;
    esac
done
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
check_prerequisites() {
    log_info "Checking prerequisites..."
    command -v gcloud &> /dev/null || { log_error "gcloud not installed"; exit 1; }
    [ -z "$PROJECT_ID" ] && { log_error "No project ID"; exit 1; }
    log_success "Prerequisites check passed"
}
get_database_password() {
    if gcloud secrets describe database-password --project="$PROJECT_ID" &> /dev/null; then
        DB_PASSWORD=$(gcloud secrets versions access latest --secret="database-password" --project="$PROJECT_ID")
        log_info "Retrieved password from Secret Manager"
    else
        DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
        log_warning "Generated new password (run 02-create-secrets.sh first)"
    fi
}
create_instance() {
    log_info "Creating Cloud SQL instance '$INSTANCE_NAME'..."
    if gcloud sql instances describe "$INSTANCE_NAME" --project="$PROJECT_ID" &> /dev/null; then
        log_warning "Instance already exists"
        INSTANCE_EXISTS=true
        return
    fi
    INSTANCE_EXISTS=false
    gcloud sql instances create "$INSTANCE_NAME" \
        --database-version="$POSTGRES_VERSION" \
        --tier="$TIER" \
        --region="$REGION" \
        --storage-size="$STORAGE_SIZE" \
        --storage-type=SSD \
        --storage-auto-increase \
        --backup-start-time="02:00" \
        --enable-point-in-time-recovery \
        --maintenance-window-day=SUN \
        --maintenance-window-hour=03 \
        --availability-type=zonal \
        --insights-config-query-insights-enabled \
        --project="$PROJECT_ID" \
        --async
    log_info "Instance creation initiated (5-10 minutes)..."
}
wait_for_instance() {
    log_info "Waiting for instance..."
    local max_attempts=60 attempt=0
    while [ $attempt -lt $max_attempts ]; do
        STATUS=$(gcloud sql instances describe "$INSTANCE_NAME" --project="$PROJECT_ID" --format="value(state)" 2>/dev/null || echo "PENDING")
        [ "$STATUS" = "RUNNABLE" ] && { log_success "Instance ready!"; return 0; }
        echo -ne "\r${BLUE}[INFO]${NC} Status: $STATUS (attempt $((attempt+1))/$max_attempts)..."
        sleep 10
        ((attempt++))
    done
    log_error "Timeout waiting for instance"
    exit 1
}
configure_ssl() {
    log_info "Requiring SSL connections..."
    gcloud sql instances patch "$INSTANCE_NAME" --require-ssl --project="$PROJECT_ID" --quiet
    log_success "SSL configured"
}
create_database() {
    log_info "Creating database '$DATABASE_NAME'..."
    if gcloud sql databases describe "$DATABASE_NAME" --instance="$INSTANCE_NAME" --project="$PROJECT_ID" &> /dev/null; then
        log_warning "Database already exists"
    else
        gcloud sql databases create "$DATABASE_NAME" --instance="$INSTANCE_NAME" --project="$PROJECT_ID"
        log_success "Database created"
    fi
}
create_user() {
    log_info "Creating user '$DATABASE_USER'..."
    get_database_password
    if gcloud sql users list --instance="$INSTANCE_NAME" --project="$PROJECT_ID" --format="value(name)" | grep -q "^${DATABASE_USER}$"; then
        log_warning "User exists, updating password..."
        gcloud sql users set-password "$DATABASE_USER" --instance="$INSTANCE_NAME" --password="$DB_PASSWORD" --project="$PROJECT_ID"
    else
        gcloud sql users create "$DATABASE_USER" --instance="$INSTANCE_NAME" --password="$DB_PASSWORD" --project="$PROJECT_ID"
        log_success "User created"
    fi
}
output_connection_info() {
    echo ""
    echo -e "${GREEN}========================================"
    echo -e "  Database Configuration Summary"
    echo -e "========================================${NC}"
    INSTANCE_CONNECTION=$(gcloud sql instances describe "$INSTANCE_NAME" --project="$PROJECT_ID" --format="value(connectionName)")
    PUBLIC_IP=$(gcloud sql instances describe "$INSTANCE_NAME" --project="$PROJECT_ID" --format="value(ipAddresses[0].ipAddress)")
    echo -e "Instance:    ${BLUE}$INSTANCE_NAME${NC}"
    echo -e "Connection:  ${BLUE}$INSTANCE_CONNECTION${NC}"
    echo -e "Database:    ${BLUE}$DATABASE_NAME${NC}"
    echo -e "User:        ${BLUE}$DATABASE_USER${NC}"
    echo -e "IP:          ${BLUE}$PUBLIC_IP${NC}"
    echo ""
    echo -e "${CYAN}Cloud Run flag:${NC}"
    echo "  --add-cloudsql-instances=$INSTANCE_CONNECTION"
    echo ""
    cat >> "$SCRIPT_DIR/../../.gcp-config" << EOF
export DB_INSTANCE_NAME="$INSTANCE_NAME"
export DB_CONNECTION_NAME="$INSTANCE_CONNECTION"
export DB_NAME="$DATABASE_NAME"
export DB_USER="$DATABASE_USER"
EOF
    log_success "Config appended to .gcp-config"
}
main() {
    echo -e "${BLUE}========================================"
    echo -e "  AI Accountant - Cloud SQL Setup"
    echo -e "========================================${NC}"
    check_prerequisites
    log_info "Project: $PROJECT_ID | Instance: $INSTANCE_NAME | Tier: $TIER"
    create_instance
    wait_for_instance
    configure_ssl
    create_database
    create_user
    output_connection_info
    log_success "Database setup completed!"
}
main "$@"