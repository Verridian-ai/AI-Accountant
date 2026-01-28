#!/bin/bash
#
# 07-setup-domain.sh
# Configure custom domain and SSL for Cloud Run
#
# Usage: ./07-setup-domain.sh [--domain=DOMAIN] [--load-balancer]
#
set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../.."
[ -f "$PROJECT_ROOT/.gcp-config" ] && source "$PROJECT_ROOT/.gcp-config"
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${GCP_REGION:-australia-southeast1}"
SERVICE_NAME="${BACKEND_SERVICE_NAME:-ai-accountant-backend}"
CUSTOM_DOMAIN=""
USE_LOAD_BALANCER=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --domain=*) CUSTOM_DOMAIN="${1#*=}"; shift ;;
        --load-balancer) USE_LOAD_BALANCER=true; shift ;;
        --service=*) SERVICE_NAME="${1#*=}"; shift ;;
        *) shift ;;
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
    gcloud run services describe "$SERVICE_NAME" --region="$REGION" --project="$PROJECT_ID" &> /dev/null || { log_error "Service not found"; exit 1; }
    log_success "Prerequisites check passed"
}
prompt_for_domain() {
    if [ -z "$CUSTOM_DOMAIN" ]; then
        echo -e "${CYAN}Enter your custom domain (e.g., api.example.com):${NC}"
        read -p "Domain: " CUSTOM_DOMAIN
        [ -z "$CUSTOM_DOMAIN" ] && { log_error "No domain provided"; exit 1; }
    fi
}
setup_domain_mapping() {
    log_info "Setting up domain mapping for $CUSTOM_DOMAIN..."
    if gcloud run domain-mappings describe --domain="$CUSTOM_DOMAIN" --region="$REGION" --project="$PROJECT_ID" &> /dev/null; then
        log_warning "Domain mapping already exists"
        return
    fi
    gcloud run domain-mappings create --service="$SERVICE_NAME" --domain="$CUSTOM_DOMAIN" --region="$REGION" --project="$PROJECT_ID"
    log_success "Domain mapping created"
}
get_dns_records() {
    log_info "Getting DNS records..."
    echo ""
    echo -e "${CYAN}========================================"
    echo -e "  DNS Configuration Required"
    echo -e "========================================${NC}"
    echo ""
    gcloud run domain-mappings describe --domain="$CUSTOM_DOMAIN" --region="$REGION" --project="$PROJECT_ID" --format="yaml(resourceRecords)"
    echo ""
    echo -e "${YELLOW}Add the above DNS records to your domain registrar.${NC}"
}
setup_load_balancer() {
    [ "$USE_LOAD_BALANCER" = false ] && return
    log_info "Setting up Cloud Load Balancer..."
    LB_NAME="ai-accountant-lb"
    NEG_NAME="ai-accountant-neg"
    BACKEND_NAME="ai-accountant-backend-service"
    URL_MAP_NAME="ai-accountant-url-map"
    HTTPS_PROXY_NAME="ai-accountant-https-proxy"
    CERT_NAME="ai-accountant-cert"
    # Reserve static IP
    log_info "Reserving static IP..."
    gcloud compute addresses describe "$LB_NAME-ip" --global --project="$PROJECT_ID" &> /dev/null || \
        gcloud compute addresses create "$LB_NAME-ip" --global --project="$PROJECT_ID"
    STATIC_IP=$(gcloud compute addresses describe "$LB_NAME-ip" --global --project="$PROJECT_ID" --format="value(address)")
    log_success "Static IP: $STATIC_IP"
    # Create serverless NEG
    log_info "Creating serverless NEG..."
    gcloud compute network-endpoint-groups describe "$NEG_NAME" --region="$REGION" --project="$PROJECT_ID" &> /dev/null || \
        gcloud compute network-endpoint-groups create "$NEG_NAME" --region="$REGION" --network-endpoint-type=serverless --cloud-run-service="$SERVICE_NAME" --project="$PROJECT_ID"
    # Create backend service
    log_info "Creating backend service..."
    if ! gcloud compute backend-services describe "$BACKEND_NAME" --global --project="$PROJECT_ID" &> /dev/null; then
        gcloud compute backend-services create "$BACKEND_NAME" --global --project="$PROJECT_ID"
        gcloud compute backend-services add-backend "$BACKEND_NAME" --global --network-endpoint-group="$NEG_NAME" --network-endpoint-group-region="$REGION" --project="$PROJECT_ID"
    fi
    # Create URL map
    log_info "Creating URL map..."
    gcloud compute url-maps describe "$URL_MAP_NAME" --project="$PROJECT_ID" &> /dev/null || \
        gcloud compute url-maps create "$URL_MAP_NAME" --default-service="$BACKEND_NAME" --project="$PROJECT_ID"
    # Create managed SSL certificate
    log_info "Creating managed SSL certificate..."
    gcloud compute ssl-certificates describe "$CERT_NAME" --project="$PROJECT_ID" &> /dev/null || \
        gcloud compute ssl-certificates create "$CERT_NAME" --domains="$CUSTOM_DOMAIN" --global --project="$PROJECT_ID"
    # Create HTTPS proxy
    log_info "Creating HTTPS proxy..."
    gcloud compute target-https-proxies describe "$HTTPS_PROXY_NAME" --project="$PROJECT_ID" &> /dev/null || \
        gcloud compute target-https-proxies create "$HTTPS_PROXY_NAME" --url-map="$URL_MAP_NAME" --ssl-certificates="$CERT_NAME" --project="$PROJECT_ID"
    # Create forwarding rule
    log_info "Creating forwarding rule..."
    gcloud compute forwarding-rules describe "ai-accountant-https-rule" --global --project="$PROJECT_ID" &> /dev/null || \
        gcloud compute forwarding-rules create "ai-accountant-https-rule" --global --target-https-proxy="$HTTPS_PROXY_NAME" --address="$LB_NAME-ip" --ports=443 --project="$PROJECT_ID"
    log_success "Load Balancer configured"
    echo ""
    echo -e "${CYAN}Add A record: $CUSTOM_DOMAIN -> $STATIC_IP${NC}"
}
output_configuration() {
    echo ""
    echo -e "${GREEN}========================================"
    echo -e "  Domain Configuration Summary"
    echo -e "========================================${NC}"
    SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --project="$PROJECT_ID" --format="value(status.url)")
    echo -e "Service:       ${BLUE}$SERVICE_NAME${NC}"
    echo -e "Cloud Run URL: ${BLUE}$SERVICE_URL${NC}"
    echo -e "Custom Domain: ${CYAN}https://$CUSTOM_DOMAIN${NC}"
    [ "$USE_LOAD_BALANCER" = true ] && echo -e "Static IP:     ${BLUE}$STATIC_IP${NC}"
    echo ""
    cat >> "$PROJECT_ROOT/.gcp-config" << EOF
export CUSTOM_DOMAIN="$CUSTOM_DOMAIN"
export CUSTOM_DOMAIN_URL="https://$CUSTOM_DOMAIN"
EOF
    log_success "Config appended"
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Add DNS records to your domain registrar"
    echo "2. Wait for DNS propagation (up to 48 hours)"
    echo "3. SSL certificate provisioned automatically"
}
main() {
    echo -e "${BLUE}========================================"
    echo -e "  AI Accountant - Domain Setup"
    echo -e "========================================${NC}"
    check_prerequisites
    prompt_for_domain
    if [ "$USE_LOAD_BALANCER" = true ]; then
        setup_load_balancer
    else
        setup_domain_mapping
        get_dns_records
    fi
    output_configuration
    log_success "Domain setup completed!"
}
main "$@"