"""
Australian Depreciation Calculator

Handles depreciation calculations for business assets including:
- Diminishing value method
- Prime cost method
- Low value pool
- Instant asset write-off
"""

from dataclasses import dataclass
from datetime import date, datetime
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


def parse_date(date_str: str) -> date:
    """Parse a date string in YYYY-MM-DD format."""
    if isinstance(date_str, date):
        return date_str
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def get_tax_year_dates(tax_year: str) -> tuple[date, date]:
    """Get start and end dates for an Australian tax year."""
    start_year = int(tax_year.split("-")[0])
    return (
        date(start_year, 7, 1),
        date(start_year + 1, 6, 30)
    )


def get_tax_year_for_date(d: date) -> str:
    """Get the Australian tax year for a date."""
    year = d.year
    month = d.month
    if month >= 7:
        return f"{year}-{str(year + 1)[2:]}"
    else:
        return f"{year - 1}-{str(year)[2:]}"


def get_effective_life(category: AssetCategory, subcategory: str = "default") -> float:
    """Get the ATO effective life for an asset type."""
    category_life = EFFECTIVE_LIFE_TABLE.get(category, {"default": 5})
    return category_life.get(subcategory, category_life.get("default", 5))


def calculate_diminishing_value(
    cost_cents: int,
    written_down_value_cents: int,
    effective_life_years: float,
    days_held: int = 365,
    full_year_days: int = 365
) -> int:
    """
    Calculate depreciation using the diminishing value method.

    Formula: Base value × (Days held ÷ 365) × (200% ÷ Asset's effective life)
    """
    if effective_life_years <= 0:
        return 0

    # Diminishing value rate = 200% / effective life
    rate = 2.0 / effective_life_years

    # Pro-rata for days held
    days_factor = days_held / full_year_days

    depreciation = round(written_down_value_cents * rate * days_factor)

    # Cannot depreciate below zero
    return min(depreciation, written_down_value_cents)


def calculate_prime_cost(
    cost_cents: int,
    effective_life_years: float,
    days_held: int = 365,
    full_year_days: int = 365
) -> int:
    """
    Calculate depreciation using the prime cost (straight line) method.

    Formula: Asset's cost × (Days held ÷ 365) × (100% ÷ Asset's effective life)
    """
    if effective_life_years <= 0:
        return 0

    # Prime cost rate = 100% / effective life
    rate = 1.0 / effective_life_years

    # Pro-rata for days held
    days_factor = days_held / full_year_days

    return round(cost_cents * rate * days_factor)


def calculate_low_value_pool(
    opening_pool_cents: int,
    additions_cents: int,
    existing_assets_added_cents: int,
) -> tuple[int, int]:
    """
    Calculate depreciation for the low value pool.

    Rules:
    - Opening balance: 37.5%
    - New additions: 18.75% (half year rule)
    - Existing assets added: 37.5%

    Returns:
        Tuple of (depreciation_amount, closing_balance)
    """
    # Depreciation on opening balance at 37.5%
    opening_depreciation = round(opening_pool_cents * 0.375)

    # Depreciation on new additions at 18.75% (half year)
    additions_depreciation = round(additions_cents * 0.1875)

    # Depreciation on existing assets added at 37.5%
    existing_depreciation = round(existing_assets_added_cents * 0.375)

    total_depreciation = opening_depreciation + additions_depreciation + existing_depreciation

    # Closing balance
    closing_balance = (
        opening_pool_cents +
        additions_cents +
        existing_assets_added_cents -
        total_depreciation
    )

    # Pool is written off when balance < $1,000 at end of year
    if closing_balance < 100000:  # $1,000
        total_depreciation += closing_balance
        closing_balance = 0

    return total_depreciation, max(0, closing_balance)


def calculate_days_held(
    purchase_date: date,
    tax_year: str
) -> int:
    """Calculate days held in a tax year."""
    year_start, year_end = get_tax_year_dates(tax_year)

    # If purchased before tax year, use full year
    if purchase_date <= year_start:
        return 365

    # If purchased during tax year, pro-rata from purchase date
    if purchase_date <= year_end:
        return (year_end - purchase_date).days + 1

    # If purchased after tax year, no depreciation
    return 0


