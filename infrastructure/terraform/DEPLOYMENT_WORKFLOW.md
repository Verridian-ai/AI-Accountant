# AI Accountant - Deployment Workflow

This document outlines the complete deployment workflow from initial setup to production deployment.

## Phase 1: Pre-Deployment (30 minutes)

### Step 1: Prerequisites Setup

```mermaid
graph TD
    A[Install Terraform] --> B[Install gcloud CLI]
    B --> C[Create GCP Project]
    C --> D[Enable Billing]
    D --> E[Authenticate with GCP]
    E --> F[Get API Keys]
    F --> G[Ready for Deployment]
```

**Commands**:
```bash
# Check prerequisites
make check-prereqs

# Authenticate
gcloud auth login
gcloud auth application-default login

# Set project
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID
```

### Step 2: Configuration

```bash
# Copy and edit variables
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars  # Update project_id and other settings
```

**Required Changes**:
- `project_id`: Your GCP project ID
- Review defaults for `db_tier`, `backend_min_instances`, `enable_cloud_armor`

## Phase 2: Infrastructure Deployment (15 minutes)

### Step 3: Terraform Initialization

```bash
# Initialize Terraform
make init

# Or manually
terraform init
```

**What happens**:
- Downloads Terraform providers (Google, Google Beta, Random)
- Initializes backend configuration
- Creates `.terraform` directory

### Step 4: Plan Review

```bash
# Review planned changes
make plan

# Or manually
terraform plan
```

**Expected resources**: ~60 resources will be created including:
- 1 VPC network + subnets
- 1 Cloud SQL instance + database + user
- 1 Cloud Run service (backend)
- 2 Cloud Run jobs (PDF processor, AI categorization)
- 1 Cloud Storage bucket
- 5 Secret Manager secrets
- 3 Service accounts
- 20+ IAM bindings
- 1 VPC access connector
- Optional: Cloud Armor policy + load balancer

### Step 5: Infrastructure Deployment

```bash
# Deploy infrastructure
make apply

# Or manually
terraform apply
```

**Timeline**:
- 0-2 min: API enablement
- 2-4 min: VPC and networking setup
- 4-12 min: Cloud SQL instance creation (longest step)
- 12-14 min: Cloud Run and storage configuration
- 14-15 min: IAM and final configuration

### Step 6: Verify Deployment

```bash
# Check outputs
terraform output

# Verify services
make status
```

## Phase 3: Application Deployment (30 minutes)

### Step 7: Update Secrets

```bash
# Update API keys
make update-secrets

# Or manually
echo -n "sk-or-v1-YOUR_KEY" | gcloud secrets versions add openrouter-api-key --data-file=-
echo -n "sk_live_YOUR_KEY" | gcloud secrets versions add stripe-api-key --data-file=-
```

### Step 8: Build Container Images

#### Backend Service

```bash
cd ../../server

# Build backend image
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/backend:latest \
  --timeout=20m

# Expected: ~5-10 minutes
```

#### PDF Processor Job

Create `server/Dockerfile.pdf-processor`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/services/parsers/ ./parsers/
COPY src/services/rag.py ./
COPY src/services/pipeline.py ./

# Entry point
CMD ["python", "pipeline.py", "--mode=pdf"]
```

Build:
```bash
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/pdf-processor:latest \
  --file=Dockerfile.pdf-processor

# Expected: ~5-10 minutes
```

#### AI Categorization Job

Create `server/Dockerfile.ai-categorization`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/services/agents/ ./agents/
COPY src/services/ai.ts ./
COPY src/services/pipeline.py ./

# Entry point
CMD ["python", "pipeline.py", "--mode=categorization"]
```

Build:
```bash
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/ai-categorization:latest \
  --file=Dockerfile.ai-categorization

# Expected: ~5-10 minutes
```

### Step 9: Deploy to Cloud Run

Update Terraform variables with container images:

```bash
# Edit terraform.tfvars
nano terraform.tfvars
```

Update:
```hcl
backend_image = "gcr.io/YOUR_PROJECT_ID/backend:latest"
pdf_processor_image = "gcr.io/YOUR_PROJECT_ID/pdf-processor:latest"
ai_categorization_image = "gcr.io/YOUR_PROJECT_ID/ai-categorization:latest"
```

