const fs = require("fs");
const path = require("path");

const gcpDir = "./scripts/gcp";
const scriptsDir = "./scripts";

fs.mkdirSync(gcpDir, { recursive: true });
fs.mkdirSync(scriptsDir, { recursive: true });

const script08 = `#\!/bin/bash
set -e

RED="\x1b[0;31m"
GREEN="\x1b[0;32m"
YELLOW="\x1b[1;33m"
BLUE="\x1b[0;34m"
NC="\x1b[0m"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../.."
[ -f "$PROJECT_ROOT/.gcp-config" ] && source "$PROJECT_ROOT/.gcp-config"

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${GCP_REGION:-australia-southeast1}"
SERVICE_NAME="${BACKEND_SERVICE_NAME:-ai-accountant-backend}"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

check_prerequisites() {
    log_info "Checking prerequisites..."
    command -v gcloud &>/dev/null || { echo "gcloud not installed"; exit 1; }
    [ -z "$PROJECT_ID" ] && { echo "No project ID"; exit 1; }
    log_success "Prerequisites check passed"
}

create_uptime_checks() {
    log_info "Creating uptime checks..."
    SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --project="$PROJECT_ID" --format="value(status.url)" 2>/dev/null || echo "")
    [ -z "$SERVICE_URL" ] && { log_warning "Could not get service URL"; return; }
    gcloud monitoring uptime check-configs create "ai-accountant-health" --project="$PROJECT_ID" --display-name="ai-accountant-health" --resource-type="uptime-url" --path="/health" --port=443 --check-interval=60 --timeout=10 --protocol=HTTPS 2>/dev/null || log_warning "Uptime check may exist"
    log_success "Uptime check configured"
}

create_log_based_metrics() {
    log_info "Creating log-based metrics..."
    METRIC="ai-accountant/error-logs"
    gcloud logging metrics describe "$METRIC" --project="$PROJECT_ID" &>/dev/null || gcloud logging metrics create "$METRIC" --project="$PROJECT_ID" --description="Error logs" --log-filter="resource.type=cloud_run_revision AND severity>=ERROR"
    log_success "Log-based metrics created"
}

output_configuration() {
    echo ""
    echo -e "${GREEN}========================================"
    echo -e "  Monitoring Configuration Summary"
    echo -e "========================================${NC}"
    echo -e "Project: ${BLUE}$PROJECT_ID${NC}"
    echo -e "Service: ${BLUE}$SERVICE_NAME${NC}"
    echo ""
    echo "Access Monitoring:"
    echo "  Dashboard: https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT_ID"
    echo "  Alerts:    https://console.cloud.google.com/monitoring/alerting?project=$PROJECT_ID"
    echo "  Logs:      https://console.cloud.google.com/logs?project=$PROJECT_ID"
    log_success "Monitoring setup completed\!"
}

main() {
    echo -e "${BLUE}========================================"
    echo -e "  AI Accountant - Monitoring Setup"
    echo -e "========================================${NC}"
    check_prerequisites
    create_uptime_checks
    create_log_based_metrics
    output_configuration
}

main "$@"
`;

fs.writeFileSync(path.join(gcpDir, "08-setup-monitoring.sh"), script08);
console.log("Created 08-setup-monitoring.sh");
