# ==============================================================================
# Makefile for AI Accountant GCP Infrastructure
# Provides convenient commands for managing Terraform infrastructure
# ==============================================================================

.PHONY: help init plan apply destroy validate fmt check clean

# Default target
help:
	@echo "AI Accountant - Terraform Infrastructure Management"
	@echo ""
	@echo "Available commands:"
	@echo "  make init          - Initialize Terraform and download providers"
	@echo "  make validate      - Validate Terraform configuration"
	@echo "  make fmt           - Format Terraform files"
	@echo "  make plan          - Show planned infrastructure changes"
	@echo "  make apply         - Apply infrastructure changes"
	@echo "  make destroy       - Destroy all infrastructure (DANGEROUS)"
	@echo "  make check         - Run validation and formatting checks"
	@echo "  make clean         - Clean Terraform cache and state"
	@echo ""
	@echo "Secret management:"
	@echo "  make update-secrets - Update API keys in Secret Manager"
	@echo "  make show-secrets  - List all Secret Manager secrets"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy-backend - Build and deploy backend service"
	@echo "  make deploy-jobs   - Deploy Cloud Run jobs"
	@echo ""
	@echo "Monitoring:"
	@echo "  make logs          - View Cloud Run backend logs"
	@echo "  make status        - Show status of all services"
	@echo "  make outputs       - Show Terraform outputs"

# Initialize Terraform
init:
	@echo "Initializing Terraform..."
	terraform init

# Validate configuration
validate:
	@echo "Validating Terraform configuration..."
	terraform validate

# Format Terraform files
fmt:
	@echo "Formatting Terraform files..."
	terraform fmt -recursive

# Run all checks
check: validate fmt
	@echo "All checks passed!"

# Plan changes
plan:
	@echo "Planning infrastructure changes..."
	terraform plan

# Apply changes
apply:
	@echo "Applying infrastructure changes..."
	terraform apply

# Destroy infrastructure
destroy:
	@echo "WARNING: This will destroy ALL infrastructure!"
	@echo "Press Ctrl+C to cancel, or Enter to continue..."
	@read dummy
	terraform destroy

# Clean Terraform cache
clean:
	@echo "Cleaning Terraform cache..."
	rm -rf .terraform
	rm -f .terraform.lock.hcl
	rm -f terraform.tfstate.backup

# Show outputs
outputs:
	@echo "Terraform Outputs:"
	terraform output

# Update secrets in Secret Manager
update-secrets:
	@echo "Updating secrets in Secret Manager..."
	@echo "Enter OpenRouter API key:"
	@read OPENROUTER_KEY; echo -n "$$OPENROUTER_KEY" | gcloud secrets versions add openrouter-api-key --data-file=-
	@echo "Enter Stripe API key (or press Enter to skip):"
	@read STRIPE_KEY; [ -n "$$STRIPE_KEY" ] && echo -n "$$STRIPE_KEY" | gcloud secrets versions add stripe-api-key --data-file=- || echo "Skipped Stripe key"
	@echo "Secrets updated successfully!"

# Show all secrets
show-secrets:
	@echo "Secret Manager Secrets:"
	@gcloud secrets list --filter="labels.application=ai-accountant"

# Deploy backend service
deploy-backend:
	@echo "Building and deploying backend service..."
	@PROJECT_ID=$$(terraform output -raw project_id 2>/dev/null || gcloud config get-value project); \
	REGION=$$(terraform output -raw region 2>/dev/null || echo "australia-southeast1"); \
	SERVICE_NAME=$$(terraform output -raw backend_service_name 2>/dev/null || echo "ai-accountant-backend"); \
	cd ../../server && \
	gcloud builds submit --tag gcr.io/$$PROJECT_ID/backend:latest && \
	gcloud run deploy $$SERVICE_NAME \
		--image gcr.io/$$PROJECT_ID/backend:latest \
		--region $$REGION \
		--platform managed
	@echo "Backend deployed successfully!"

# Deploy Cloud Run jobs
deploy-jobs:
	@echo "Deploying Cloud Run jobs..."
	@PROJECT_ID=$$(terraform output -raw project_id 2>/dev/null || gcloud config get-value project); \
	REGION=$$(terraform output -raw region 2>/dev/null || echo "australia-southeast1"); \
	cd ../../server && \
	echo "Building PDF processor..." && \
	gcloud builds submit --tag gcr.io/$$PROJECT_ID/pdf-processor:latest --config cloudbuild-pdf-processor.yaml && \
	gcloud run jobs update ai-accountant-pdf-processor --image gcr.io/$$PROJECT_ID/pdf-processor:latest --region $$REGION && \
	echo "Building AI categorization..." && \
	gcloud builds submit --tag gcr.io/$$PROJECT_ID/ai-categorization:latest --config cloudbuild-ai-categorization.yaml && \
	gcloud run jobs update ai-accountant-ai-categorization --image gcr.io/$$PROJECT_ID/ai-categorization:latest --region $$REGION
	@echo "Jobs deployed successfully!"

