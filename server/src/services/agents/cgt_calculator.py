# Refactored: cgt_calculator/ package replaces this file.
# Python resolves 'from .cgt_calculator import X' via cgt_calculator/__init__.py.
# This file is unreachable — the package directory takes priority in Python's import resolution.
"""
Australian Capital Gains Tax (CGT) Calculator

Handles CGT calculations including:
- Cost base calculations
- 50% CGT discount for assets held 12+ months
- Capital losses and carried forward losses
- Partial disposals
"""

from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional
from enum import Enum


class AssetType(Enum):
    """Types of CGT assets."""
    SHARES = "shares"
    PROPERTY = "property"
    CRYPTO = "crypto"
    COLLECTABLES = "collectables"
    PERSONAL_USE = "personal_use"
    OTHER = "other"


class DisposalMethod(Enum):
    """Methods for identifying which assets are sold."""
    FIFO = "fifo"  # First In First Out
    LIFO = "lifo"  # Last In First Out
    SPECIFIC = "specific"  # Specific identification
    AVERAGE = "average"  # Average cost (for crypto/fungible assets)


@dataclass
class CGTAsset:
    """Represents a CGT asset."""
    asset_id: str
    asset_name: str
    asset_type: AssetType
    acquisition_date: date
    acquisition_cost_cents: int  # Purchase price
    incidental_costs_cents: int  # Brokerage, legal, stamp duty
    improvements_cents: int  # Capital improvements
    quantity: float  # For shares/crypto
    unit_cost_cents: Optional[int] = None  # Cost per unit


@dataclass
class CGTDisposal:
    """Represents a CGT disposal event."""
    disposal_date: date
    disposal_proceeds_cents: int
    disposal_costs_cents: int  # Selling costs
    quantity_disposed: float


@dataclass
class CGTResult:
    """Result of a CGT calculation."""
    cost_base_cents: int
    reduced_cost_base_cents: int
    capital_proceeds_cents: int
    capital_gain_gross_cents: int
    discount_eligible: bool
    discount_amount_cents: int
    capital_gain_net_cents: int
    capital_loss_cents: int
    holding_period_days: int
    calculation_details: dict


def parse_date(date_str: str) -> date:
    """Parse a date string in YYYY-MM-DD format."""
    if isinstance(date_str, date):
        return date_str
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def calculate_holding_period(acquisition_date: date, disposal_date: date) -> int:
    """Calculate the number of days an asset was held."""
    return (disposal_date - acquisition_date).days


def is_discount_eligible(
    acquisition_date: date,
    disposal_date: date,
    asset_type: AssetType
) -> bool:
    """
    Determine if an asset is eligible for the 50% CGT discount.

    Conditions:
    - Held for at least 12 months
    - Not a collectable or personal use asset under $500
    - Individual, trust or super fund (not company)
    """
    holding_days = calculate_holding_period(acquisition_date, disposal_date)

    # Must be held for at least 12 months
    if holding_days < 365:
        return False

    # Collectables are only discountable if over $500 acquisition cost
    # (This is simplified - actual rules are more complex)
    if asset_type == AssetType.PERSONAL_USE:
        return False

    return True


def calculate_cost_base(asset: CGTAsset) -> int:
    """
    Calculate the cost base of an asset.

    Cost base includes:
    1. Money paid for the asset
    2. Incidental costs (brokerage, legal, stamp duty)
    3. Costs of owning the asset (not for most assets)
    4. Capital costs to increase value
    5. Costs to establish title
    """
    return (
        asset.acquisition_cost_cents +
        asset.incidental_costs_cents +
        asset.improvements_cents
    )


def calculate_reduced_cost_base(asset: CGTAsset) -> int:
    """
    Calculate the reduced cost base (used for capital losses).

    Generally same as cost base but excludes some elements.
    """
    return (
        asset.acquisition_cost_cents +
        asset.incidental_costs_cents +
        asset.improvements_cents
    )


