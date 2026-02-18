"""Australian CGT Calculator — Convenience functions."""

from .calculator import CGTCalculator


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
