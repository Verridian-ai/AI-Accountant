"""Reconciliation Agent for matching and validating transactions."""

from pydantic_ai import Agent
from datetime import datetime, timedelta

from .base import BaseAgent, AgentContext, AgentResponse


class ReconciliationAgent(BaseAgent):
    """Agent specialized in transaction reconciliation and validation."""
    
    agent_name = "reconciliation_agent"
    model_type = "fast"
    system_prompt = """You are an expert financial reconciliation AI assistant.

Your capabilities include:
- Matching transactions between accounts
- Identifying duplicate transactions
- Detecting missing or unreconciled items
- Validating statement balances
- Finding discrepancies in records

When reconciling:
1. Compare transactions by date, amount, and description
2. Allow for small timing differences (1-3 days)
3. Flag potential duplicates
4. Identify unmatched items
5. Verify opening and closing balances

Always provide:
- Summary of matched transactions
- List of unmatched items
- Potential duplicates found
- Balance verification results
- Recommendations for resolution
    
Note: Use 'search_transaction_memory' to find past resolutions for similar discrepancies."""

    def _register_tools(self, agent: Agent):
        """Register reconciliation-specific tools."""
        super()._register_tools(agent)
        
        @agent.tool
        async def find_duplicate_transactions(ctx: AgentContext) -> dict:
            """Find potential duplicate transactions."""
            if not ctx.transactions:
                return {"error": "No transactions to analyze"}
            
            duplicates = []
            seen = {}
            
            for tx in ctx.transactions:
                # Create a key based on amount and approximate date
                amount = tx.get("amount", 0)
                date = tx.get("date", "")
                desc = tx.get("description", "")[:20].lower()
                
                key = f"{amount}_{date}_{desc}"
                
                if key in seen:
                    duplicates.append({
                        "original": seen[key],
                        "duplicate": {
                            "id": tx.get("id"),
                            "date": date,
                            "description": tx.get("description"),
                            "amount": amount / 100,
                        },
                    })
                else:
                    seen[key] = {
                        "id": tx.get("id"),
                        "date": date,
                        "description": tx.get("description"),
                        "amount": amount / 100,
                    }
            
            return {
                "potential_duplicates": duplicates,
                "duplicate_count": len(duplicates),
                "total_duplicate_amount": sum(d["duplicate"]["amount"] for d in duplicates),
            }
        
        @agent.tool
        async def verify_statement_balance(
            ctx: AgentContext,
            opening_balance: float,
            closing_balance: float,
            statement_id: int = None
        ) -> dict:
            """Verify that transactions reconcile with statement balances."""
            if not ctx.transactions:
                return {"error": "No transactions to verify"}
            
            # Filter transactions for specific statement if provided
            transactions = ctx.transactions
            if statement_id:
                transactions = [
                    tx for tx in ctx.transactions
                    if tx.get("statementId") == statement_id
                ]
            
            # Calculate transaction total
            transaction_total = sum(tx.get("amount", 0) for tx in transactions) / 100
            
            # Expected closing balance
            expected_closing = opening_balance + transaction_total
            
            # Check for discrepancy
            discrepancy = round(closing_balance - expected_closing, 2)
            
            return {
                "opening_balance": opening_balance,
                "transaction_total": round(transaction_total, 2),
                "expected_closing": round(expected_closing, 2),
                "actual_closing": closing_balance,
                "discrepancy": discrepancy,
                "is_balanced": abs(discrepancy) < 0.01,
                "transaction_count": len(transactions),
            }
        
        @agent.tool
        async def find_unmatched_transactions(
            ctx: AgentContext,
            match_tolerance_days: int = 3,
            match_tolerance_amount: float = 0.01
        ) -> dict:
            """Find transactions that don't have matching counterparts."""
            if not ctx.transactions:
                return {"error": "No transactions to analyze"}
            
            # Separate income and expenses
            income = [tx for tx in ctx.transactions if tx.get("amount", 0) > 0]
            expenses = [tx for tx in ctx.transactions if tx.get("amount", 0) < 0]
            
            # Find potential matches (transfers between accounts)
            matched = []
            unmatched_income = []
            unmatched_expenses = []
            
            for inc in income:
                inc_amount = inc.get("amount", 0)
                inc_date = inc.get("date", "")
                found_match = False
                
                for exp in expenses:
                    exp_amount = abs(exp.get("amount", 0))
                    exp_date = exp.get("date", "")
                    
                    # Check if amounts match within tolerance
                    if abs(inc_amount - exp_amount) <= match_tolerance_amount * 100:
                        # Check if dates are within tolerance
                        try:
                            inc_dt = datetime.strptime(inc_date, "%Y-%m-%d")
                            exp_dt = datetime.strptime(exp_date, "%Y-%m-%d")
                            if abs((inc_dt - exp_dt).days) <= match_tolerance_days:
                                matched.append({
                                    "income": {
                                        "date": inc_date,
                                        "description": inc.get("description"),
                                        "amount": inc_amount / 100,
                                    },
                                    "expense": {
                                        "date": exp_date,
                                        "description": exp.get("description"),
                                        "amount": exp_amount / 100,
                                    },
                                })
                                found_match = True
                                break
                        except ValueError:
                            pass
                
                if not found_match:
                    unmatched_income.append({
                        "date": inc_date,
                        "description": inc.get("description"),
                        "amount": inc_amount / 100,
                    })
            
            return {
                "matched_transfers": matched,
                "matched_count": len(matched),
                "unmatched_income": unmatched_income[:20],  # Limit output
                "unmatched_income_count": len(unmatched_income),
                "total_transactions": len(ctx.transactions),
            }
        
        @agent.tool
        async def check_statement_continuity(ctx: AgentContext) -> dict:
            """Check for gaps or overlaps in statement coverage."""
            if not ctx.statements:
                return {"error": "No statement data available"}
            
            issues = []
            sorted_statements = sorted(
                ctx.statements,
                key=lambda s: s.get("periodStartDate", "") or ""
            )
            
            for i in range(len(sorted_statements) - 1):
                current = sorted_statements[i]
                next_stmt = sorted_statements[i + 1]
                
                current_end = current.get("periodEndDate")
                next_start = next_stmt.get("periodStartDate")
                
                if current_end and next_start:
                    try:
                        end_dt = datetime.strptime(current_end, "%Y-%m-%d")
                        start_dt = datetime.strptime(next_start, "%Y-%m-%d")
                        gap_days = (start_dt - end_dt).days
                        
                        if gap_days > 1:
                            issues.append({
                                "type": "gap",
                                "days": gap_days - 1,
                                "from": current_end,
                                "to": next_start,
                            })
                        elif gap_days < 1:
                            issues.append({
                                "type": "overlap",
                                "days": abs(gap_days) + 1,
                                "from": current_end,
                                "to": next_start,
                            })
                    except ValueError:
                        pass
            
            return {
                "statements_checked": len(sorted_statements),
                "issues_found": len(issues),
                "issues": issues,
                "is_continuous": len(issues) == 0,
            }

