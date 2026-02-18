"""Australian GST Categorization Rules — Calculation and categorization functions."""

from typing import Optional
import re

from .types import GSTCategory, BASLabel, GSTCategorization
from .categories import (
    GST_FREE_PATTERNS,
    INPUT_TAXED_PATTERNS,
    CAPITAL_PATTERNS,
    PRIVATE_PATTERNS,
    FUEL_PATTERNS,
)


def calculate_gst_from_inclusive(amount_cents: int, gst_rate: float = 0.10) -> int:
    """Calculate GST component from a GST-inclusive amount."""
    if gst_rate == 0:
        return 0
    return round(abs(amount_cents) * gst_rate / (1 + gst_rate))


def calculate_gst_exclusive(amount_cents: int, gst_rate: float = 0.10) -> int:
    """Calculate GST-exclusive amount from GST-inclusive amount."""
    return abs(amount_cents) - calculate_gst_from_inclusive(amount_cents, gst_rate)


def matches_any_pattern(description: str, patterns: list[str]) -> bool:
    """Check if description matches any of the given regex patterns."""
    for pattern in patterns:
        if re.search(pattern, description):
            return True
    return False


def categorize_transaction(
    description: str,
    amount_cents: int,
    category: Optional[str] = None,
    is_income: bool = False,
) -> GSTCategorization:
    """Categorize a transaction for GST purposes."""
    is_expense = amount_cents < 0

    if matches_any_pattern(description, PRIVATE_PATTERNS):
        return GSTCategorization(
            category=GSTCategory.PRIVATE,
            gst_rate=0,
            gst_amount_cents=0,
            is_claimable=False,
            bas_label=None,
            confidence=0.8,
            reasoning="Appears to be a private/personal transaction, not for BAS reporting",
        )

    for category_name, patterns in INPUT_TAXED_PATTERNS.items():
        if matches_any_pattern(description, patterns):
            return GSTCategorization(
                category=GSTCategory.INPUT_TAXED,
                gst_rate=0,
                gst_amount_cents=0,
                is_claimable=False,
                bas_label=None,
                confidence=0.85,
                reasoning=f"Input-taxed supply ({category_name}) - no GST charged, no input credit claimable",
            )

    for category_name, patterns in GST_FREE_PATTERNS.items():
        if matches_any_pattern(description, patterns):
            bas_label = BASLabel.G3.value if is_income else None
            if category_name == "export":
                bas_label = BASLabel.G2.value if is_income else None
            return GSTCategorization(
                category=GSTCategory.GST_FREE,
                gst_rate=0,
                gst_amount_cents=0,
                is_claimable=True,
                bas_label=bas_label,
                confidence=0.75,
                reasoning=f"GST-free supply ({category_name}) - no GST charged",
            )

    if is_expense and matches_any_pattern(description, CAPITAL_PATTERNS):
        gst_amount = calculate_gst_from_inclusive(amount_cents)
        return GSTCategorization(
            category=GSTCategory.CAPITAL,
            gst_rate=0.10,
            gst_amount_cents=gst_amount,
            is_claimable=True,
            bas_label=BASLabel.G10.value,
            confidence=0.7,
            reasoning="Capital acquisition - GST claimable, reported at G10",
        )

    # Default: Standard taxable supply at 10% GST
    gst_amount = calculate_gst_from_inclusive(amount_cents)

    if is_income or amount_cents > 0:
        return GSTCategorization(
            category=GSTCategory.TAXABLE_10,
            gst_rate=0.10,
            gst_amount_cents=gst_amount,
            is_claimable=False,
            bas_label=BASLabel.G1.value,
            confidence=0.6,
            reasoning="Standard taxable sale at 10% GST - reported at G1, GST at 1A",
        )
    else:
        return GSTCategorization(
            category=GSTCategory.TAXABLE_10,
            gst_rate=0.10,
            gst_amount_cents=gst_amount,
            is_claimable=True,
            bas_label=BASLabel.G11.value,
            confidence=0.6,
            reasoning="Standard taxable purchase at 10% GST - reported at G11, GST claimable at 1B",
        )


def is_likely_fuel_purchase(description: str) -> bool:
    """Check if a transaction is likely a fuel purchase for fuel tax credits."""
    return matches_any_pattern(description, FUEL_PATTERNS)


def get_quarter_dates(financial_year: str, quarter: int) -> tuple[str, str, str]:
    """Get start date, end date, and lodgement due date for an Australian BAS quarter."""
    start_year = int(financial_year.split("-")[0])
    quarter_dates = {
        1: (f"{start_year}-07-01", f"{start_year}-09-30", f"{start_year}-10-28"),
        2: (f"{start_year}-10-01", f"{start_year}-12-31", f"{start_year + 1}-02-28"),
        3: (f"{start_year + 1}-01-01", f"{start_year + 1}-03-31", f"{start_year + 1}-04-28"),
        4: (f"{start_year + 1}-04-01", f"{start_year + 1}-06-30", f"{start_year + 1}-07-28"),
    }
    return quarter_dates.get(quarter, ("", "", ""))


def get_current_financial_year() -> str:
    """Get the current Australian financial year."""
    from datetime import date
    today = date.today()
    if today.month >= 7:
        return f"{today.year}-{str(today.year + 1)[2:]}"
    else:
        return f"{today.year - 1}-{str(today.year)[2:]}"


def get_current_quarter() -> tuple[str, int]:
    """Get the current Australian BAS quarter."""
    from datetime import date
    today = date.today()
    fy = get_current_financial_year()
    if today.month in [7, 8, 9]:
        return (fy, 1)
    elif today.month in [10, 11, 12]:
        return (fy, 2)
    elif today.month in [1, 2, 3]:
        return (fy, 3)
    else:
        return (fy, 4)
