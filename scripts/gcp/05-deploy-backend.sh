#!/bin/bash
#
# 05-deploy-backend.sh
# Build and deploy backend to Cloud Run
#
# Usage: ./05-deploy-backend.sh [--tag=TAG] [--min-instances=N] [--max-instances=N]
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
SERVICE_NAME="ai-accountant-backend"
IMAGE_TAG="${IMAGE_TAG:-latest}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"
MAX_INSTANCES="${MAX_INSTANCES:-10}"
MEMORY="${MEMORY:-512Mi}"
CPU="${CPU:-1}"
TIMEOUT="${TIMEOUT:-300}"
while [[ $# -gt 0 ]]; do
    case $1 in
        --tag=*) IMAGE_TAG="${1#*=}"; shift ;;
        --min-instances=*) MIN_INSTANCES="${1#*=}"; shift ;;
        --max-instances=*) MAX_INSTANCES="${1#*=}"; shift ;;
        --memory=*) MEMORY="${1#*=}"; shift ;;
        --cpu=*) CPU="${1#*=}"; shift ;;
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
    command -v docker &> /dev/null || { log_error "docker not installed"; exit 1; }
    [ -z "$PROJECT_ID" ] && { log_error "No project ID"; exit 1; }
    [ ! -f "$PROJECT_ROOT/server/Dockerfile" ] && { log_error "Dockerfile not found"; exit 1; }
    log_success "Prerequisites check passed"
}
get_config_values() {
    DB_CONNECTION_NAME="${DB_CONNECTION_NAME:-$PROJECT_ID:$REGION:ai-accountant-db}"
    GCS_BUCKET="${GCS_BUCKET:-$PROJECT_ID-ai-accountant}"
    SA_BACKEND="${SA_BACKEND:-ai-accountant-backend@$PROJECT_ID.iam.gserviceaccount.com}"
    ARTIFACT_REGISTRY="${ARTIFACT_REGISTRY:-$REGION-docker.pkg.dev/$PROJECT_ID/ai-accountant}"
    IMAGE_URL="$ARTIFACT_REGISTRY/$SERVICE_NAME:$IMAGE_TAG"
}
build_image() {
    log_info "Building Docker image..."
    cd "$PROJECT_ROOT/server"
    docker build -t "$IMAGE_URL" -f Dockerfile --platform linux/amd64 .
    log_success "Image built: $IMAGE_URL"
}
push_image() {
    log_info "Pushing to Artifact Registry..."
    gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet 2>/dev/null || true
    docker push "$IMAGE_URL"
    log_success "Image pushed"
}
deploy_to_cloud_run() {
    log_info "Deploying to Cloud Run..."
    gcloud run deploy $SERVICE_NAME \
        --image="$IMAGE_URL" \
        --platform=managed \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --service-account="$SA_BACKEND" \
        --memory="$MEMORY" \
        --cpu="$CPU" \
        --timeout="${TIMEOUT}s" \
        --min-instances="$MIN_INSTANCES" \
        --max-instances="$MAX_INSTANCES" \
        --port=3000 \
        --allow-unauthenticated \
        --add-cloudsql-instances="$DB_CONNECTION_NAME" \
        --set-env-vars=NODE_ENV=production \
        --set-env-vars=PORT=3000 \
        --set-env-vars=GCS_BUCKET="$GCS_BUCKET" \
        --set-env-vars=DATABASE_HOST=/cloudsql/$DB_CONNECTION_NAME \
        --set-env-vars=DATABASE_NAME=ai_accountant \
        --set-env-vars=DATABASE_USER=ai_accountant_app \
        --set-secrets=DATABASE_PASSWORD=database-password:latest \
        --set-secrets=JWT_SECRET=jwt-secret:latest \
        --set-secrets=OPENROUTER_API_KEY=openrouter-api-key:latest \
        --set-secrets=SESSION_SECRET=session-secret:latest \
        --set-secrets=ENCRYPTION_KEY=encryption-key:latest \
        --labels=app=ai-accountant,component=backend
    log_success "Deployed to Cloud Run"
}
get_service_url() {
    gcloud run services describe "$SERVICE_NAME" --platform=managed --region="$REGION" --project="$PROJECT_ID" --format="value(status.url)"
}
run_health_check() {
    log_info "Running health check..."
    SERVICE_URL=$(get_service_url)
    local max_attempts=30 attempt=0
    while [ $attempt -lt $max_attempts ]; do
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/health" 2>/dev/null || echo "000")
        [ "$HTTP_STATUS" = "200" ] && { log_success "Health check passed!"; return 0; }
        echo -ne "\r${BLUE}[INFO]${NC} Waiting... (attempt $((attempt+1))/$max_attempts, status: $HTTP_STATUS)"
        sleep 5
        ((attempt++))
    done
    log_warning "Health check timeout (service may still be starting)"
}
output_deployment_info() {
    echo ""
    echo -e "${GREEN}========================================"
    echo -e "  Backend Deployment Summary"
    echo -e "========================================${NC}"
    SERVICE_URL=$(get_service_url)
    echo -e "Service:  ${BLUE}$SERVICE_NAME${NC}"
    echo -e "Image:    ${BLUE}$IMAGE_URL${NC}"
    echo -e "URL:      ${CYAN}$SERVICE_URL${NC}"
    echo -e "Memory:   ${BLUE}$MEMORY${NC} | CPU: ${BLUE}$CPU${NC}"
    echo -e "Scaling:  ${BLUE}$MIN_INSTANCES - $MAX_INSTANCES${NC}"
    echo ""
    echo -e "${CYAN}Commands:${NC}"
    echo "  Logs:    gcloud run services logs read $SERVICE_NAME --region=$REGION"
    echo "  Metrics: gcloud run services describe $SERVICE_NAME --region=$REGION"
    echo ""
    cat >> "$PROJECT_ROOT/.gcp-config" << EOF
export BACKEND_SERVICE_NAME="$SERVICE_NAME"
export BACKEND_IMAGE="$IMAGE_URL"
export BACKEND_URL="$SERVICE_URL"
EOF
    log_success "Config appended"
}
main() {
    echo -e "${BLUE}========================================"
    echo -e "  AI Accountant - Backend Deployment"
    echo -e "========================================${NC}"
    check_prerequisites
    get_config_values
    log_info "Project: $PROJECT_ID | Service: $SERVICE_NAME | Tag: $IMAGE_TAG"
    build_image
    push_image
    deploy_to_cloud_run
    run_health_check
    output_deployment_info
    log_success "Backend deployment completed!"
}
main "$@"