Apply changes:
```bash
cd ../../infrastructure/terraform
terraform apply
```

### Step 10: Database Migrations

```bash
# Connect via Cloud SQL Proxy
cloud_sql_proxy -instances=$(terraform output -raw cloud_sql_connection_name)=tcp:5432

# In another terminal
cd ../../server
export DATABASE_URL="postgresql://app_user:PASSWORD@localhost:5432/accountant_db"

# Run migrations (choose one)
npm run migrate                    # For custom migrations
npx drizzle-kit push:pg           # For Drizzle ORM
```

## Phase 4: Testing and Validation (15 minutes)

### Step 11: Health Checks

```bash
# Test backend health endpoint
BACKEND_URL=$(cd infrastructure/terraform && terraform output -raw backend_service_url)
curl $BACKEND_URL/health

# Expected response:
# {"status":"ok","timestamp":"2024-01-28T12:00:00Z"}
```

### Step 12: Test Cloud Run Jobs

```bash
# Test PDF processor
gcloud run jobs execute ai-accountant-pdf-processor \
  --region australia-southeast1 \
  --wait

# Test AI categorization
gcloud run jobs execute ai-accountant-ai-categorization \
  --region australia-southeast1 \
  --wait

# View execution logs
gcloud run jobs logs read ai-accountant-pdf-processor \
  --region australia-southeast1 \
  --limit 50
```

### Step 13: Integration Testing

```bash
# Upload test PDF to storage bucket
BUCKET_NAME=$(cd infrastructure/terraform && terraform output -raw storage_bucket_name)
gsutil cp test-statement.pdf gs://$BUCKET_NAME/raw/

# Trigger PDF processing
gcloud run jobs execute ai-accountant-pdf-processor \
  --region australia-southeast1

# Check database for results
# Connect to Cloud SQL and verify transactions were created
```

### Step 14: Load Testing (Optional)

```bash
# Install Apache Bench
sudo apt-get install apache2-utils  # Ubuntu/Debian
brew install httpd                   # macOS

# Test backend performance
ab -n 1000 -c 10 $BACKEND_URL/health

# Expected: 100-500 req/sec depending on instance configuration
```

## Phase 5: Production Configuration (30 minutes)

### Step 15: Custom Domain Setup

```bash
# Map Cloud Run to custom domain
gcloud run domain-mappings create \
  --service ai-accountant-backend \
  --domain api.yourdomain.com \
  --region australia-southeast1

# Configure DNS (in your DNS provider)
# Add CNAME record: api -> ghs.googlehosted.com
```

### Step 16: SSL Certificate Configuration

Update `security.tf` to enable SSL certificate:
```hcl
resource "google_compute_managed_ssl_certificate" "backend_ssl_cert" {
  name = "${var.project_name}-backend-ssl-cert"

  managed {
    domains = ["api.yourdomain.com"]
  }
}
```

Apply:
```bash
terraform apply
```

### Step 17: Configure CORS and Security

Update `terraform.tfvars`:
```hcl
cors_origins = ["https://yourdomain.com"]
allowed_countries = ["AU", "NZ"]  # Restrict to specific countries
enable_cloud_armor = true
rate_limit_threshold = 100
```

Apply:
```bash
terraform apply
```

### Step 18: Set Up Monitoring

```bash
# Create uptime check
gcloud monitoring uptime create api-uptime-check \
  --resource-type=uptime-url \
  --host=api.yourdomain.com \
  --path=/health

# Create alert policy for errors
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Backend Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05
```

### Step 19: Budget Alerts

```bash
# Set budget alert (via GCP Console or gcloud)
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="AI Accountant Budget" \
  --budget-amount=500 \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

### Step 20: CI/CD Setup

Create `cloudbuild.yaml`:
```yaml
steps:
  # Build backend
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/backend:$COMMIT_SHA', 'server/']

  # Push backend
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/backend:$COMMIT_SHA']

  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'ai-accountant-backend'
      - '--image'
      - 'gcr.io/$PROJECT_ID/backend:$COMMIT_SHA'
      - '--region'
      - 'australia-southeast1'
      - '--platform'
      - 'managed'

images:
  - 'gcr.io/$PROJECT_ID/backend:$COMMIT_SHA'
