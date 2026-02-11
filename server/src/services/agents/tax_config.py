"""
Australian Tax Configuration

Configurable tax rules for Australian income tax calculations.
Supports multiple financial years and entity types.
"""

from dataclasses import dataclass
from typing import Optional
from enum import Enum


class EntityType(Enum):
    """Tax entity types."""
    INDIVIDUAL = "individual"
    COMPANY = "company"
    TRUST = "trust"
    PARTNERSHIP = "partnership"
    SMSF = "smsf"


class DeductionMethod(Enum):
    """Deduction calculation methods."""
    FIXED_RATE = "fixed_rate"
    ACTUAL_COST = "actual_cost"
    CENTS_PER_KM = "cents_per_km"
    LOGBOOK = "logbook"


@dataclass
class TaxBracket:
    """Income tax bracket configuration."""
    threshold_min: int  # In cents
    threshold_max: Optional[int]  # None for top bracket
    rate: float  # e.g., 0.19 for 19%
    base_tax: int  # Cumulative tax at bracket start (cents)


@dataclass
class TaxOffset:
    """Tax offset configuration (LITO, LMITO, SAPTO, etc.)."""
    name: str
    max_amount: int  # In cents
    phase_out_start: int  # Income where phase-out begins (cents)
    phase_out_rate: float  # Reduction per dollar over threshold
    phase_out_end: Optional[int]  # Income where offset becomes zero


@dataclass
class MedicareLevyConfig:
    """Medicare levy configuration."""
    base_rate: float  # Usually 0.02 (2%)
    low_income_threshold: int  # No levy below this (cents)
    shade_in_threshold: int  # Full levy above this (cents)
    surcharge_tier_1: tuple[int, float]  # (threshold, rate)
    surcharge_tier_2: tuple[int, float]
    surcharge_tier_3: tuple[int, float]
    family_threshold_increase: int  # Per dependent child


@dataclass
class DeductionRates:
    """Standard deduction rates."""
    wfh_hourly_rate: int  # Cents per hour
    motor_vehicle_cents_per_km: int  # Cents per km
    motor_vehicle_max_km: int  # Maximum claimable km
    laundry_no_records_max: int  # Maximum without records (cents)
    gifts_no_records_max: int  # Maximum without records (cents)
    instant_asset_writeoff_threshold: int  # In cents


@dataclass
class CGTConfig:
    """Capital gains tax configuration."""
    discount_rate: float  # Usually 0.50 (50% discount)
    discount_holding_period_days: int  # Usually 365 days
    main_residence_exemption: bool
    small_business_concessions: bool


@dataclass
class DepreciationConfig:
    """Depreciation configuration."""
    diminishing_value_factor: float  # Usually 2.0 (200%)
    prime_cost_factor: float  # Usually 1.0 (100%)
    low_value_pool_existing_rate: float  # 37.5%
    low_value_pool_new_rate: float  # 18.75%
    low_value_pool_threshold: int  # Items under this go to pool (cents)


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


def get_tax_brackets(tax_year: str, entity_type: EntityType = EntityType.INDIVIDUAL) -> list[TaxBracket]:
    """Get tax brackets for a specific year and entity type."""
    if entity_type == EntityType.COMPANY:
        # Company tax rate is flat
        base_rate = 0.25 if tax_year >= "2021-22" else 0.275
        return [TaxBracket(0, None, base_rate, 0)]

    brackets = {
        "2024-25": TAX_BRACKETS_2024_25,
        "2023-24": TAX_BRACKETS_2023_24,
    }
    return brackets.get(tax_year, TAX_BRACKETS_2024_25)


def get_tax_offset(offset_type: str, tax_year: str) -> Optional[TaxOffset]:
    """Get tax offset configuration."""
    offsets = {
        "LITO": {"2024-25": LITO_2024_25, "2023-24": LITO_2024_25},
        "SAPTO": {"2024-25": SAPTO_2024_25, "2023-24": SAPTO_2024_25},
    }
    return offsets.get(offset_type, {}).get(tax_year)


def get_deduction_rates(tax_year: str) -> DeductionRates:
    """Get deduction rates for a specific year."""
    rates = {
        "2024-25": DEDUCTION_RATES_2024_25,
        "2023-24": DEDUCTION_RATES_2024_25,  # Same rates
    }
    return rates.get(tax_year, DEDUCTION_RATES_2024_25)


def calculate_income_tax(
    taxable_income_cents: int,
    tax_year: str = "2024-25",
    entity_type: EntityType = EntityType.INDIVIDUAL
) -> dict:
    """
    Calculate Australian income tax.

    Args:
        taxable_income_cents: Taxable income in cents
        tax_year: Financial year (e.g., '2024-25')
        entity_type: Type of taxpayer

    Returns:
        Dictionary with tax calculation breakdown
    """
    brackets = get_tax_brackets(tax_year, entity_type)
    tax = 0
    bracket_used = ""

    for i, bracket in enumerate(brackets):
        if taxable_income_cents <= bracket.threshold_min:
            break

        if bracket.threshold_max is None or taxable_income_cents <= bracket.threshold_max:
            excess = taxable_income_cents - bracket.threshold_min
            tax = bracket.base_tax + round(excess * bracket.rate)
            bracket_used = f"{bracket.rate * 100:.0f}% marginal rate"
            break

    return {
        "taxable_income_cents": taxable_income_cents,
        "income_tax_cents": tax,
        "marginal_bracket": bracket_used,
        "tax_year": tax_year,
        "entity_type": entity_type.value,
    }


