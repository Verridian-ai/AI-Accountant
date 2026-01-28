# Quick Start Guide - AI Accountant GCP Infrastructure

This guide will help you deploy the AI Accountant infrastructure to GCP in under 15 minutes.

## Prerequisites Checklist

- [ ] Google Cloud account with billing enabled
- [ ] Terraform >= 1.5.0 installed
- [ ] gcloud CLI installed and authenticated
- [ ] OpenRouter API key (get from https://openrouter.ai)
- [ ] Stripe API key (optional, for payments)

## Step-by-Step Deployment

### 1. Authenticate with GCP (2 minutes)

```bash
# Login to GCP
gcloud auth login

# Set up application default credentials
gcloud auth application-default login

# Set your project ID
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID
```

### 2. Prepare Configuration (3 minutes)

```bash
# Navigate to terraform directory
cd infrastructure/terraform

# Copy example variables
cp terraform.tfvars.example terraform.tfvars

# Edit the file - REQUIRED CHANGES:
# - project_id: Your GCP project ID
# - Optional: Adjust db_tier, backend_min_instances, enable_cloud_armor
nano terraform.tfvars  # or use your preferred editor
```

**Minimum required change in `terraform.tfvars`**:
```hcl
project_id = "your-actual-project-id"
```

### 3. Deploy Infrastructure (10 minutes)

```bash
# Initialize Terraform
terraform init

# Preview changes (optional but recommended)
terraform plan

# Deploy everything
terraform apply
# Type 'yes' when prompted
```

**Wait**: Cloud SQL instance creation takes ~8-10 minutes.

### 4. Configure Secrets (1 minute)

```bash
# Update OpenRouter API key
echo -n "sk-or-v1-YOUR_OPENROUTER_KEY" | gcloud secrets versions add openrouter-api-key --data-file=-

# Update Stripe API key (if needed)
echo -n "sk_live_YOUR_STRIPE_KEY" | gcloud secrets versions add stripe-api-key --data-file=-
```

### 5. Get Deployment Information

```bash
# View all important outputs
terraform output

# Get specific values
terraform output backend_service_url
terraform output storage_bucket_name
terraform output cloud_sql_connection_name
```

## Next Steps

### Deploy Application Code

```bash
# Build and deploy backend
cd ../../server
gcloud builds submit --tag gcr.io/$PROJECT_ID/backend:latest

# Update Cloud Run service
gcloud run deploy ai-accountant-backend \
  --image gcr.io/$PROJECT_ID/backend:latest \
  --region australia-southeast1
```

### Run Database Migrations

```bash
# Using Cloud SQL Proxy
cloud_sql_proxy -instances=$(terraform output -raw cloud_sql_connection_name)=tcp:5432

# In another terminal
export DATABASE_URL="postgresql://app_user:PASSWORD@localhost:5432/accountant_db"
npm run migrate
```

### Test the Deployment

```bash
# Test backend health
BACKEND_URL=$(terraform output -raw backend_service_url)
curl $BACKEND_URL/health

# Test PDF processor job
gcloud run jobs execute ai-accountant-pdf-processor \
  --region australia-southeast1 \
  --wait
```

## Development vs Production Settings

### Development (Cost ~$25/month)

```hcl
environment = "dev"
db_tier = "db-f1-micro"
db_high_availability = false
backend_min_instances = 0
enable_cloud_armor = false
```

### Production (Cost ~$300/month)

```hcl
environment = "prod"
db_tier = "db-n1-standard-2"
db_high_availability = true
backend_min_instances = 2
enable_cloud_armor = true
```

## Common Issues and Solutions

### Issue: "API not enabled"
**Solution**: Terraform automatically enables APIs, but this can take a few minutes. Wait 5 minutes and retry.

### Issue: "Insufficient permissions"
**Solution**: Ensure you have Owner or Editor role on the project:
```bash
gcloud projects get-iam-policy $PROJECT_ID
```

### Issue: "VPC connector creation failed"
**Solution**: This can happen if the IP range conflicts. The configuration uses 10.8.0.0/28 which should be available in new projects.

### Issue: "Cloud SQL instance creation timeout"
**Solution**: Cloud SQL takes 8-10 minutes. If it times out, check the GCP Console - it may still be creating. Re-run `terraform apply` to continue.

## Clean Up

To delete all resources:

```bash
terraform destroy
# Type 'yes' when prompted
```

**WARNING**: This permanently deletes all data including databases and storage!

## Costs Breakdown

Estimated monthly costs (Sydney region):

| Resource | Development | Production |
|----------|-------------|------------|
| Cloud SQL | $10 | $200 |
| Cloud Run | $5 | $50-100 |
| Cloud Storage | $0.50 | $5 |
| VPC Connector | $10 | $20 |
| Cloud Armor | $0 | $20 |
| **Total** | **~$25** | **~$300-400** |

## Getting Help

1. **View logs**: `gcloud run services logs read ai-accountant-backend --region australia-southeast1`
2. **Check GCP Console**: https://console.cloud.google.com
3. **Terraform state**: `terraform show`
4. **Full documentation**: See README.md

## Security Checklist

After deployment:

- [ ] Rotate placeholder API keys in Secret Manager
- [ ] Review IAM permissions: `gcloud projects get-iam-policy $PROJECT_ID`
- [ ] Enable Cloud Armor for production (set `enable_cloud_armor = true`)
- [ ] Configure CORS origins (change from `["*"]` to specific domains)
- [ ] Set up SSL certificate for custom domain
- [ ] Enable Cloud Monitoring alerts
- [ ] Configure budget alerts in GCP Console

## Success Indicators

Your deployment is successful when:

1. ✅ `terraform apply` completes without errors
2. ✅ Backend service URL returns 200 status: `curl $(terraform output -raw backend_service_url)/health`
3. ✅ Cloud SQL instance is running: `gcloud sql instances list`
4. ✅ Storage bucket exists: `gcloud storage buckets list | grep ai-accountant`
5. ✅ Secrets contain actual keys (not placeholders)
6. ✅ Cloud Run jobs can execute: `gcloud run jobs execute ai-accountant-pdf-processor --region australia-southeast1`

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Internet                                │
└───────────────────────────┬─────────────────────────────────┘
                            │
                    ┌───────▼───────┐
                    │ Cloud Armor   │ (WAF + Rate Limiting)
                    │ Load Balancer │
                    └───────┬───────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼──────┐
│  Cloud Run     │  │  Cloud Run     │  │  Cloud Run  │
│  Backend API   │  │  PDF Processor │  │  AI Agent   │
│  (Hono/Node)   │  │  Job (Python)  │  │  (Python)   │
└───────┬────────┘  └───────┬────────┘  └──────┬──────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼──────────┐
│  Cloud SQL     │  │ Cloud Storage  │  │ Secret Manager  │
│  PostgreSQL 15 │  │ (PDFs/Docs)    │  │ (API Keys)      │
└────────────────┘  └────────────────┘  └─────────────────┘
```

## Next: Application Development

Once infrastructure is deployed:

1. **Backend Development**: Update `server/` code with Cloud Run compatibility
2. **Frontend Deployment**: Deploy React app to Cloud Run or Firebase Hosting
3. **CI/CD Setup**: Configure Cloud Build triggers for automatic deployments
4. **Monitoring**: Set up Cloud Monitoring dashboards and alerts
5. **Custom Domain**: Configure Cloud DNS and SSL certificates

---

**Need help?** Check the full README.md or consult GCP documentation.
