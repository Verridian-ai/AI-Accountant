"""
Cognee Cloud DataPoint Models

10 custom Pydantic DataPoint models for Australian financial entity extraction.
These models tell Cognee Cloud what entities to extract during cognify operations.

Based on: server/src/services/cognee/datapoint-models.ts
"""

from typing import Optional, List
from pydantic import BaseModel, Field


# ============================================================================
# 1. TransactionNode — Financial Transactions
# ============================================================================

class TransactionNode(BaseModel):
    """A financial transaction from a bank statement or ledger."""
    
    description: str = Field(..., description="Transaction description/merchant name")
    amount_cents: int = Field(..., description="Transaction amount in cents")
    category: str = Field(..., description="Transaction category")
    date: str = Field(..., description="Transaction date (ISO 8601)")
    gst_amount_cents: int = Field(default=0, description="GST component in cents")
    gst_applicable: bool = Field(default=False, description="Whether GST applies")
    claim_type: str = Field(default="", description="Tax claim type (work-related, self-education, etc.)")
    is_debit: bool = Field(default=True, description="Whether this is a debit transaction")
    account_id: Optional[str] = Field(default=None, description="Account identifier")
    merchant_name: Optional[str] = Field(default=None, description="Normalized merchant name")
    
    class Config:
        json_schema_extra = {
            "index_fields": ["description", "category", "merchant_name"],
            "target_dataset": "bank_transactions"
        }


# ============================================================================
# 2. AccountNode — Bank Accounts
# ============================================================================

class AccountNode(BaseModel):
    """A bank or business account."""
    
    account_number_masked: str = Field(..., description="Masked account number (last 4 digits)")
    account_type: str = Field(..., description="Account type (savings, business, credit, loan)")
    bank_name: str = Field(..., description="Bank name")
    bsb: str = Field(default="", description="BSB number")
    balance_cents: int = Field(default=0, description="Current balance in cents")
    ownership_tag: str = Field(default="", description="Ownership type (personal, business, trust)")
    
    class Config:
        json_schema_extra = {
            "index_fields": ["account_type", "bank_name"],
            "target_dataset": "financial_insights"
        }


# ============================================================================
# 3. CategoryNode — Transaction Categories
# ============================================================================

class CategoryNode(BaseModel):
    """A transaction category with tax properties."""
    
    name: str = Field(..., description="Category name")
    parent: Optional[str] = Field(default=None, description="Parent category")
    tax_deductible: bool = Field(default=False, description="Whether expenses are tax deductible")
    gst_applicable: bool = Field(default=False, description="Whether GST applies")
    category_type: str = Field(..., description="Category type (income, expense, transfer)")
    
    class Config:
        json_schema_extra = {
            "index_fields": ["name", "parent"],
            "target_dataset": "financial_insights"
        }


# ============================================================================
# 4. GSTRuleNode — GST Rules and ATO Rulings
# ============================================================================

class GSTRuleNode(BaseModel):
    """An Australian GST rule or ATO ruling."""
    
    rule_type: str = Field(..., description="Rule type (input_taxed, gst_free, standard, export)")
    rate: float = Field(..., description="GST rate (0.0 or 0.1)")
    description: str = Field(..., description="Rule description")
    ato_reference: str = Field(default="", description="ATO ruling reference number")
    applies_to: str = Field(..., description="Category or transaction types this rule applies to")
    
    class Config:
        json_schema_extra = {
            "index_fields": ["rule_type", "description", "applies_to"],
            "target_dataset": "gst_rules"
        }


# ============================================================================
# 5. PatternNode — Spending/Income Patterns
# ============================================================================

class PatternNode(BaseModel):
    """A detected financial pattern or trend."""
    
    pattern_type: str = Field(..., description="Type: recurring, seasonal, anomaly, trend")
    frequency: str = Field(..., description="Frequency: daily, weekly, monthly, quarterly, annual")
    amount_range_min: int = Field(..., description="Minimum amount in cents")
    amount_range_max: int = Field(..., description="Maximum amount in cents")
    entities: str = Field(..., description="Related merchants/categories (comma-separated)")
    confidence: float = Field(..., description="Detection confidence 0.0-1.0")
    
    class Config:
        json_schema_extra = {
            "index_fields": ["pattern_type", "frequency", "entities"],
            "target_dataset": "temporal_patterns"
        }


# ============================================================================
# 6. BASPeriodNode — BAS Reporting Periods
# ============================================================================

