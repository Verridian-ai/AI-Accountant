"""Australian GST Categorization Rules — BAS Calculator."""

from typing import Optional

from .types import GSTCategory, GSTCategorization
from .rules import categorize_transaction


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