def calculate_capital_gain(
    asset: CGTAsset,
    disposal: CGTDisposal,
    carried_forward_losses_cents: int = 0,
    apply_discount: bool = True,
) -> CGTResult:
    """
    Calculate capital gain or loss on disposal.

    Args:
        asset: The CGT asset being disposed
        disposal: Details of the disposal
        carried_forward_losses_cents: Capital losses from prior years
        apply_discount: Whether to apply 50% CGT discount if eligible

    Returns:
        CGTResult with full calculation breakdown
    """
    # Calculate proportional cost base for partial disposals
    disposal_ratio = disposal.quantity_disposed / asset.quantity if asset.quantity > 0 else 1.0

    full_cost_base = calculate_cost_base(asset)
    cost_base = round(full_cost_base * disposal_ratio)

    full_reduced_cost_base = calculate_reduced_cost_base(asset)
    reduced_cost_base = round(full_reduced_cost_base * disposal_ratio)

    # Capital proceeds = sale price - selling costs
    capital_proceeds = disposal.disposal_proceeds_cents - disposal.disposal_costs_cents

    # Calculate gain or loss
    if capital_proceeds > cost_base:
        # Capital gain
        capital_gain_gross = capital_proceeds - cost_base
        capital_loss = 0
    else:
        # Capital loss (use reduced cost base)
        capital_gain_gross = 0
        capital_loss = reduced_cost_base - capital_proceeds

    # Apply carried forward losses to gains
    if capital_gain_gross > 0 and carried_forward_losses_cents > 0:
        loss_offset = min(capital_gain_gross, carried_forward_losses_cents)
        capital_gain_gross -= loss_offset

    # Holding period
    holding_days = calculate_holding_period(asset.acquisition_date, disposal.disposal_date)

    # CGT discount
    discount_eligible = is_discount_eligible(
        asset.acquisition_date,
        disposal.disposal_date,
        asset.asset_type
    )

    discount_amount = 0
    capital_gain_net = capital_gain_gross

    if apply_discount and discount_eligible and capital_gain_gross > 0:
        # 50% CGT discount
        discount_amount = round(capital_gain_gross * 0.50)
        capital_gain_net = capital_gain_gross - discount_amount

    return CGTResult(
        cost_base_cents=cost_base,
        reduced_cost_base_cents=reduced_cost_base,
        capital_proceeds_cents=capital_proceeds,
        capital_gain_gross_cents=capital_gain_gross,
        discount_eligible=discount_eligible,
        discount_amount_cents=discount_amount,
        capital_gain_net_cents=capital_gain_net,
        capital_loss_cents=capital_loss,
        holding_period_days=holding_days,
        calculation_details={
            "asset_name": asset.asset_name,
            "asset_type": asset.asset_type.value,
            "acquisition_date": asset.acquisition_date.isoformat(),
            "disposal_date": disposal.disposal_date.isoformat(),
            "quantity_disposed": disposal.quantity_disposed,
            "total_quantity": asset.quantity,
            "disposal_ratio": disposal_ratio,
            "holding_period_months": holding_days // 30,
            "applied_losses": carried_forward_losses_cents if capital_gain_gross > 0 else 0,
        },
    )


