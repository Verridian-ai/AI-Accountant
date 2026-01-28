# ==============================================================================
# Outputs Configuration
# Export important resource information for reference and integration
# ==============================================================================

# ------------------------------------------------------------------------------
# Project Information
# ------------------------------------------------------------------------------

output "project_id" {
  description = "GCP Project ID"
  value       = var.project_id
}

output "region" {
  description = "GCP region where resources are deployed"
  value       = var.region
}

output "environment" {
  description = "Environment name"
  value       = var.environment
}

# ------------------------------------------------------------------------------
# Cloud SQL Outputs
# ------------------------------------------------------------------------------

output "cloud_sql_instance_name" {
  description = "Name of the Cloud SQL instance"
  value       = google_sql_database_instance.postgres.name
}

output "cloud_sql_connection_name" {
  description = "Connection name for Cloud SQL instance (for Cloud Run)"
  value       = google_sql_database_instance.postgres.connection_name
}

output "cloud_sql_private_ip" {
  description = "Private IP address of the Cloud SQL instance"
  value       = google_sql_database_instance.postgres.private_ip_address
  sensitive   = true
}

output "database_name" {
  description = "Name of the application database"
  value       = google_sql_database.database.name
}

output "database_user" {
  description = "Database username"
  value       = google_sql_user.app_user.name
}

output "database_password_secret" {
  description = "Secret Manager secret ID for database password"
  value       = google_secret_manager_secret.db_password.secret_id
}

# ------------------------------------------------------------------------------
# Cloud Run Backend Outputs
# ------------------------------------------------------------------------------

output "backend_service_name" {
  description = "Name of the Cloud Run backend service"
  value       = google_cloud_run_v2_service.backend.name
}

output "backend_service_url" {
  description = "URL of the Cloud Run backend service"
  value       = google_cloud_run_v2_service.backend.uri
}

output "backend_service_location" {
  description = "Location of the Cloud Run backend service"
  value       = google_cloud_run_v2_service.backend.location
}

# ------------------------------------------------------------------------------
# Cloud Run Jobs Outputs
# ------------------------------------------------------------------------------

output "pdf_processor_job_name" {
  description = "Name of the PDF processor Cloud Run job"
  value       = google_cloud_run_v2_job.pdf_processor.name
}

output "pdf_processor_job_location" {
  description = "Location of the PDF processor job"
  value       = google_cloud_run_v2_job.pdf_processor.location
}

output "ai_categorization_job_name" {
  description = "Name of the AI categorization Cloud Run job"
  value       = google_cloud_run_v2_job.ai_categorization.name
}

output "ai_categorization_job_location" {
  description = "Location of the AI categorization job"
  value       = google_cloud_run_v2_job.ai_categorization.location
}

# ------------------------------------------------------------------------------
# Storage Outputs
# ------------------------------------------------------------------------------

output "storage_bucket_name" {
  description = "Name of the Cloud Storage bucket for statements"
  value       = google_storage_bucket.statements_bucket.name
}

output "storage_bucket_url" {
  description = "GCS URL of the storage bucket"
  value       = google_storage_bucket.statements_bucket.url
}

output "storage_bucket_self_link" {
  description = "Self-link of the storage bucket"
  value       = google_storage_bucket.statements_bucket.self_link
}

# ------------------------------------------------------------------------------
# Secret Manager Outputs
# ------------------------------------------------------------------------------

output "secrets" {
  description = "Map of Secret Manager secret IDs"
  value = {
    openrouter_api_key         = google_secret_manager_secret.openrouter_api_key.secret_id
    jwt_secret                 = google_secret_manager_secret.jwt_secret.secret_id
    stripe_api_key             = google_secret_manager_secret.stripe_api_key.secret_id
    database_password          = google_secret_manager_secret.db_password.secret_id
    database_connection_string = google_secret_manager_secret.db_connection_string.secret_id
  }
}

# ------------------------------------------------------------------------------
# Service Account Outputs
# ------------------------------------------------------------------------------

output "backend_service_account" {
  description = "Email of the backend service account"
  value       = google_service_account.backend_sa.email
}

output "ai_worker_service_account" {
  description = "Email of the AI worker service account"
  value       = google_service_account.ai_worker_sa.email
}

output "cloudbuild_service_account" {
  description = "Email of the Cloud Build service account"
  value       = google_service_account.cloudbuild_sa.email
}

# ------------------------------------------------------------------------------
# Network Outputs
# ------------------------------------------------------------------------------

output "vpc_network_name" {
  description = "Name of the VPC network"
  value       = google_compute_network.private_network.name
}

output "vpc_network_self_link" {
  description = "Self-link of the VPC network"
  value       = google_compute_network.private_network.self_link
}

output "vpc_connector_name" {
  description = "Name of the VPC access connector"
  value       = google_vpc_access_connector.connector.name
}

