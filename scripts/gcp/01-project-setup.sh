#!/bin/bash
#
# 01-project-setup.sh
# Initial GCP project setup for AI Accountant fintech application
#
# Usage: ./01-project-setup.sh [PROJECT_ID]
#

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DEFAULT_REGION="australia-southeast1"
DEFAULT_ZONE="australia-southeast1-b"
ARTIFACT_REPO_NAME="ai-accountant"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_prerequisites() {
    log_info "Checking prerequisites..."
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI is not installed"
        exit 1
    fi
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n 1 &> /dev/null; then
        log_error "Not authenticated. Run 'gcloud auth login'"
        exit 1
    fi
    log_success "Prerequisites check passed"
}

get_project_id() {
    if [ -n "$1" ]; then
        PROJECT_ID="$1"
    else
        PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
        if [ -z "$PROJECT_ID" ]; then
            log_error "No project ID. Usage: $0 [PROJECT_ID]"
            exit 1
        fi
    fi
    log_info "Using project: $PROJECT_ID"
}

enable_apis() {
    log_info "Enabling required APIs..."
    APIS=(
        "run.googleapis.com"
        "cloudbuild.googleapis.com"
        "artifactregistry.googleapis.com"
        "sqladmin.googleapis.com"
        "sql-component.googleapis.com"
        "secretmanager.googleapis.com"
        "storage.googleapis.com"
        "compute.googleapis.com"
        "vpcaccess.googleapis.com"
        "iam.googleapis.com"
        "monitoring.googleapis.com"
        "logging.googleapis.com"
        "cloudtrace.googleapis.com"
        "servicenetworking.googleapis.com"
    )
    for api in "${APIS[@]}"; do
        log_info "  Enabling $api..."
        gcloud services enable "$api" --project="$PROJECT_ID" --quiet || log_warning "Failed to enable $api"
    done
    log_success "APIs enabled"
}

set_default_region() {
    log_info "Setting default region to $DEFAULT_REGION..."
    gcloud config set compute/region "$DEFAULT_REGION" --quiet
    gcloud config set compute/zone "$DEFAULT_ZONE" --quiet
    gcloud config set run/region "$DEFAULT_REGION" --quiet
    log_success "Default region set"
}

create_artifact_registry() {
    log_info "Creating Artifact Registry..."
    if gcloud artifacts repositories describe "$ARTIFACT_REPO_NAME"         --location="$DEFAULT_REGION" --project="$PROJECT_ID" &> /dev/null; then
        log_warning "Repository already exists"
    else
        gcloud artifacts repositories create "$ARTIFACT_REPO_NAME"             --repository-format=docker             --location="$DEFAULT_REGION"             --description="AI Accountant Docker repository"             --project="$PROJECT_ID"
        log_success "Repository created"
    fi
    gcloud auth configure-docker "${DEFAULT_REGION}-docker.pkg.dev" --quiet
    log_success "Docker auth configured"
}

create_service_accounts() {
    log_info "Creating service accounts..."
    for SA in "ai-accountant-backend" "ai-accountant-worker"; do
        if ! gcloud iam service-accounts describe "${SA}@${PROJECT_ID}.iam.gserviceaccount.com" &> /dev/null; then
            gcloud iam service-accounts create "$SA"                 --display-name="AI Accountant ${SA#ai-accountant-}"                 --project="$PROJECT_ID"
            log_success "Created $SA"
        else
            log_warning "$SA already exists"
        fi
    done
    
    log_info "Granting IAM roles..."
    ROLES=("roles/cloudsql.client" "roles/secretmanager.secretAccessor" "roles/storage.objectAdmin" "roles/logging.logWriter" "roles/cloudtrace.agent")
    for role in "${ROLES[@]}"; do
        for SA in "ai-accountant-backend" "ai-accountant-worker"; do
            gcloud projects add-iam-policy-binding "$PROJECT_ID"                 --member="serviceAccount:${SA}@${PROJECT_ID}.iam.gserviceaccount.com"                 --role="$role" --quiet &> /dev/null || true
        done
    done
    gcloud projects add-iam-policy-binding "$PROJECT_ID"         --member="serviceAccount:ai-accountant-backend@${PROJECT_ID}.iam.gserviceaccount.com"         --role="roles/run.invoker" --quiet &> /dev/null || true
    log_success "IAM roles granted"
}

output_configuration() {
    echo ""
    echo -e "${GREEN}========================================"
    echo -e "  Project Configuration Summary"
    echo -e "========================================${NC}"
    echo -e "Project ID:        ${BLUE}$PROJECT_ID${NC}"
    echo -e "Region:            ${BLUE}$DEFAULT_REGION${NC}"
    echo -e "Artifact Registry: ${BLUE}${DEFAULT_REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO_NAME}${NC}"
    echo ""
    
    cat > .gcp-config << EOF
export GCP_PROJECT_ID="$PROJECT_ID"
export GCP_REGION="$DEFAULT_REGION"
export GCP_ZONE="$DEFAULT_ZONE"
export ARTIFACT_REGISTRY="${DEFAULT_REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO_NAME}"
export SA_BACKEND="ai-accountant-backend@${PROJECT_ID}.iam.gserviceaccount.com"
export SA_WORKER="ai-accountant-worker@${PROJECT_ID}.iam.gserviceaccount.com"
EOF
    log_success "Config saved to .gcp-config"
}

main() {
    echo -e "${BLUE}========================================"
    echo -e "  AI Accountant - GCP Project Setup"
    echo -e "========================================${NC}"
    check_prerequisites
    get_project_id "$1"
    enable_apis
    set_default_region
    create_artifact_registry
    create_service_accounts
    output_configuration
    log_success "Setup completed!"
}

main "$@"