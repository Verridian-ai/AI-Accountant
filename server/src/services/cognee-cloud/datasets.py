"""
Cognee Cloud Dataset Definitions

Defines all 41 datasets for GoldLedger knowledge graph.
Organized into:
- Shared Knowledge (6 datasets) — Global, read-only reference data
- Per-Tenant Financial Data (33 datasets) — User-specific financial data
- Dynamic DataPoint Configs (2 datasets) — Runtime-generated configs
"""

from typing import List, Dict, Any
from dataclasses import dataclass


@dataclass
class DatasetDefinition:
    """Definition of a Cognee Cloud dataset."""
    name: str
    description: str
    category: str  # 'shared', 'tenant', 'dynamic'
    is_public: bool = False  # Whether dataset is shared across tenants


# ============================================================================
# SHARED KNOWLEDGE DATASETS (6 datasets)
# ============================================================================

SHARED_DATASETS: List[DatasetDefinition] = [
    DatasetDefinition(
        name="gst_rules",
        description="ATO GST rulings, tax rules, and GST-free/input-taxed categories",
        category="shared",
        is_public=True
    ),
    DatasetDefinition(
        name="ato_rulings",
        description="Australian Tax Office rulings, interpretations, and guidance",
        category="shared",
        is_public=True
    ),
    DatasetDefinition(
        name="tax_tables",
        description="Tax brackets, offsets, Medicare levy rates, and HELP/HECS thresholds",
        category="shared",
        is_public=True
    ),
    DatasetDefinition(
        name="deduction_patterns",
        description="Common tax deduction patterns and ATO substantiation requirements",
        category="shared",
        is_public=True
    ),
    DatasetDefinition(
        name="award_rates",
        description="Award wage rates, penalty rates, and allowances for payroll",
        category="shared",
        is_public=True
    ),
    DatasetDefinition(
        name="stp_compliance",
        description="Single Touch Payroll compliance rules and reporting requirements",
        category="shared",
        is_public=True
    ),
]

# ============================================================================
# PER-TENANT FINANCIAL DATA DATASETS (33 datasets)
# ============================================================================

TENANT_DATASETS: List[DatasetDefinition] = [
    # Core Banking & Transactions
    DatasetDefinition(
        name="bank_transactions",
        description="All financial transactions from bank statements",
        category="tenant"
    ),
    DatasetDefinition(
        name="bank_formats",
        description="Statement parser format definitions and column mappings",
        category="tenant"
    ),
    DatasetDefinition(
        name="merchant_mappings",
        description="Merchant name normalization and canonical name mappings",
        category="tenant"
    ),
    DatasetDefinition(
        name="merchant_corrections",
        description="User corrections to merchant categorization and GST classification",
        category="tenant"
    ),
    DatasetDefinition(
        name="transfer_patterns",
        description="Inter-account transfer detection patterns and rules",
        category="tenant"
    ),
    
    # Financial Reporting & Analysis
    DatasetDefinition(
        name="financial_reports",
        description="Generated financial reports, P&L, balance sheets",
        category="tenant"
    ),
    DatasetDefinition(
        name="budget_templates",
        description="Budget templates and forecasting models",
        category="tenant"
    ),
    DatasetDefinition(
        name="kpi_history",
        description="KPI metrics tracked over time",
        category="tenant"
    ),
    DatasetDefinition(
        name="forecast_patterns",
        description="Revenue and expense forecasting patterns",
        category="tenant"
    ),
    DatasetDefinition(
        name="anomaly_history",
        description="Detected financial anomalies and alerts",
        category="tenant"
    ),
    DatasetDefinition(
        name="compliance_rulings",
        description="Compliance check results and audit findings",
        category="tenant"
    ),
    DatasetDefinition(
        name="temporal_patterns",
        description="Time-based spending patterns and seasonality",
        category="tenant"
    ),
    
    # Intelligence & Insights
    DatasetDefinition(
        name="cross_module_insights",
        description="Cross-module intelligence and correlations",
        category="tenant"
    ),
    DatasetDefinition(
        name="module_relationships",
        description="Module connection metadata and dependencies",
        category="tenant"
    ),
    
    # Consumer Data Right (CDR)
    DatasetDefinition(
        name="cdr_products",
        description="Consumer Data Right product data from banks",
        category="tenant"
    ),
    DatasetDefinition(
        name="cdr_rates",
        description="CDR interest rates and fee schedules",
        category="tenant"
    ),
    DatasetDefinition(
        name="banking_product_knowledge",
        description="Banking product intelligence and comparisons",
        category="tenant"
    ),
    
    # Market Data
    DatasetDefinition(
        name="market_intelligence",
        description="Market analysis and industry benchmarks",
        category="tenant"
    ),
    DatasetDefinition(
        name="market_sentiment",
        description="Sentiment analysis of market conditions",
        category="tenant"
    ),
    DatasetDefinition(
        name="rba_statistics",
        description="Reserve Bank of Australia statistics and rates",
        category="tenant"
    ),
    DatasetDefinition(
        name="abs_statistics",
        description="Australian Bureau of Statistics economic data",
        category="tenant"
    ),
    DatasetDefinition(
        name="asx_market_data",
        description="ASX market data for investment tracking",
        category="tenant"
    ),

    # Inventory & Operations
    DatasetDefinition(
        name="inventory_catalog",
        description="Inventory items and stock management",
        category="tenant"
    ),
    DatasetDefinition(
        name="recon_patterns",
        description="Reconciliation patterns and matching rules",
        category="tenant"
    ),

    # OCR & Document Processing
    DatasetDefinition(
        name="ocr_extractions",
        description="OCR document extractions and parsed data",
        category="tenant"
    ),

    # Customers & Invoicing
    DatasetDefinition(
        name="customer_profiles",
        description="Customer profiles and contact information",
        category="tenant"
    ),
    DatasetDefinition(
        name="invoice_history",
        description="Invoice records and payment history",
        category="tenant"
    ),

    # Suppliers & Payables
    DatasetDefinition(
        name="supplier_profiles",
        description="Supplier profiles and payment terms",
        category="tenant"
    ),
    DatasetDefinition(
        name="bill_patterns",
        description="Bill payment patterns and schedules",
        category="tenant"
    ),

    # Payroll
    DatasetDefinition(
        name="employee_profiles",
        description="Employee profiles and employment details",
        category="tenant"
    ),
    DatasetDefinition(
        name="pay_structures",
        description="Payroll structures, rates, and allowances",
        category="tenant"
    ),

    # Feedback & Learning
    DatasetDefinition(
        name="search_feedback",
        description="User search feedback for memify enrichment",
        category="tenant"
    ),
]

# ============================================================================
# ALL DATASETS
# ============================================================================

ALL_DATASETS = SHARED_DATASETS + TENANT_DATASETS


def get_dataset_by_name(name: str) -> DatasetDefinition | None:
    """Get dataset definition by name."""
    for dataset in ALL_DATASETS:
        if dataset.name == name:
            return dataset
    return None


def get_shared_datasets() -> List[DatasetDefinition]:
    """Get all shared (public) datasets."""
    return SHARED_DATASETS


def get_tenant_datasets() -> List[DatasetDefinition]:
    """Get all per-tenant datasets."""
    return TENANT_DATASETS


def get_dataset_names() -> List[str]:
    """Get all dataset names."""
    return [d.name for d in ALL_DATASETS]


