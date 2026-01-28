"""Financial Analyst Agent for transaction analysis and insights."""

from pydantic_ai import Agent

from .base import BaseAgent, AgentContext, AgentResponse


class FinancialAnalystAgent(BaseAgent):
    """Agent specialized in financial analysis and insights."""
    
    agent_name = "financial_analyst"
    model_type = "reasoning"
    system_prompt = """You are an expert financial analyst AI assistant specializing in personal and business finance.

Your capabilities include:
- Analyzing transaction patterns and spending habits
- Identifying unusual or suspicious transactions
- Providing cash flow analysis and projections
- Calculating financial ratios and metrics
- Offering actionable insights for financial improvement

When analyzing data:
1. Always use the execute_python_code tool for precise calculations
2. Provide clear explanations of your findings
3. Include specific numbers and percentages
4. Suggest actionable recommendations

Format your response as a structured analysis with:
- Summary of findings
- Key metrics calculated
- Trends identified
- Recommendations

Always be accurate with numbers - use the code interpreter for all calculations.

CRITICAL: Use the 'search_transaction_memory' tool to find relevant historical context, past patterns, or similar transactions in the knowledge base before forming a conclusion."""

    def _register_tools(self, agent: Agent):
        """Register financial analysis specific tools."""
        # First register base tools
        super()._register_tools(agent)
        
        @agent.tool
        async def analyze_spending_patterns(ctx: AgentContext) -> dict:
            """Analyze spending patterns by category and time."""
            if not ctx.transactions:
                return {"error": "No transactions to analyze"}
            
            # Group by category
            categories = {}
            for tx in ctx.transactions:
                cat = tx.get("category", "Uncategorized")
                if cat not in categories:
                    categories[cat] = {"count": 0, "total": 0, "transactions": []}
                categories[cat]["count"] += 1
                categories[cat]["total"] += abs(tx.get("amount", 0))
            
            # Calculate percentages
            total_spending = sum(c["total"] for c in categories.values())
            for cat in categories:
                categories[cat]["percentage"] = (
                    round(categories[cat]["total"] / total_spending * 100, 2)
                    if total_spending > 0 else 0
                )
                categories[cat]["total"] = categories[cat]["total"] / 100  # Convert to dollars
            
            return {
                "categories": categories,
                "total_spending": total_spending / 100,
                "category_count": len(categories),
            }
        
        @agent.tool
        async def calculate_monthly_averages(ctx: AgentContext) -> dict:
            """Calculate monthly income and expense averages."""
            if not ctx.transactions:
                return {"error": "No transactions to analyze"}
            
            # Group by month
            months = {}
            for tx in ctx.transactions:
                date = tx.get("date", "")
                if len(date) >= 7:
                    month_key = date[:7]  # YYYY-MM
                    if month_key not in months:
                        months[month_key] = {"income": 0, "expenses": 0}
                    
                    amount = tx.get("amount", 0)
                    if amount > 0:
                        months[month_key]["income"] += amount
                    else:
                        months[month_key]["expenses"] += abs(amount)
            
            if not months:
                return {"error": "Could not parse transaction dates"}
            
            # Calculate averages
            num_months = len(months)
            total_income = sum(m["income"] for m in months.values())
            total_expenses = sum(m["expenses"] for m in months.values())
            
            return {
                "months_analyzed": num_months,
                "average_monthly_income": round(total_income / num_months / 100, 2),
                "average_monthly_expenses": round(total_expenses / num_months / 100, 2),
                "average_monthly_savings": round((total_income - total_expenses) / num_months / 100, 2),
                "monthly_breakdown": {
                    k: {"income": v["income"] / 100, "expenses": v["expenses"] / 100}
                    for k, v in sorted(months.items())
                },
            }
        
        @agent.tool
        async def identify_recurring_transactions(ctx: AgentContext) -> list[dict]:
            """Identify potentially recurring transactions (subscriptions, bills)."""
            if not ctx.transactions:
                return []
            
            # Group by description similarity and amount
            recurring = {}
            for tx in ctx.transactions:
                desc = tx.get("description", "").lower()[:30]  # First 30 chars
                amount = tx.get("amount", 0)
                key = f"{desc}_{amount}"
                
                if key not in recurring:
                    recurring[key] = {
                        "description": tx.get("description"),
                        "amount": amount / 100,
                        "occurrences": 0,
                        "dates": [],
                    }
                recurring[key]["occurrences"] += 1
                recurring[key]["dates"].append(tx.get("date"))
            
            # Filter to only those that occur multiple times
            return [
                v for v in recurring.values()
                if v["occurrences"] >= 2
            ]
        
        @agent.tool
        async def project_future_balance(
            ctx: AgentContext,
            months_ahead: int = 3,
            include_recurring: bool = True
        ) -> dict:
            """Project future account balance based on historical patterns."""
            if not ctx.accounts:
                return {"error": "No account data available"}
            
            current_balance = sum(a.get("balance", 0) for a in ctx.accounts) / 100
            
            # Calculate average monthly net flow
            months = {}
            for tx in ctx.transactions:
                date = tx.get("date", "")
                if len(date) >= 7:
                    month_key = date[:7]
                    if month_key not in months:
                        months[month_key] = 0
                    months[month_key] += tx.get("amount", 0)
            
            if not months:
                return {"current_balance": current_balance, "projection": "Insufficient data"}
            
            avg_monthly_flow = sum(months.values()) / len(months) / 100
            
            projections = []
            balance = current_balance
            for i in range(1, months_ahead + 1):
                balance += avg_monthly_flow
                projections.append({
                    "month": i,
                    "projected_balance": round(balance, 2),
                })
            
            return {
                "current_balance": current_balance,
                "average_monthly_flow": round(avg_monthly_flow, 2),
                "projections": projections,
            }

