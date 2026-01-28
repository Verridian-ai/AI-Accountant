# ==============================================================================
# Cloud Storage Configuration
# Bucket for PDF bank statements and processed documents
# ==============================================================================

# ------------------------------------------------------------------------------
# Cloud Storage Bucket
# ------------------------------------------------------------------------------

resource "google_storage_bucket" "statements_bucket" {
  name          = var.storage_bucket_name != "" ? var.storage_bucket_name : "${var.project_name}-statements-${random_id.suffix.hex}"
  location      = var.storage_location
  storage_class = var.storage_class

  # Uniform bucket-level access (recommended for security)
  uniform_bucket_level_access {
    enabled = true
  }

  # Versioning to prevent accidental data loss
  versioning {
    enabled = true
  }

  # CORS configuration for direct browser uploads
  cors {
    origin          = var.cors_origins
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  # Lifecycle rules for automatic cleanup
  lifecycle_rule {
    condition {
      age        = var.temp_file_retention_days
      matches_prefix = ["temp/"]
    }
    action {
      type = "Delete"
    }
  }

  # Lifecycle rule to delete old versions after 30 days
  lifecycle_rule {
    condition {
      days_since_noncurrent_time = 30
      with_state                 = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }

  # Lifecycle rule to move old files to Nearline after 90 days
  lifecycle_rule {
    condition {
      age                   = 90
      matches_storage_class = ["STANDARD"]
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  # Enable public access prevention
  public_access_prevention = "enforced"

  # Labels for organization
  labels = merge(var.labels, {
    purpose = "statements-storage"
  })

  depends_on = [google_project_service.required_services]
}

# ------------------------------------------------------------------------------
# Bucket Folders (logical organization)
# Note: GCS doesn't have true folders, but we document the structure
# ------------------------------------------------------------------------------

# Expected folder structure:
# - raw/              : Original uploaded PDFs
# - processed/        : Processed and extracted data
# - temp/             : Temporary files (auto-deleted after 7 days)
# - exports/          : Generated reports and exports
# - archives/         : Long-term archived statements

# ------------------------------------------------------------------------------
# IAM Bindings for Service Accounts
# ------------------------------------------------------------------------------

# Backend service account - read/write access
resource "google_storage_bucket_iam_member" "backend_object_admin" {
  bucket = google_storage_bucket.statements_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.backend_sa.email}"
}

# AI worker service account - read/write access
resource "google_storage_bucket_iam_member" "ai_worker_object_admin" {
  bucket = google_storage_bucket.statements_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.ai_worker_sa.email}"
}

# ------------------------------------------------------------------------------
# Bucket Notifications (Optional)
# Trigger Cloud Run jobs when files are uploaded
# ------------------------------------------------------------------------------

# # Pub/Sub topic for bucket notifications
# resource "google_pubsub_topic" "bucket_notifications" {
#   name = "${var.project_name}-bucket-notifications"
#
#   labels = var.labels
#
#   depends_on = [google_project_service.required_services]
# }
#
# # Grant Cloud Storage permission to publish to Pub/Sub
# data "google_storage_project_service_account" "gcs_account" {
#   project = var.project_id
# }
#
# resource "google_pubsub_topic_iam_member" "gcs_publisher" {
#   topic  = google_pubsub_topic.bucket_notifications.name
#   role   = "roles/pubsub.publisher"
#   member = "serviceAccount:${data.google_storage_project_service_account.gcs_account.email_address}"
# }
#
# # Bucket notification configuration
# resource "google_storage_notification" "pdf_upload_notification" {
#   bucket         = google_storage_bucket.statements_bucket.name
#   payload_format = "JSON_API_V1"
#   topic          = google_pubsub_topic.bucket_notifications.id
#   event_types    = ["OBJECT_FINALIZE"]
#
#   custom_attributes = {
#     notification-type = "pdf-upload"
#   }
#
#   # Only trigger for PDFs in the raw folder
#   object_name_prefix = "raw/"
#
#   depends_on = [google_pubsub_topic_iam_member.gcs_publisher]
# }

# ------------------------------------------------------------------------------
# Backup Bucket (Optional)
# For disaster recovery and compliance
# ------------------------------------------------------------------------------

# resource "google_storage_bucket" "backup_bucket" {
#   name          = "${var.project_name}-backup-${random_id.suffix.hex}"
#   location      = "us-central1"  # Different region for DR
#   storage_class = "NEARLINE"
#
#   uniform_bucket_level_access {
#     enabled = true
#   }
#
#   versioning {
#     enabled = true
#   }
#
#   lifecycle_rule {
#     condition {
#       age = 365
#     }
#     action {
#       type          = "SetStorageClass"
#       storage_class = "ARCHIVE"
#     }
#   }
#
#   public_access_prevention = "enforced"
#
#   labels = merge(var.labels, {
#     purpose = "backup-storage"
#   })
#
#   depends_on = [google_project_service.required_services]
# }

# ------------------------------------------------------------------------------
# Outputs
# ------------------------------------------------------------------------------

output "storage_bucket_name" {
  description = "Name of the Cloud Storage bucket for statements"
  value       = google_storage_bucket.statements_bucket.name
}

output "storage_bucket_url" {
  description = "URL of the Cloud Storage bucket"
  value       = google_storage_bucket.statements_bucket.url
}

output "storage_bucket_self_link" {
  description = "Self link of the Cloud Storage bucket"
  value       = google_storage_bucket.statements_bucket.self_link
}
