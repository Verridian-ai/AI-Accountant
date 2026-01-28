# ==============================================================================
# Variables Configuration
# AI Accountant Fintech Application - GCP Infrastructure
# ==============================================================================

# ------------------------------------------------------------------------------
# Project Configuration
# ------------------------------------------------------------------------------

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "project_name" {
  description = "Project name used as prefix for resource naming"
  type        = string
  default     = "ai-accountant"
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "australia-southeast1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

# ------------------------------------------------------------------------------
# Cloud SQL Configuration
# ------------------------------------------------------------------------------

variable "db_instance_name" {
  description = "Cloud SQL instance name"
  type        = string
  default     = "ai-accountant-db"
}

variable "db_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-g1-small"
}

variable "db_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "POSTGRES_15"
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "accountant_db"
}

variable "db_user" {
  description = "Database username"
  type        = string
  default     = "app_user"
}

variable "db_high_availability" {
  description = "Enable high availability configuration"
  type        = bool
  default     = false
}

variable "db_backup_start_time" {
  description = "Backup start time (HH:MM format, UTC)"
  type        = string
  default     = "14:00"
}

variable "db_maintenance_window_day" {
  description = "Maintenance window day (1-7, 1=Monday)"
  type        = number
  default     = 7
}

variable "db_maintenance_window_hour" {
  description = "Maintenance window hour (0-23, UTC)"
  type        = number
  default     = 16
}

# ------------------------------------------------------------------------------
# Cloud Run Configuration
# ------------------------------------------------------------------------------

variable "backend_service_name" {
  description = "Cloud Run backend service name"
  type        = string
  default     = "ai-accountant-backend"
}

variable "backend_cpu" {
  description = "CPU allocation for backend service"
  type        = string
  default     = "1"
}

variable "backend_memory" {
  description = "Memory allocation for backend service"
  type        = string
  default     = "512Mi"
}

variable "backend_min_instances" {
  description = "Minimum number of backend instances"
  type        = number
  default     = 1
}

variable "backend_max_instances" {
  description = "Maximum number of backend instances"
  type        = number
  default     = 100
}

variable "backend_timeout_seconds" {
  description = "Request timeout for backend service"
  type        = number
  default     = 300
}

variable "backend_concurrency" {
  description = "Maximum concurrent requests per backend instance"
  type        = number
  default     = 80
}

# ------------------------------------------------------------------------------
# Cloud Run Jobs Configuration
# ------------------------------------------------------------------------------

variable "ai_job_cpu" {
  description = "CPU allocation for AI worker jobs"
  type        = string
  default     = "2"
}

variable "ai_job_memory" {
  description = "Memory allocation for AI worker jobs"
  type        = string
  default     = "2Gi"
}

variable "ai_job_timeout_seconds" {
  description = "Timeout for AI worker jobs"
  type        = number
  default     = 1200
}

variable "ai_job_max_retries" {
  description = "Maximum retries for failed AI jobs"
  type        = number
  default     = 3
}

# ------------------------------------------------------------------------------
# Cloud Storage Configuration
# ------------------------------------------------------------------------------

variable "storage_bucket_name" {
  description = "Cloud Storage bucket name for PDFs and statements"
  type        = string
  default     = ""
}

variable "storage_location" {
  description = "Cloud Storage bucket location"
  type        = string
  default     = "australia-southeast1"
}

variable "storage_class" {
  description = "Cloud Storage class"
  type        = string
  default     = "STANDARD"
}

variable "temp_file_retention_days" {
  description = "Days to retain temporary files before deletion"
  type        = number
  default     = 7
}

# ------------------------------------------------------------------------------
# Security Configuration
# ------------------------------------------------------------------------------

variable "allowed_ingress_cidrs" {
  description = "CIDR blocks allowed to access Cloud Run services"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "cors_origins" {
  description = "Allowed CORS origins for backend API"
  type        = list(string)
  default     = ["*"]
}

variable "rate_limit_threshold" {
  description = "Rate limit threshold (requests per minute per IP)"
  type        = number
  default     = 100
}

variable "enable_cloud_armor" {
  description = "Enable Cloud Armor security policy"
  type        = bool
  default     = true
}

variable "allowed_countries" {
  description = "ISO 3166-1 alpha-2 country codes allowed to access services (empty = all countries)"
  type        = list(string)
  default     = []
}

# ------------------------------------------------------------------------------
# Container Images
# ------------------------------------------------------------------------------

variable "backend_image" {
  description = "Container image for backend service"
  type        = string
  default     = "gcr.io/cloudrun/hello"
}

variable "pdf_processor_image" {
  description = "Container image for PDF processor job"
  type        = string
  default     = "gcr.io/cloudrun/hello"
}

variable "ai_categorization_image" {
  description = "Container image for AI categorization job"
  type        = string
  default     = "gcr.io/cloudrun/hello"
}

# ------------------------------------------------------------------------------
# Tags and Labels
# ------------------------------------------------------------------------------

variable "labels" {
  description = "Labels to apply to all resources"
  type        = map(string)
  default = {
    application = "ai-accountant"
    managed-by  = "terraform"
  }
}