def calculate_medicare_levy(
    taxable_income_cents: int,
    has_private_health: bool = False,
    family_size: int = 1,
    tax_year: str = "2024-25"
) -> dict:
    """
    Calculate Medicare levy and surcharge.

    Args:
        taxable_income_cents: Taxable income in cents
        has_private_health: Whether taxpayer has appropriate private health cover
        family_size: Number of people in family (for threshold adjustments)
        tax_year: Financial year

    Returns:
        Dictionary with Medicare levy breakdown
    """
    config = MEDICARE_LEVY_2024_25  # Use current config

    # Base Medicare levy
    levy = 0
    if taxable_income_cents > config.shade_in_threshold:
        levy = round(taxable_income_cents * config.base_rate)
    elif taxable_income_cents > config.low_income_threshold:
        # Shade-in range: 10% of excess over low threshold
        excess = taxable_income_cents - config.low_income_threshold
        levy = round(excess * 0.10)

    # Medicare levy surcharge (if no private health cover)
    surcharge = 0
    surcharge_rate = 0.0
    if not has_private_health:
        if taxable_income_cents > config.surcharge_tier_3[0]:
            surcharge_rate = config.surcharge_tier_3[1]
        elif taxable_income_cents > config.surcharge_tier_2[0]:
            surcharge_rate = config.surcharge_tier_2[1]
        elif taxable_income_cents > config.surcharge_tier_1[0]:
            surcharge_rate = config.surcharge_tier_1[1]

        surcharge = round(taxable_income_cents * surcharge_rate)

    return {
        "medicare_levy_cents": levy,
        "medicare_levy_surcharge_cents": surcharge,
        "surcharge_rate": surcharge_rate,
        "total_medicare_cents": levy + surcharge,
        "has_private_health": has_private_health,
    }


def calculate_tax_offset(
    taxable_income_cents: int,
    offset_type: str,
    tax_year: str = "2024-25"
) -> dict:
    """
    Calculate a tax offset amount.

    Args:
        taxable_income_cents: Taxable income in cents
        offset_type: Type of offset ('LITO', 'SAPTO', etc.)
        tax_year: Financial year

    Returns:
        Dictionary with offset calculation
    """
    offset_config = get_tax_offset(offset_type, tax_year)
    if not offset_config:
        return {"offset_amount_cents": 0, "error": f"Unknown offset type: {offset_type}"}

    if taxable_income_cents <= offset_config.phase_out_start:
        amount = offset_config.max_amount
    elif offset_config.phase_out_end and taxable_income_cents >= offset_config.phase_out_end:
        amount = 0
    else:
        excess = taxable_income_cents - offset_config.phase_out_start
        reduction = round(excess * offset_config.phase_out_rate)
        amount = max(0, offset_config.max_amount - reduction)

    return {
        "offset_type": offset_type,
        "offset_name": offset_config.name,
        "max_amount_cents": offset_config.max_amount,
        "offset_amount_cents": amount,
        "phase_out_applied": amount < offset_config.max_amount,
    }


def calculate_full_tax(
    gross_income_cents: int,
    deductions_cents: int = 0,
    tax_year: str = "2024-25",
    entity_type: EntityType = EntityType.INDIVIDUAL,
    has_private_health: bool = False,
    apply_lito: bool = True,
    apply_sapto: bool = False,
) -> dict:
    """
    Calculate complete Australian tax liability.

    Args:
        gross_income_cents: Total gross income in cents
        deductions_cents: Total deductions in cents
        tax_year: Financial year
        entity_type: Type of taxpayer
        has_private_health: Whether taxpayer has private health insurance
        apply_lito: Whether to apply Low Income Tax Offset
        apply_sapto: Whether to apply Seniors and Pensioners Tax Offset

    Returns:
        Complete tax calculation breakdown
    """
    taxable_income = max(0, gross_income_cents - deductions_cents)

    # Income tax
    tax_result = calculate_income_tax(taxable_income, tax_year, entity_type)
    income_tax = tax_result["income_tax_cents"]

    # Medicare levy
    medicare = calculate_medicare_levy(taxable_income, has_private_health, 1, tax_year)

    # Tax offsets
    total_offsets = 0
    offsets_detail = []

    if apply_lito and entity_type == EntityType.INDIVIDUAL:
        lito = calculate_tax_offset(taxable_income, "LITO", tax_year)
        total_offsets += lito["offset_amount_cents"]
        offsets_detail.append(lito)

    if apply_sapto and entity_type == EntityType.INDIVIDUAL:
        sapto = calculate_tax_offset(taxable_income, "SAPTO", tax_year)
        total_offsets += sapto["offset_amount_cents"]
        offsets_detail.append(sapto)

    # Calculate final tax
    tax_before_offsets = income_tax + medicare["total_medicare_cents"]
    total_tax = max(0, tax_before_offsets - total_offsets)

    # Effective rate
    effective_rate = (total_tax / gross_income_cents * 100) if gross_income_cents > 0 else 0

    return {
        "gross_income_cents": gross_income_cents,
        "deductions_cents": deductions_cents,
        "taxable_income_cents": taxable_income,
        "income_tax_cents": income_tax,
        "medicare_levy_cents": medicare["medicare_levy_cents"],
        "medicare_surcharge_cents": medicare["medicare_levy_surcharge_cents"],
        "tax_offsets_cents": total_offsets,
        "offsets_detail": offsets_detail,
        "total_tax_cents": total_tax,
        "effective_tax_rate_percent": round(effective_rate, 2),
        "take_home_annual_cents": gross_income_cents - total_tax,
        "take_home_monthly_cents": round((gross_income_cents - total_tax) / 12),
        "tax_year": tax_year,
        "entity_type": entity_type.value,
    }


