"""Australian Tax Configuration — package re-exports."""
from .types import (
    EntityType,
    DeductionMethod,
    TaxBracket,
    TaxOffset,
    MedicareLevyConfig,
    DeductionRates,
    CGTConfig,
    DepreciationConfig,
)
from .brackets import (
    TAX_BRACKETS_2024_25,
    TAX_BRACKETS_2023_24,
    LITO_2024_25,
    SAPTO_2024_25,
    MEDICARE_LEVY_2024_25,
    DEDUCTION_RATES_2024_25,
    CGT_CONFIG_2024_25,
    DEPRECIATION_CONFIG_2024_25,
)
from .calculations import (
    get_tax_brackets,
    get_tax_offset,
    get_deduction_rates,
    calculate_income_tax,
    calculate_medicare_levy,
    calculate_tax_offset,
    calculate_full_tax,
    calculate_wfh_deduction,
    calculate_motor_vehicle_deduction,
)
