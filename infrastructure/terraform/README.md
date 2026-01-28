# AI Accountant - GCP Infrastructure with Terraform

This directory contains Terraform configurations for deploying the AI Accountant fintech application on Google Cloud Platform (GCP) in the Australia Sydney region (`australia-southeast1`).

## Architecture Overview

The infrastructure provisions:

- **Cloud SQL PostgreSQL 15**: Managed database with automatic backups and private networking
- **Cloud Run Backend**: Hono TypeScript API with auto-scaling (1-100 instances)
- **Cloud Run Jobs**: Python AI agents for PDF processing and transaction categorization
- **Cloud Storage**: Secure bucket for bank statements and processed documents
- **Secret Manager**: Encrypted storage for API keys and credentials
- **Cloud Armor**: WAF with OWASP rules, rate limiting, and DDoS protection
- **VPC Networking**: Private IP connectivity between services
- **IAM**: Service accounts with least-privilege permissions

## Prerequisites

### 1. Install Required Tools

- **Terraform**: >= 1.5.0 ([Install Terraform](https://developer.hashicorp.com/terraform/downloads))
- **gcloud CLI**: Latest version ([Install gcloud](https://cloud.google.com/sdk/docs/install))
- **Git**: For version control

### 2. GCP Project Setup

Create a new GCP project or use an existing one:

```bash
# Set your project ID
export PROJECT_ID="your-gcp-project-id"

# Create a new project (optional)
gcloud projects create $PROJECT_ID --name="AI Accountant"

# Set the active project
gcloud config set project $PROJECT_ID

# Link a billing account (required)
gcloud billing accounts list
gcloud billing projects link $PROJECT_ID --billing-account=BILLING_ACCOUNT_ID
```

### 3. Enable Required APIs

The Terraform configuration automatically enables required APIs, but you can manually enable them:

```bash
gcloud services enable \
  compute.googleapis.com \
  cloudresourcemanager.googleapis.com \
  servicenetworking.googleapis.com \
  sqladmin.googleapis.com \
  run.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  vpcaccess.googleapis.com \
  iam.googleapis.com
```

### 4. Authenticate with GCP

```bash
# Authenticate with your Google account
gcloud auth login

# Set up application default credentials for Terraform
gcloud auth application-default login
```

## Initial Setup

### 1. Clone Repository and Navigate to Infrastructure Directory

```bash
cd infrastructure/terraform
```

### 2. Configure Variables

Copy the example variables file and update with your values:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and update:

```hcl
# REQUIRED: Update these values
project_id = "your-gcp-project-id"
project_name = "ai-accountant"
environment = "prod"

# Optional: Adjust resource sizing and configuration
db_tier = "db-g1-small"
backend_min_instances = 1
enable_cloud_armor = true
```

### 3. Initialize Terraform

```bash
# Initialize Terraform and download providers
terraform init
```

### 4. Review Planned Changes

```bash
# See what resources will be created
terraform plan
```

### 5. Deploy Infrastructure

```bash
# Apply the configuration
terraform apply

# Review the changes and type 'yes' to confirm
```

**Deployment time**: 10-15 minutes (Cloud SQL instance creation is the slowest)

## Post-Deployment Configuration

### 1. Update API Keys in Secret Manager

After deployment, update placeholder secrets with actual API keys:

```bash
# Update OpenRouter API key
echo -n "sk-or-v1-YOUR_ACTUAL_KEY" | gcloud secrets versions add openrouter-api-key --data-file=-

# Update Stripe API key (if using payments)
echo -n "sk_live_YOUR_ACTUAL_KEY" | gcloud secrets versions add stripe-api-key --data-file=-

# Verify secrets were updated
gcloud secrets versions list openrouter-api-key
gcloud secrets versions list stripe-api-key
```

### 2. Retrieve Deployment Information

```bash
# View all outputs
terraform output

# Get specific outputs
terraform output backend_service_url
terraform output storage_bucket_name
terraform output cloud_sql_connection_name
```

### 3. Build and Deploy Application Containers

#### Backend Service

```bash
# Navigate to server directory
cd ../../server

# Build container image
gcloud builds submit --tag gcr.io/$PROJECT_ID/backend:latest

# Deploy to Cloud Run (Terraform already created the service)
gcloud run deploy ai-accountant-backend \
  --image gcr.io/$PROJECT_ID/backend:latest \
  --region australia-southeast1 \
  --platform managed
```

#### PDF Processor Job

```bash
# Build container image
gcloud builds submit \
  --config cloudbuild-pdf-processor.yaml \
  --substitutions=_IMAGE_NAME=gcr.io/$PROJECT_ID/pdf-processor:latest

# Update Cloud Run job
gcloud run jobs update ai-accountant-pdf-processor \
  --image gcr.io/$PROJECT_ID/pdf-processor:latest \
  --region australia-southeast1
```

#### AI Categorization Job

```bash
# Build container image
gcloud builds submit \
  --config cloudbuild-ai-categorization.yaml \
  --substitutions=_IMAGE_NAME=gcr.io/$PROJECT_ID/ai-categorization:latest

# Update Cloud Run job
gcloud run jobs update ai-accountant-ai-categorization \
  --image gcr.io/$PROJECT_ID/ai-categorization:latest \
  --region australia-southeast1
```

### 4. Run Database Migrations

```bash
# Connect to Cloud SQL via proxy
cloud_sql_proxy -instances=INSTANCE_CONNECTION_NAME=tcp:5432

# In another terminal, run migrations
export DATABASE_URL="postgresql://app_user:PASSWORD@localhost:5432/accountant_db"
npm run migrate

# Or use Drizzle migrations
npx drizzle-kit push:pg
```

### 5. Test Cloud Run Jobs

```bash
# Test PDF processor job
gcloud run jobs execute ai-accountant-pdf-processor \
  --region australia-southeast1 \
  --wait

# Test AI categorization job
gcloud run jobs execute ai-accountant-ai-categorization \
  --region australia-southeast1 \
  --wait

# View job execution logs
gcloud run jobs logs read ai-accountant-pdf-processor \
  --region australia-southeast1 \
  --limit 50
```

## Infrastructure Management

### Viewing Resources

```bash
# List all Cloud Run services
gcloud run services list --region australia-southeast1

# List all Cloud Run jobs
gcloud run jobs list --region australia-southeast1

# List Cloud SQL instances
gcloud sql instances list

# List Cloud Storage buckets
gcloud storage buckets list

# View service account details
gcloud iam service-accounts list
```

### Updating Infrastructure

```bash
# Modify terraform.tfvars or *.tf files
vim terraform.tfvars

# Preview changes
terraform plan

# Apply changes
terraform apply
```

### Scaling Resources

Update `terraform.tfvars` with new values:

```hcl
# Scale backend service
backend_min_instances = 2
backend_max_instances = 200
backend_cpu = "2"
backend_memory = "1Gi"

# Upgrade database
db_tier = "db-n1-standard-2"
db_high_availability = true
```

Apply changes:

```bash
terraform apply
```

### Cost Optimization

#### Development Environment

```hcl
environment = "dev"
db_tier = "db-f1-micro"
db_high_availability = false
backend_min_instances = 0  # Allow scaling to zero
enable_cloud_armor = false  # Disable Cloud Armor to save costs
```

#### Production Environment

```hcl
environment = "prod"
db_tier = "db-n1-standard-2"
db_high_availability = true
backend_min_instances = 2  # Ensure availability
enable_cloud_armor = true  # Enable security
```

### Monitoring and Logging

```bash
# View Cloud Run backend logs
gcloud run services logs read ai-accountant-backend \
  --region australia-southeast1 \
  --limit 100

# View Cloud SQL logs
gcloud logging read "resource.type=cloudsql_database" \
  --limit 50 \
  --format json

# View Cloud Armor logs (if enabled)
gcloud logging read "resource.type=http_load_balancer" \
  --limit 50

# Create log-based metrics
gcloud logging metrics create error_count \
  --description="Count of application errors" \
  --log-filter='severity>=ERROR'
```

### Backup and Recovery

#### Database Backups

```bash
# List backups
gcloud sql backups list --instance=INSTANCE_NAME

# Create on-demand backup
gcloud sql backups create --instance=INSTANCE_NAME

# Restore from backup
gcloud sql backups restore BACKUP_ID \
  --backup-instance=INSTANCE_NAME \
  --backup-location=australia-southeast1
```

#### Storage Backups

```bash
# Enable versioning (already enabled in Terraform)
gcloud storage buckets update gs://BUCKET_NAME --versioning

# List object versions
gcloud storage ls -a gs://BUCKET_NAME/

# Restore previous version
gcloud storage cp gs://BUCKET_NAME/file.pdf#VERSION gs://BUCKET_NAME/file.pdf
```

## Security Best Practices

### 1. Secret Rotation

Regularly rotate API keys and database passwords:

```bash
# Rotate database password
gcloud sql users set-password app_user \
  --instance=INSTANCE_NAME \
  --password=NEW_PASSWORD

# Update secret in Secret Manager
echo -n "NEW_PASSWORD" | gcloud secrets versions add database-password --data-file=-
```

### 2. IAM Auditing

```bash
# View IAM policy
gcloud projects get-iam-policy $PROJECT_ID

# Audit service account permissions
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount"
```

### 3. Security Scanning

```bash
# Enable Artifact Registry vulnerability scanning
gcloud artifacts repositories set-iam-policy REPO_NAME \
  --location=australia-southeast1 \
  --policy-file=policy.json

# View vulnerabilities
gcloud artifacts docker images list \
  --repository=REPO_NAME \
  --location=australia-southeast1 \
  --show-occurrences
```

## Troubleshooting

### Cloud Run Service Not Starting

```bash
# Check service logs
gcloud run services logs read ai-accountant-backend \
  --region australia-southeast1 \
  --limit 100

# Check service description
gcloud run services describe ai-accountant-backend \
  --region australia-southeast1

# Verify environment variables
gcloud run services describe ai-accountant-backend \
  --region australia-southeast1 \
  --format="value(spec.template.spec.containers[0].env)"
```

### Cloud SQL Connection Issues

```bash
# Test connectivity with Cloud SQL Proxy
cloud_sql_proxy -instances=INSTANCE_CONNECTION_NAME=tcp:5432

# Verify VPC connector
gcloud compute networks vpc-access connectors describe \
  ai-accountant-vpc-connector \
  --region australia-southeast1

# Check Cloud SQL instance status
gcloud sql instances describe INSTANCE_NAME
```

### Secret Manager Access Issues

```bash
# Verify secret exists
gcloud secrets describe openrouter-api-key

# Check IAM permissions
gcloud secrets get-iam-policy openrouter-api-key

# Test secret access
gcloud secrets versions access latest --secret=openrouter-api-key
```

### Cloud Armor Issues

```bash
# View security policy rules
gcloud compute security-policies describe \
  ai-accountant-backend-security-policy

# Check if requests are being blocked
gcloud logging read "resource.type=http_load_balancer AND jsonPayload.enforcedSecurityPolicy.name=ai-accountant-backend-security-policy"
```

## Terraform State Management

### Remote State Setup (Recommended for Teams)

```bash
# Create GCS bucket for Terraform state
gsutil mb -l australia-southeast1 gs://$PROJECT_ID-terraform-state

# Enable versioning
gsutil versioning set on gs://$PROJECT_ID-terraform-state

# Update main.tf backend configuration
terraform {
  backend "gcs" {
    bucket = "your-project-id-terraform-state"
    prefix = "terraform/state"
  }
}

# Migrate existing state
terraform init -migrate-state
```

### State Operations

```bash
# List resources in state
terraform state list

# Show specific resource
terraform state show google_cloud_run_v2_service.backend

# Remove resource from state (without destroying)
terraform state rm google_cloud_run_v2_service.backend

# Import existing resource
terraform import google_cloud_run_v2_service.backend projects/PROJECT/locations/REGION/services/SERVICE
```

## Cleanup and Destruction

### Destroy All Resources

**WARNING**: This will permanently delete all resources including databases and storage.

```bash
# Preview what will be destroyed
terraform plan -destroy

# Destroy all resources
terraform destroy

# Confirm by typing 'yes'
```

### Selective Resource Removal

```bash
# Remove specific resource
terraform destroy -target=google_cloud_run_v2_job.pdf_processor

# Remove Cloud Armor only
terraform destroy -target=google_compute_security_policy.backend_security_policy
```

## Cost Estimation

### Monthly Cost Breakdown (Estimated)

**Development Environment**:
- Cloud SQL (db-f1-micro): ~$10/month
- Cloud Run (low traffic): ~$5/month
- Cloud Storage (10GB): ~$0.50/month
- VPC Connector: ~$10/month
- **Total**: ~$25-30/month

**Production Environment**:
- Cloud SQL (db-n1-standard-2, HA): ~$200/month
- Cloud Run (medium traffic): ~$50-100/month
- Cloud Storage (100GB): ~$5/month
- VPC Connector: ~$20/month
- Cloud Armor: ~$20/month
- **Total**: ~$300-400/month

### Cost Optimization Tips

1. **Use Cloud Run scaling to zero** for dev environments
2. **Enable Cloud SQL automatic storage increase** cautiously
3. **Set up budget alerts** in GCP Console
4. **Use committed use discounts** for predictable workloads
5. **Archive old storage data** to Nearline/Coldline storage classes
6. **Monitor and optimize** query performance to reduce database load

## Additional Resources

- [GCP Cloud Run Documentation](https://cloud.google.com/run/docs)
- [GCP Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [Terraform GCP Provider Documentation](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [Cloud Armor Security Policies](https://cloud.google.com/armor/docs/security-policy-concepts)
- [Secret Manager Best Practices](https://cloud.google.com/secret-manager/docs/best-practices)

## Support

For issues or questions:

1. Check Terraform logs: `terraform show`
2. Review GCP Console: [https://console.cloud.google.com](https://console.cloud.google.com)
3. View Cloud Logging: [https://console.cloud.google.com/logs](https://console.cloud.google.com/logs)
4. Contact project maintainer

## License

[Add your license information here]