def calculate_depreciation(
    asset: DepreciableAsset,
    tax_year: str,
    opening_value_cents: Optional[int] = None
) -> DepreciationResult:
    """
    Calculate depreciation for an asset for a specific tax year.

    Args:
        asset: The depreciable asset
        tax_year: Australian tax year (e.g., '2024-25')
        opening_value_cents: Opening written down value (uses purchase cost if None)

    Returns:
        DepreciationResult with full calculation
    """
    # Determine opening value
    if opening_value_cents is not None:
        opening = opening_value_cents
    elif asset.opening_written_down_value_cents is not None:
        opening = asset.opening_written_down_value_cents
    else:
        opening = asset.purchase_cost_cents

    # If already fully depreciated
    if opening <= 0:
        return DepreciationResult(
            tax_year=tax_year,
            opening_value_cents=0,
            depreciation_amount_cents=0,
            closing_value_cents=0,
            days_held=0,
            business_use_percentage=asset.business_use_percentage,
            deductible_amount_cents=0,
            method_used=asset.method,
            calculation_notes="Asset fully depreciated",
        )

    # Calculate days held
    days_held = calculate_days_held(asset.purchase_date, tax_year)

    if days_held <= 0:
        return DepreciationResult(
            tax_year=tax_year,
            opening_value_cents=opening,
            depreciation_amount_cents=0,
            closing_value_cents=opening,
            days_held=0,
            business_use_percentage=asset.business_use_percentage,
            deductible_amount_cents=0,
            method_used=asset.method,
            calculation_notes="Asset not held during this tax year",
        )

    # Check for instant asset write-off
    purchase_year = get_tax_year_for_date(asset.purchase_date)
    if (
        asset.method == DepreciationMethod.INSTANT_WRITE_OFF or
        (purchase_year == tax_year and asset.purchase_cost_cents < INSTANT_WRITE_OFF_THRESHOLD)
    ):
        deductible = round(opening * asset.business_use_percentage / 100)
        return DepreciationResult(
            tax_year=tax_year,
            opening_value_cents=opening,
            depreciation_amount_cents=opening,
            closing_value_cents=0,
            days_held=days_held,
            business_use_percentage=asset.business_use_percentage,
            deductible_amount_cents=deductible,
            method_used=DepreciationMethod.INSTANT_WRITE_OFF,
            calculation_notes=f"Instant asset write-off - asset under ${INSTANT_WRITE_OFF_THRESHOLD / 100:,.0f}",
        )

    # Calculate depreciation based on method
    if asset.method == DepreciationMethod.DIMINISHING_VALUE:
        depreciation = calculate_diminishing_value(
            asset.purchase_cost_cents,
            opening,
            asset.effective_life_years,
            days_held
        )
        notes = f"Diminishing value: 200% ÷ {asset.effective_life_years} years = {200/asset.effective_life_years:.1f}%"

    elif asset.method == DepreciationMethod.PRIME_COST:
        depreciation = calculate_prime_cost(
            asset.purchase_cost_cents,
            asset.effective_life_years,
            days_held
        )
        notes = f"Prime cost: 100% ÷ {asset.effective_life_years} years = {100/asset.effective_life_years:.1f}%"

    else:
        # Default to diminishing value
        depreciation = calculate_diminishing_value(
            asset.purchase_cost_cents,
            opening,
            asset.effective_life_years,
            days_held
        )
        notes = f"Diminishing value (default): {200/asset.effective_life_years:.1f}%"

    # Pro-rata for days held
    if days_held < 365:
        notes += f" (pro-rata: {days_held} days)"

    # Calculate closing value and deductible amount
    closing = max(0, opening - depreciation)
    deductible = round(depreciation * asset.business_use_percentage / 100)

    if asset.business_use_percentage < 100:
        notes += f" × {asset.business_use_percentage}% business use"

    return DepreciationResult(
        tax_year=tax_year,
        opening_value_cents=opening,
        depreciation_amount_cents=depreciation,
        closing_value_cents=closing,
        days_held=days_held,
        business_use_percentage=asset.business_use_percentage,
        deductible_amount_cents=deductible,
        method_used=asset.method,
        calculation_notes=notes,
    )


