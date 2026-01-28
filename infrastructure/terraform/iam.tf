# ==============================================================================
# IAM Configuration
# Service accounts and IAM role bindings with least-privilege access
# ==============================================================================

# ------------------------------------------------------------------------------
# Backend Service Account
# Used by Cloud Run backend service
# ------------------------------------------------------------------------------

resource "google_service_account" "backend_sa" {
  account_id   = "${var.project_name}-backend-sa"
  display_name = "AI Accountant Backend Service Account"
  description  = "Service account for Cloud Run backend service with least-privilege access"

  depends_on = [google_project_service.required_services]
}

# Cloud SQL Client - connect to Cloud SQL instance
resource "google_project_iam_member" "backend_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

# Cloud Run Invoker - invoke Cloud Run jobs
resource "google_project_iam_member" "backend_run_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

# Cloud Run Developer - manage Cloud Run jobs
resource "google_project_iam_member" "backend_run_developer" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

# Logs Writer - write application logs
resource "google_project_iam_member" "backend_logs_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

# Monitoring Metric Writer - write custom metrics
resource "google_project_iam_member" "backend_monitoring_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

# Cloud Trace Agent - write trace data
resource "google_project_iam_member" "backend_trace_agent" {
  project = var.project_id
  role    = "roles/cloudtrace.agent"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

# Service Account User - impersonate other service accounts if needed
resource "google_project_iam_member" "backend_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

# ------------------------------------------------------------------------------
# AI Worker Service Account
# Used by Cloud Run jobs for AI processing
# ------------------------------------------------------------------------------

resource "google_service_account" "ai_worker_sa" {
  account_id   = "${var.project_name}-ai-worker-sa"
  display_name = "AI Accountant Worker Service Account"
  description  = "Service account for Cloud Run jobs (PDF processor, AI categorization)"

  depends_on = [google_project_service.required_services]
}

# Cloud SQL Client - connect to Cloud SQL instance
resource "google_project_iam_member" "ai_worker_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.ai_worker_sa.email}"
}

# Logs Writer - write application logs
resource "google_project_iam_member" "ai_worker_logs_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.ai_worker_sa.email}"
}

# Monitoring Metric Writer - write custom metrics
resource "google_project_iam_member" "ai_worker_monitoring_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.ai_worker_sa.email}"
}

# Cloud Trace Agent - write trace data
resource "google_project_iam_member" "ai_worker_trace_agent" {
  project = var.project_id
  role    = "roles/cloudtrace.agent"
  member  = "serviceAccount:${google_service_account.ai_worker_sa.email}"
}

# ------------------------------------------------------------------------------
# Cloud Build Service Account (Optional)
# For CI/CD deployments
# ------------------------------------------------------------------------------

resource "google_service_account" "cloudbuild_sa" {
  account_id   = "${var.project_name}-cloudbuild-sa"
  display_name = "AI Accountant Cloud Build Service Account"
  description  = "Service account for Cloud Build CI/CD pipelines"

  depends_on = [google_project_service.required_services]
}

# Cloud Run Admin - deploy Cloud Run services and jobs
resource "google_project_iam_member" "cloudbuild_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.cloudbuild_sa.email}"
}

# Service Account User - deploy as service accounts
resource "google_project_iam_member" "cloudbuild_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.cloudbuild_sa.email}"
}

# Storage Admin - manage container images
resource "google_project_iam_member" "cloudbuild_storage_admin" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.cloudbuild_sa.email}"
}

# Artifact Registry Writer - push container images
resource "google_project_iam_member" "cloudbuild_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.cloudbuild_sa.email}"
}

# Logs Writer - write build logs
resource "google_project_iam_member" "cloudbuild_logs_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.cloudbuild_sa.email}"
}

# ------------------------------------------------------------------------------
# Custom IAM Role for Fine-Grained Permissions (Optional)
# Create custom roles for even more granular access control
# ------------------------------------------------------------------------------

# resource "google_project_iam_custom_role" "ai_worker_custom" {
#   role_id     = "aiWorkerCustomRole"
#   title       = "AI Worker Custom Role"
#   description = "Custom role with specific permissions for AI workers"
#
#   permissions = [
#     "cloudsql.instances.connect",
#     "cloudsql.instances.get",
#     "storage.objects.create",
#     "storage.objects.get",
#     "storage.objects.list",
#     "secretmanager.versions.access",
#   ]
# }

# ------------------------------------------------------------------------------
# Service Account Key Generation (Not Recommended for Production)
# Only use for local development - use Workload Identity in production
# ------------------------------------------------------------------------------

# resource "google_service_account_key" "backend_sa_key" {
#   service_account_id = google_service_account.backend_sa.name
# }
#
# # Store key in Secret Manager
# resource "google_secret_manager_secret" "backend_sa_key" {
#   secret_id = "backend-service-account-key"
#
#   replication {
#     auto {}
#   }
#
#   labels = var.labels
#
#   depends_on = [google_project_service.required_services]
# }
#
# resource "google_secret_manager_secret_version" "backend_sa_key" {
#   secret      = google_secret_manager_secret.backend_sa_key.id
#   secret_data = base64decode(google_service_account_key.backend_sa_key.private_key)
# }

# ------------------------------------------------------------------------------
# Workload Identity Binding (for GKE, if migrating from Cloud Run)
# ------------------------------------------------------------------------------

# resource "google_service_account_iam_member" "workload_identity_binding" {
#   service_account_id = google_service_account.backend_sa.name
#   role               = "roles/iam.workloadIdentityUser"
#   member             = "serviceAccount:${var.project_id}.svc.id.goog[default/backend-ksa]"
# }

# ------------------------------------------------------------------------------
# IAM Policy Bindings for Cross-Service Communication
# ------------------------------------------------------------------------------

# Allow backend to invoke AI worker jobs
resource "google_cloud_run_v2_job_iam_member" "backend_invoke_pdf_processor" {
  name     = google_cloud_run_v2_job.pdf_processor.name
  location = google_cloud_run_v2_job.pdf_processor.location
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.backend_sa.email}"
}

resource "google_cloud_run_v2_job_iam_member" "backend_invoke_ai_categorization" {
  name     = google_cloud_run_v2_job.ai_categorization.name
  location = google_cloud_run_v2_job.ai_categorization.location
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.backend_sa.email}"
}

# ------------------------------------------------------------------------------
# IAM Audit Logging Configuration
# Enable data access audit logs for security monitoring
# ------------------------------------------------------------------------------

resource "google_project_iam_audit_config" "project_audit_config" {
  project = var.project_id
  service = "allServices"

  audit_log_config {
    log_type = "ADMIN_READ"
  }

  audit_log_config {
    log_type = "DATA_READ"
  }

  audit_log_config {
    log_type = "DATA_WRITE"
  }
}

# ------------------------------------------------------------------------------
# Outputs
# ------------------------------------------------------------------------------

output "backend_service_account_email" {
  description = "Email of the backend service account"
  value       = google_service_account.backend_sa.email
}

output "ai_worker_service_account_email" {
  description = "Email of the AI worker service account"
  value       = google_service_account.ai_worker_sa.email
}

output "cloudbuild_service_account_email" {
  description = "Email of the Cloud Build service account"
  value       = google_service_account.cloudbuild_sa.email
}
