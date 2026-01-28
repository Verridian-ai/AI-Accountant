#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GCP_DIR="$SCRIPT_DIR/gcp"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_prerequisites() {
    log_info "Checking prerequisites..."
    command -v gcloud &>/dev/null || { log_error "gcloud CLI not installed"; exit 1; }
    command -v docker &>/dev/null || { log_error "Docker not installed"; exit 1; }
    log_success "Prerequisites check passed"
}

confirm_deployment() {
    echo ""
    echo -e "${YELLOW}This will deploy the AI Accountant application to GCP.${NC}"
    echo "The following steps will be executed:"
    echo "  1. Project setup (APIs, service accounts)"
    echo "  2. Create secrets"
    echo "  3. Create database"
    echo "  4. Create storage bucket"
    echo "  5. Deploy backend"
    echo "  6. Deploy AI worker"
    echo "  7. Setup monitoring"
    echo ""
    read -p "Continue? (y/n): " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && exit 0
}

run_script() {
    local script="$1"
    local name="$2"
    echo ""
    log_info "Running: $name"
    echo "========================================"
    bash "$script" || { log_error "Failed: $name"; exit 1; }
    log_success "Completed: $name"
}

main() {
    echo -e "${BLUE}========================================"
    echo -e "  AI Accountant - Full Deployment"
    echo -e "========================================${NC}"
    
    check_prerequisites
    confirm_deployment
    
    run_script "$GCP_DIR/01-project-setup.sh" "Project Setup"
    run_script "$GCP_DIR/02-create-secrets.sh" "Create Secrets"
    run_script "$GCP_DIR/03-create-database.sh" "Create Database"
    run_script "$GCP_DIR/04-create-storage.sh" "Create Storage"
    run_script "$GCP_DIR/05-deploy-backend.sh" "Deploy Backend"
    run_script "$GCP_DIR/06-deploy-ai-worker.sh" "Deploy AI Worker"
    run_script "$GCP_DIR/08-setup-monitoring.sh" "Setup Monitoring"
    
    echo ""
    echo -e "${GREEN}========================================"
    echo -e "  Deployment Complete!"
    echo -e "========================================${NC}"
    echo ""
    [ -f ".gcp-config" ] && source ".gcp-config" && echo -e "Backend URL: ${BACKEND_URL:-Not available}"
    echo ""
    log_success "Full deployment completed successfully!"
}

main "$@"