def calculate_depreciation_schedule(
    asset: DepreciableAsset,
    start_year: str,
    years: int = 10
) -> list[DepreciationResult]:
    """
    Calculate a multi-year depreciation schedule.

    Args:
        asset: The depreciable asset
        start_year: First tax year (e.g., '2024-25')
        years: Number of years to project

    Returns:
        List of DepreciationResult for each year
    """
    schedule = []
    opening = asset.purchase_cost_cents

    start_year_int = int(start_year.split("-")[0])

    for i in range(years):
        year = f"{start_year_int + i}-{str(start_year_int + i + 1)[2:]}"

        result = calculate_depreciation(asset, year, opening)
        schedule.append(result)

        # Use closing value as next year's opening
        opening = result.closing_value_cents

        # Stop if fully depreciated
        if opening <= 0:
            break

    return schedule


def compare_depreciation_methods(
    purchase_cost_cents: int,
    effective_life_years: float,
    business_use_percentage: float = 100.0,
    years_to_compare: int = 5
) -> dict:
    """
    Compare different depreciation methods.

    Args:
        purchase_cost_cents: Asset cost in cents
        effective_life_years: ATO effective life
        business_use_percentage: Business use %
        years_to_compare: Years to project

    Returns:
        Comparison of methods
    """
    results = {
        "diminishing_value": [],
        "prime_cost": [],
        "purchase_cost": purchase_cost_cents / 100,
        "effective_life_years": effective_life_years,
        "business_use_percentage": business_use_percentage,
    }

    # Diminishing value
    opening_dv = purchase_cost_cents
    for year in range(years_to_compare):
        dep = calculate_diminishing_value(
            purchase_cost_cents, opening_dv, effective_life_years
        )
        deductible = round(dep * business_use_percentage / 100)
        results["diminishing_value"].append({
            "year": year + 1,
            "depreciation": dep / 100,
            "deductible": deductible / 100,
            "closing_value": (opening_dv - dep) / 100,
        })
        opening_dv = max(0, opening_dv - dep)

    # Prime cost
    opening_pc = purchase_cost_cents
    for year in range(years_to_compare):
        dep = calculate_prime_cost(purchase_cost_cents, effective_life_years)
        dep = min(dep, opening_pc)  # Can't depreciate more than remaining
        deductible = round(dep * business_use_percentage / 100)
        results["prime_cost"].append({
            "year": year + 1,
            "depreciation": dep / 100,
            "deductible": deductible / 100,
            "closing_value": (opening_pc - dep) / 100,
        })
        opening_pc = max(0, opening_pc - dep)

    # Summary
    dv_total = sum(y["deductible"] for y in results["diminishing_value"])
    pc_total = sum(y["deductible"] for y in results["prime_cost"])

    results["summary"] = {
        "total_diminishing_value": dv_total,
        "total_prime_cost": pc_total,
        "recommended_method": (
            "diminishing_value" if results["diminishing_value"][0]["deductible"] >
            results["prime_cost"][0]["deductible"] else "prime_cost"
        ),
        "note": "Diminishing value gives higher deductions in early years; Prime cost spreads evenly",
    }

    return results


