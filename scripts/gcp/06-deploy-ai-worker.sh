#!/bin/bash
#
# 06-deploy-ai-worker.sh
# Build and deploy AI worker as Cloud Run Job
#
# Usage: ./06-deploy-ai-worker.sh [--tag=TAG] [--test]
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
JOB_NAME="ai-accountant-worker"
IMAGE_TAG="${IMAGE_TAG:-latest}"
MEMORY="${MEMORY:-2Gi}"
CPU="${CPU:-2}"
TASK_TIMEOUT="${TASK_TIMEOUT:-3600}"
MAX_RETRIES="${MAX_RETRIES:-3}"
RUN_TEST=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --tag=*) IMAGE_TAG="${1#*=}"; shift ;;
        --memory=*) MEMORY="${1#*=}"; shift ;;
        --cpu=*) CPU="${1#*=}"; shift ;;
        --test) RUN_TEST=true; shift ;;
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
    log_success "Prerequisites check passed"
}
get_config_values() {
    DB_CONNECTION_NAME="${DB_CONNECTION_NAME:-$PROJECT_ID:$REGION:ai-accountant-db}"
    GCS_BUCKET="${GCS_BUCKET:-$PROJECT_ID-ai-accountant}"
    SA_WORKER="${SA_WORKER:-ai-accountant-worker@$PROJECT_ID.iam.gserviceaccount.com}"
    ARTIFACT_REGISTRY="${ARTIFACT_REGISTRY:-$REGION-docker.pkg.dev/$PROJECT_ID/ai-accountant}"
    IMAGE_URL="$ARTIFACT_REGISTRY/$JOB_NAME:$IMAGE_TAG"
}
build_image() {
    log_info "Building AI worker Docker image..."
    cd "$PROJECT_ROOT/server"
    DOCKERFILE="Dockerfile.worker"
    [ ! -f "$DOCKERFILE" ] && { DOCKERFILE="Dockerfile"; log_warning "Using main Dockerfile"; }
    docker build -t "$IMAGE_URL" -f "$DOCKERFILE" --platform linux/amd64 .
    log_success "Image built: $IMAGE_URL"
}
push_image() {
    log_info "Pushing to Artifact Registry..."
    gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet 2>/dev/null || true
    docker push "$IMAGE_URL"
    log_success "Image pushed"
}
create_or_update_job() {
    log_info "Creating/updating Cloud Run Job..."
    if gcloud run jobs describe "$JOB_NAME" --region="$REGION" --project="$PROJECT_ID" &> /dev/null; then
        log_info "Updating existing job..."
        ACTION="update"
    else
        log_info "Creating new job..."
        ACTION="create"
    fi
    gcloud run jobs $ACTION $JOB_NAME \
        --image="$IMAGE_URL" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --service-account="$SA_WORKER" \
        --memory="$MEMORY" \
        --cpu="$CPU" \
        --task-timeout="${TASK_TIMEOUT}s" \
        --max-retries="$MAX_RETRIES" \
        --parallelism=1 \
        --tasks=1 \
        --add-cloudsql-instances="$DB_CONNECTION_NAME" \
        --set-env-vars=NODE_ENV=production \
        --set-env-vars=WORKER_MODE=true \
        --set-env-vars=GCS_BUCKET="$GCS_BUCKET" \
        --set-env-vars=DATABASE_HOST=/cloudsql/$DB_CONNECTION_NAME \
        --set-env-vars=DATABASE_NAME=ai_accountant \
        --set-env-vars=DATABASE_USER=ai_accountant_app \
        --set-secrets=DATABASE_PASSWORD=database-password:latest \
        --set-secrets=OPENROUTER_API_KEY=openrouter-api-key:latest \
        --set-secrets=ENCRYPTION_KEY=encryption-key:latest \
        --labels=app=ai-accountant,component=worker
    log_success "Cloud Run Job configured"
}
test_job_execution() {
    [ "$RUN_TEST" = false ] && return
    log_info "Testing job execution..."
    EXECUTION_NAME=$(gcloud run jobs execute "$JOB_NAME" --region="$REGION" --project="$PROJECT_ID" --format="value(metadata.name)" --wait)
    log_info "Execution: $EXECUTION_NAME"
    local max_attempts=60 attempt=0
    while [ $attempt -lt $max_attempts ]; do
        STATUS=$(gcloud run jobs executions describe "$EXECUTION_NAME" --region="$REGION" --project="$PROJECT_ID" --format="value(status.conditions[0].type)" 2>/dev/null || echo "Running")
        [ "$STATUS" = "Completed" ] && { log_success "Job completed!"; return 0; }
        [ "$STATUS" = "Failed" ] && { log_error "Job failed"; return 1; }
        echo -ne "\r${BLUE}[INFO]${NC} Status: $STATUS..."
        sleep 10
        ((attempt++))
    done
    log_warning "Test timeout"
}
setup_scheduler() {
    log_info "Setting up Cloud Scheduler..."
    SCHEDULER_NAME="ai-accountant-worker-daily"
    if ! gcloud services list --enabled --filter="name:cloudscheduler.googleapis.com" --project="$PROJECT_ID" | grep -q cloudscheduler; then
        log_warning "Scheduler API not enabled, skipping"
        return
    fi
    if gcloud scheduler jobs describe "$SCHEDULER_NAME" --location="$REGION" --project="$PROJECT_ID" &> /dev/null; then
        log_warning "Scheduler already exists"
        return
    fi
    gcloud scheduler jobs create http "$SCHEDULER_NAME" \
        --location="$REGION" \
        --project="$PROJECT_ID" \
        --schedule="0 2 * * *" \
        --time-zone="Australia/Sydney" \
        --uri="https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT_ID/jobs/$JOB_NAME:run" \
        --http-method=POST \
        --oauth-service-account-email="$SA_WORKER" \
        --description="Daily AI processing job" || log_warning "Scheduler setup failed"
    log_success "Scheduler configured for 2 AM AEST"
}
output_deployment_info() {
    echo ""
    echo -e "${GREEN}========================================"
    echo -e "  AI Worker Deployment Summary"
    echo -e "========================================${NC}"
    echo -e "Job:      ${BLUE}$JOB_NAME${NC}"
    echo -e "Image:    ${BLUE}$IMAGE_URL${NC}"
    echo -e "Memory:   ${BLUE}$MEMORY${NC} | CPU: ${BLUE}$CPU${NC}"
    echo -e "Timeout:  ${BLUE}${TASK_TIMEOUT}s${NC}"
    echo ""
    echo -e "${CYAN}Commands:${NC}"
    echo "  Execute:    gcloud run jobs execute $JOB_NAME --region=$REGION"
    echo "  Executions: gcloud run jobs executions list --job=$JOB_NAME --region=$REGION"
    echo ""
    cat >> "$PROJECT_ROOT/.gcp-config" << EOF
export WORKER_JOB_NAME="$JOB_NAME"
export WORKER_IMAGE="$IMAGE_URL"
EOF
    log_success "Config appended"
}
main() {
    echo -e "${BLUE}========================================"
    echo -e "  AI Accountant - AI Worker Deployment"
    echo -e "========================================${NC}"
    check_prerequisites
    get_config_values
    log_info "Project: $PROJECT_ID | Job: $JOB_NAME | Tag: $IMAGE_TAG"
    build_image
    push_image
    create_or_update_job
    setup_scheduler
    test_job_execution
    output_deployment_info
    log_success "AI Worker deployment completed!"
}
main "$@"