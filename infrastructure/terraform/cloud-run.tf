# ==============================================================================
# Cloud Run Backend Service Configuration
# Hono TypeScript backend with Cloud SQL connection
# ==============================================================================

# ------------------------------------------------------------------------------
# Cloud Run Service for Backend API
# ------------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "backend" {
  name     = var.backend_service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  labels = var.labels

  template {
    # Scaling configuration - min 1 to avoid cold starts
    scaling {
      min_instance_count = var.backend_min_instances
      max_instance_count = var.backend_max_instances
    }

    # VPC Access for Cloud SQL private IP
    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    # Service account for IAM permissions
    service_account = google_service_account.backend_sa.email

    # Container configuration
    containers {
      image = var.backend_image

      # Resource limits
      resources {
        limits = {
          cpu    = var.backend_cpu
          memory = var.backend_memory
        }
        cpu_idle = true
        startup_cpu_boost = true
      }

      # Startup probe for health checks
      startup_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 10
        timeout_seconds       = 3
        period_seconds        = 5
        failure_threshold     = 3
      }

      # Liveness probe
      liveness_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 30
        timeout_seconds       = 3
        period_seconds        = 10
        failure_threshold     = 3
      }

      # Environment variables
      env {
        name  = "NODE_ENV"
        value = var.environment
      }

      env {
        name  = "PORT"
        value = "8080"
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

      # Database connection string from Secret Manager
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_connection_string.secret_id
            version = "latest"
          }
        }
      }

      # OpenRouter API key from Secret Manager
      env {
        name = "OPENROUTER_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.openrouter_api_key.secret_id
            version = "latest"
          }
        }
      }

      # JWT secret from Secret Manager
      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt_secret.secret_id
            version = "latest"
          }
        }
      }

      # Stripe API key from Secret Manager (if applicable)
      env {
        name = "STRIPE_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.stripe_api_key.secret_id
            version = "latest"
          }
        }
      }

      # Storage bucket name
      env {
        name  = "STORAGE_BUCKET"
        value = google_storage_bucket.statements_bucket.name
      }

      # CORS origins
      env {
        name  = "CORS_ORIGINS"
        value = join(",", var.cors_origins)
      }

      # Cloud Run Jobs names for triggering
      env {
        name  = "PDF_PROCESSOR_JOB"
        value = google_cloud_run_v2_job.pdf_processor.name
      }

      env {
        name  = "AI_CATEGORIZATION_JOB"
        value = google_cloud_run_v2_job.ai_categorization.name
      }
    }

    # Maximum request timeout
    timeout = "${var.backend_timeout_seconds}s"

    # Maximum concurrent requests per instance
    max_instance_request_concurrency = var.backend_concurrency
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.required_services,
    google_vpc_access_connector.connector,
    google_sql_database_instance.postgres
  ]
}

# ------------------------------------------------------------------------------
# IAM Policy for Public Access (or restrict as needed)
# ------------------------------------------------------------------------------

resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  name     = google_cloud_run_v2_service.backend.name
  location = google_cloud_run_v2_service.backend.location
  role     = "roles/run.invoker"
  member   = "allUsers"

  # For production, consider restricting to specific identities:
  # member = "serviceAccount:frontend-sa@${var.project_id}.iam.gserviceaccount.com"
}

# ------------------------------------------------------------------------------
# Cloud Armor Security Policy Association (if enabled)
# ------------------------------------------------------------------------------

# Note: Cloud Armor requires a Load Balancer setup
# This is configured in security.tf with the backend service
# The actual association is handled through NEG (Network Endpoint Group)

# ------------------------------------------------------------------------------
# Output backend URL
# ------------------------------------------------------------------------------

output "backend_url" {
  description = "URL of the backend Cloud Run service"
  value       = google_cloud_run_v2_service.backend.uri
}
