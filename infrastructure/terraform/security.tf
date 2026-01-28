# ==============================================================================
# Security Configuration
# Cloud Armor security policy with OWASP rules and rate limiting
# ==============================================================================

# ------------------------------------------------------------------------------
# Cloud Armor Security Policy
# Protects backend API from common attacks and abuse
# ------------------------------------------------------------------------------

resource "google_compute_security_policy" "backend_security_policy" {
  count = var.enable_cloud_armor ? 1 : 0

  name        = "${var.project_name}-backend-security-policy"
  description = "Cloud Armor security policy for AI Accountant backend"

  # ------------------------------------------------------------------------------
  # Rule 1: Rate Limiting for Authentication Endpoints
  # Prevents brute force attacks on login/signup
  # ------------------------------------------------------------------------------

  rule {
    action   = "rate_based_ban"
    priority = "1000"

    match {
      versioned_expr = "SRC_IPS_V1"

      config {
        src_ip_ranges = ["*"]
      }

      expr {
        expression = "request.path.matches('/api/auth/(login|signup|reset-password)')"
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"

      enforce_on_key = "IP"

      rate_limit_threshold {
        count        = var.rate_limit_threshold
        interval_sec = 60
      }

      ban_duration_sec = 600  # 10 minute ban after exceeding limit
    }

    description = "Rate limit authentication endpoints to ${var.rate_limit_threshold} requests per minute per IP"
  }

  # ------------------------------------------------------------------------------
  # Rule 2: General API Rate Limiting
  # Prevents API abuse and DoS attacks
  # ------------------------------------------------------------------------------

  rule {
    action   = "rate_based_ban"
    priority = "2000"

    match {
      versioned_expr = "SRC_IPS_V1"

      config {
        src_ip_ranges = ["*"]
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"

      enforce_on_key = "IP"

      rate_limit_threshold {
        count        = var.rate_limit_threshold * 5  # Higher limit for general API
        interval_sec = 60
      }

      ban_duration_sec = 300  # 5 minute ban
    }

    description = "Rate limit general API access to ${var.rate_limit_threshold * 5} requests per minute per IP"
  }

  # ------------------------------------------------------------------------------
  # Rule 3: Geo-filtering (Optional)
  # Restrict access to specific countries
  # ------------------------------------------------------------------------------

  dynamic "rule" {
    for_each = length(var.allowed_countries) > 0 ? [1] : []

    content {
      action   = "deny(403)"
      priority = "3000"

      match {
        expr {
          expression = "!origin.region_code.matches('${join("|", var.allowed_countries)}')"
        }
      }

      description = "Block access from countries not in allowed list"
    }
  }

  # ------------------------------------------------------------------------------
  # Rule 4: Block Known Bad IPs and Bot Traffic
  # Uses Google's threat intelligence
  # ------------------------------------------------------------------------------

  rule {
    action   = "deny(403)"
    priority = "4000"

    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sourceiplist-vpn', ['vpn-ip-list-1'])"
      }
    }

    description = "Block known VPN and proxy IPs to prevent abuse"
  }

  # ------------------------------------------------------------------------------
  # OWASP Top 10 Protection Rules
  # ------------------------------------------------------------------------------

  # SQL Injection
  rule {
    action   = "deny(403)"
    priority = "5000"

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('sqli-v33-stable', {'sensitivity': 1})"
      }
    }

    description = "OWASP: Block SQL injection attempts"
  }

  # Cross-Site Scripting (XSS)
  rule {
    action   = "deny(403)"
    priority = "5100"

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('xss-v33-stable', {'sensitivity': 1})"
      }
    }

    description = "OWASP: Block XSS attempts"
  }

  # Local File Inclusion (LFI)
  rule {
    action   = "deny(403)"
    priority = "5200"

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('lfi-v33-stable', {'sensitivity': 1})"
      }
    }

    description = "OWASP: Block local file inclusion attempts"
  }

  # Remote File Inclusion (RFI)
  rule {
    action   = "deny(403)"
    priority = "5300"

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('rfi-v33-stable', {'sensitivity': 1})"
      }
    }

    description = "OWASP: Block remote file inclusion attempts"
  }

  # Remote Code Execution (RCE)
  rule {
    action   = "deny(403)"
    priority = "5400"

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('rce-v33-stable', {'sensitivity': 1})"
      }
    }

    description = "OWASP: Block remote code execution attempts"
  }

  # Method Enforcement
  rule {
    action   = "deny(403)"
    priority = "5500"

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('methodenforcement-v33-stable', {'sensitivity': 1})"
      }
    }

    description = "OWASP: Block invalid HTTP methods"
  }

  # Scanner Detection
  rule {
    action   = "deny(403)"
    priority = "5600"

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('scannerdetection-v33-stable', {'sensitivity': 1})"
      }
    }

    description = "OWASP: Block vulnerability scanners"
  }

  # Protocol Attack
  rule {
    action   = "deny(403)"
    priority = "5700"

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('protocolattack-v33-stable', {'sensitivity': 1})"
      }
    }

    description = "OWASP: Block protocol attacks"
  }

  # PHP Injection
  rule {
    action   = "deny(403)"
    priority = "5800"

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('php-v33-stable', {'sensitivity': 1})"
      }
    }

    description = "OWASP: Block PHP injection attempts"
  }

  # Session Fixation
  rule {
    action   = "deny(403)"
    priority = "5900"

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('sessionfixation-v33-stable', {'sensitivity': 1})"
      }
    }

    description = "OWASP: Block session fixation attempts"
  }

  # ------------------------------------------------------------------------------
  # Rule 10000: Default Allow
  # Allow all traffic that doesn't match previous rules
  # ------------------------------------------------------------------------------

  rule {
    action   = "allow"
    priority = "2147483647"

    match {
      versioned_expr = "SRC_IPS_V1"

      config {
        src_ip_ranges = ["*"]
      }
    }

    description = "Default allow rule"
  }

  # Adaptive Protection (DDoS mitigation)
  adaptive_protection_config {
    layer_7_ddos_defense_config {
      enable          = true
      rule_visibility = "STANDARD"
    }
  }

  depends_on = [google_project_service.required_services]
}

