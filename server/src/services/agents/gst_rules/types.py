"""Australian GST Categorization Rules — Enums and data classes."""

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class GSTCategory(Enum):
    """GST categories as defined by the ATO."""
    TAXABLE_10 = "taxable_10"  # Standard 10% GST
    GST_FREE = "gst_free"  # No GST - medical, education, fresh food, exports
    INPUT_TAXED = "input_taxed"  # No GST claim - financial services, residential rent
    EXPORT = "export"  # Export sales - GST-free
    CAPITAL = "capital"  # Capital acquisition with GST
    PRIVATE = "private"  # Not for BAS - private/out of scope
    NO_ABN = "no_abn"  # No ABN quoted - withhold GST component


class BASLabel(Enum):
    """BAS reporting labels."""
    G1 = "G1"  # Total sales
    G2 = "G2"  # Export sales
    G3 = "G3"  # Other GST-free sales
    G10 = "G10"  # Capital purchases
    G11 = "G11"  # Non-capital purchases
    LABEL_1A = "1A"  # GST on sales
    LABEL_1B = "1B"  # GST on purchases
    W1 = "W1"  # Total salary/wages
    W2 = "W2"  # Amounts withheld
    LABEL_5A = "5A"  # PAYG instalment
    LABEL_7C = "7C"  # Fuel tax credits - business
    LABEL_7D = "7D"  # Fuel tax credits - other


@dataclass
class GSTCategorization:
    """Result of GST categorization."""
    category: GSTCategory
    gst_rate: float
    gst_amount_cents: int
    is_claimable: bool
    bas_label: Optional[str]
    confidence: float
    reasoning: str
