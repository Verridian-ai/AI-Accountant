"""Australian Depreciation Calculator — public API."""

from .types import (
    DepreciationMethod,
    AssetCategory,
    EFFECTIVE_LIFE_TABLE,
    INSTANT_WRITE_OFF_THRESHOLD,
    LOW_VALUE_POOL_THRESHOLD,
    DepreciableAsset,
    DepreciationResult,
)
from .calculations import (
    parse_date,
    get_tax_year_dates,
    get_tax_year_for_date,
    get_effective_life,
    calculate_diminishing_value,
    calculate_prime_cost,
    calculate_low_value_pool,
    calculate_days_held,
    calculate_depreciation,
    calculate_depreciation_schedule,
    compare_depreciation_methods,
)
from .calculator import DepreciationCalculator
from .convenience import quick_depreciation