def calculate_wfh_deduction(
    hours_per_week: float,
    weeks_worked: int,
    actual_expenses_cents: Optional[int] = None,
    tax_year: str = "2024-25"
) -> dict:
    """
    Calculate work from home deduction - compare fixed rate vs actual cost.

    Args:
        hours_per_week: Average hours worked from home per week
        weeks_worked: Number of weeks worked from home
        actual_expenses_cents: Actual expenses if using actual cost method
        tax_year: Financial year

    Returns:
        Comparison of both methods with recommendation
    """
    rates = get_deduction_rates(tax_year)

    # Fixed rate method
    total_hours = hours_per_week * weeks_worked
    fixed_rate_deduction = round(total_hours * rates.wfh_hourly_rate)

    result = {
        "fixed_rate_method": {
            "rate_per_hour_cents": rates.wfh_hourly_rate,
            "total_hours": total_hours,
            "deduction_cents": fixed_rate_deduction,
            "note": "Covers electricity, phone, internet, stationery. Must keep timesheet records.",
        },
        "hours_per_week": hours_per_week,
        "weeks_worked": weeks_worked,
    }

    if actual_expenses_cents is not None:
        # Actual cost method (requires detailed records)
        result["actual_cost_method"] = {
            "deduction_cents": actual_expenses_cents,
            "note": "Requires diary of usage + receipts for all expenses",
        }
        result["recommended_method"] = (
            "fixed_rate" if fixed_rate_deduction >= actual_expenses_cents else "actual_cost"
        )
        result["difference_cents"] = fixed_rate_deduction - actual_expenses_cents
    else:
        result["recommended_method"] = "fixed_rate"

    return result


def calculate_motor_vehicle_deduction(
    km_travelled: int,
    logbook_percentage: Optional[float] = None,
    total_car_expenses_cents: Optional[int] = None,
    tax_year: str = "2024-25"
) -> dict:
    """
    Calculate motor vehicle deduction - cents per km or logbook method.

    Args:
        km_travelled: Business kilometres travelled
        logbook_percentage: Business use percentage from logbook (0-100)
        total_car_expenses_cents: Total car expenses for logbook method
        tax_year: Financial year

    Returns:
        Comparison of both methods with recommendation
    """
    rates = get_deduction_rates(tax_year)

    # Cents per km method (max 5,000 km)
    claimable_km = min(km_travelled, rates.motor_vehicle_max_km)
    cents_per_km_deduction = claimable_km * rates.motor_vehicle_cents_per_km

    result = {
        "cents_per_km_method": {
            "rate_cents": rates.motor_vehicle_cents_per_km,
            "km_claimed": claimable_km,
            "km_limit": rates.motor_vehicle_max_km,
            "deduction_cents": cents_per_km_deduction,
            "note": f"Maximum {rates.motor_vehicle_max_km:,} km claimable. No receipts needed, but must have records.",
        },
        "km_travelled": km_travelled,
    }

    if logbook_percentage is not None and total_car_expenses_cents is not None:
        # Logbook method
        logbook_deduction = round(total_car_expenses_cents * logbook_percentage / 100)
        result["logbook_method"] = {
            "business_use_percentage": logbook_percentage,
            "total_expenses_cents": total_car_expenses_cents,
            "deduction_cents": logbook_deduction,
            "note": "Requires 12-week logbook (valid 5 years) + all receipts",
        }
        result["recommended_method"] = (
            "cents_per_km" if cents_per_km_deduction >= logbook_deduction else "logbook"
        )
        result["difference_cents"] = cents_per_km_deduction - logbook_deduction
    else:
        result["recommended_method"] = "cents_per_km"

    return result
