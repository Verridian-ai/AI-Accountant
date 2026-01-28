#!/bin/bash
#
# 02-create-secrets.sh
# Create secrets in Google Secret Manager for AI Accountant
#
# Usage: ./02-create-secrets.sh [--non-interactive]
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
NON_INTERACTIVE=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --non-interactive) NON_INTERACTIVE=true; shift ;;
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
generate_random_secret() {
    openssl rand -base64 "${1:-32}" | tr -dc 'a-zA-Z0-9' | head -c "${1:-32}"
}
create_secret() {
    local name="$1" value="$2"
    if gcloud secrets describe "$name" --project="$PROJECT_ID" &> /dev/null; then
        log_warning "Secret '$name' already exists"
        if [ "$NON_INTERACTIVE" = false ]; then
            read -p "Add new version? (y/n): " -n 1 -r; echo
            [[ $REPLY =~ ^[Yy]$ ]] && echo -n "$value" | gcloud secrets versions add "$name" --data-file=- --project="$PROJECT_ID"
        fi
    else
        gcloud secrets create "$name" --replication-policy="user-managed" --locations="$REGION" --labels="app=ai-accountant" --project="$PROJECT_ID"
        echo -n "$value" | gcloud secrets versions add "$name" --data-file=- --project="$PROJECT_ID"
        log_success "Created secret '$name'"
    fi
}
grant_secret_access() {
    gcloud secrets add-iam-policy-binding "$1" --member="serviceAccount:$2" --role="roles/secretmanager.secretAccessor" --project="$PROJECT_ID" --quiet &> /dev/null || true
}
create_all_secrets() {
    SA_BACKEND="ai-accountant-backend@${PROJECT_ID}.iam.gserviceaccount.com"
    SA_WORKER="ai-accountant-worker@${PROJECT_ID}.iam.gserviceaccount.com"
    echo -e "${YELLOW}--- OpenRouter API Key ---${NC}"
    if [ "$NON_INTERACTIVE" = true ]; then
        OPENROUTER_KEY="${OPENROUTER_API_KEY:-placeholder}"
    else
        echo "Get your key from https://openrouter.ai/keys"
        read -sp "Enter OpenRouter API key: " OPENROUTER_KEY; echo
        [ -z "$OPENROUTER_KEY" ] && OPENROUTER_KEY="placeholder"
    fi
    create_secret "openrouter-api-key" "$OPENROUTER_KEY"
    grant_secret_access "openrouter-api-key" "$SA_BACKEND"
    grant_secret_access "openrouter-api-key" "$SA_WORKER"
    echo -e "${YELLOW}--- JWT Secret ---${NC}"
    create_secret "jwt-secret" "$(generate_random_secret 64)"
    grant_secret_access "jwt-secret" "$SA_BACKEND"
    echo -e "${YELLOW}--- Database Password ---${NC}"
    create_secret "database-password" "$(generate_random_secret 32)"
    grant_secret_access "database-password" "$SA_BACKEND"
    grant_secret_access "database-password" "$SA_WORKER"
    echo -e "${YELLOW}--- Session Secret ---${NC}"
    create_secret "session-secret" "$(generate_random_secret 48)"
    grant_secret_access "session-secret" "$SA_BACKEND"
    echo -e "${YELLOW}--- Encryption Key ---${NC}"
    create_secret "encryption-key" "$(generate_random_secret 32)"
    grant_secret_access "encryption-key" "$SA_BACKEND"
    grant_secret_access "encryption-key" "$SA_WORKER"
    if [ "$NON_INTERACTIVE" = false ]; then
        echo -e "${YELLOW}--- Stripe Keys (Optional) ---${NC}"
        read -p "Configure Stripe? (y/n): " -n 1 -r; echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            read -sp "Stripe Secret Key: " STRIPE_SECRET; echo
            [ -n "$STRIPE_SECRET" ] && { create_secret "stripe-secret-key" "$STRIPE_SECRET"; grant_secret_access "stripe-secret-key" "$SA_BACKEND"; }
            read -sp "Stripe Webhook Secret: " STRIPE_WEBHOOK; echo
            [ -n "$STRIPE_WEBHOOK" ] && { create_secret "stripe-webhook-secret" "$STRIPE_WEBHOOK"; grant_secret_access "stripe-webhook-secret" "$SA_BACKEND"; }
        fi
    fi
}
output_summary() {
    echo ""
    echo -e "${GREEN}========================================"
    echo -e "  Secrets Created Summary"
    echo -e "========================================${NC}"
    gcloud secrets list --project="$PROJECT_ID" --filter="labels.app=ai-accountant" --format="table(name,createTime)"
    echo ""
    log_success "Secrets setup completed!"
}
main() {
    echo -e "${BLUE}========================================"
    echo -e "  AI Accountant - Secret Manager Setup"
    echo -e "========================================${NC}"
    check_prerequisites
    log_info "Project: $PROJECT_ID"
    if [ "$NON_INTERACTIVE" = false ]; then
        read -p "Continue? (y/n): " -n 1 -r; echo
        [[ ! $REPLY =~ ^[Yy]$ ]] && exit 0
    fi
    create_all_secrets
    output_summary
}
main "$@"