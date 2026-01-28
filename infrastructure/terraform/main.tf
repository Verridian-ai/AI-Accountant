# ==============================================================================
# Main Terraform Configuration
# AI Accountant Fintech Application - GCP Infrastructure
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Backend configuration for state management
  # Uncomment and configure for production use
  # backend "gcs" {
  #   bucket = "YOUR_TERRAFORM_STATE_BUCKET"
  #   prefix = "terraform/state"
  # }
}

# ==============================================================================
# Provider Configuration
# ==============================================================================

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ==============================================================================
# Project Services (APIs)
# Enable required GCP services for the application
# ==============================================================================

locals {
  required_services = [
    "compute.googleapis.com",           # Compute Engine API
    "cloudresourcemanager.googleapis.com", # Cloud Resource Manager API
    "servicenetworking.googleapis.com", # Service Networking API
    "sqladmin.googleapis.com",          # Cloud SQL Admin API
    "run.googleapis.com",               # Cloud Run API
    "storage.googleapis.com",           # Cloud Storage API
    "secretmanager.googleapis.com",     # Secret Manager API
    "cloudscheduler.googleapis.com",    # Cloud Scheduler API
    "cloudbuild.googleapis.com",        # Cloud Build API (for deployments)
    "artifactregistry.googleapis.com",  # Artifact Registry API
    "compute.googleapis.com",           # Required for Cloud Armor
    "vpcaccess.googleapis.com",         # VPC Access for Cloud Run
    "iam.googleapis.com",               # IAM API
  ]
}

resource "google_project_service" "required_services" {
  for_each = toset(local.required_services)

  project = var.project_id
  service = each.value

  disable_dependent_services = false
  disable_on_destroy        = false
}

# ==============================================================================
# VPC Network Configuration
# Private IP configuration for Cloud SQL
# ==============================================================================

resource "google_compute_network" "private_network" {
  name                    = "${var.project_name}-network"
  auto_create_subnetworks = true

  depends_on = [google_project_service.required_services]
}

# Reserve IP range for private service connection (Cloud SQL)
resource "google_compute_global_address" "private_ip_address" {
  name          = "${var.project_name}-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.private_network.id

  depends_on = [google_project_service.required_services]
}

# Create private VPC connection for Cloud SQL
resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.private_network.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]

  depends_on = [google_project_service.required_services]
}

# VPC Access Connector for Cloud Run to connect to Cloud SQL via private IP
resource "google_vpc_access_connector" "connector" {
  name          = "${var.project_name}-vpc-connector"
  region        = var.region
  network       = google_compute_network.private_network.name
  ip_cidr_range = "10.8.0.0/28"

  min_instances = 2
  max_instances = 3

  machine_type = "e2-micro"

  depends_on = [google_project_service.required_services]
}

# ==============================================================================
# Random Suffix for Unique Resource Names
# ==============================================================================

resource "random_id" "suffix" {
  byte_length = 4
}