# ------------------------------------------------------------------------------
# Network Endpoint Group (NEG) for Cloud Run Backend
# Required to attach Cloud Armor policy to Cloud Run
# ------------------------------------------------------------------------------

resource "google_compute_region_network_endpoint_group" "backend_neg" {
  count = var.enable_cloud_armor ? 1 : 0

  name                  = "${var.project_name}-backend-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.backend.name
  }

  depends_on = [google_project_service.required_services]
}

# ------------------------------------------------------------------------------
# Backend Service for Load Balancer
# Connects NEG to Cloud Armor policy
# ------------------------------------------------------------------------------

resource "google_compute_backend_service" "backend_service" {
  count = var.enable_cloud_armor ? 1 : 0

  name                  = "${var.project_name}-backend-service"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTPS"

  backend {
    group = google_compute_region_network_endpoint_group.backend_neg[0].id
  }

  security_policy = google_compute_security_policy.backend_security_policy[0].id

  log_config {
    enable      = true
    sample_rate = 1.0
  }

  depends_on = [google_project_service.required_services]
}

# ------------------------------------------------------------------------------
# URL Map for Load Balancer
# ------------------------------------------------------------------------------

resource "google_compute_url_map" "backend_url_map" {
  count = var.enable_cloud_armor ? 1 : 0

  name            = "${var.project_name}-backend-url-map"
  default_service = google_compute_backend_service.backend_service[0].id

  depends_on = [google_project_service.required_services]
}

# ------------------------------------------------------------------------------
# SSL Certificate (Managed)
# Uncomment and configure for production with custom domain
# ------------------------------------------------------------------------------

# resource "google_compute_managed_ssl_certificate" "backend_ssl_cert" {
#   count = var.enable_cloud_armor ? 1 : 0
#
#   name = "${var.project_name}-backend-ssl-cert"
#
#   managed {
#     domains = ["api.yourdomain.com"]
#   }
#
#   depends_on = [google_project_service.required_services]
# }

# ------------------------------------------------------------------------------
# HTTPS Proxy
# ------------------------------------------------------------------------------

resource "google_compute_target_https_proxy" "backend_https_proxy" {
  count = var.enable_cloud_armor ? 1 : 0

  name    = "${var.project_name}-backend-https-proxy"
  url_map = google_compute_url_map.backend_url_map[0].id

  # Uncomment when SSL certificate is configured
  # ssl_certificates = [google_compute_managed_ssl_certificate.backend_ssl_cert[0].id]

  depends_on = [google_project_service.required_services]
}

# ------------------------------------------------------------------------------
# Global Forwarding Rule (External IP)
# ------------------------------------------------------------------------------

resource "google_compute_global_forwarding_rule" "backend_forwarding_rule" {
  count = var.enable_cloud_armor ? 1 : 0

  name                  = "${var.project_name}-backend-forwarding-rule"
  target                = google_compute_target_https_proxy.backend_https_proxy[0].id
  port_range            = "443"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  depends_on = [google_project_service.required_services]
}

# ------------------------------------------------------------------------------
# Outputs
# ------------------------------------------------------------------------------

output "cloud_armor_policy_name" {
  description = "Name of the Cloud Armor security policy"
  value       = var.enable_cloud_armor ? google_compute_security_policy.backend_security_policy[0].name : null
}

output "load_balancer_ip" {
  description = "External IP address of the load balancer"
  value       = var.enable_cloud_armor ? google_compute_global_forwarding_rule.backend_forwarding_rule[0].ip_address : null
}