class BASPeriodNode(BaseModel):
    """A BAS reporting period with GST calculations."""
    
    quarter: str = Field(..., description="BAS quarter (Q1-Q4)")
    financial_year: str = Field(..., description="Financial year (e.g. 2025-26)")
    gst_collected: int = Field(..., description="GST collected (G1) in cents")
    gst_paid: int = Field(..., description="GST paid on purchases in cents")
    net_gst: int = Field(..., description="Net GST payable/refundable in cents")
    total_sales: int = Field(..., description="Total sales in cents")
    
    class Config:
        json_schema_extra = {
            "index_fields": ["quarter", "financial_year"],
            "target_dataset": "financial_insights"
        }


# ============================================================================
# 7. MerchantNode — Merchant Profiles
# ============================================================================

class MerchantNode(BaseModel):
    """A merchant or vendor profile with spending intelligence."""
    
    name: str = Field(..., description="Merchant name (normalized)")
    canonical_name: str = Field(default="", description="Canonical merchant name")
    abn: str = Field(default="", description="Australian Business Number")
    industry: str = Field(default="", description="Industry classification")
    primary_category: str = Field(default="", description="Primary transaction category")
    avg_amount_cents: int = Field(default=0, description="Average transaction amount in cents")
    frequency: str = Field(default="", description="Transaction frequency (weekly, monthly, etc.)")
    total_spend_cents: int = Field(default=0, description="Total lifetime spend in cents")
    
    class Config:
        json_schema_extra = {
            "index_fields": ["name", "canonical_name", "industry", "primary_category"],
            "target_dataset": "merchant_data"
        }


# ============================================================================
# 8. DeductionNode — Tax Deductions
# ============================================================================

class DeductionNode(BaseModel):
    """A tax deduction claim."""

    deduction_type: str = Field(..., description="Deduction type (work-related, self-education, home-office, etc.)")
    category: str = Field(..., description="ATO deduction category (D1-D15)")
    amount_cents: int = Field(..., description="Deduction amount in cents")
    tax_year: str = Field(..., description="Financial year")
    ato_ruling: str = Field(default="", description="Relevant ATO ruling")
    substantiation: str = Field(default="", description="Evidence type (receipt, logbook, etc.)")

    class Config:
        json_schema_extra = {
            "index_fields": ["deduction_type", "category", "tax_year"],
            "target_dataset": "deduction_patterns"
        }


# ============================================================================
# 9. EmployeeNode — Employee Profiles
# ============================================================================

class EmployeeNode(BaseModel):
    """An employee profile for payroll."""

    employee_id: str = Field(..., description="Employee identifier")
    first_name: str = Field(..., description="First name")
    last_name: str = Field(..., description="Last name")
    employment_type: str = Field(..., description="Employment type (full_time, part_time, casual)")
    tax_file_number_masked: str = Field(default="", description="Masked TFN (last 3 digits)")
    superannuation_fund: str = Field(default="", description="Superannuation fund name")
    base_salary_cents: int = Field(default=0, description="Base salary in cents per annum")

    class Config:
        json_schema_extra = {
            "index_fields": ["employee_id", "employment_type"],
            "target_dataset": "employee_profiles"
        }


# ============================================================================
# 10. InvoiceNode — Invoices and Bills
# ============================================================================

class InvoiceNode(BaseModel):
    """An invoice or bill entity."""

    invoice_number: str = Field(..., description="Invoice number")
    invoice_type: str = Field(..., description="Type (invoice, bill, credit_note)")
    customer_name: Optional[str] = Field(default=None, description="Customer/supplier name")
    invoice_date: str = Field(..., description="Invoice date (ISO 8601)")
    due_date: str = Field(..., description="Due date (ISO 8601)")
    subtotal_cents: int = Field(..., description="Subtotal in cents")
    gst_amount_cents: int = Field(..., description="GST amount in cents")
    total_amount_cents: int = Field(..., description="Total amount in cents")
    status: str = Field(..., description="Status (draft, sent, paid, overdue)")

    class Config:
        json_schema_extra = {
            "index_fields": ["invoice_number", "customer_name", "status"],
            "target_dataset": "invoice_history"
        }


# ============================================================================
# All DataPoint Models
# ============================================================================

ALL_DATAPOINT_MODELS = [
    TransactionNode,
    AccountNode,
    CategoryNode,
    GSTRuleNode,
    PatternNode,
    BASPeriodNode,
    MerchantNode,
    DeductionNode,
    EmployeeNode,
    InvoiceNode,
]


def get_datapoint_model_by_name(name: str) -> Optional[type[BaseModel]]:
    """Get DataPoint model class by name."""
    for model in ALL_DATAPOINT_MODELS:
        if model.__name__ == name:
            return model
    return None


def get_all_datapoint_schemas() -> List[dict]:
    """Get JSON schemas for all DataPoint models."""
    return [model.model_json_schema() for model in ALL_DATAPOINT_MODELS]


