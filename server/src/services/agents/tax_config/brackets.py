"""Australian Tax Configuration — Year-specific constants and rate tables."""

from .types import (
    TaxBracket,
    TaxOffset,
    MedicareLevyConfig,
    DeductionRates,
    CGTConfig,
    DepreciationConfig,
)

# ============================================================================
# 2024-25 FINANCIAL YEAR CONFIGURATION (Stage 3 Tax Cuts)
# ============================================================================

TAX_BRACKETS_2024_25: list[TaxBracket] = [
    TaxBracket(0, 1820000, 0.00, 0),
    TaxBracket(1820001, 4500000, 0.16, 0),  # 16% from $18,201 to $45,000
    TaxBracket(4500001, 13500000, 0.30, 428800),  # 30% from $45,001 to $135,000
    TaxBracket(13500001, 19000000, 0.37, 3128800),  # 37% from $135,001 to $190,000
    TaxBracket(19000001, None, 0.45, 5163800),  # 45% above $190,000
]

TAX_BRACKETS_2023_24: list[TaxBracket] = [
    TaxBracket(0, 1820000, 0.00, 0),
    TaxBracket(1820001, 4500000, 0.19, 0),
    TaxBracket(4500001, 12000000, 0.325, 509200),
    TaxBracket(12000001, 18000000, 0.37, 2959700),
    TaxBracket(18000001, None, 0.45, 5179700),
]

# Tax offsets
LITO_2024_25 = TaxOffset(
    name="Low Income Tax Offset",
    max_amount=70000,  # $700
    phase_out_start=3750000,  # $37,500
    phase_out_rate=0.05,  # $0.05 per $1
    phase_out_end=6683300,  # $66,833 (approx)
)

SAPTO_2024_25 = TaxOffset(
    name="Seniors and Pensioners Tax Offset",
    max_amount=239800,  # $2,398 (single)
    phase_out_start=3275200,  # $32,752
    phase_out_rate=0.125,  # 12.5 cents per dollar
    phase_out_end=5094000,  # Income where fully phased out
)

# Medicare levy configuration
MEDICARE_LEVY_2024_25 = MedicareLevyConfig(
    base_rate=0.02,  # 2%
    low_income_threshold=2427600,  # $24,276
    shade_in_threshold=3034500,  # $30,345
    surcharge_tier_1=(9300000, 0.01),  # 1% over $93,000
    surcharge_tier_2=(10800000, 0.0125),  # 1.25% over $108,000
    surcharge_tier_3=(14400000, 0.015),  # 1.5% over $144,000
    family_threshold_increase=423200,  # $4,232 per child
)

# Deduction rates
DEDUCTION_RATES_2024_25 = DeductionRates(
    wfh_hourly_rate=67,  # $0.67 per hour
    motor_vehicle_cents_per_km=85,  # 85 cents per km
    motor_vehicle_max_km=5000,
    laundry_no_records_max=15000,  # $150
    gifts_no_records_max=1000,  # $10
    instant_asset_writeoff_threshold=2000000,  # $20,000
)

# CGT configuration
CGT_CONFIG_2024_25 = CGTConfig(
    discount_rate=0.50,  # 50%
    discount_holding_period_days=365,
    main_residence_exemption=True,
    small_business_concessions=True,
)

# Depreciation configuration
DEPRECIATION_CONFIG_2024_25 = DepreciationConfig(
    diminishing_value_factor=2.0,
    prime_cost_factor=1.0,
    low_value_pool_existing_rate=0.375,
    low_value_pool_new_rate=0.1875,
    low_value_pool_threshold=100000,  # $1,000
)
