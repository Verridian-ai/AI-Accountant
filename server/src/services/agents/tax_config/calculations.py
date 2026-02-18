"""Australian Tax Configuration — Calculation functions."""

from typing import Optional

from .types import EntityType, TaxBracket, TaxOffset, DeductionRates
from .brackets import (
    TAX_BRACKETS_2024_25,
    TAX_BRACKETS_2023_24,
    LITO_2024_25,
    SAPTO_2024_25,
    MEDICARE_LEVY_2024_25,
    DEDUCTION_RATES_2024_25,
)


def get_tax_brackets(tax_year: str, entity_type: EntityType = EntityType.INDIVIDUAL) -> list[TaxBracket]:
    """Get tax brackets for a specific year and entity type."""
    if entity_type == EntityType.COMPANY:
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
    """Calculate Australian income tax."""
    brackets = get_tax_brackets(tax_year, entity_type)
    tax = 0
    bracket_used = ""

    for bracket in brackets:
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
    """Calculate Medicare levy and surcharge."""
    config = MEDICARE_LEVY_2024_25

    levy = 0
    if taxable_income_cents > config.shade_in_threshold:
        levy = round(taxable_income_cents * config.base_rate)
    elif taxable_income_cents > config.low_income_threshold:
        excess = taxable_income_cents - config.low_income_threshold
        levy = round(excess * 0.10)

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
    """Calculate a tax offset amount."""
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
    """Calculate complete Australian tax liability."""
    taxable_income = max(0, gross_income_cents - deductions_cents)

    tax_result = calculate_income_tax(taxable_income, tax_year, entity_type)
    income_tax = tax_result["income_tax_cents"]

    medicare = calculate_medicare_levy(taxable_income, has_private_health, 1, tax_year)

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

    tax_before_offsets = income_tax + medicare["total_medicare_cents"]
    total_tax = max(0, tax_before_offsets - total_offsets)
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
    """Calculate work from home deduction — compare fixed rate vs actual cost."""
    rates = get_deduction_rates(tax_year)

    total_hours = hours_per_week * weeks_worked
    fixed_rate_deduction = round(total_hours * rates.wfh_hourly_rate)

    result: dict = {
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
    """Calculate motor vehicle deduction — cents per km or logbook method."""
    rates = get_deduction_rates(tax_year)

    claimable_km = min(km_travelled, rates.motor_vehicle_max_km)
    cents_per_km_deduction = claimable_km * rates.motor_vehicle_cents_per_km

    result: dict = {
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
