"""Australian Depreciation Calculator — DepreciationCalculator class."""

from typing import Optional

from .types import AssetCategory, AssetCategory, DepreciationMethod, DepreciableAsset, INSTANT_WRITE_OFF_THRESHOLD, LOW_VALUE_POOL_THRESHOLD
from .calculations import parse_date, get_effective_life, calculate_depreciation


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
