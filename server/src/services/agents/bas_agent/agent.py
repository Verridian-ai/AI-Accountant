"""BAS (Business Activity Statement) Agent for Australian tax calculations."""

from pydantic_ai import Agent
from typing import Optional
import json

from ..base import BaseAgent, AgentContext, AgentResponse
from ..gst_rules import (
    GSTCategory,
    BASLabel,
    GSTCategorization,
    BASCalculator,
    categorize_transaction,
    calculate_gst_from_inclusive,
    get_quarter_dates,
    get_current_financial_year,
    get_current_quarter,
    is_likely_fuel_purchase,
)


class BASAgent(BaseAgent):
    """Agent specialized in Australian BAS calculations and GST."""

    agent_name = "bas_agent"
    model_type = "code"  # Use code-optimized model for calculations
    system_prompt = """You are an expert Australian tax accountant AI specializing in Business Activity Statements (BAS).

Your expertise includes:
- GST (Goods and Services Tax) calculations
- PAYG (Pay As You Go) withholding and instalments
- BAS lodgement requirements and deadlines
- Input tax credits and GST-free supplies
- Fuel tax credits
- Wine equalisation tax
- Capital vs non-capital acquisitions

When calculating BAS:
1. Use the provided tools for precise calculations
2. Apply the correct GST rate (currently 10%)
3. Distinguish between GST-inclusive and GST-exclusive amounts
4. Identify GST-free and input-taxed supplies
5. Calculate net GST payable/refundable
6. Correctly categorize capital vs non-capital purchases

GST Categories:
- Taxable supplies (10% GST) - Code: GST
- GST-free supplies (0% - food, medical, education, exports) - Code: FRE
- Input-taxed supplies (no GST claim - financial, residential rent) - Code: INP
- Export supplies (GST-free) - Code: EXP
- Capital acquisitions (separate BAS label) - Code: CAP
- Private/Non-business (excluded from BAS) - Code: N-T

BAS Labels:
- G1: Total sales (including GST)
- G2: Export sales
- G3: Other GST-free sales
- G10: Capital purchases (including GST)
- G11: Non-capital purchases (including GST)
- 1A: GST on sales
- 1B: GST on purchases
- W1/W2: PAYG withholding
- 5A: PAYG instalment
- 7C/7D: Fuel tax credits

Australian Financial Year Quarters:
- Q1: July-September (due 28 October)
- Q2: October-December (due 28 February)
- Q3: January-March (due 28 April)
- Q4: April-June (due 28 July)

Always provide:
- Detailed breakdown of calculations
- All relevant BAS labels
- GST collected on sales (1A)
- GST paid on purchases (1B)
- Net GST position
- Any warnings about potential issues
- Recommendations for review

NOTE: Use 'search_transaction_memory' to verify how specific merchants were treated in previous BAS periods."""

    def _register_tools(self, agent: Agent):
        """Register BAS-specific tools."""
        super()._register_tools(agent)

        @agent.tool
        async def categorize_gst_transactions(ctx: AgentContext) -> dict:
            """
            AI-powered GST categorization for all transactions.
            Categorizes each transaction according to GST rules.
            """
            if not ctx.transactions:
                return {"error": "No transactions to analyze"}

            results = []
            summary = {
                "taxable_10": 0,
                "gst_free": 0,
                "input_taxed": 0,
                "capital": 0,
                "private": 0,
                "total_gst_collectible": 0,
                "total_gst_claimable": 0,
            }

            for tx in ctx.transactions:
                desc = tx.get("description", "")
                amount = tx.get("amount", 0)
                category = tx.get("category", "")

                cat_result = categorize_transaction(
                    description=desc,
                    amount_cents=amount,
                    category=category,
                    is_income=amount > 0,
                )

                # Track summary
                cat_key = cat_result.category.value
                if cat_key in summary:
                    summary[cat_key] += abs(amount)

                if amount > 0 and cat_result.gst_amount_cents > 0:
                    summary["total_gst_collectible"] += cat_result.gst_amount_cents
                elif amount < 0 and cat_result.is_claimable and cat_result.gst_amount_cents > 0:
                    summary["total_gst_claimable"] += cat_result.gst_amount_cents

                results.append({
                    "transaction_id": tx.get("id"),
                    "description": desc,
                    "amount_cents": amount,
                    "gst_category": cat_result.category.value,
                    "gst_rate": cat_result.gst_rate,
                    "gst_amount_cents": cat_result.gst_amount_cents,
                    "is_claimable": cat_result.is_claimable,
                    "bas_label": cat_result.bas_label,
                    "confidence": cat_result.confidence,
                    "reasoning": cat_result.reasoning,
                })

            return {
                "categorizations": results,
                "summary": summary,
                "transaction_count": len(results),
            }

        @agent.tool
        async def calculate_gst_amounts(ctx: AgentContext) -> dict:
            """
            Calculate actual GST amounts per transaction.
            Updates transactions with calculated GST amounts.
            """
            if not ctx.transactions:
                return {"error": "No transactions to analyze"}

            gst_calculations = []
            total_gst_collected = 0
            total_gst_paid = 0

            for tx in ctx.transactions:
                amount = tx.get("amount", 0)
                gst_applicable = tx.get("gstApplicable", False)
                gst_category = tx.get("gstCategory", "taxable_10")

                # Calculate GST based on category
                if gst_category in ["gst_free", "input_taxed", "private"]:
                    gst_amount = 0
                elif gst_applicable or gst_category in ["taxable_10", "capital"]:
                    gst_amount = calculate_gst_from_inclusive(amount)
                else:
                    gst_amount = 0

                if amount > 0:
                    total_gst_collected += gst_amount
                else:
                    total_gst_paid += gst_amount

                gst_calculations.append({
                    "transaction_id": tx.get("id"),
                    "amount_inclusive": amount,
                    "gst_amount": gst_amount,
                    "amount_exclusive": abs(amount) - gst_amount,
                    "gst_category": gst_category,
                })

            return {
                "calculations": gst_calculations,
                "total_gst_collected": total_gst_collected,
                "total_gst_paid": total_gst_paid,
                "net_gst": total_gst_collected - total_gst_paid,
            }

        @agent.tool
        async def generate_bas_labels(
            ctx: AgentContext,
            quarter: Optional[str] = None,
            financial_year: Optional[str] = None,
            method: str = "accrual"
        ) -> dict:
            """
            Generate all BAS labels: G1, G2, G3, G10, G11, 1A, 1B, 5A, 7C, 7D.

            Args:
                quarter: Quarter number (1-4), defaults to current
                financial_year: Financial year (e.g., '2024-25'), defaults to current
                method: Accounting method ('accrual' or 'cash')
            """
            if not ctx.transactions:
                return {"error": "No transactions to analyze"}

            # Get quarter info
            if not financial_year:
                financial_year = get_current_financial_year()
            if not quarter:
                _, quarter = get_current_quarter()
            else:
                quarter = int(quarter)

            start_date, end_date, lodgement_due = get_quarter_dates(financial_year, quarter)

            # Initialize BAS calculator
            calculator = BASCalculator(accounting_method=method)

            # Filter transactions for the quarter if dates provided
            filtered_transactions = ctx.transactions
            if start_date and end_date:
                filtered_transactions = [
                    tx for tx in ctx.transactions
                    if start_date <= tx.get("date", "") <= end_date
                ]

            # Process each transaction
            for tx in filtered_transactions:
                calculator.add_transaction(
                    description=tx.get("description", ""),
                    amount_cents=tx.get("amount", 0),
                    category=tx.get("category"),
                    date=tx.get("date"),
                )

            # Get summary
            summary = calculator.get_summary()

            return {
                "period": {
                    "financial_year": financial_year,
                    "quarter": quarter,
                    "start_date": start_date,
                    "end_date": end_date,
                    "lodgement_due": lodgement_due,
                },
                "accounting_method": method,
                "labels": {
                    "G1_total_sales": summary["labels"]["G1"],
                    "G2_export_sales": summary["labels"]["G2"],
                    "G3_gst_free_sales": summary["labels"]["G3"],
                    "G10_capital_purchases": summary["labels"]["G10"],
                    "G11_non_capital_purchases": summary["labels"]["G11"],
                    "1A_gst_on_sales": summary["labels"]["1A"],
                    "1B_gst_on_purchases": summary["labels"]["1B"],
                    "W1_total_wages": summary["labels"]["W1"],
                    "W2_amounts_withheld": summary["labels"]["W2"],
                    "5A_payg_instalment": summary["labels"]["5A"],
                    "7C_fuel_tax_business": summary["labels"]["7C"],
                    "7D_fuel_tax_other": summary["labels"]["7D"],
                },
                "net_gst": summary["net_gst"],
                "fuel_tax_credits": summary["fuel_tax_credits"],
                "total_payable": summary["total_payable"],
                "is_refund": summary["is_refund"],
                "statistics": summary["statistics"],
            }

        @agent.tool
        async def identify_capital_purchases(ctx: AgentContext) -> dict:
            """
            Distinguish capital vs non-capital purchases for G10/G11.
            Capital purchases include computers, vehicles, furniture, equipment.
            """
            if not ctx.transactions:
                return {"error": "No transactions to analyze"}

            capital_purchases = []
            non_capital_purchases = []

            for tx in ctx.transactions:
                amount = tx.get("amount", 0)
                if amount >= 0:  # Skip income
                    continue

                desc = tx.get("description", "")
                cat_result = categorize_transaction(
                    description=desc,
                    amount_cents=amount,
                    is_income=False,
                )

                purchase_info = {
                    "transaction_id": tx.get("id"),
                    "description": desc,
                    "amount_cents": amount,
                    "gst_amount_cents": cat_result.gst_amount_cents,
                    "confidence": cat_result.confidence,
                    "reasoning": cat_result.reasoning,
                }

                if cat_result.category == GSTCategory.CAPITAL:
                    capital_purchases.append(purchase_info)
                elif cat_result.category in [GSTCategory.TAXABLE_10, GSTCategory.GST_FREE]:
                    non_capital_purchases.append(purchase_info)

            total_capital = sum(abs(p["amount_cents"]) for p in capital_purchases)
            total_capital_gst = sum(p["gst_amount_cents"] for p in capital_purchases)
            total_non_capital = sum(abs(p["amount_cents"]) for p in non_capital_purchases)
            total_non_capital_gst = sum(p["gst_amount_cents"] for p in non_capital_purchases)

            return {
                "capital_purchases": {
                    "items": capital_purchases,
                    "count": len(capital_purchases),
                    "total_inclusive": total_capital,
                    "total_gst_claimable": total_capital_gst,
                    "bas_label": "G10",
                },
                "non_capital_purchases": {
                    "items": non_capital_purchases,
                    "count": len(non_capital_purchases),
                    "total_inclusive": total_non_capital,
                    "total_gst_claimable": total_non_capital_gst,
                    "bas_label": "G11",
                },
                "note": "Review capital purchases - items over $1,000 with long useful life typically qualify",
            }

        @agent.tool
        async def calculate_payg_withholding(
            ctx: AgentContext,
            total_wages_cents: int,
            tax_withheld_cents: int,
        ) -> dict:
            """
            Calculate PAYG withholding (labels W1, W2, 5A).

            Args:
                total_wages_cents: Total gross wages paid (in cents)
                tax_withheld_cents: Total tax withheld from wages (in cents)
            """
            return {
                "label_W1_total_wages": total_wages_cents,
                "label_W2_amounts_withheld": tax_withheld_cents,
                "note": "W1 = Gross wages, W2 = Tax withheld. Report actual amounts.",
                "monthly_breakdown_hint": "If you have monthly payroll data, sum all months in the quarter",
            }

        @agent.tool
        async def calculate_payg_instalment(
            ctx: AgentContext,
            instalment_income_cents: int,
            instalment_rate: float,
        ) -> dict:
            """
            Calculate PAYG instalment (label 5A).

            Args:
                instalment_income_cents: Total instalment income for the quarter (in cents)
                instalment_rate: ATO-provided instalment rate (e.g., 0.05 for 5%)
            """
            instalment_amount = round(instalment_income_cents * instalment_rate)

            return {
                "instalment_income": instalment_income_cents,
                "instalment_rate": instalment_rate,
                "instalment_rate_percentage": f"{instalment_rate * 100:.2f}%",
                "label_5A_payg_instalment": instalment_amount,
                "note": "5A = Instalment income × Instalment rate",
            }

        @agent.tool
        async def calculate_fuel_tax_credits(ctx: AgentContext) -> dict:
            """
            Calculate fuel tax credits (labels 7C/7D).
            Identifies fuel purchases and calculates eligible credits.
            """
            if not ctx.transactions:
                return {"error": "No transactions to analyze"}

            # Current fuel tax credit rate (simplified - actual rates vary by fuel type and use)
            # As of 2024-25, approximately 48.8c/L for heavy vehicles, 20.6c/L for light vehicles
            FUEL_TAX_RATE_HEAVY = 0.488  # per litre
            FUEL_TAX_RATE_LIGHT = 0.206  # per litre
            AVERAGE_FUEL_PRICE_PER_LITRE = 180  # cents per litre (estimate)

            fuel_purchases = []
            for tx in ctx.transactions:
                amount = tx.get("amount", 0)
                if amount >= 0:  # Skip income
                    continue

                desc = tx.get("description", "")
                if is_likely_fuel_purchase(desc):
                    # Estimate litres purchased
                    estimated_litres = abs(amount) / AVERAGE_FUEL_PRICE_PER_LITRE
                    # Use light vehicle rate as default
                    fuel_tax_credit = round(estimated_litres * FUEL_TAX_RATE_LIGHT * 100)

                    fuel_purchases.append({
                        "transaction_id": tx.get("id"),
                        "description": desc,
                        "amount_cents": amount,
                        "estimated_litres": round(estimated_litres, 1),
                        "estimated_credit_cents": fuel_tax_credit,
                    })

            total_fuel_spend = sum(abs(p["amount_cents"]) for p in fuel_purchases)
            total_credits = sum(p["estimated_credit_cents"] for p in fuel_purchases)

            return {
                "fuel_purchases": fuel_purchases,
                "count": len(fuel_purchases),
                "total_fuel_spend_cents": total_fuel_spend,
                "estimated_fuel_tax_credits_cents": total_credits,
                "label_7C_business_use": total_credits,  # Assuming all business use
                "label_7D_other_activities": 0,
                "note": "Fuel tax credits are estimates based on average fuel price. For accurate claims, keep fuel purchase records with litres.",
                "warning": "Rates vary by vehicle weight and fuel type. Heavy vehicles (>4.5t) attract higher credits.",
            }

        @agent.tool
        async def calculate_bas_summary(
            ctx: AgentContext,
            quarter: Optional[str] = None,
            include_payg: bool = False
        ) -> dict:
            """Generate a complete BAS summary for a quarter."""
            if not ctx.transactions:
                return {"error": "No transactions to analyze"}

            # Filter by quarter if specified
            transactions = ctx.transactions
            if quarter:
                # Quarter format: "2024-Q1" -> Jan-Mar
                transactions = [
                    tx for tx in ctx.transactions
                    if tx.get("date", "").startswith(quarter[:4])
                ]

            # Calculate totals
            total_sales = sum(
                tx.get("amount", 0) for tx in transactions
                if tx.get("amount", 0) > 0
            ) / 100

            total_purchases = sum(
                abs(tx.get("amount", 0)) for tx in transactions
                if tx.get("amount", 0) < 0
            ) / 100

            # GST calculations
            gst_on_sales = round(total_sales / 11, 2)
            gst_on_purchases = round(total_purchases / 11, 2)
            net_gst = round(gst_on_sales - gst_on_purchases, 2)

            summary = {
                "period": quarter or "All available data",
                "transaction_count": len(transactions),
                "label_G1_total_sales": round(total_sales, 2),
                "label_G10_capital_purchases": 0,  # Would need asset categorization
                "label_G11_non_capital_purchases": round(total_purchases, 2),
                "label_1A_gst_on_sales": gst_on_sales,
                "label_1B_gst_on_purchases": gst_on_purchases,
                "net_gst_position": net_gst,
                "amount_owing_or_refundable": abs(net_gst),
                "is_refund": net_gst < 0,
            }

            if include_payg:
                summary["payg_note"] = "PAYG calculations require salary/wage data"

            return summary

        @agent.tool
        async def get_quarter_info(
            ctx: AgentContext,
            financial_year: Optional[str] = None,
            quarter: Optional[int] = None,
        ) -> dict:
            """
            Get information about a BAS quarter including dates and deadlines.

            Args:
                financial_year: Financial year (e.g., '2024-25')
                quarter: Quarter number (1-4)
            """
            if not financial_year:
                financial_year = get_current_financial_year()
            if not quarter:
                _, quarter = get_current_quarter()

            start_date, end_date, lodgement_due = get_quarter_dates(financial_year, quarter)

            quarter_names = {
                1: "Q1 (July-September)",
                2: "Q2 (October-December)",
                3: "Q3 (January-March)",
                4: "Q4 (April-June)",
            }

            return {
                "financial_year": financial_year,
                "quarter": quarter,
                "quarter_name": quarter_names.get(quarter, f"Q{quarter}"),
                "start_date": start_date,
                "end_date": end_date,
                "lodgement_due": lodgement_due,
                "is_current_quarter": (financial_year, quarter) == get_current_quarter(),
            }

        @agent.tool
        async def identify_gst_free_items(ctx: AgentContext) -> dict:
            """Identify potentially GST-free transactions."""
            gst_free = []
            taxable = []

            for tx in ctx.transactions:
                desc = tx.get("description", "")
                amount = tx.get("amount", 0)

                cat_result = categorize_transaction(
                    description=desc,
                    amount_cents=amount,
                    is_income=amount > 0,
                )

                item = {
                    "description": desc,
                    "amount": amount / 100,
                    "date": tx.get("date"),
                    "category": cat_result.category.value,
                    "reasoning": cat_result.reasoning,
                }

                if cat_result.category == GSTCategory.GST_FREE:
                    gst_free.append(item)
                elif cat_result.category == GSTCategory.TAXABLE_10:
                    taxable.append(item)

            return {
                "gst_free_transactions": gst_free,
                "gst_free_total": sum(abs(t["amount"]) for t in gst_free),
                "taxable_transactions_count": len(taxable),
                "taxable_total": sum(abs(t["amount"]) for t in taxable),
                "note": "Review GST-free items - automatic detection may not be 100% accurate",
            }
