"""Australian Depreciation Calculator — Types and constants."""

from dataclasses import dataclass
from datetime import date
from typing import Optional
from enum import Enum


class DepreciationMethod(Enum):
    """Depreciation calculation methods."""
    DIMINISHING_VALUE = "diminishing"
    PRIME_COST = "prime_cost"
    LOW_VALUE_POOL = "low_value_pool"
    INSTANT_WRITE_OFF = "instant_write_off"


class AssetCategory(Enum):
    """Categories of depreciable assets."""
    COMPUTER = "computer"
    FURNITURE = "furniture"
    VEHICLE = "vehicle"
    BUILDING = "building"
    PLANT_EQUIPMENT = "plant_equipment"
    SOFTWARE = "software"
    OTHER = "other"


# ATO effective life for common assets (in years)
EFFECTIVE_LIFE_TABLE = {
    AssetCategory.COMPUTER: {
        "desktop": 4,
        "laptop": 4,
        "server": 5,
        "monitor": 5,
        "printer": 5,
        "default": 4,
    },
    AssetCategory.FURNITURE: {
        "desk": 10,
        "chair": 10,
        "filing_cabinet": 15,
        "default": 10,
    },
    AssetCategory.VEHICLE: {
        "car": 8,
        "motorcycle": 8,
        "truck": 10,
        "van": 8,
        "default": 8,
    },
    AssetCategory.BUILDING: {
        "commercial": 40,
        "industrial": 25,
        "residential": 40,
        "default": 40,
    },
    AssetCategory.PLANT_EQUIPMENT: {
        "general": 10,
        "heavy": 15,
        "default": 10,
    },
    AssetCategory.SOFTWARE: {
        "acquired": 5,
        "in_house": 5,
        "default": 5,
    },
    AssetCategory.OTHER: {
        "default": 5,
    },
}

# 2024-25 thresholds
INSTANT_WRITE_OFF_THRESHOLD = 2000000  # $20,000 in cents
LOW_VALUE_POOL_THRESHOLD = 100000  # $1,000 in cents


@dataclass
class DepreciableAsset:
    """Represents a depreciable asset."""
    asset_id: str
    asset_name: str
    category: AssetCategory
    purchase_date: date
    purchase_cost_cents: int
    effective_life_years: float
    method: DepreciationMethod
    business_use_percentage: float = 100.0
    opening_written_down_value_cents: Optional[int] = None


@dataclass
class DepreciationResult:
    """Result of depreciation calculation for a year."""
    tax_year: str
    opening_value_cents: int
    depreciation_amount_cents: int
    closing_value_cents: int
    days_held: int
    business_use_percentage: float
    deductible_amount_cents: int
    method_used: DepreciationMethod
    calculation_notes: str
