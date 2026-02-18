# Refactored: gst_rules/ package replaces this file.
# Python resolves 'from .gst_rules import X' via gst_rules/__init__.py.
# This file is unreachable — the package directory takes priority in Python's import resolution.
"""
Australian GST Categorization Rules

This module provides comprehensive rules for categorizing transactions
according to Australian GST requirements for BAS reporting.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional
import re


class GSTCategory(Enum):
    """GST categories as defined by the ATO."""
    TAXABLE_10 = "taxable_10"  # Standard 10% GST
    GST_FREE = "gst_free"  # No GST - medical, education, fresh food, exports
    INPUT_TAXED = "input_taxed"  # No GST claim - financial services, residential rent
    EXPORT = "export"  # Export sales - GST-free
    CAPITAL = "capital"  # Capital acquisition with GST
    PRIVATE = "private"  # Not for BAS - private/out of scope
    NO_ABN = "no_abn"  # No ABN quoted - withhold GST component


class BASLabel(Enum):
    """BAS reporting labels."""
    G1 = "G1"  # Total sales
    G2 = "G2"  # Export sales
    G3 = "G3"  # Other GST-free sales
    G10 = "G10"  # Capital purchases
    G11 = "G11"  # Non-capital purchases
    LABEL_1A = "1A"  # GST on sales
    LABEL_1B = "1B"  # GST on purchases
    W1 = "W1"  # Total salary/wages
    W2 = "W2"  # Amounts withheld
    LABEL_5A = "5A"  # PAYG instalment
    LABEL_7C = "7C"  # Fuel tax credits - business
    LABEL_7D = "7D"  # Fuel tax credits - other


@dataclass
class GSTCategorization:
    """Result of GST categorization."""
    category: GSTCategory
    gst_rate: float
    gst_amount_cents: int
    is_claimable: bool
    bas_label: Optional[str]
    confidence: float
    reasoning: str


# GST-FREE supply categories (no GST charged, but can claim inputs)
GST_FREE_PATTERNS = {
    # Medical and health
    "medical": [
        r"(?i)doctor", r"(?i)gp\s", r"(?i)medical\s+centre", r"(?i)hospital",
        r"(?i)pharmacy(?!\s+mart)", r"(?i)chemist(?!\s+warehouse)",  # Exclude retail
        r"(?i)pathology", r"(?i)radiology", r"(?i)x-?ray", r"(?i)ultrasound",
        r"(?i)physiotherapy", r"(?i)physio\s", r"(?i)dentist", r"(?i)dental",
        r"(?i)optometrist", r"(?i)psycholog", r"(?i)medicare",
        r"(?i)health\s+fund", r"(?i)private\s+health", r"(?i)medibank",
        r"(?i)bupa", r"(?i)hcf\s", r"(?i)nib\s",
    ],
    # Education
    "education": [
        r"(?i)university", r"(?i)tafe", r"(?i)college", r"(?i)school\s+fees",
        r"(?i)tuition", r"(?i)course\s+fees", r"(?i)education",
        r"(?i)childcare", r"(?i)child\s+care", r"(?i)kindy", r"(?i)kindergarten",
        r"(?i)preschool", r"(?i)pre-school",
    ],
    # Fresh food (basic food)
    "fresh_food": [
        r"(?i)woolworths(?!.*(?:liquor|dan\s*murphy))",  # Exclude liquor
        r"(?i)coles(?!.*(?:liquor|express))",  # Exclude liquor/convenience
        r"(?i)aldi\s", r"(?i)iga\s",
        r"(?i)fruit(?:\s+&|\s+and)?\s+veg", r"(?i)greengrocer",
        r"(?i)butcher(?!.*bar)", r"(?i)baker[y]?(?!.*cafe)",  # Exclude hospitality
        r"(?i)fish\s+market", r"(?i)seafood\s+market",
    ],
    # Exports
    "export": [
        r"(?i)export", r"(?i)overseas\s+sale", r"(?i)international\s+sale",
        r"(?i)foreign\s+sale",
    ],
    # Charitable donations
    "charity": [
        r"(?i)donation", r"(?i)charity", r"(?i)red\s+cross",
        r"(?i)salvation\s+army", r"(?i)lifeline", r"(?i)beyond\s+blue",
    ],
    # Water and sewerage (residential)
    "water": [
        r"(?i)water\s+corp", r"(?i)sydney\s+water", r"(?i)sa\s+water",
        r"(?i)urban\s+utilities", r"(?i)sewerage",
    ],
}

# INPUT-TAXED supplies (no GST, cannot claim inputs)
INPUT_TAXED_PATTERNS = {
    # Financial services
    "financial": [
        r"(?i)bank\s+fee", r"(?i)account\s+fee", r"(?i)monthly\s+fee",
        r"(?i)loan\s+interest", r"(?i)mortgage\s+interest",
        r"(?i)credit\s+card\s+interest", r"(?i)interest\s+charge",
        r"(?i)share\s+brokerage", r"(?i)broker\s+fee",
        r"(?i)investment\s+fee", r"(?i)management\s+fee",
        r"(?i)financial\s+advice", r"(?i)superannuation\s+fee",
    ],
    # Residential rent (as landlord)
    "residential_rent": [
        r"(?i)residential\s+rent", r"(?i)rent\s+received",
        r"(?i)rental\s+income",
    ],
}

# CAPITAL ACQUISITIONS (GST claimable, reported separately)
CAPITAL_PATTERNS = [
    r"(?i)computer", r"(?i)laptop", r"(?i)desktop", r"(?i)mac(?:book)?(?:\s|$)",
    r"(?i)ipad", r"(?i)tablet",
    r"(?i)furniture", r"(?i)desk", r"(?i)chair", r"(?i)office\s+fit",
    r"(?i)vehicle", r"(?i)car\s+purchase", r"(?i)motor\s+vehicle",
    r"(?i)equipment", r"(?i)machinery", r"(?i)plant\s+&",
    r"(?i)renovation", r"(?i)fit\s*out", r"(?i)construction",
    r"(?i)server", r"(?i)networking\s+equipment",
    r"(?i)printer(?:\s+|$)", r"(?i)photocopier",
    r"(?i)phone\s+system", r"(?i)security\s+system",
]

# PRIVATE/NON-BUSINESS patterns
PRIVATE_PATTERNS = [
    r"(?i)atm\s+withdrawal", r"(?i)cash\s+withdrawal",
    r"(?i)transfer\s+to\s+self", r"(?i)personal",
    r"(?i)grocery(?:\s|$)",  # Personal groceries vs business supplies
    r"(?i)netflix", r"(?i)spotify", r"(?i)disney\+",  # Personal entertainment
    r"(?i)gym\s+membership", r"(?i)fitness\s+first",
]

# FUEL (for fuel tax credits calculation)
FUEL_PATTERNS = [
    r"(?i)bp\s", r"(?i)shell\s", r"(?i)caltex", r"(?i)ampol",
    r"(?i)7-?eleven\s+fuel", r"(?i)united\s+petrol",
    r"(?i)petrol", r"(?i)diesel", r"(?i)fuel(?:\s|$)",
    r"(?i)service\s+station",
]


def calculate_gst_from_inclusive(amount_cents: int, gst_rate: float = 0.10) -> int:
    """
    Calculate GST component from a GST-inclusive amount.

    GST = Amount × (GST Rate / (1 + GST Rate))
    For 10% GST: GST = Amount / 11

    Args:
        amount_cents: GST-inclusive amount in cents
        gst_rate: GST rate (default 0.10 for 10%)

    Returns:
        GST amount in cents
    """
    if gst_rate == 0:
        return 0
    return round(abs(amount_cents) * gst_rate / (1 + gst_rate))


def calculate_gst_exclusive(amount_cents: int, gst_rate: float = 0.10) -> int:
    """
    Calculate GST-exclusive amount from GST-inclusive amount.

    Args:
        amount_cents: GST-inclusive amount in cents
        gst_rate: GST rate (default 0.10 for 10%)

    Returns:
        GST-exclusive amount in cents
    """
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
    """
    Categorize a transaction for GST purposes.

    Args:
        description: Transaction description
        amount_cents: Transaction amount in cents (positive = income, negative = expense)
        category: Optional pre-assigned category
        is_income: Whether this is an income transaction

    Returns:
        GSTCategorization with category, GST amount, and BAS label
    """
    desc_lower = description.lower()
    is_expense = amount_cents < 0

    # Check for private/non-business transactions first
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

    # Check for input-taxed supplies
    for category_name, patterns in INPUT_TAXED_PATTERNS.items():
        if matches_any_pattern(description, patterns):
            return GSTCategorization(
                category=GSTCategory.INPUT_TAXED,
                gst_rate=0,
                gst_amount_cents=0,
                is_claimable=False,
                bas_label=None,  # Not reported on BAS
                confidence=0.85,
                reasoning=f"Input-taxed supply ({category_name}) - no GST charged, no input credit claimable",
            )

    # Check for GST-free supplies
    for category_name, patterns in GST_FREE_PATTERNS.items():
        if matches_any_pattern(description, patterns):
            bas_label = BASLabel.G3.value if is_income else None
            if category_name == "export":
                bas_label = BASLabel.G2.value if is_income else None

            return GSTCategorization(
                category=GSTCategory.GST_FREE,
                gst_rate=0,
                gst_amount_cents=0,
                is_claimable=True,  # Can still claim GST on related inputs
                bas_label=bas_label,
                confidence=0.75,
                reasoning=f"GST-free supply ({category_name}) - no GST charged",
            )

    # Check for capital acquisitions (expenses only)
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
        # Sales
        return GSTCategorization(
            category=GSTCategory.TAXABLE_10,
            gst_rate=0.10,
            gst_amount_cents=gst_amount,
            is_claimable=False,  # N/A for sales
            bas_label=BASLabel.G1.value,
            confidence=0.6,
            reasoning="Standard taxable sale at 10% GST - reported at G1, GST at 1A",
        )
    else:
        # Purchases
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
    """
    Get start date, end date, and lodgement due date for an Australian BAS quarter.

    Args:
        financial_year: Financial year in format '2024-25'
        quarter: Quarter number (1-4)

    Returns:
        Tuple of (start_date, end_date, lodgement_due) in YYYY-MM-DD format
    """
    start_year = int(financial_year.split("-")[0])

    # Australian financial year runs July to June
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
    else:  # 4, 5, 6
        return (fy, 4)


class BASCalculator:
    """Calculator for BAS label values."""

    def __init__(self, accounting_method: str = "accrual"):
        """
        Initialize BAS calculator.

        Args:
            accounting_method: 'accrual' or 'cash'
        """
        self.accounting_method = accounting_method
        self.reset()

    def reset(self):
        """Reset all label values."""
        self.labels = {
            "G1": 0,   # Total sales
            "G2": 0,   # Export sales
            "G3": 0,   # Other GST-free sales
            "G10": 0,  # Capital purchases
            "G11": 0,  # Non-capital purchases
            "1A": 0,   # GST on sales
            "1B": 0,   # GST on purchases
            "W1": 0,   # Total wages
            "W2": 0,   # Amounts withheld
            "5A": 0,   # PAYG instalment
            "7C": 0,   # Fuel tax credits - business
            "7D": 0,   # Fuel tax credits - other
        }
        self.transactions_processed = 0
        self.gst_free_sales = 0
        self.gst_free_purchases = 0
        self.input_taxed = 0
        self.private = 0

    def add_transaction(
        self,
        description: str,
        amount_cents: int,
        category: Optional[str] = None,
        date: Optional[str] = None,
    ) -> GSTCategorization:
        """
        Add a transaction to the BAS calculation.

        Args:
            description: Transaction description
            amount_cents: Amount in cents
            category: Optional pre-assigned category
            date: Transaction date (for cash accounting)

        Returns:
            The GST categorization applied
        """
        is_income = amount_cents > 0
        categorization = categorize_transaction(
            description, amount_cents, category, is_income
        )

        self.transactions_processed += 1
        amount_abs = abs(amount_cents)

        if categorization.category == GSTCategory.PRIVATE:
            self.private += amount_abs
            return categorization

        if categorization.category == GSTCategory.INPUT_TAXED:
            self.input_taxed += amount_abs
            return categorization

        if is_income:
            # Sales
            if categorization.category == GSTCategory.GST_FREE:
                self.gst_free_sales += amount_abs
                if categorization.bas_label == "G2":
                    self.labels["G2"] += amount_abs
                else:
                    self.labels["G3"] += amount_abs
            else:
                # Taxable sales
                self.labels["G1"] += amount_abs
                self.labels["1A"] += categorization.gst_amount_cents
        else:
            # Purchases
            if categorization.category == GSTCategory.GST_FREE:
                self.gst_free_purchases += amount_abs
            elif categorization.category == GSTCategory.CAPITAL:
                self.labels["G10"] += amount_abs
                self.labels["1B"] += categorization.gst_amount_cents
            elif categorization.category == GSTCategory.TAXABLE_10:
                self.labels["G11"] += amount_abs
                if categorization.is_claimable:
                    self.labels["1B"] += categorization.gst_amount_cents

        return categorization

    def add_payg_wages(self, total_wages: int, tax_withheld: int):
        """Add PAYG withholding data."""
        self.labels["W1"] += total_wages
        self.labels["W2"] += tax_withheld

    def add_fuel_tax_credits(self, business_use: int, other_activities: int = 0):
        """Add fuel tax credits."""
        self.labels["7C"] += business_use
        self.labels["7D"] += other_activities

    def calculate_payg_instalment(self, instalment_rate: float = 0.0):
        """Calculate PAYG instalment (label 5A)."""
        # Simplified: rate × (G1 - G2 - G3)
        taxable_sales = self.labels["G1"]
        self.labels["5A"] = round(taxable_sales * instalment_rate)

    def get_summary(self) -> dict:
        """Get BAS calculation summary."""
        net_gst = self.labels["1A"] - self.labels["1B"]
        fuel_credits = self.labels["7C"] + self.labels["7D"]

        total_payable = (
            net_gst
            + self.labels["W2"]  # PAYG withheld
            + self.labels["5A"]  # PAYG instalment
            - fuel_credits
        )

        return {
            "labels": self.labels.copy(),
            "net_gst": net_gst,
            "fuel_tax_credits": fuel_credits,
            "total_payable": total_payable,
            "is_refund": total_payable < 0,
            "statistics": {
                "transactions_processed": self.transactions_processed,
                "gst_free_sales": self.gst_free_sales,
                "gst_free_purchases": self.gst_free_purchases,
                "input_taxed": self.input_taxed,
                "private_excluded": self.private,
            },
        }