def calculate_cgt_for_tax_year(
    disposals: list[tuple[CGTAsset, CGTDisposal]],
    carried_forward_losses_cents: int = 0,
    apply_discount: bool = True,
) -> dict:
    """
    Calculate total CGT for a tax year from multiple disposals.

    Args:
        disposals: List of (asset, disposal) tuples
        carried_forward_losses_cents: Losses from prior years
        apply_discount: Whether to apply CGT discount

    Returns:
        Summary of CGT calculations for the year
    """
    total_gains_gross = 0
    total_gains_net = 0
    total_losses = 0
    total_discount = 0
    disposal_results = []

    remaining_losses = carried_forward_losses_cents

    for asset, disposal in disposals:
        result = calculate_capital_gain(
            asset,
            disposal,
            remaining_losses,
            apply_discount
        )

        disposal_results.append({
            "asset_name": asset.asset_name,
            "gain_gross_cents": result.capital_gain_gross_cents,
            "gain_net_cents": result.capital_gain_net_cents,
            "loss_cents": result.capital_loss_cents,
            "discount_cents": result.discount_amount_cents,
            "discount_eligible": result.discount_eligible,
            "holding_days": result.holding_period_days,
        })

        total_gains_gross += result.capital_gain_gross_cents
        total_gains_net += result.capital_gain_net_cents
        total_losses += result.capital_loss_cents
        total_discount += result.discount_amount_cents

        # Use losses against next gain
        if result.capital_gain_gross_cents > 0:
            remaining_losses = max(0, remaining_losses - result.capital_gain_gross_cents)

    # Net position
    net_capital_gain = max(0, total_gains_net - total_losses)
    net_capital_loss = max(0, total_losses - total_gains_net)

    return {
        "total_gains_gross_cents": total_gains_gross,
        "total_discount_cents": total_discount,
        "total_gains_net_cents": total_gains_net,
        "total_losses_cents": total_losses,
        "carried_forward_used_cents": carried_forward_losses_cents - remaining_losses,
        "net_capital_gain_cents": net_capital_gain,
        "net_capital_loss_cents": net_capital_loss,
        "losses_to_carry_forward_cents": net_capital_loss + remaining_losses,
        "disposal_count": len(disposals),
        "disposals": disposal_results,
    }


def calculate_average_cost(
    purchases: list[dict],
    total_quantity: float
) -> int:
    """
    Calculate average cost per unit for fungible assets (crypto, shares).

    Args:
        purchases: List of {"quantity": float, "cost_cents": int} dicts
        total_quantity: Total quantity held

    Returns:
        Average cost per unit in cents
    """
    total_cost = sum(p["cost_cents"] for p in purchases)
    if total_quantity <= 0:
        return 0
    return round(total_cost / total_quantity)


def calculate_fifo_cost_base(
    purchases: list[dict],
    quantity_to_sell: float
) -> tuple[int, list[dict]]:
    """
    Calculate cost base using FIFO method.

    Args:
        purchases: List of {"date": str, "quantity": float, "cost_cents": int} dicts
                  sorted by date ascending
        quantity_to_sell: Quantity being disposed

    Returns:
        Tuple of (cost_base_cents, remaining_purchases)
    """
    # Sort by date (oldest first)
    sorted_purchases = sorted(purchases, key=lambda x: x["date"])

    remaining_to_sell = quantity_to_sell
    cost_base = 0
    remaining_purchases = []

    for purchase in sorted_purchases:
        if remaining_to_sell <= 0:
            remaining_purchases.append(purchase)
            continue

        available = purchase["quantity"]
        unit_cost = purchase["cost_cents"] / purchase["quantity"]

        if available <= remaining_to_sell:
            # Use entire purchase
            cost_base += purchase["cost_cents"]
            remaining_to_sell -= available
        else:
            # Partial use
            used = remaining_to_sell
            cost_base += round(used * unit_cost)
            remaining_purchases.append({
                "date": purchase["date"],
                "quantity": available - used,
                "cost_cents": round((available - used) * unit_cost),
            })
            remaining_to_sell = 0

    return cost_base, remaining_purchases


