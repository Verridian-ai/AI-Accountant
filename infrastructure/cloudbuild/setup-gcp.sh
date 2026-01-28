#!/bin/bash
# =============================================================================
# GCP Setup Script for AI Accountant Deployment
# =============================================================================
# This script sets up the required GCP resources for Cloud Run deployment.
#
# Prerequisites:
# - gcloud CLI installed and authenticated
# - Appropriate GCP permissions (Owner or Editor role)
#
# Usage:
#   chmod +x setup-gcp.sh
#   ./setup-gcp.sh <project-id> <region>

set -e

PROJECT_ID="${1:-$(gcloud config get-value project)}"
REGION="${2:-australia-southeast1}"
ARTIFACT_REGISTRY="ai-accountant"
BACKEND_SERVICE="ai-accountant-backend"
WORKER_JOB="ai-accountant-worker"

echo "=========================================="
echo "Setting up GCP resources for AI Accountant"
echo "=========================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Set the project
gcloud config set project "$PROJECT_ID"

# Enable required APIs
echo "[1/8] Enabling required APIs..."
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    sqladmin.googleapis.com \
    secretmanager.googleapis.com \
    cloudresourcemanager.googleapis.com

# Create Artifact Registry repository
echo "[2/8] Creating Artifact Registry repository..."
gcloud artifacts repositories create "$ARTIFACT_REGISTRY" \
    --repository-format=docker \
    --location="$REGION" \
    --description="AI Accountant Docker images" \
    2>/dev/null || echo "Repository already exists"

# Create service accounts
echo "[3/8] Creating service accounts..."

# Backend service account
gcloud iam service-accounts create "$BACKEND_SERVICE" \
    --display-name="AI Accountant Backend Service" \
    2>/dev/null || echo "Backend service account already exists"

# Worker service account
gcloud iam service-accounts create "$WORKER_JOB" \
    --display-name="AI Accountant Worker Service" \
    2>/dev/null || echo "Worker service account already exists"

# Grant permissions to service accounts
echo "[4/8] Granting IAM permissions..."

# Backend permissions
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$BACKEND_SERVICE@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudsql.client" --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$BACKEND_SERVICE@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$BACKEND_SERVICE@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.objectViewer" --quiet

# Worker permissions
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$WORKER_JOB@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudsql.client" --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$WORKER_JOB@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" --quiet

# Cloud Build permissions
echo "[5/8] Granting Cloud Build permissions..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
    --role="roles/run.admin" --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser" --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" --quiet

# Create secrets (placeholders - update with actual values)
echo "[6/8] Creating secrets in Secret Manager..."

create_secret() {
    local name=$1
    local placeholder=$2

    if ! gcloud secrets describe "$name" --project="$PROJECT_ID" &>/dev/null; then
        echo "$placeholder" | gcloud secrets create "$name" \
            --data-file=- \
            --replication-policy="automatic" \
            --project="$PROJECT_ID"
        echo "Created secret: $name (UPDATE WITH REAL VALUE!)"
    else
        echo "Secret already exists: $name"
    fi
}

create_secret "openai-api-key" "sk-placeholder-update-me"
create_secret "openrouter-api-key" "sk-or-placeholder-update-me"
create_secret "jwt-secret" "$(openssl rand -hex 32)"
create_secret "database-url" "postgresql://postgres:PASSWORD@/ai_accountant?host=/cloudsql/${PROJECT_ID}:${REGION}:ai-accountant-db"
create_secret "langfuse-public-key" "pk-placeholder-update-me"
create_secret "langfuse-secret-key" "sk-placeholder-update-me"

# Create Cloud SQL instance (PostgreSQL)
echo "[7/8] Creating Cloud SQL instance..."
if ! gcloud sql instances describe "ai-accountant-db" --project="$PROJECT_ID" &>/dev/null; then
    gcloud sql instances create "ai-accountant-db" \
        --database-version=POSTGRES_15 \
        --tier=db-f1-micro \
        --region="$REGION" \
        --storage-type=SSD \
        --storage-size=10GB \
        --storage-auto-increase \
        --backup-start-time=04:00 \
        --enable-point-in-time-recovery \
        --database-flags=max_connections=100

    # Create database
    gcloud sql databases create "ai_accountant" \
        --instance="ai-accountant-db"

    echo "Cloud SQL instance created. Set password with:"
    echo "  gcloud sql users set-password postgres --instance=ai-accountant-db --password=<YOUR_PASSWORD>"
else
    echo "Cloud SQL instance already exists"
fi

# Create Cloud Build trigger (optional)
echo "[8/8] Setting up Cloud Build trigger..."
echo "To create a Cloud Build trigger for automatic deployments, run:"
echo ""
echo "  gcloud builds triggers create github \\"
echo "    --name=\"ai-accountant-deploy\" \\"
echo "    --repo-owner=\"<GITHUB_USER>\" \\"
echo "    --repo-name=\"<REPO_NAME>\" \\"
echo "    --branch-pattern=\"^main\$\" \\"
echo "    --build-config=\"infrastructure/cloudbuild/cloudbuild.yaml\""
echo ""

echo "=========================================="
echo "Setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Update secrets with real values:"
echo "   gcloud secrets versions add openai-api-key --data-file=-"
echo "   gcloud secrets versions add openrouter-api-key --data-file=-"
echo ""
echo "2. Set Cloud SQL password:"
echo "   gcloud sql users set-password postgres --instance=ai-accountant-db --password=<PASSWORD>"
echo ""
echo "3. Update the database-url secret with the correct password"
echo ""
echo "4. Run the first deployment:"
echo "   gcloud builds submit --config infrastructure/cloudbuild/cloudbuild.yaml ."
echo ""
