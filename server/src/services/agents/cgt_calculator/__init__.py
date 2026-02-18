"""Australian CGT Calculator — public API."""

from .types import AssetType, DisposalMethod, CGTAsset, CGTDisposal, CGTResult
from .calculations import (
    parse_date,
    calculate_holding_period,
    is_discount_eligible,
    calculate_cost_base,
    calculate_reduced_cost_base,
    calculate_capital_gain,
    calculate_cgt_for_tax_year,
    calculate_average_cost,
    calculate_fifo_cost_base,
)
from .calculator import CGTCalculator
from .convenience import quick_cgt_calculation
