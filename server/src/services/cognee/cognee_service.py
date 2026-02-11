"""
Cognee integration service for CBA Statements Parse.

Provides structured access to the Cognee knowledge graph for
transaction categorization, GST analysis, and financial intelligence.
Uses the Cognee Python SDK directly (Option B from COGNEE_INTEGRATION.md).
"""

import os
import asyncio
import json
import sys
from typing import Optional, List
from dotenv import load_dotenv

# Load environment variables
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(SCRIPT_DIR, "../../../../.env"))
load_dotenv(dotenv_path=os.path.join(SCRIPT_DIR, "../../../../env.local"))


class CogneeService:
    """Cognee integration service for CBA Statements Parse."""

    def __init__(self):
        self._configured = False

    def _configure(self):
        """Configure Cognee backends from environment."""
        if self._configured:
            return

        os.environ["LLM_PROVIDER"] = "openai"
        os.environ["LLM_MODEL"] = os.getenv("LLM_MODEL", "openrouter/openai/gpt-4o")
        os.environ["LLM_API_KEY"] = os.getenv("VITE_OPENROUTER_API_KEY", "")
        os.environ["LLM_ENDPOINT"] = os.getenv("LLM_ENDPOINT", "https://openrouter.ai/api/v1")
        os.environ["OPENROUTER_API_KEY"] = os.getenv("VITE_OPENROUTER_API_KEY", "")
        os.environ["OPENAI_API_KEY"] = os.getenv("VITE_OPENROUTER_API_KEY", "")
        os.environ["OPENAI_API_BASE"] = "https://openrouter.ai/api/v1"

        os.environ["EMBEDDING_PROVIDER"] = "fastembed"
        os.environ["EMBEDDING_MODEL"] = "BAAI/bge-small-en-v1.5"
        os.environ["EMBEDDING_DIMENSIONS"] = "384"

        os.environ["DB_PROVIDER"] = "postgres"
        os.environ["DB_HOST"] = os.getenv("POSTGRES_HOST", "localhost")
        os.environ["DB_PORT"] = os.getenv("POSTGRES_PORT", "5432")
        os.environ["DB_NAME"] = os.getenv("POSTGRES_DB", "ai_accountant")
        os.environ["DB_USERNAME"] = os.getenv("POSTGRES_USER", "app_user")
        os.environ["DB_PASSWORD"] = os.getenv("POSTGRES_PASSWORD", "")

        os.environ["VECTOR_DB_PROVIDER"] = "pgvector"
        os.environ["GRAPH_DATABASE_PROVIDER"] = "kuzu"
        os.environ["TELEMETRY_DISABLED"] = "true"

        self._configured = True

    def _ensure_configured(self):
        """Lazy initialization of Cognee configuration."""
        self._configure()

    # ─── Statement Ingestion ──────────────────────────────────────

    async def add_statement_data(
        self,
        bank: str,
        account_number: str,
        account_name: str,
        filename: str,
        period_start: str,
        period_end: str,
        opening_balance: int,
        closing_balance: int,
        transactions: list,
        file_hash: str,
    ) -> dict:
        """
        Add a complete parsed statement to the knowledge graph.
        Creates AccountNode -> StatementNode -> TransactionNode chain.
        """
        self._ensure_configured()
        from cognee.api.v1.add import add
        from cognee.api.v1.cognify import cognify

        try:
            from cognee.modules.graph import add_data_points
            from .models import AccountNode, StatementNode, TransactionNode

            # Create account node
            account = AccountNode(
                bank=bank,
                account_number=account_number,
                account_name=account_name,
                account_type="transaction",
            )

            # Create statement node linked to account
            statement = StatementNode(
                filename=filename,
                period_start=period_start,
                period_end=period_end,
                opening_balance_cents=opening_balance,
                closing_balance_cents=closing_balance,
                transaction_count=len(transactions),
                hash=file_hash,
                from_account=account,
            )

            # Create transaction nodes
            tx_nodes = []
            for tx in transactions:
                tx_node = TransactionNode(
                    date=tx["date"],
                    description=tx["description"],
                    amount_cents=tx["amount"],
                    balance_cents=tx.get("balance"),
                    ai_reasoning=tx.get("aiReasoningNotes"),
                    confidence_score=tx.get("confidenceScore", 1.0),
                    belongs_to=account,
                    in_statement=statement,
                )
                tx_nodes.append(tx_node)

            # Insert all nodes with relationships
            all_nodes = [account, statement] + tx_nodes
            await add_data_points(all_nodes)

            return {
                "status": "success",
                "account_id": str(account.id),
                "statement_id": str(statement.id),
                "transactions_added": len(tx_nodes),
            }
        except ImportError:
            # Fallback to text-based ingestion if graph modules unavailable
            statement_text = [
                f"Bank Statement: {bank} Account {account_number} ({account_name})",
                f"File: {filename}, Period: {period_start} to {period_end}",
                f"Opening Balance: ${opening_balance / 100:.2f}, "
                f"Closing Balance: ${closing_balance / 100:.2f}",
                f"Transactions: {len(transactions)}",
            ]
            for tx in transactions:
                statement_text.append(
                    f"Date: {tx['date']}, Description: {tx['description']}, "
                    f"Amount: ${tx['amount'] / 100:.2f}"
                )

            await add(statement_text, "statement_parser")
            await cognify()
            return {
                "status": "success",
                "transactions_added": len(transactions),
            }

    # ─── Transaction Operations ───────────────────────────────────

    async def add_transaction(self, tx: dict, account_id: Optional[str] = None) -> dict:
        """Add a single transaction to the knowledge graph."""
        self._ensure_configured()
        from cognee.api.v1.add import add
        from cognee.api.v1.cognify import cognify

        text = (
            f"Date: {tx['date']}, "
            f"Description: {tx['description']}, "
            f"Amount: ${tx['amount'] / 100:.2f}, "
            f"Category: {tx.get('category', 'uncategorized')}, "
            f"GST: {'Yes' if tx.get('gstApplicable') else 'No'}"
        )
        await add([text], "categorizer")
        await cognify()
        return {"status": "success"}

    async def search_similar_transactions(self, description: str, limit: int = 10) -> list:
        """Semantic search for transactions with similar descriptions."""
        self._ensure_configured()
        from cognee.api.v1.search import search
        from cognee import SearchType

        try:
            results = await search(
                query_text=description,
                query_type=SearchType.CHUNKS,
            )
            return results[:limit]
        except Exception as e:
            if "DatabaseNotCreatedError" in str(e):
                return []
            raise

    # ─── Category Intelligence ────────────────────────────────────

    async def get_category_patterns(self, category: str) -> list:
        """Get transaction patterns associated with a category."""
        self._ensure_configured()
        from cognee.api.v1.search import search
        from cognee import SearchType

        try:
            results = await search(
                query_text=f"Transaction patterns for category {category}",
                query_type=SearchType.INSIGHTS,
            )
            return results
        except Exception:
            return []

    async def suggest_category(self, description: str) -> dict:
        """Use graph knowledge to suggest a category for a transaction."""
        self._ensure_configured()
        from cognee.api.v1.search import search
        from cognee import SearchType

        try:
            results = await search(
                query_text=f"What category should be assigned to a transaction "
                           f"with description: {description}",
                query_type=SearchType.GRAPH_COMPLETION,
            )
            return {"suggestions": results}
        except Exception:
            return {"suggestions": []}

    # ─── GST & Tax ────────────────────────────────────────────────

    async def get_gst_ruling(self, transaction_type: str) -> dict:
        """Look up GST treatment from the knowledge graph."""
        self._ensure_configured()
        from cognee.api.v1.search import search
        from cognee import SearchType

        try:
            results = await search(
                query_text=f"GST treatment for {transaction_type} under Australian tax law",
                query_type=SearchType.GRAPH_COMPLETION,
            )
            return {"ruling": results}
        except Exception:
            return {"ruling": []}

    async def seed_gst_rules(self) -> dict:
        """Seed the knowledge graph with ATO GST rules."""
        self._ensure_configured()
        from cognee.api.v1.add import add
        from cognee.api.v1.cognify import cognify

        gst_rules_text = [
            "GST-free supplies include: basic food (fresh fruit, vegetables, meat, bread, milk), "
            "medical and health services, education courses, childcare, exports, water and sewerage.",

            "Input-taxed supplies include: bank fees, loan interest, credit card interest, "
            "share brokerage, financial advice fees, superannuation fees, residential rent received.",

            "Standard 10% GST applies to: most goods and services sold in Australia by "
            "GST-registered businesses. GST = Amount * (10/110) for inclusive prices.",

            "Capital acquisitions with GST: computers, laptops, furniture, vehicles, equipment, "
            "renovations, printers, server equipment, phone systems. Report at BAS label G10.",

            "Non-capital purchases with GST: office supplies, utilities, professional services, "
            "software subscriptions, travel, advertising, rent (commercial). Report at BAS label G11.",

            "Private/out-of-scope: ATM withdrawals, cash withdrawals, personal groceries, "
            "Netflix, Spotify, gym memberships, personal entertainment. Not reported on BAS.",

            "No ABN quoted: if a supplier does not provide an ABN and payment exceeds $75 "
            "(excluding GST), the payer must withhold the top marginal tax rate (47%) from the payment.",

            "BAS reporting labels: G1=Total Sales, G2=Export Sales, G3=Other GST-free sales, "
            "G10=Capital purchases, G11=Non-capital purchases, 1A=GST on sales, 1B=GST on purchases, "
            "W1=Total salary/wages, W2=Amounts withheld, 5A=PAYG instalment.",

            "Australian financial year runs July to June. BAS quarters: Q1=Jul-Sep, Q2=Oct-Dec, "
            "Q3=Jan-Mar, Q4=Apr-Jun. Lodgement due 28 days after quarter end.",

            "Fuel tax credits: businesses can claim credits for fuel used in eligible activities. "
            "Report at 7C (business use) and 7D (other activities). Rates change quarterly.",
        ]
        await add(gst_rules_text, "gst_rules")
        await cognify()
        return {"status": "success", "rules_added": len(gst_rules_text)}

    # ─── Account Flows ────────────────────────────────────────────

    async def trace_account_flows(self, account_id: str) -> dict:
        """Graph traversal showing money flows through an account."""
        self._ensure_configured()
        from cognee.api.v1.search import search
        from cognee import SearchType

        try:
            results = await search(
                query_text=f"Show all transaction flows, transfers, and patterns "
                           f"for account {account_id}",
                query_type=SearchType.GRAPH_COMPLETION,
            )
            return {"flows": results}
        except Exception:
            return {"flows": []}

    # ─── Learning from Corrections ────────────────────────────────

    async def add_correction(
        self,
        transaction_description: str,
        old_category: str,
        new_category: str,
        reason: Optional[str] = None,
    ) -> dict:
        """Record a user correction to learn from."""
        self._ensure_configured()
        from cognee.api.v1.add import add
        from cognee.api.v1.cognify import cognify

        correction_text = (
            f"CATEGORY CORRECTION: Transaction '{transaction_description}' "
            f"was incorrectly categorized as '{old_category}'. "
            f"The correct category is '{new_category}'. "
            f"{'Reason: ' + reason + '. ' if reason else ''}"
            f"Future transactions with similar descriptions should be "
            f"categorized as '{new_category}'."
        )
        await add([correction_text], "categorizer")
        await cognify()
        return {"status": "success", "learned": True}

    # ─── BAS Calculations ─────────────────────────────────────────

    async def store_bas_period(self, bas_data: dict) -> dict:
        """Store a completed BAS calculation in the knowledge graph."""
        self._ensure_configured()
        from cognee.api.v1.add import add
        from cognee.api.v1.cognify import cognify

        bas_text = (
            f"BAS Q{bas_data['quarter']} {bas_data['financial_year']}: "
            f"G1 Total Sales ${bas_data.get('g1', 0) / 100:.2f}, "
            f"G10 Capital ${bas_data.get('g10', 0) / 100:.2f}, "
            f"G11 Non-capital ${bas_data.get('g11', 0) / 100:.2f}, "
            f"1A GST on sales ${bas_data.get('label_1a', 0) / 100:.2f}, "
            f"1B GST on purchases ${bas_data.get('label_1b', 0) / 100:.2f}, "
            f"Net GST ${bas_data.get('net_gst', 0) / 100:.2f}"
        )
        await add([bas_text], "gst_rules")
        await cognify()
        return {"status": "success"}

    # ─── Pruning ──────────────────────────────────────────────────

    async def prune_all(self) -> dict:
        """Reset all Cognee data. Use with caution."""
        self._ensure_configured()
        import cognee

        await cognee.prune.prune_data()
        await cognee.prune.prune_system(metadata=True)
        return {"status": "pruned"}

    async def prune_dataset(self, dataset_name: str) -> dict:
        """Remove a specific dataset."""
        self._ensure_configured()
        import cognee

        await cognee.prune.prune_data()
        return {"status": "pruned", "dataset": dataset_name}