output "vpc_connector_self_link" {
  description = "Self-link of the VPC access connector"
  value       = google_vpc_access_connector.connector.self_link
}

# ------------------------------------------------------------------------------
# Security Outputs
# ------------------------------------------------------------------------------

output "cloud_armor_enabled" {
  description = "Whether Cloud Armor is enabled"
  value       = var.enable_cloud_armor
}

output "cloud_armor_policy_name" {
  description = "Name of the Cloud Armor security policy"
  value       = var.enable_cloud_armor ? google_compute_security_policy.backend_security_policy[0].name : null
}

output "load_balancer_ip" {
  description = "External IP address of the load balancer (if Cloud Armor enabled)"
  value       = var.enable_cloud_armor ? google_compute_global_forwarding_rule.backend_forwarding_rule[0].ip_address : null
}

# ------------------------------------------------------------------------------
# Deployment Information
# ------------------------------------------------------------------------------

output "deployment_commands" {
  description = "Useful commands for deployment and management"
  value = {
    # Update secret values
    update_openrouter_key = "echo -n 'YOUR_KEY' | gcloud secrets versions add ${google_secret_manager_secret.openrouter_api_key.secret_id} --data-file=-"
    update_stripe_key     = "echo -n 'YOUR_KEY' | gcloud secrets versions add ${google_secret_manager_secret.stripe_api_key.secret_id} --data-file=-"

    # Deploy backend service
    deploy_backend = "gcloud run deploy ${google_cloud_run_v2_service.backend.name} --region ${var.region} --image gcr.io/${var.project_id}/backend:latest"

    # Execute Cloud Run jobs
    run_pdf_processor      = "gcloud run jobs execute ${google_cloud_run_v2_job.pdf_processor.name} --region ${var.region}"
    run_ai_categorization  = "gcloud run jobs execute ${google_cloud_run_v2_job.ai_categorization.name} --region ${var.region}"

    # View logs
    backend_logs           = "gcloud run services logs read ${google_cloud_run_v2_service.backend.name} --region ${var.region}"
    pdf_processor_logs     = "gcloud run jobs logs read ${google_cloud_run_v2_job.pdf_processor.name} --region ${var.region}"

    # Connect to Cloud SQL
    sql_proxy = "gcloud sql connect ${google_sql_database_instance.postgres.name} --user=${google_sql_user.app_user.name} --database=${google_sql_database.database.name}"

    # List storage bucket contents
    list_bucket = "gsutil ls -r gs://${google_storage_bucket.statements_bucket.name}/"
  }
}

# ------------------------------------------------------------------------------
# Connection Strings (for application configuration)
# ------------------------------------------------------------------------------

output "application_config" {
  description = "Application configuration values"
  value = {
    database_url          = "See Secret Manager: ${google_secret_manager_secret.db_connection_string.secret_id}"
    backend_url           = google_cloud_run_v2_service.backend.uri
    storage_bucket        = google_storage_bucket.statements_bucket.name
    project_id            = var.project_id
    region                = var.region
    pdf_processor_job     = google_cloud_run_v2_job.pdf_processor.name
    ai_categorization_job = google_cloud_run_v2_job.ai_categorization.name
  }
  sensitive = true
}

# ------------------------------------------------------------------------------
# Cost Optimization Tips
# ------------------------------------------------------------------------------

output "cost_optimization_tips" {
  description = "Tips for optimizing GCP costs"
  value = [
    "Cloud SQL: Consider using db-f1-micro for development (lowest cost)",
    "Cloud SQL: Enable automatic storage increase only if needed",
    "Cloud Run: Set min instances to 0 for development to avoid idle charges",
    "Cloud Storage: Use lifecycle policies to move old data to Nearline/Coldline",
    "Cloud Run Jobs: Use preemptible execution for non-critical batch jobs",
    "Monitoring: Set up budget alerts to track spending",
    "VPC Connector: Use e2-micro for development, scale up for production"
  ]
}

# ------------------------------------------------------------------------------
# Next Steps
# ------------------------------------------------------------------------------

output "next_steps" {
  description = "Next steps after infrastructure deployment"
  value = [
    "1. Update API keys in Secret Manager (OpenRouter, Stripe)",
    "2. Deploy application containers to Cloud Run",
    "3. Run database migrations against Cloud SQL",
    "4. Configure custom domain and SSL certificate (if needed)",
    "5. Set up Cloud Monitoring alerts and dashboards",
    "6. Configure Cloud Build triggers for CI/CD",
    "7. Test Cloud Run jobs execution",
    "8. Review and adjust Cloud Armor rules based on traffic patterns",
    "9. Set up regular database backups verification",
    "10. Configure log exports to BigQuery for analytics"
  ]
}
