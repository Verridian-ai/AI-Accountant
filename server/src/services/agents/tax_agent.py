"""Tax Agent for Australian income tax calculations and deductions."""

from pydantic_ai import Agent
from typing import Optional
import json

from .base import BaseAgent, AgentContext, AgentResponse
from .tax_config import (
    EntityType,
    DeductionMethod,
    calculate_income_tax,
    calculate_medicare_levy,
    calculate_tax_offset,
    calculate_full_tax,
    calculate_wfh_deduction,
    calculate_motor_vehicle_deduction,
    get_tax_brackets,
    get_deduction_rates,
    DEDUCTION_RATES_2024_25,
)
from .cgt_calculator import (
    CGTCalculator,
    quick_cgt_calculation,
    AssetType,
)
from .depreciation_calculator import (
    DepreciationCalculator,
    quick_depreciation,
    compare_depreciation_methods,
    AssetCategory,
    INSTANT_WRITE_OFF_THRESHOLD,
)


class TaxAgent(BaseAgent):
    """Agent specialized in Australian income tax calculations."""

    agent_name = "tax_agent"
    model_type = "code"
    system_prompt = """You are an expert Australian tax accountant AI specializing in income tax.

Your expertise includes:
- Income tax calculations using current tax brackets (2024-25 Stage 3 cuts)
- Medicare levy and surcharge calculations
- Tax offsets (LITO, SAPTO)
- Work-related deductions (WFH, travel, uniforms, tools)
- Capital gains tax with 50% discount
- Depreciation (diminishing value, prime cost, instant write-off)
- Superannuation contributions
- Rental property deductions

2024-25 Tax Brackets (Stage 3):
- $0 - $18,200: Nil
- $18,201 - $45,000: 16%
- $45,001 - $135,000: 30% ($4,288 + 30% over $45,000)
- $135,001 - $190,000: 37% ($31,288 + 37% over $135,000)
- $190,001+: 45% ($51,638 + 45% over $190,000)

Medicare Levy: 2% (with low-income exemption)
Medicare Levy Surcharge: 1-1.5% if no private health cover and income > $93,000

Key Deduction Rates 2024-25:
- Work from Home: $0.67 per hour (fixed rate method)
- Motor Vehicle: 85 cents per km (max 5,000 km)
- Instant Asset Write-off: $20,000 threshold
- Low Value Pool: 37.5% existing, 18.75% new additions

Capital Gains:
- 50% CGT discount if held 12+ months
- Apply capital losses before discount
- Carry forward unused losses indefinitely

Always provide:
- Taxable income calculation
- Tax payable breakdown
- Medicare levy details
- Applicable offsets
- Deductions summary
- Effective tax rate
- Recommendations for tax optimization

IMPORTANT: Use 'search_transaction_memory' to look up previous year's deductions or specific rules indexed in the knowledge base."""

    def _register_tools(self, agent: Agent):
        """Register tax-specific tools."""
        super()._register_tools(agent)

        @agent.tool
        async def calculate_tax_full(
            ctx: AgentContext,
            gross_income: float,
            deductions: float = 0,
            entity_type: str = "individual",
            tax_year: str = "2024-25",
            has_private_health: bool = False,
            apply_lito: bool = True,
        ) -> dict:
            """
            Calculate full Australian tax with Medicare levy, surcharge, and offsets.

            Args:
                gross_income: Total gross income in dollars
                deductions: Total deductions in dollars
                entity_type: 'individual', 'company', 'trust', 'smsf'
                tax_year: Financial year (e.g., '2024-25')
                has_private_health: Whether taxpayer has private health insurance
                apply_lito: Whether to apply Low Income Tax Offset
            """
            entity = EntityType(entity_type) if entity_type in [e.value for e in EntityType] else EntityType.INDIVIDUAL

            result = calculate_full_tax(
                gross_income_cents=round(gross_income * 100),
                deductions_cents=round(deductions * 100),
                tax_year=tax_year,
                entity_type=entity,
                has_private_health=has_private_health,
                apply_lito=apply_lito,
            )

            # Convert cents to dollars
            return {
                "gross_income": result["gross_income_cents"] / 100,
                "deductions": result["deductions_cents"] / 100,
                "taxable_income": result["taxable_income_cents"] / 100,
                "income_tax": result["income_tax_cents"] / 100,
                "medicare_levy": result["medicare_levy_cents"] / 100,
                "medicare_surcharge": result["medicare_surcharge_cents"] / 100,
                "tax_offsets": result["tax_offsets_cents"] / 100,
                "offsets_detail": [
                    {**o, "offset_amount": o["offset_amount_cents"] / 100}
                    for o in result.get("offsets_detail", [])
                ],
                "total_tax": result["total_tax_cents"] / 100,
                "effective_tax_rate": result["effective_tax_rate_percent"],
                "take_home_annual": result["take_home_annual_cents"] / 100,
                "take_home_monthly": result["take_home_monthly_cents"] / 100,
                "tax_year": result["tax_year"],
                "entity_type": result["entity_type"],
            }

        @agent.tool
        async def calculate_income_tax_only(
            ctx: AgentContext,
            taxable_income: float,
            tax_year: str = "2024-25",
        ) -> dict:
            """
            Calculate Australian income tax for a given taxable income.

            Args:
                taxable_income: Taxable income in dollars
                tax_year: Financial year
            """
            result = calculate_income_tax(
                taxable_income_cents=round(taxable_income * 100),
                tax_year=tax_year,
            )

            # Medicare levy
            medicare = calculate_medicare_levy(
                taxable_income_cents=round(taxable_income * 100),
                tax_year=tax_year,
            )

            total_tax = result["income_tax_cents"] + medicare["total_medicare_cents"]
            effective_rate = (total_tax / (taxable_income * 100) * 100) if taxable_income > 0 else 0

            return {
                "taxable_income": taxable_income,
                "income_tax": result["income_tax_cents"] / 100,
                "medicare_levy": medicare["medicare_levy_cents"] / 100,
                "total_tax": total_tax / 100,
                "effective_tax_rate": round(effective_rate, 2),
                "marginal_bracket": result["marginal_bracket"],
                "take_home_annual": taxable_income - total_tax / 100,
                "take_home_monthly": (taxable_income - total_tax / 100) / 12,
            }

        @agent.tool
        async def calculate_wfh_comparison(
            ctx: AgentContext,
            hours_per_week: float,
            weeks_worked: int = 48,
            actual_expenses: Optional[float] = None,
            tax_year: str = "2024-25",
        ) -> dict:
            """
            Compare fixed rate vs actual cost for work from home deduction.

            Args:
                hours_per_week: Average hours worked from home per week
                weeks_worked: Number of weeks worked from home
                actual_expenses: Optional actual expenses in dollars
                tax_year: Financial year
            """
            actual_cents = round(actual_expenses * 100) if actual_expenses else None

            result = calculate_wfh_deduction(
                hours_per_week=hours_per_week,
                weeks_worked=weeks_worked,
                actual_expenses_cents=actual_cents,
                tax_year=tax_year,
            )

            # Convert to dollars
            response = {
                "fixed_rate_method": {
                    "rate_per_hour": result["fixed_rate_method"]["rate_per_hour_cents"] / 100,
                    "total_hours": result["fixed_rate_method"]["total_hours"],
                    "deduction": result["fixed_rate_method"]["deduction_cents"] / 100,
                    "note": result["fixed_rate_method"]["note"],
                },
                "hours_per_week": result["hours_per_week"],
                "weeks_worked": result["weeks_worked"],
                "recommended_method": result["recommended_method"],
            }

            if "actual_cost_method" in result:
                response["actual_cost_method"] = {
                    "deduction": result["actual_cost_method"]["deduction_cents"] / 100,
                    "note": result["actual_cost_method"]["note"],
                }
                response["difference"] = result["difference_cents"] / 100

            return response

        @agent.tool
        async def calculate_motor_vehicle_deduction(
            ctx: AgentContext,
            km_travelled: int,
            logbook_percentage: Optional[float] = None,
            total_car_expenses: Optional[float] = None,
            tax_year: str = "2024-25",
        ) -> dict:
            """
            Calculate motor vehicle deduction using cents per km or logbook method.

            Args:
                km_travelled: Total business kilometres
                logbook_percentage: Business use % from logbook (0-100)
                total_car_expenses: Total car expenses in dollars (for logbook)
                tax_year: Financial year
            """
            expenses_cents = round(total_car_expenses * 100) if total_car_expenses else None

            result = calculate_motor_vehicle_deduction(
                km_travelled=km_travelled,
                logbook_percentage=logbook_percentage,
                total_car_expenses_cents=expenses_cents,
                tax_year=tax_year,
            )

            # Convert to dollars
            response = {
                "cents_per_km_method": {
                    "rate_cents": result["cents_per_km_method"]["rate_cents"],
                    "km_claimed": result["cents_per_km_method"]["km_claimed"],
                    "km_limit": result["cents_per_km_method"]["km_limit"],
                    "deduction": result["cents_per_km_method"]["deduction_cents"] / 100,
                    "note": result["cents_per_km_method"]["note"],
                },
                "km_travelled": result["km_travelled"],
                "recommended_method": result["recommended_method"],
            }

            if "logbook_method" in result:
                response["logbook_method"] = {
                    "business_use_percentage": result["logbook_method"]["business_use_percentage"],
                    "total_expenses": result["logbook_method"]["total_expenses_cents"] / 100,
                    "deduction": result["logbook_method"]["deduction_cents"] / 100,
                    "note": result["logbook_method"]["note"],
                }
                response["difference"] = result["difference_cents"] / 100

            return response

        @agent.tool
        async def calculate_capital_gain(
            ctx: AgentContext,
            acquisition_date: str,
            acquisition_cost: float,
            disposal_date: str,
            disposal_proceeds: float,
            incidental_costs: float = 0,
            disposal_costs: float = 0,
            carried_forward_losses: float = 0,
            asset_type: str = "other",
        ) -> dict:
            """
            Calculate capital gain with 50% discount and loss offsets.

            Args:
                acquisition_date: Date acquired (YYYY-MM-DD)
                acquisition_cost: Purchase price in dollars
                disposal_date: Date sold (YYYY-MM-DD)
                disposal_proceeds: Sale price in dollars
                incidental_costs: Brokerage, legal, stamp duty in dollars
                disposal_costs: Selling costs in dollars
                carried_forward_losses: Prior year losses in dollars
                asset_type: 'shares', 'property', 'crypto', 'collectables', 'other'
            """
            calculator = CGTCalculator()

            result = calculator.calculate_disposal(
                acquisition_date=acquisition_date,
                acquisition_cost_cents=round(acquisition_cost * 100),
                incidental_costs_cents=round(incidental_costs * 100),
                disposal_date=disposal_date,
                disposal_proceeds_cents=round(disposal_proceeds * 100),
                disposal_costs_cents=round(disposal_costs * 100),
                asset_type=asset_type,
            )

            # Apply carried forward losses
            gross_gain = result["capital_gain_gross_cents"]
            losses_used = 0
            if gross_gain > 0 and carried_forward_losses > 0:
                losses_used = min(gross_gain, round(carried_forward_losses * 100))
                gross_gain -= losses_used

            # Recalculate discount
            if result["discount_eligible"] and gross_gain > 0:
                discount = round(gross_gain * 0.50)
                net_gain = gross_gain - discount
            else:
                discount = result["discount_amount_cents"]
                net_gain = result["capital_gain_net_cents"]

            return {
                "cost_base": result["cost_base_cents"] / 100,
                "capital_proceeds": result["capital_proceeds_cents"] / 100,
                "capital_gain_gross": result["capital_gain_gross_cents"] / 100,
                "carried_forward_losses_used": losses_used / 100,
                "gain_after_losses": gross_gain / 100,
                "discount_eligible": result["discount_eligible"],
                "discount_amount": discount / 100,
                "capital_gain_net": net_gain / 100,
                "capital_loss": result["capital_loss_cents"] / 100,
                "holding_period_days": result["holding_period_days"],
                "holding_period_months": result["holding_period_months"],
                "tax_year": result["tax_year"],
                "note": "50% CGT discount applied" if result["discount_eligible"] and gross_gain > 0 else "No discount - held less than 12 months" if not result["discount_eligible"] else "Capital loss",
            }

        @agent.tool
        async def calculate_depreciation(
            ctx: AgentContext,
            purchase_cost: float,
            purchase_date: str,
            effective_life: float,
            method: str = "diminishing",
            business_use: float = 100,
            asset_category: str = "other",
        ) -> dict:
            """
            Calculate depreciation using diminishing value or prime cost method.

            Args:
                purchase_cost: Asset cost in dollars
                purchase_date: Purchase date (YYYY-MM-DD)
                effective_life: ATO effective life in years
                method: 'diminishing' or 'prime_cost'
                business_use: Business use percentage (0-100)
                asset_category: 'computer', 'furniture', 'vehicle', etc.
            """
            result = quick_depreciation(
                purchase_cost=purchase_cost,
                effective_life_years=effective_life,
                method=method,
                business_use_percent=business_use,
            )

            return {
                "purchase_cost": purchase_cost,
                "effective_life_years": effective_life,
                "method": result["method"],
                "first_year_depreciation": result["depreciation"],
                "first_year_deductible": result["deductible"],
                "closing_value": result["closing_value"],
                "annual_rate_percent": result.get("annual_rate", 100 / effective_life),
                "business_use_percent": business_use,
                "note": result["note"],
                "instant_write_off_threshold": INSTANT_WRITE_OFF_THRESHOLD / 100,
            }

        @agent.tool
        async def compare_depreciation_methods(
            ctx: AgentContext,
            purchase_cost: float,
            effective_life: float,
            business_use: float = 100,
            years: int = 5,
        ) -> dict:
            """
            Compare diminishing value vs prime cost depreciation.

            Args:
                purchase_cost: Asset cost in dollars
                effective_life: Effective life in years
                business_use: Business use percentage
                years: Years to compare
            """
            result = compare_depreciation_methods(
                purchase_cost_cents=round(purchase_cost * 100),
                effective_life_years=effective_life,
                business_use_percentage=business_use,
                years_to_compare=years,
            )

            return {
                "purchase_cost": result["purchase_cost"],
                "effective_life_years": result["effective_life_years"],
                "business_use_percent": result["business_use_percentage"],
                "diminishing_value": result["diminishing_value"],
                "prime_cost": result["prime_cost"],
                "summary": result["summary"],
            }

        @agent.tool
        async def identify_deductible_expenses(ctx: AgentContext) -> dict:
            """Identify potentially tax-deductible expenses from transactions."""
            DEDUCTION_KEYWORDS = {
                "work_from_home": ["office", "desk", "chair", "monitor", "keyboard", "stationery"],
                "professional": ["subscription", "membership", "professional", "license", "registration"],
                "education": ["course", "training", "seminar", "conference", "textbook"],
                "travel": ["uber", "taxi", "parking", "toll", "fuel", "petrol"],
                "clothing": ["uniform", "laundry", "dry clean", "workwear"],
                "tools": ["tools", "equipment", "software", "computer", "laptop", "phone"],
                "internet_phone": ["internet", "mobile", "phone plan", "telstra", "optus"],
            }

            deductions = {cat: [] for cat in DEDUCTION_KEYWORDS}

            for tx in ctx.transactions:
                if tx.get("amount", 0) >= 0:  # Skip income
                    continue

                desc = tx.get("description", "").lower()
                amount = abs(tx.get("amount", 0)) / 100

                for category, keywords in DEDUCTION_KEYWORDS.items():
                    if any(kw in desc for kw in keywords):
                        deductions[category].append({
                            "description": tx.get("description"),
                            "amount": amount,
                            "date": tx.get("date"),
                        })
                        break

            # Calculate totals
            summary = {}
            total_deductions = 0
            for cat, items in deductions.items():
                cat_total = sum(item["amount"] for item in items)
                summary[cat] = {
                    "count": len(items),
                    "total": round(cat_total, 2),
                    "items": items[:5],  # First 5 items as examples
                }
                total_deductions += cat_total

            return {
                "deduction_categories": summary,
                "total_potential_deductions": round(total_deductions, 2),
                "note": "Review items - not all may be fully deductible. Keep receipts!",
            }

        @agent.tool
        async def generate_tax_summary(
            ctx: AgentContext,
            tax_year: str = "2024-25",
            gross_income: Optional[float] = None,
            tax_withheld: Optional[float] = None,
        ) -> dict:
            """
            Generate complete tax year summary from transaction data.

            Args:
                tax_year: Financial year
                gross_income: Override gross income if known
                tax_withheld: PAYG withheld from salary
            """
            # Calculate from transactions if not provided
            if gross_income is None and ctx.transactions:
                gross_income = sum(
                    tx.get("amount", 0) for tx in ctx.transactions
                    if tx.get("amount", 0) > 0 and not tx.get("isTransfer", False)
                ) / 100

            # Identify deductions
            deductions_result = await identify_deductible_expenses(ctx)
            total_deductions = deductions_result.get("total_potential_deductions", 0)

            # Calculate tax
            tax_result = await calculate_tax_full(
                ctx,
                gross_income=gross_income or 0,
                deductions=total_deductions,
                tax_year=tax_year,
            )

            # Calculate refund/payable
            refund = 0
            payable = 0
            if tax_withheld:
                difference = tax_withheld - tax_result["total_tax"]
                if difference > 0:
                    refund = difference
                else:
                    payable = abs(difference)

            return {
                "tax_year": tax_year,
                "income": {
                    "gross_income": gross_income or 0,
                    "source": "calculated from transactions" if gross_income else "not provided",
                },
                "deductions": {
                    "total": total_deductions,
                    "breakdown": deductions_result.get("deduction_categories", {}),
                },
                "tax_calculation": tax_result,
                "withholding": {
                    "tax_withheld": tax_withheld or 0,
                    "estimated_refund": round(refund, 2),
                    "estimated_payable": round(payable, 2),
                },
                "recommendations": [
                    "Review all potential deductions and ensure you have supporting records",
                    "Consider WFH deduction if working from home",
                    "Check if any capital gains/losses apply",
                    "Review depreciation on any work-related assets",
                ],
            }

        @agent.tool
        async def get_tax_brackets(
            ctx: AgentContext,
            tax_year: str = "2024-25",
            entity_type: str = "individual",
        ) -> dict:
            """
            Get tax brackets for a specific year and entity type.

            Args:
                tax_year: Financial year
                entity_type: 'individual', 'company', etc.
            """
            entity = EntityType(entity_type) if entity_type in [e.value for e in EntityType] else EntityType.INDIVIDUAL
            brackets = get_tax_brackets(tax_year, entity)

            return {
                "tax_year": tax_year,
                "entity_type": entity.value,
                "brackets": [
                    {
                        "threshold_min": b.threshold_min / 100,
                        "threshold_max": b.threshold_max / 100 if b.threshold_max else None,
                        "rate_percent": b.rate * 100,
                        "base_tax": b.base_tax / 100,
                    }
                    for b in brackets
                ],
                "medicare_levy_rate": 2.0,
                "medicare_surcharge_note": "1-1.5% if no private health and income > $93,000",
            }

        @agent.tool
        async def get_deduction_rates(
            ctx: AgentContext,
            tax_year: str = "2024-25",
        ) -> dict:
            """Get current deduction rates and thresholds."""
            rates = get_deduction_rates(tax_year)

            return {
                "tax_year": tax_year,
                "work_from_home": {
                    "fixed_rate_per_hour": rates.wfh_hourly_rate / 100,
                    "covers": "electricity, phone, internet, stationery",
                    "record_keeping": "Must keep timesheet of hours worked from home",
                },
                "motor_vehicle": {
                    "cents_per_km": rates.motor_vehicle_cents_per_km,
                    "max_km": rates.motor_vehicle_max_km,
                    "max_deduction": rates.motor_vehicle_cents_per_km * rates.motor_vehicle_max_km / 100,
                    "logbook_alternative": "Can use logbook method for higher amounts",
                },
                "instant_asset_write_off": {
                    "threshold": rates.instant_asset_writeoff_threshold / 100,
                    "note": f"Assets under ${rates.instant_asset_writeoff_threshold/100:,.0f} can be immediately deducted",
                },
                "laundry": {
                    "no_records_max": rates.laundry_no_records_max / 100,
                    "note": "Up to $150 without written evidence",
                },
                "gifts_donations": {
                    "no_records_max": rates.gifts_no_records_max / 100,
                    "note": "Up to $10 without receipt",
                },
            }

        @agent.tool
        async def estimate_tax_refund(
            ctx: AgentContext,
            gross_income: float,
            tax_withheld: float,
            additional_deductions: float = 0
        ) -> dict:
            """
            Estimate potential tax refund based on income and deductions.

            Args:
                gross_income: Total gross income in dollars
                tax_withheld: Total PAYG withheld in dollars
                additional_deductions: Additional deductions in dollars
            """
            tax_result = await calculate_tax_full(
                ctx,
                gross_income=gross_income,
                deductions=additional_deductions,
            )

            refund = tax_withheld - tax_result["total_tax"]

            return {
                "gross_income": gross_income,
                "deductions": additional_deductions,
                "taxable_income": tax_result["taxable_income"],
                "tax_owed": tax_result["total_tax"],
                "tax_withheld": tax_withheld,
                "estimated_refund": round(refund, 2) if refund > 0 else 0,
                "amount_owing": round(abs(refund), 2) if refund < 0 else 0,
            }

        @agent.tool
        async def calculate_wfh_deduction(
            ctx: AgentContext,
            hours_per_week: float,
            weeks_worked: int = 48
        ) -> dict:
            """Calculate work from home deduction using fixed rate method."""
            # Fixed rate method: $0.67 per hour
            FIXED_RATE = 0.67

            total_hours = hours_per_week * weeks_worked
            deduction = total_hours * FIXED_RATE

            return {
                "method": "Fixed rate method (2024-25)",
                "rate_per_hour": FIXED_RATE,
                "hours_per_week": hours_per_week,
                "weeks_worked": weeks_worked,
                "total_hours": total_hours,
                "total_deduction": round(deduction, 2),
                "note": "Keep a record of hours worked from home",
            }
