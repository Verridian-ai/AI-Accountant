"""Australian Tax Configuration — Data classes and enums."""

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
