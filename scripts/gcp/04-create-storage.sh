#!/bin/bash
#
# 04-create-storage.sh
# Create Cloud Storage bucket for AI Accountant
#
# Usage: ./04-create-storage.sh [BUCKET_NAME]
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
BUCKET_NAME="${1:-${PROJECT_ID}-ai-accountant}"
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
check_prerequisites() {
    log_info "Checking prerequisites..."
    command -v gcloud &> /dev/null || { log_error "gcloud not installed"; exit 1; }
    command -v gsutil &> /dev/null || { log_error "gsutil not installed"; exit 1; }
    [ -z "$PROJECT_ID" ] && { log_error "No project ID"; exit 1; }
    log_success "Prerequisites check passed"
}
create_bucket() {
    log_info "Creating bucket '$BUCKET_NAME'..."
    if gsutil ls -b "gs://$BUCKET_NAME" &> /dev/null; then
        log_warning "Bucket already exists"
        return
    fi
    gsutil mb -p "$PROJECT_ID" -l "$REGION" -b on "gs://$BUCKET_NAME"
    log_success "Bucket created"
}
set_bucket_labels() {
    log_info "Setting bucket labels..."
    gsutil label ch -l "app:ai-accountant" -l "environment:production" "gs://$BUCKET_NAME"
    log_success "Labels set"
}
configure_lifecycle() {
    log_info "Configuring lifecycle policies..."
    LIFECYCLE_CONFIG=$(mktemp)
    cat > "$LIFECYCLE_CONFIG" << 'EOFLIFE'
{
  "lifecycle": {
    "rule": [
      {"action": {"type": "Delete"}, "condition": {"age": 365, "matchesPrefix": ["temp/"]}},
      {"action": {"type": "Delete"}, "condition": {"age": 30, "matchesPrefix": ["uploads/pending/"]}},
      {"action": {"type": "SetStorageClass", "storageClass": "NEARLINE"}, "condition": {"age": 90, "matchesPrefix": ["statements/"]}},
      {"action": {"type": "SetStorageClass", "storageClass": "COLDLINE"}, "condition": {"age": 365, "matchesPrefix": ["statements/"]}},
      {"action": {"type": "SetStorageClass", "storageClass": "ARCHIVE"}, "condition": {"age": 730, "matchesPrefix": ["statements/"]}}
    ]
  }
}
EOFLIFE
    gsutil lifecycle set "$LIFECYCLE_CONFIG" "gs://$BUCKET_NAME"
    rm "$LIFECYCLE_CONFIG"
    log_success "Lifecycle policies configured"
}
configure_cors() {
    log_info "Configuring CORS..."
    CORS_CONFIG=$(mktemp)
    cat > "$CORS_CONFIG" << 'EOFCORS'
[
  {
    "origin": ["*"],
    "method": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Length", "Content-Disposition", "Cache-Control", "x-goog-resumable", "x-goog-meta-*"],
    "maxAgeSeconds": 3600
  }
]
EOFCORS
    gsutil cors set "$CORS_CONFIG" "gs://$BUCKET_NAME"
    rm "$CORS_CONFIG"
    log_success "CORS configured"
    log_warning "CORS allows all origins (*). Restrict for production!"
}
create_folder_structure() {
    log_info "Creating folder structure..."
    for folder in "statements/" "uploads/pending/" "uploads/processed/" "exports/" "temp/" "backups/"; do
        echo "" | gsutil -q cp - "gs://$BUCKET_NAME/${folder}.keep" 2>/dev/null || true
    done
    log_success "Folder structure created"
}
set_iam_permissions() {
    log_info "Setting IAM permissions..."
    SA_BACKEND="ai-accountant-backend@${PROJECT_ID}.iam.gserviceaccount.com"
    SA_WORKER="ai-accountant-worker@${PROJECT_ID}.iam.gserviceaccount.com"
    gsutil iam ch "serviceAccount:${SA_BACKEND}:objectAdmin" "gs://$BUCKET_NAME" 2>/dev/null || true
    gsutil iam ch "serviceAccount:${SA_WORKER}:objectAdmin" "gs://$BUCKET_NAME" 2>/dev/null || true
    log_success "IAM permissions set"
}
configure_versioning() {
    log_info "Enabling versioning..."
    gsutil versioning set on "gs://$BUCKET_NAME"
    log_success "Versioning enabled"
}
output_configuration() {
    echo ""
    echo -e "${GREEN}========================================"
    echo -e "  Storage Configuration Summary"
    echo -e "========================================${NC}"
    echo -e "Bucket:      ${BLUE}$BUCKET_NAME${NC}"
    echo -e "Location:    ${BLUE}$REGION${NC}"
    echo -e "GS URL:      ${YELLOW}gs://$BUCKET_NAME${NC}"
    echo -e "HTTPS URL:   ${YELLOW}https://storage.googleapis.com/$BUCKET_NAME${NC}"
    echo ""
    echo -e "${CYAN}Folders:${NC} statements/, uploads/, exports/, temp/, backups/"
    echo ""
    cat >> "$SCRIPT_DIR/../../.gcp-config" << EOF
export GCS_BUCKET="$BUCKET_NAME"
export GCS_URL="gs://$BUCKET_NAME"
export STORAGE_HTTPS_URL="https://storage.googleapis.com/$BUCKET_NAME"
EOF
    log_success "Config appended to .gcp-config"
}
main() {
    echo -e "${BLUE}========================================"
    echo -e "  AI Accountant - Cloud Storage Setup"
    echo -e "========================================${NC}"
    check_prerequisites
    log_info "Project: $PROJECT_ID | Bucket: $BUCKET_NAME"
    create_bucket
    set_bucket_labels
    configure_versioning
    configure_lifecycle
    configure_cors
    create_folder_structure
    set_iam_permissions
    output_configuration
    log_success "Storage setup completed!"
}
main "$@"