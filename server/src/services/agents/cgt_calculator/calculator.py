"""Australian CGT Calculator — CGTCalculator class."""

from datetime import date

from .types import AssetType, CGTAsset, CGTDisposal
from .calculations import parse_date, calculate_capital_gain


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