class DepreciationCalculator:
    """Calculator for managing depreciation across multiple assets."""

    def __init__(self):
        self.assets: dict[str, DepreciableAsset] = {}
        self.low_value_pool_cents: int = 0

    def add_asset(
        self,
        asset_id: str,
        asset_name: str,
        category: str,
        purchase_date: str,
        purchase_cost_cents: int,
        effective_life_years: Optional[float] = None,
        method: str = "diminishing",
        business_use_percentage: float = 100.0,
    ) -> dict:
        """Add a depreciable asset."""
        cat = AssetCategory(category) if category in [e.value for e in AssetCategory] else AssetCategory.OTHER

        # Get effective life if not provided
        if effective_life_years is None:
            effective_life_years = get_effective_life(cat)

        # Determine best method
        if purchase_cost_cents < INSTANT_WRITE_OFF_THRESHOLD:
            dep_method = DepreciationMethod.INSTANT_WRITE_OFF
        elif purchase_cost_cents < LOW_VALUE_POOL_THRESHOLD:
            dep_method = DepreciationMethod.LOW_VALUE_POOL
        else:
            dep_method = DepreciationMethod(method) if method in ["diminishing", "prime_cost"] else DepreciationMethod.DIMINISHING_VALUE

        asset = DepreciableAsset(
            asset_id=asset_id,
            asset_name=asset_name,
            category=cat,
            purchase_date=parse_date(purchase_date),
            purchase_cost_cents=purchase_cost_cents,
            effective_life_years=effective_life_years,
            method=dep_method,
            business_use_percentage=business_use_percentage,
        )

        self.assets[asset_id] = asset

        return {
            "asset_id": asset_id,
            "asset_name": asset_name,
            "category": cat.value,
            "purchase_cost": purchase_cost_cents / 100,
            "effective_life_years": effective_life_years,
            "method": dep_method.value,
            "business_use_percentage": business_use_percentage,
            "can_instant_write_off": purchase_cost_cents < INSTANT_WRITE_OFF_THRESHOLD,
        }

    def calculate_year(self, tax_year: str) -> dict:
        """Calculate total depreciation for all assets for a tax year."""
        results = []
        total_depreciation = 0
        total_deductible = 0

        for asset_id, asset in self.assets.items():
            result = calculate_depreciation(asset, tax_year)
            results.append({
                "asset_id": asset_id,
                "asset_name": asset.asset_name,
                "opening_value": result.opening_value_cents / 100,
                "depreciation": result.depreciation_amount_cents / 100,
                "closing_value": result.closing_value_cents / 100,
                "deductible": result.deductible_amount_cents / 100,
                "method": result.method_used.value,
                "notes": result.calculation_notes,
            })

            total_depreciation += result.depreciation_amount_cents
            total_deductible += result.deductible_amount_cents

        return {
            "tax_year": tax_year,
            "assets": results,
            "total_depreciation": total_depreciation / 100,
            "total_deductible": total_deductible / 100,
            "asset_count": len(results),
        }


# Convenience functions
def quick_depreciation(
    purchase_cost: float,  # Dollars
    effective_life_years: float,
    method: str = "diminishing",
    business_use_percent: float = 100.0,
) -> dict:
    """
    Quick depreciation calculation for first year.

    Args:
        purchase_cost: Asset cost in dollars
        effective_life_years: ATO effective life
        method: 'diminishing' or 'prime_cost'
        business_use_percent: Business use percentage

    Returns:
        First year depreciation in dollars
    """
    cost_cents = round(purchase_cost * 100)

    # Check instant write-off
    if cost_cents < INSTANT_WRITE_OFF_THRESHOLD:
        deductible = round(cost_cents * business_use_percent / 100) / 100
        return {
            "method": "instant_write_off",
            "depreciation": purchase_cost,
            "deductible": deductible,
            "closing_value": 0,
            "note": f"Asset under ${INSTANT_WRITE_OFF_THRESHOLD/100:,.0f} - immediate write-off",
        }

    if method == "diminishing":
        dep_cents = calculate_diminishing_value(
            cost_cents, cost_cents, effective_life_years
        )
    else:
        dep_cents = calculate_prime_cost(cost_cents, effective_life_years)

    deductible_cents = round(dep_cents * business_use_percent / 100)

    return {
        "method": method,
        "depreciation": dep_cents / 100,
        "deductible": deductible_cents / 100,
        "closing_value": (cost_cents - dep_cents) / 100,
        "annual_rate": (200 if method == "diminishing" else 100) / effective_life_years,
        "note": f"Year 1 depreciation at {(200 if method == 'diminishing' else 100)/effective_life_years:.1f}% per year",
    }
