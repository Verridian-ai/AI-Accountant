# ==============================================================================
# Secret Manager Configuration
# Secure storage for API keys, credentials, and sensitive configuration
# ==============================================================================

# ------------------------------------------------------------------------------
# OpenRouter API Key
# Used by AI services for LLM access
# ------------------------------------------------------------------------------

resource "google_secret_manager_secret" "openrouter_api_key" {
  secret_id = "openrouter-api-key"

  replication {
    auto {}
  }

  labels = merge(var.labels, {
    purpose = "api-key"
    service = "openrouter"
  })

  depends_on = [google_project_service.required_services]
}

# Placeholder version - update with actual key after deployment
resource "google_secret_manager_secret_version" "openrouter_api_key" {
  secret      = google_secret_manager_secret.openrouter_api_key.id
  secret_data = "PLACEHOLDER_OPENROUTER_API_KEY"

  lifecycle {
    ignore_changes = [secret_data]
  }
}

# ------------------------------------------------------------------------------
# JWT Secret
# Used for authentication token signing
# ------------------------------------------------------------------------------

resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "jwt-secret"

  replication {
    auto {}
  }

  labels = merge(var.labels, {
    purpose = "authentication"
    service = "backend"
  })

  depends_on = [google_project_service.required_services]
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = random_password.jwt_secret.result
}

# ------------------------------------------------------------------------------
# Stripe API Key
# For payment processing (if applicable)
# ------------------------------------------------------------------------------

resource "google_secret_manager_secret" "stripe_api_key" {
  secret_id = "stripe-api-key"

  replication {
    auto {}
  }

  labels = merge(var.labels, {
    purpose = "api-key"
    service = "stripe"
  })

  depends_on = [google_project_service.required_services]
}

# Placeholder version - update with actual key after deployment
resource "google_secret_manager_secret_version" "stripe_api_key" {
  secret      = google_secret_manager_secret.stripe_api_key.id
  secret_data = "PLACEHOLDER_STRIPE_API_KEY"

  lifecycle {
    ignore_changes = [secret_data]
  }
}

# ------------------------------------------------------------------------------
# Additional Secrets (Optional)
# Add more secrets as needed for your application
# ------------------------------------------------------------------------------

# # Cognee API Key (if using external Cognee service)
# resource "google_secret_manager_secret" "cognee_api_key" {
#   secret_id = "cognee-api-key"
#
#   replication {
#     auto {}
#   }
#
#   labels = merge(var.labels, {
#     purpose = "api-key"
#     service = "cognee"
#   })
#
#   depends_on = [google_project_service.required_services]
# }
#
# resource "google_secret_manager_secret_version" "cognee_api_key" {
#   secret      = google_secret_manager_secret.cognee_api_key.id
#   secret_data = "PLACEHOLDER_COGNEE_API_KEY"
#
#   lifecycle {
#     ignore_changes = [secret_data]
#   }
# }

# # OAuth Client Secret (for third-party integrations)
# resource "google_secret_manager_secret" "oauth_client_secret" {
#   secret_id = "oauth-client-secret"
#
#   replication {
#     auto {}
#   }
#
#   labels = merge(var.labels, {
#     purpose = "oauth"
#     service = "authentication"
#   })
#
#   depends_on = [google_project_service.required_services]
# }
#
# resource "google_secret_manager_secret_version" "oauth_client_secret" {
#   secret      = google_secret_manager_secret.oauth_client_secret.id
#   secret_data = "PLACEHOLDER_OAUTH_CLIENT_SECRET"
#
#   lifecycle {
#     ignore_changes = [secret_data]
#   }
# }

# # Webhook Secret (for secure webhook validation)
# resource "random_password" "webhook_secret" {
#   length  = 32
#   special = false
# }
#
# resource "google_secret_manager_secret" "webhook_secret" {
#   secret_id = "webhook-secret"
#
#   replication {
#     auto {}
#   }
#
#   labels = merge(var.labels, {
#     purpose = "webhook-validation"
#     service = "backend"
#   })
#
#   depends_on = [google_project_service.required_services]
# }
#
# resource "google_secret_manager_secret_version" "webhook_secret" {
#   secret      = google_secret_manager_secret.webhook_secret.id
#   secret_data = random_password.webhook_secret.result
# }

# ------------------------------------------------------------------------------
# IAM Bindings for Secret Access
# ------------------------------------------------------------------------------

# Backend service account - access to all secrets
resource "google_secret_manager_secret_iam_member" "backend_openrouter" {
  secret_id = google_secret_manager_secret.openrouter_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "backend_jwt" {
  secret_id = google_secret_manager_secret.jwt_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "backend_stripe" {
  secret_id = google_secret_manager_secret.stripe_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "backend_db_password" {
  secret_id = google_secret_manager_secret.db_password.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "backend_db_connection" {
  secret_id = google_secret_manager_secret.db_connection_string.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend_sa.email}"
}

# AI worker service account - access to API keys and database secrets
resource "google_secret_manager_secret_iam_member" "ai_worker_openrouter" {
  secret_id = google_secret_manager_secret.openrouter_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.ai_worker_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "ai_worker_db_password" {
  secret_id = google_secret_manager_secret.db_password.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.ai_worker_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "ai_worker_db_connection" {
  secret_id = google_secret_manager_secret.db_connection_string.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.ai_worker_sa.email}"
}

# ------------------------------------------------------------------------------
# Outputs
# ------------------------------------------------------------------------------

output "secret_ids" {
  description = "Map of secret IDs created"
  value = {
    openrouter_api_key      = google_secret_manager_secret.openrouter_api_key.secret_id
    jwt_secret              = google_secret_manager_secret.jwt_secret.secret_id
    stripe_api_key          = google_secret_manager_secret.stripe_api_key.secret_id
    database_password       = google_secret_manager_secret.db_password.secret_id
    database_connection_string = google_secret_manager_secret.db_connection_string.secret_id
  }
}