# View backend logs
logs:
	@SERVICE_NAME=$$(terraform output -raw backend_service_name 2>/dev/null || echo "ai-accountant-backend"); \
	REGION=$$(terraform output -raw region 2>/dev/null || echo "australia-southeast1"); \
	gcloud run services logs read $$SERVICE_NAME --region $$REGION --limit 50

# Show status of all services
status:
	@echo "=== Cloud Run Services ==="
	@gcloud run services list --region australia-southeast1 --filter="metadata.labels.application=ai-accountant"
	@echo ""
	@echo "=== Cloud Run Jobs ==="
	@gcloud run jobs list --region australia-southeast1 --filter="metadata.labels.application=ai-accountant"
	@echo ""
	@echo "=== Cloud SQL Instances ==="
	@gcloud sql instances list --filter="labels.application=ai-accountant"
	@echo ""
	@echo "=== Cloud Storage Buckets ==="
	@gcloud storage buckets list --filter="labels.application=ai-accountant"

# Test infrastructure
test:
	@echo "Testing infrastructure..."
	@BACKEND_URL=$$(terraform output -raw backend_service_url 2>/dev/null); \
	if [ -n "$$BACKEND_URL" ]; then \
		echo "Testing backend health endpoint..."; \
		curl -f $$BACKEND_URL/health && echo "✓ Backend is healthy" || echo "✗ Backend health check failed"; \
	else \
		echo "Backend URL not found in outputs"; \
	fi

# Show costs (requires billing export to BigQuery)
costs:
	@echo "Cost estimation for AI Accountant infrastructure:"
	@echo ""
	@echo "Development (~$25/month):"
	@echo "  - Cloud SQL (db-f1-micro): ~$10/month"
	@echo "  - Cloud Run (low traffic): ~$5/month"
	@echo "  - Cloud Storage (10GB): ~$0.50/month"
	@echo "  - VPC Connector: ~$10/month"
	@echo ""
	@echo "Production (~$300-400/month):"
	@echo "  - Cloud SQL (db-n1-standard-2, HA): ~$200/month"
	@echo "  - Cloud Run (medium traffic): ~$50-100/month"
	@echo "  - Cloud Storage (100GB): ~$5/month"
	@echo "  - VPC Connector: ~$20/month"
	@echo "  - Cloud Armor: ~$20/month"
	@echo ""
	@echo "For actual costs, check GCP Billing Console"

# Setup development environment
setup-dev:
	@echo "Setting up development environment..."
	@cp terraform.tfvars.example terraform.tfvars
	@echo "Please edit terraform.tfvars with your project_id"
	@echo "Then run: make init && make apply"

# Setup production environment
setup-prod:
	@echo "Setting up production environment..."
	@cp terraform.tfvars.example terraform.tfvars
	@echo "Configuring production settings..."
	@sed -i 's/environment = "dev"/environment = "prod"/' terraform.tfvars || sed -i '' 's/environment = "dev"/environment = "prod"/' terraform.tfvars
	@sed -i 's/db_tier = "db-f1-micro"/db_tier = "db-n1-standard-2"/' terraform.tfvars || sed -i '' 's/db_tier = "db-f1-micro"/db_tier = "db-n1-standard-2"/' terraform.tfvars
	@sed -i 's/db_high_availability = false/db_high_availability = true/' terraform.tfvars || sed -i '' 's/db_high_availability = false/db_high_availability = true/' terraform.tfvars
	@sed -i 's/backend_min_instances = 0/backend_min_instances = 2/' terraform.tfvars || sed -i '' 's/backend_min_instances = 0/backend_min_instances = 2/' terraform.tfvars
	@sed -i 's/enable_cloud_armor = false/enable_cloud_armor = true/' terraform.tfvars || sed -i '' 's/enable_cloud_armor = false/enable_cloud_armor = true/' terraform.tfvars
	@echo "Production configuration applied!"
	@echo "Please edit terraform.tfvars to set project_id and review settings"
	@echo "Then run: make init && make apply"

# Backup Terraform state
backup-state:
	@echo "Backing up Terraform state..."
	@mkdir -p backups
	@cp terraform.tfstate backups/terraform.tfstate.$$(date +%Y%m%d_%H%M%S)
	@echo "State backed up to backups/"

# Check prerequisites
check-prereqs:
	@echo "Checking prerequisites..."
	@command -v terraform >/dev/null 2>&1 || { echo "✗ terraform not installed"; exit 1; }
	@echo "✓ terraform: $$(terraform version -json | jq -r .terraform_version)"
	@command -v gcloud >/dev/null 2>&1 || { echo "✗ gcloud not installed"; exit 1; }
	@echo "✓ gcloud: $$(gcloud version --format='value(version)')"
	@gcloud auth list --filter=status:ACTIVE --format="value(account)" >/dev/null 2>&1 || { echo "✗ gcloud not authenticated"; exit 1; }
	@echo "✓ gcloud authenticated as: $$(gcloud auth list --filter=status:ACTIVE --format='value(account)')"
	@echo ""
	@echo "All prerequisites met!"