class CGTCalculator:
    """Calculator for managing CGT across multiple assets and years."""

    def __init__(self):
        self.carried_forward_losses: dict[str, int] = {}  # year -> amount

    def add_carried_forward_loss(self, year: str, amount_cents: int):
        """Record a carried forward loss from a previous year."""
        self.carried_forward_losses[year] = amount_cents

    def get_available_losses(self, current_year: str) -> int:
        """Get total available carried forward losses."""
        total = 0
        for year, amount in self.carried_forward_losses.items():
            if year < current_year:
                total += amount
        return total

    def calculate_disposal(
        self,
        acquisition_date: str,
        acquisition_cost_cents: int,
        incidental_costs_cents: int,
        disposal_date: str,
        disposal_proceeds_cents: int,
        disposal_costs_cents: int = 0,
        quantity: float = 1.0,
        quantity_disposed: float = 1.0,
        improvements_cents: int = 0,
        asset_name: str = "Asset",
        asset_type: str = "other",
    ) -> dict:
        """
        Calculate CGT for a single disposal.

        All amounts in cents.
        """
        asset = CGTAsset(
            asset_id="temp",
            asset_name=asset_name,
            asset_type=AssetType(asset_type),
            acquisition_date=parse_date(acquisition_date),
            acquisition_cost_cents=acquisition_cost_cents,
            incidental_costs_cents=incidental_costs_cents,
            improvements_cents=improvements_cents,
            quantity=quantity,
        )

        disposal = CGTDisposal(
            disposal_date=parse_date(disposal_date),
            disposal_proceeds_cents=disposal_proceeds_cents,
            disposal_costs_cents=disposal_costs_cents,
            quantity_disposed=quantity_disposed,
        )

        # Get losses for this tax year
        tax_year = self._get_tax_year(disposal.disposal_date)
        available_losses = self.get_available_losses(tax_year)

        result = calculate_capital_gain(asset, disposal, available_losses)

        return {
            "cost_base_cents": result.cost_base_cents,
            "capital_proceeds_cents": result.capital_proceeds_cents,
            "capital_gain_gross_cents": result.capital_gain_gross_cents,
            "discount_eligible": result.discount_eligible,
            "discount_amount_cents": result.discount_amount_cents,
            "capital_gain_net_cents": result.capital_gain_net_cents,
            "capital_loss_cents": result.capital_loss_cents,
            "holding_period_days": result.holding_period_days,
            "holding_period_months": result.holding_period_days // 30,
            "tax_year": tax_year,
            "available_losses_used_cents": min(available_losses, result.capital_gain_gross_cents),
            "details": result.calculation_details,
        }

    def _get_tax_year(self, disposal_date: date) -> str:
        """Get the Australian tax year for a date."""
        year = disposal_date.year
        month = disposal_date.month

        if month >= 7:
            return f"{year}-{str(year + 1)[2:]}"
        else:
            return f"{year - 1}-{str(year)[2:]}"


# Convenience function for simple calculations
def quick_cgt_calculation(
    acquisition_date: str,
    acquisition_cost: float,  # Dollars
    disposal_date: str,
    disposal_proceeds: float,  # Dollars
    carried_forward_losses: float = 0,  # Dollars
) -> dict:
    """
    Quick CGT calculation with dollar amounts.

    Args:
        acquisition_date: Date acquired (YYYY-MM-DD)
        acquisition_cost: Purchase price in dollars
        disposal_date: Date sold (YYYY-MM-DD)
        disposal_proceeds: Sale price in dollars
        carried_forward_losses: Prior losses in dollars

    Returns:
        CGT calculation in dollars
    """
    calculator = CGTCalculator()

    result = calculator.calculate_disposal(
        acquisition_date=acquisition_date,
        acquisition_cost_cents=round(acquisition_cost * 100),
        incidental_costs_cents=0,
        disposal_date=disposal_date,
        disposal_proceeds_cents=round(disposal_proceeds * 100),
    )

    # Apply carried forward losses
    gross_gain = result["capital_gain_gross_cents"]
    if gross_gain > 0 and carried_forward_losses > 0:
        loss_offset = min(gross_gain, round(carried_forward_losses * 100))
        gross_gain -= loss_offset

    # Recalculate discount on reduced gain
    if result["discount_eligible"] and gross_gain > 0:
        discount = round(gross_gain * 0.50)
        net_gain = gross_gain - discount
    else:
        discount = 0
        net_gain = gross_gain

    return {
        "acquisition_cost": acquisition_cost,
        "disposal_proceeds": disposal_proceeds,
        "cost_base": result["cost_base_cents"] / 100,
        "capital_gain_gross": gross_gain / 100,
        "discount_eligible": result["discount_eligible"],
        "discount_amount": discount / 100,
        "capital_gain_net": net_gain / 100,
        "capital_loss": result["capital_loss_cents"] / 100,
        "holding_months": result["holding_period_months"],
        "note": "50% CGT discount applied" if result["discount_eligible"] and gross_gain > 0 else "No CGT discount - held less than 12 months" if not result["discount_eligible"] else "Capital loss - no tax payable",
    }
