"""Australian Depreciation Calculator — Convenience functions."""

from .types import INSTANT_WRITE_OFF_THRESHOLD
from .calculations import calculate_diminishing_value, calculate_prime_cost, compare_depreciation_methods


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
