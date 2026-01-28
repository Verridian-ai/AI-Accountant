# ==============================================================================
# Cloud SQL PostgreSQL Configuration
# Production-ready PostgreSQL 15 instance with backups and SSL
# ==============================================================================

# ------------------------------------------------------------------------------
# Generate Random Password for Database
# ------------------------------------------------------------------------------

resource "random_password" "db_password" {
  length  = 32
  special = true
}

# ------------------------------------------------------------------------------
# Cloud SQL Instance
# ------------------------------------------------------------------------------

resource "google_sql_database_instance" "postgres" {
  name             = "${var.db_instance_name}-${random_id.suffix.hex}"
  database_version = var.db_version
  region           = var.region

  # Deletion protection - set to true for production
  deletion_protection = false

  settings {
    # Machine tier - can be upgraded without downtime
    tier              = var.db_tier
    availability_type = var.db_high_availability ? "REGIONAL" : "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = 10  # GB, auto-increases as needed
    disk_autoresize   = true

    # Backup Configuration
    backup_configuration {
      enabled                        = true
      start_time                     = var.db_backup_start_time
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7

      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }
    }

    # Maintenance Window
    maintenance_window {
      day          = var.db_maintenance_window_day
      hour         = var.db_maintenance_window_hour
      update_track = "stable"
    }

    # IP Configuration - Private IP preferred for security
    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.private_network.id
      enable_private_path_for_google_cloud_services = true
      require_ssl                                   = true

      # Authorized networks can be added here if public access needed
      # authorized_networks {
      #   name  = "office-network"
      #   value = "203.0.113.0/24"
      # }
    }

    # Database flags for PostgreSQL optimization
    database_flags {
      name  = "max_connections"
      value = "100"
    }

    database_flags {
      name  = "shared_buffers"
      value = "262144"  # 256MB in 8KB pages
    }

    database_flags {
      name  = "work_mem"
      value = "4096"  # 4MB in KB
    }

    database_flags {
      name  = "maintenance_work_mem"
      value = "65536"  # 64MB in KB
    }

    database_flags {
      name  = "effective_cache_size"
      value = "524288"  # 512MB in 8KB pages
    }

    # Enable query insights for performance monitoring
    insights_config {
      query_insights_enabled  = true
      query_plans_per_minute  = 5
      query_string_length     = 1024
      record_application_tags = true
    }
  }

  # Depends on private VPC connection
  depends_on = [
    google_service_networking_connection.private_vpc_connection,
    google_project_service.required_services
  ]
}

# ------------------------------------------------------------------------------
# Database
# ------------------------------------------------------------------------------

resource "google_sql_database" "database" {
  name     = var.db_name
  instance = google_sql_database_instance.postgres.name
}

# ------------------------------------------------------------------------------
# Database User
# ------------------------------------------------------------------------------

resource "google_sql_user" "app_user" {
  name     = var.db_user
  instance = google_sql_database_instance.postgres.name
  password = random_password.db_password.result
}

# ------------------------------------------------------------------------------
# Store Database Password in Secret Manager
# ------------------------------------------------------------------------------

resource "google_secret_manager_secret" "db_password" {
  secret_id = "database-password"

  replication {
    auto {}
  }

  labels = var.labels

  depends_on = [google_project_service.required_services]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

# ------------------------------------------------------------------------------
# Store Database Connection String in Secret Manager
# ------------------------------------------------------------------------------

resource "google_secret_manager_secret" "db_connection_string" {
  secret_id = "database-connection-string"

  replication {
    auto {}
  }

  labels = var.labels

  depends_on = [google_project_service.required_services]
}

resource "google_secret_manager_secret_version" "db_connection_string" {
  secret = google_secret_manager_secret.db_connection_string.id
  secret_data = format(
    "postgresql://%s:%s@%s/%s?host=/cloudsql/%s",
    var.db_user,
    random_password.db_password.result,
    google_sql_database_instance.postgres.private_ip_address,
    var.db_name,
    google_sql_database_instance.postgres.connection_name
  )
}

# ------------------------------------------------------------------------------
# Outputs for other modules
# ------------------------------------------------------------------------------

output "db_instance_connection_name" {
  description = "Connection name for Cloud SQL instance"
  value       = google_sql_database_instance.postgres.connection_name
}

output "db_private_ip" {
  description = "Private IP address of the Cloud SQL instance"
  value       = google_sql_database_instance.postgres.private_ip_address
}
