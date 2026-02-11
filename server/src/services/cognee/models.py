"""
Cognee DataPoint models for CBA Statements Parse knowledge graph.

These models define the entity types and relationships in the Cognee
knowledge graph, used for AI-powered transaction categorization,
GST analysis, and financial intelligence.
"""

from cognee.infrastructure.engine import DataPoint
from typing import Any, Optional, List
from pydantic import SkipValidation


class AccountNode(DataPoint):
    """Bank account entity."""
    bank: str                    # "CBA", "NAB", "ANZ", etc.
    bsb: Optional[str] = None
    account_number: str
    account_name: str
    account_type: str            # "transaction", "savings", "credit"
    metadata: dict = {"index_fields": ["bank", "account_name"]}


class StatementNode(DataPoint):
    """Parsed bank statement."""
    filename: str
    period_start: str            # ISO date
    period_end: str              # ISO date
    opening_balance_cents: int
    closing_balance_cents: int
    transaction_count: int
    hash: str                    # File hash for dedup
    from_account: SkipValidation[Any] = None  # -> AccountNode
    metadata: dict = {"index_fields": ["filename", "period_start"]}


class CategoryNode(DataPoint):
    """Transaction category from the single source of truth."""
    name: str                    # e.g., "Office Supplies"
    category_type: str           # "revenue", "expense", "cogs", "system"
    account_code: str            # e.g., "6-0900"
    tax_code: str                # "GST", "FRE", "N-T", "EXP"
    keywords: List[str]          # Matching keywords
    description: str             # What this category covers
    metadata: dict = {"index_fields": ["name", "description"]}


class GSTRuleNode(DataPoint):
    """GST categorization rule per ATO guidelines."""
    gst_category: str            # "taxable_10", "gst_free", "input_taxed", "capital", "private"
    gst_rate: float              # 0.0 or 0.10
    bas_label: Optional[str]     # "G1", "G10", "G11", etc.
    is_claimable: bool
    description: str             # Human-readable rule description
    ato_reference: Optional[str] = None  # ATO ruling reference
    applies_to: SkipValidation[Any] = None  # -> CategoryNode
    metadata: dict = {"index_fields": ["description", "gst_category"]}


class PatternNode(DataPoint):
    """Recurring transaction pattern learned from data."""
    description_pattern: str     # Regex or fuzzy match string
    typical_amount_min: int      # Cents
    typical_amount_max: int      # Cents
    frequency: str               # "weekly", "fortnightly", "monthly", "quarterly", "annual"
    occurrence_count: int        # Times seen
    last_seen: str               # ISO date
    suggests_category: SkipValidation[Any] = None  # -> CategoryNode
    observed_in: SkipValidation[Any] = None         # -> AccountNode
    metadata: dict = {"index_fields": ["description_pattern", "frequency"]}


class TransactionNode(DataPoint):
    """Individual bank transaction."""
    date: str                    # ISO date
    description: str             # Raw transaction description
    amount_cents: int            # Positive = credit, negative = debit
    balance_cents: Optional[int] = None
    ai_reasoning: Optional[str] = None  # AI categorization notes
    confidence_score: float = 1.0       # 0.0 to 1.0
    belongs_to: SkipValidation[Any] = None       # -> AccountNode
    in_statement: SkipValidation[Any] = None     # -> StatementNode
    categorized_as: SkipValidation[Any] = None   # -> CategoryNode
    gst_treatment: SkipValidation[Any] = None    # -> GSTRuleNode
    matches_pattern: SkipValidation[Any] = None  # -> PatternNode
    transfer_pair: SkipValidation[Any] = None    # -> TransactionNode (matched transfer)
    metadata: dict = {"index_fields": ["description", "ai_reasoning"]}


class TransferNode(DataPoint):
    """Cross-account transfer relationship."""
    amount_cents: int
    date: str
    matched: bool                # Whether both sides are confirmed
    debit_from: SkipValidation[Any] = None  # -> AccountNode
    credit_to: SkipValidation[Any] = None   # -> AccountNode
    metadata: dict = {"index_fields": []}


class BASPeriodNode(DataPoint):
    """BAS reporting period with calculated label values."""
    financial_year: str          # "2024-25"
    quarter: int                 # 1-4
    period_start: str
    period_end: str
    lodgement_due: str
    # BAS label values (cents)
    g1_total_sales: int = 0
    g2_export_sales: int = 0
    g3_gst_free_sales: int = 0
    g10_capital_purchases: int = 0
    g11_non_capital_purchases: int = 0
    label_1a_gst_on_sales: int = 0
    label_1b_gst_on_purchases: int = 0
    net_gst: int = 0
    transactions_processed: int = 0
    metadata: dict = {"index_fields": ["financial_year"]}


class CorrectionNode(DataPoint):
    """User correction to AI categorization - used for learning."""
    transaction_description: str
    old_category: str
    new_category: str
    corrected_at: str            # ISO datetime
    reason: Optional[str] = None
    for_transaction: SkipValidation[Any] = None  # -> TransactionNode
    metadata: dict = {"index_fields": ["transaction_description", "old_category", "new_category"]}


class DeductionNode(DataPoint):
    """Tax deduction tracking."""
    deduction_type: str          # "wfh", "motor_vehicle", "depreciation", etc.
    method: str                  # "fixed_rate", "actual_cost", "cents_per_km", "logbook"
    amount_cents: int
    tax_year: str                # "2024-25"
    description: str
    applies_to: SkipValidation[Any] = None  # -> TransactionNode
    metadata: dict = {"index_fields": ["deduction_type", "description"]}
