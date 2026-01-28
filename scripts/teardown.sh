#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$SCRIPT_DIR/.gcp-config" ] && source "$SCRIPT_DIR/.gcp-config"

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${GCP_REGION:-australia-southeast1}"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

confirm_teardown() {
    echo ""
    echo -e "${RED}========================================"
    echo -e "  WARNING: DESTRUCTIVE OPERATION"
    echo -e "========================================${NC}"
    echo ""
    echo "This will DELETE the following resources:"
    echo "  - Cloud Run services"
    echo "  - Cloud Run jobs"
    echo "  - Cloud SQL instance"
    echo "  - Cloud Storage bucket"
    echo "  - Secrets"
    echo "  - Service accounts"
    echo ""
    echo -e "${YELLOW}Project: $PROJECT_ID${NC}"
    echo ""
    read -p "Type 'DELETE' to confirm: " confirm
    [ "$confirm" != "DELETE" ] && { log_info "Aborted"; exit 0; }
}

export_data() {
    log_info "Exporting data before teardown..."
    BACKUP_DIR="./backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    log_info "Exporting database..."
    gcloud sql export sql "ai-accountant-db" "gs://${PROJECT_ID}-ai-accountant/backups/teardown-backup.sql" \
        --database=ai_accountant --project="$PROJECT_ID" 2>/dev/null || log_warning "Database export failed"
    
    log_info "Downloading bucket contents..."
    gsutil -m cp -r "gs://${PROJECT_ID}-ai-accountant/*" "$BACKUP_DIR/" 2>/dev/null || log_warning "Bucket download failed"
    
    log_success "Data exported to $BACKUP_DIR"
}

delete_resources() {
    log_info "Deleting Cloud Run services..."
    gcloud run services delete ai-accountant-backend --region="$REGION" --project="$PROJECT_ID" --quiet 2>/dev/null || \
        log_warning "Service deletion failed or not found"
    
    log_info "Deleting Cloud Run jobs..."
    gcloud run jobs delete ai-accountant-worker --region="$REGION" --project="$PROJECT_ID" --quiet 2>/dev/null || \
        log_warning "Job deletion failed or not found"
    
    log_info "Deleting Cloud SQL instance..."
    gcloud sql instances delete ai-accountant-db --project="$PROJECT_ID" --quiet 2>/dev/null || \
        log_warning "Database deletion failed or not found"
    
    log_info "Deleting Cloud Storage bucket..."
    gsutil rm -r "gs://${PROJECT_ID}-ai-accountant" 2>/dev/null || \
        log_warning "Bucket deletion failed or not found"
    
    log_info "Deleting secrets..."
    for secret in openrouter-api-key jwt-secret database-password session-secret encryption-key stripe-secret-key stripe-webhook-secret; do
        gcloud secrets delete "$secret" --project="$PROJECT_ID" --quiet 2>/dev/null || true
    done
    
    log_info "Deleting service accounts..."
    for sa in ai-accountant-backend ai-accountant-worker; do
        gcloud iam service-accounts delete "${sa}@${PROJECT_ID}.iam.gserviceaccount.com" \
            --project="$PROJECT_ID" --quiet 2>/dev/null || true
    done
    
    log_success "Resources deleted"
}

main() {
    echo -e "${BLUE}========================================"
    echo -e "  AI Accountant - Teardown"
    echo -e "========================================${NC}"
    
    [ -z "$PROJECT_ID" ] && { log_error "No project ID"; exit 1; }
    
    confirm_teardown
    
    read -p "Export data before deletion? (y/n): " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]] && export_data
    
    delete_resources
    
    rm -f "$SCRIPT_DIR/.gcp-config"
    
    echo ""
    echo -e "${GREEN}========================================"
    echo -e "  Teardown Complete"
    echo -e "========================================${NC}"
    log_success "All resources have been deleted"
}

main "$@"
