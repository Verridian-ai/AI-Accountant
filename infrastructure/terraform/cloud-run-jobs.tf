# ==============================================================================
# Cloud Run Jobs Configuration
# Python AI agent jobs for PDF processing and categorization
# ==============================================================================

# ------------------------------------------------------------------------------
# PDF Processor Job
# Extracts text and data from uploaded PDF bank statements
# ------------------------------------------------------------------------------

resource "google_cloud_run_v2_job" "pdf_processor" {
  name     = "${var.project_name}-pdf-processor"
  location = var.region

  labels = merge(var.labels, {
    job-type = "pdf-processor"
  })

  template {
    template {
      # VPC Access for Cloud SQL private IP
      vpc_access {
        connector = google_vpc_access_connector.connector.id
        egress    = "PRIVATE_RANGES_ONLY"
      }

      # Service account for IAM permissions
      service_account = google_service_account.ai_worker_sa.email

      # Maximum execution time
      timeout = "${var.ai_job_timeout_seconds}s"

      # Maximum number of retries on failure
      max_retries = var.ai_job_max_retries

      containers {
        image = var.pdf_processor_image

        # Resource allocation for PDF processing
        resources {
          limits = {
            cpu    = var.ai_job_cpu
            memory = var.ai_job_memory
          }
        }

        # Environment variables
        env {
          name  = "JOB_TYPE"
          value = "pdf_processor"
        }

        env {
          name  = "PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "REGION"
          value = var.region
        }

        # Cloud SQL connection
        env {
          name  = "DB_INSTANCE_CONNECTION_NAME"
          value = google_sql_database_instance.postgres.connection_name
        }

        env {
          name  = "DB_NAME"
          value = var.db_name
        }

        env {
          name  = "DB_USER"
          value = var.db_user
        }

        # Database password from Secret Manager
        env {
          name = "DB_PASSWORD"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.db_password.secret_id
              version = "latest"
            }
          }
        }

        # Database connection string
        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.db_connection_string.secret_id
              version = "latest"
            }
          }
        }

        # OpenRouter API key for AI processing
        env {
          name = "OPENROUTER_API_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.openrouter_api_key.secret_id
              version = "latest"
            }
          }
        }

        # Storage bucket for PDFs
        env {
          name  = "STORAGE_BUCKET"
          value = google_storage_bucket.statements_bucket.name
        }

        # Python-specific settings
        env {
          name  = "PYTHONUNBUFFERED"
          value = "1"
        }
      }
    }
  }

  depends_on = [
    google_project_service.required_services,
    google_vpc_access_connector.connector
  ]
}

# ------------------------------------------------------------------------------
# AI Categorization Job
# Categorizes transactions using AI models
# ------------------------------------------------------------------------------

resource "google_cloud_run_v2_job" "ai_categorization" {
  name     = "${var.project_name}-ai-categorization"
  location = var.region

  labels = merge(var.labels, {
    job-type = "ai-categorization"
  })

  template {
    template {
      # VPC Access for Cloud SQL private IP
      vpc_access {
        connector = google_vpc_access_connector.connector.id
        egress    = "PRIVATE_RANGES_ONLY"
      }

      # Service account for IAM permissions
      service_account = google_service_account.ai_worker_sa.email

      # Maximum execution time
      timeout = "${var.ai_job_timeout_seconds}s"

      # Maximum number of retries on failure
      max_retries = var.ai_job_max_retries

      containers {
        image = var.ai_categorization_image

        # Resource allocation for AI processing
        resources {
          limits = {
            cpu    = var.ai_job_cpu
            memory = var.ai_job_memory
          }
        }

        # Environment variables
        env {
          name  = "JOB_TYPE"
          value = "ai_categorization"
        }

        env {
          name  = "PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "REGION"
          value = var.region
        }

        # Cloud SQL connection
        env {
          name  = "DB_INSTANCE_CONNECTION_NAME"
          value = google_sql_database_instance.postgres.connection_name
        }

        env {
          name  = "DB_NAME"
          value = var.db_name
        }

        env {
          name  = "DB_USER"
          value = var.db_user
        }

        # Database password from Secret Manager
        env {
          name = "DB_PASSWORD"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.db_password.secret_id
              version = "latest"
            }
          }
        }

        # Database connection string
        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.db_connection_string.secret_id
              version = "latest"
            }
          }
        }

        # OpenRouter API key for AI processing
        env {
          name = "OPENROUTER_API_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.openrouter_api_key.secret_id
              version = "latest"
            }
          }
        }

        # Storage bucket for reference data
        env {
          name  = "STORAGE_BUCKET"
          value = google_storage_bucket.statements_bucket.name
        }

        # Python-specific settings
        env {
          name  = "PYTHONUNBUFFERED"
          value = "1"
        }

        # AI model configuration
        env {
          name  = "AI_MODEL"
          value = "anthropic/claude-3.5-sonnet"
        }

        env {
          name  = "AI_TEMPERATURE"
          value = "0.3"
        }

        env {
          name  = "AI_MAX_TOKENS"
          value = "4096"
        }
      }
    }
  }

  depends_on = [
    google_project_service.required_services,
    google_vpc_access_connector.connector
  ]
}

# ------------------------------------------------------------------------------
# Cloud Scheduler for Periodic Job Execution (Optional)
# Uncomment to enable scheduled job runs
# ------------------------------------------------------------------------------

# # Run PDF processor every hour
# resource "google_cloud_scheduler_job" "pdf_processor_schedule" {
#   name             = "${var.project_name}-pdf-processor-schedule"
#   description      = "Trigger PDF processor job hourly"
#   schedule         = "0 * * * *"  # Every hour
#   time_zone        = "Australia/Sydney"
#   attempt_deadline = "320s"
#   region           = var.region
#
#   retry_config {
#     retry_count = 3
#   }
#
#   http_target {
#     http_method = "POST"
#     uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.pdf_processor.name}:run"
#
#     oauth_token {
#       service_account_email = google_service_account.ai_worker_sa.email
#     }
#   }
#
#   depends_on = [google_project_service.required_services]
# }

# # Run AI categorization every 30 minutes
# resource "google_cloud_scheduler_job" "ai_categorization_schedule" {
#   name             = "${var.project_name}-ai-categorization-schedule"
#   description      = "Trigger AI categorization job every 30 minutes"
#   schedule         = "*/30 * * * *"  # Every 30 minutes
#   time_zone        = "Australia/Sydney"
#   attempt_deadline = "320s"
#   region           = var.region
#
#   retry_config {
#     retry_count = 3
#   }
#
#   http_target {
#     http_method = "POST"
#     uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.ai_categorization.name}:run"
#
#     oauth_token {
#       service_account_email = google_service_account.ai_worker_sa.email
#     }
#   }
#
#   depends_on = [google_project_service.required_services]
# }

# ------------------------------------------------------------------------------
# Outputs
# ------------------------------------------------------------------------------

output "pdf_processor_job_name" {
  description = "Name of the PDF processor Cloud Run job"
  value       = google_cloud_run_v2_job.pdf_processor.name
}

output "ai_categorization_job_name" {
  description = "Name of the AI categorization Cloud Run job"
  value       = google_cloud_run_v2_job.ai_categorization.name
}
