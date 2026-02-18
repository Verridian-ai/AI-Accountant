"""Australian CGT Calculator — Types and data classes."""

from dataclasses import dataclass
from datetime import date
from typing import Optional
from enum import Enum


class AssetType(Enum):
    """Types of CGT assets."""
    SHARES = "shares"
    PROPERTY = "property"
    CRYPTO = "crypto"
    COLLECTABLES = "collectables"
    PERSONAL_USE = "personal_use"
    OTHER = "other"


class DisposalMethod(Enum):
    """Methods for identifying which assets are sold."""
    FIFO = "fifo"  # First In First Out
    LIFO = "lifo"  # Last In First Out
    SPECIFIC = "specific"  # Specific identification
    AVERAGE = "average"  # Average cost (for crypto/fungible assets)


@dataclass
class CGTAsset:
    """Represents a CGT asset."""
    asset_id: str
    asset_name: str
    asset_type: AssetType
    acquisition_date: date
    acquisition_cost_cents: int  # Purchase price
    incidental_costs_cents: int  # Brokerage, legal, stamp duty
    improvements_cents: int  # Capital improvements
    quantity: float  # For shares/crypto
    unit_cost_cents: Optional[int] = None  # Cost per unit


@dataclass
class CGTDisposal:
    """Represents a CGT disposal event."""
    disposal_date: date
    disposal_proceeds_cents: int
    disposal_costs_cents: int  # Selling costs
    quantity_disposed: float


@dataclass
class CGTResult:
    """Result of a CGT calculation."""
    cost_base_cents: int
    reduced_cost_base_cents: int
    capital_proceeds_cents: int
    capital_gain_gross_cents: int
    discount_eligible: bool
    discount_amount_cents: int
    capital_gain_net_cents: int
    capital_loss_cents: int
    holding_period_days: int
    calculation_details: dict
