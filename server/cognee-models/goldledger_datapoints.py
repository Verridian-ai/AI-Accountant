"""
GoldLedger Custom DataPoint Models for Cognee.

10 domain-specific DataPoints for Australian financial entity extraction.
These are registered with Cognee's ECL pipeline for structured extraction.

Based on docs/COGNEE_INTEGRATION_PLAN.md specification.
"""

from typing import Optional, List
from cognee.infrastructure.engine import DataPoint


class TransactionNode(DataPoint):
    """A financial transaction from a bank statement."""

    description: str
    amount_cents: int
    category: str
    date: str  # ISO 8601
    gst_amount_cents: int = 0
    gst_applicable: bool = False
    claim_type: str = ""  # work-related, self-education, etc.
    is_debit: bool = True
    merchant: Optional["MerchantNode"] = None  # Relationship -> edge
    account: Optional["AccountNode"] = None  # Relationship -> edge
    bas_period: Optional["BASPeriodNode"] = None  # Relationship -> edge
    metadata: dict = {"index_fields": ["description", "category", "merchant"]}


class AccountNode(DataPoint):
    """A bank or business account."""

    account_number_masked: str
    account_type: str  # savings, business, credit, loan
    bank_name: str
    bsb: str = ""
    balance_cents: int = 0
    ownership_tag: str = ""  # personal, business, trust
    metadata: dict = {"index_fields": ["account_type", "bank_name"]}


class MerchantNode(DataPoint):
    """A merchant/vendor profile with spending intelligence."""

    name: str
    canonical_name: str = ""
    abn: str = ""
    industry: str = ""
    primary_category: str = ""
    avg_amount_cents: int = 0
    frequency: str = ""  # weekly, monthly, quarterly
    total_spend_cents: int = 0
    gst_registered: bool = False
    category_patterns: List["CategoryNode"] = []  # Relationship -> edges
    metadata: dict = {"index_fields": ["name", "canonical_name", "industry"]}


class CategoryNode(DataPoint):
    """A transaction category with tax properties."""

    name: str
    parent_category: str = ""
    category_type: str = ""  # income, expense, transfer
    tax_deductible: bool = False
    gst_applicable: bool = True
    ato_category_code: str = ""  # D1-D15 for deductions
    metadata: dict = {"index_fields": ["name", "parent_category"]}


class GSTRuleNode(DataPoint):
    """An Australian GST rule or ATO ruling."""

    rule_type: str  # input_taxed, gst_free, standard, export
    rate: float  # 0.0 or 0.1
    description: str
    ato_reference: str = ""
    applies_to_categories: List[str] = []
    effective_date: str = ""
    metadata: dict = {"index_fields": ["description", "rule_type", "ato_reference"]}


class PatternNode(DataPoint):
    """A detected financial pattern or trend."""

    pattern_type: str  # recurring, seasonal, anomaly, trend, spike
    frequency: str = ""  # daily, weekly, fortnightly, monthly, quarterly, annual
    amount_range_min_cents: int = 0
    amount_range_max_cents: int = 0
    related_merchants: str = ""  # comma-separated
    related_categories: str = ""  # comma-separated
    confidence: float = 0.0
    account: Optional["AccountNode"] = None  # Relationship -> edge
    metadata: dict = {"index_fields": ["pattern_type", "frequency"]}


class BASPeriodNode(DataPoint):
    """A BAS reporting period with GST calculations."""

    quarter: str  # Q1, Q2, Q3, Q4
    financial_year: str  # e.g. 2025-26
    start_date: str = ""
    end_date: str = ""
    gst_collected_cents: int = 0  # G1
    gst_paid_cents: int = 0
    net_gst_cents: int = 0
    total_sales_cents: int = 0
    total_purchases_cents: int = 0
    metadata: dict = {"index_fields": ["quarter", "financial_year"]}


class DeductionNode(DataPoint):
    """A tax deduction claim with ATO categorization."""

    deduction_type: str  # work-related, self-education, home-office, vehicle
    ato_category: str  # D1-D15
    amount_cents: int = 0
    financial_year: str = ""
    ato_ruling: str = ""
    substantiation: str = ""  # receipt, logbook, diary
    claim_percentage: float = 100.0
    related_transactions: List["TransactionNode"] = []  # Relationship -> edges
    metadata: dict = {"index_fields": ["deduction_type", "ato_category"]}


class FinancialYearNode(DataPoint):
    """An Australian financial year (Jul 1 - Jun 30)."""

    year_label: str  # e.g. "2024-25"
    start_date: str  # "2024-07-01"
    end_date: str  # "2025-06-30"
    total_income_cents: int = 0
    total_expenses_cents: int = 0
    total_gst_collected_cents: int = 0
    total_gst_paid_cents: int = 0
    metadata: dict = {"index_fields": ["year_label"]}


class TransferNode(DataPoint):
    """An inter-account transfer linking two accounts."""

    from_account: Optional["AccountNode"] = None  # Relationship -> edge
    to_account: Optional["AccountNode"] = None  # Relationship -> edge
    amount_cents: int = 0
    date: str = ""
    is_recurring: bool = False
    frequency: str = ""
    metadata: dict = {"index_fields": ["date"]}