```

Set up trigger:
```bash
gcloud builds triggers create github \
  --repo-name=ai-accountant \
  --repo-owner=YOUR_GITHUB_ORG \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

## Deployment Checklist

### Pre-Deployment
- [ ] GCP project created and billing enabled
- [ ] Terraform and gcloud CLI installed
- [ ] Authenticated with GCP
- [ ] API keys obtained (OpenRouter, Stripe)
- [ ] terraform.tfvars configured

### Infrastructure
- [ ] Terraform init completed
- [ ] Terraform plan reviewed
- [ ] Infrastructure deployed successfully
- [ ] All outputs verified
- [ ] Secrets updated with real API keys

### Application
- [ ] Container images built
- [ ] Backend deployed to Cloud Run
- [ ] Cloud Run jobs configured
- [ ] Database migrations completed
- [ ] Health checks passing

### Testing
- [ ] Backend health endpoint responds
- [ ] Cloud Run jobs execute successfully
- [ ] PDF upload and processing works
- [ ] AI categorization works
- [ ] Database contains test data

### Production
- [ ] Custom domain configured
- [ ] SSL certificate issued
- [ ] CORS configured correctly
- [ ] Cloud Armor enabled
- [ ] Monitoring and alerts set up
- [ ] Budget alerts configured
- [ ] CI/CD pipeline configured
- [ ] Backup strategy verified

### Security
- [ ] Service accounts use least-privilege IAM
- [ ] Secrets stored in Secret Manager
- [ ] Cloud SQL uses private IP only
- [ ] Storage bucket access restricted
- [ ] Audit logging enabled
- [ ] Rate limiting configured

## Rollback Procedure

If deployment fails or issues arise:

### Rollback Infrastructure Changes

```bash
# Revert to previous state
terraform apply -var-file=terraform.tfvars.backup

# Or destroy and recreate
terraform destroy
terraform apply
```

### Rollback Application Deployment

```bash
# Deploy previous container version
gcloud run deploy ai-accountant-backend \
  --image gcr.io/$PROJECT_ID/backend:PREVIOUS_TAG \
  --region australia-southeast1

# Or via Cloud Console:
# 1. Go to Cloud Run service
# 2. Click "Revisions"
# 3. Select previous revision
# 4. Click "Serve traffic"
```

### Database Rollback

```bash
# Restore from backup
gcloud sql backups list --instance=INSTANCE_NAME
gcloud sql backups restore BACKUP_ID \
  --backup-instance=INSTANCE_NAME
```

## Troubleshooting Common Issues

### Issue: Terraform apply fails with API not enabled
**Solution**: Wait 5 minutes for APIs to fully enable, then retry

### Issue: Cloud SQL creation timeout
**Solution**: Check GCP Console - instance may still be creating. Wait and retry.

### Issue: Container image push fails
**Solution**: Ensure Artifact Registry API is enabled and you have permissions

### Issue: Cloud Run service crashes on startup
**Solution**: Check logs with `make logs` and verify environment variables

### Issue: Database connection fails
**Solution**: Verify VPC connector is running and Cloud SQL has private IP

## Monitoring Dashboard

After deployment, access:
- **Cloud Run Dashboard**: https://console.cloud.google.com/run
- **Cloud SQL Dashboard**: https://console.cloud.google.com/sql
- **Cloud Monitoring**: https://console.cloud.google.com/monitoring
- **Cloud Logging**: https://console.cloud.google.com/logs
- **Billing Dashboard**: https://console.cloud.google.com/billing

## Post-Deployment Optimization

### Week 1: Monitoring
- Review error logs daily
- Monitor request latency
- Check database performance
- Track storage usage

### Week 2-4: Optimization
- Adjust instance sizing based on metrics
- Optimize database queries
- Configure caching if needed
- Review and adjust rate limits

### Month 2+: Scaling
- Enable high availability for Cloud SQL
- Increase backend max instances if needed
- Archive old storage data
- Implement CDN if needed

## Conclusion

Following this workflow ensures a smooth, production-ready deployment of the AI Accountant application on GCP. The entire process takes approximately 2 hours for first-time setup, or 15 minutes for experienced users.

For ongoing deployments, CI/CD automation reduces deployment time to under 10 minutes.