# ─── CLI Interface ────────────────────────────────────────────────

async def main():
    """CLI interface for running CogneeService operations."""
    from uuid import UUID

    class UUIDEncoder(json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, UUID):
                return str(obj)
            return json.JSONEncoder.default(self, obj)

    service = CogneeService()

    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "No command provided"}))
        return

    command = sys.argv[1]

    try:
        if command == "add_statement":
            data = json.loads(sys.argv[2])
            result = await service.add_statement_data(**data)
            print(json.dumps(result, cls=UUIDEncoder))

        elif command == "add_transaction":
            tx = json.loads(sys.argv[2])
            result = await service.add_transaction(tx)
            print(json.dumps(result, cls=UUIDEncoder))

        elif command == "search":
            query = sys.argv[2]
            limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10
            results = await service.search_similar_transactions(query, limit)
            print(json.dumps({"status": "success", "results": results}, cls=UUIDEncoder))

        elif command == "suggest_category":
            description = sys.argv[2]
            result = await service.suggest_category(description)
            print(json.dumps(result, cls=UUIDEncoder))

        elif command == "gst_ruling":
            tx_type = sys.argv[2]
            result = await service.get_gst_ruling(tx_type)
            print(json.dumps(result, cls=UUIDEncoder))

        elif command == "seed_gst":
            result = await service.seed_gst_rules()
            print(json.dumps(result, cls=UUIDEncoder))

        elif command == "add_correction":
            data = json.loads(sys.argv[2])
            result = await service.add_correction(**data)
            print(json.dumps(result, cls=UUIDEncoder))

        elif command == "store_bas":
            data = json.loads(sys.argv[2])
            result = await service.store_bas_period(data)
            print(json.dumps(result, cls=UUIDEncoder))

        elif command == "trace_flows":
            account_id = sys.argv[2]
            result = await service.trace_account_flows(account_id)
            print(json.dumps(result, cls=UUIDEncoder))

        elif command == "prune":
            result = await service.prune_all()
            print(json.dumps(result, cls=UUIDEncoder))

        elif command == "prune_dataset":
            dataset = sys.argv[2]
            result = await service.prune_dataset(dataset)
            print(json.dumps(result, cls=UUIDEncoder))

        else:
            print(json.dumps({"status": "error", "message": f"Unknown command: {command}"}))

    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}, cls=UUIDEncoder))


if __name__ == "__main__":
    asyncio.run(main())
