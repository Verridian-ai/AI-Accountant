"""Base agent class using Pydantic AI framework."""

import os
import sys
from typing import Any, Optional
from dataclasses import dataclass
from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel

from .config import OPENROUTER_API_KEY, OPENROUTER_BASE_URL, DEFAULT_MODELS
from .observability import AgentTracer, init_observability
from .code_interpreter import CodeInterpreter

# Add parent directory to path for RAG imports
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(SCRIPT_DIR))


# Initialize observability on module load
init_observability()


@dataclass
class AgentContext:
    """Context passed to agent tools containing transaction and account data."""
    transactions: list[dict] = None
    accounts: list[dict] = None
    statements: list[dict] = None
    date_range: tuple[str, str] = None
    user_query: str = ""
    
    def __post_init__(self):
        if self.transactions is None:
            self.transactions = []
        if self.accounts is None:
            self.accounts = []
        if self.statements is None:
            self.statements = []


class AgentResponse(BaseModel):
    """Standard response from an agent."""
    success: bool
    message: str
    data: Optional[dict] = None
    reasoning: Optional[str] = None
    code_executed: Optional[str] = None
    code_result: Optional[Any] = None


class BaseAgent:
    """Base class for all Pydantic AI agents."""
    
    agent_name: str = "base_agent"
    system_prompt: str = "You are a helpful financial assistant."
    model_type: str = "fast"  # Options: reasoning, fast, vision, code
    
    def __init__(self):
        self.tracer = AgentTracer(self.agent_name)
        self.code_interpreter = CodeInterpreter()
        self._agent = self._create_agent()
    
    def _get_model(self) -> OpenAIModel:
        """Get the OpenAI-compatible model for this agent."""
        model_name = DEFAULT_MODELS.get(self.model_type, DEFAULT_MODELS["fast"])
        
        # Remove 'openrouter/' prefix for the model name since we're using base_url
        if model_name.startswith("openrouter/"):
            model_name = model_name[len("openrouter/"):]
        
        return OpenAIModel(
            model_name,
            api_key=OPENROUTER_API_KEY,
            base_url=OPENROUTER_BASE_URL,
        )
    
    def _create_agent(self) -> Agent:
        """Create the Pydantic AI agent with tools."""
        agent = Agent(
            model=self._get_model(),
            system_prompt=self.system_prompt,
            deps_type=AgentContext,
            result_type=AgentResponse,
        )
        
        # Register common tools
        self._register_tools(agent)
        
        return agent
    
    def _register_tools(self, agent: Agent):
        """Register tools with the agent. Override in subclasses to add specific tools."""
        
        @agent.tool
        async def execute_python_code(ctx: AgentContext, code: str) -> dict:
            """Execute Python code for calculations. Use 'result' variable to return values."""
            # Add transaction data to context
            code_context = {
                'transactions': ctx.transactions,
                'accounts': ctx.accounts,
            }
            result = self.code_interpreter.execute(code, code_context)
            return result.to_dict()
        
        @agent.tool
        async def get_transaction_summary(ctx: AgentContext) -> dict:
            """Get a summary of transactions in the context."""
            if not ctx.transactions:
                return {"error": "No transactions available"}
            
            total_income = sum(t.get('amount', 0) for t in ctx.transactions if t.get('amount', 0) > 0)
            total_expenses = sum(abs(t.get('amount', 0)) for t in ctx.transactions if t.get('amount', 0) < 0)
            
            return {
                "transaction_count": len(ctx.transactions),
                "total_income": total_income / 100,  # Convert from cents
                "total_expenses": total_expenses / 100,
                "net_flow": (total_income - total_expenses) / 100,
                "date_range": ctx.date_range,
            }
        
        @agent.tool
        async def get_transactions_by_category(ctx: AgentContext, category: str) -> list[dict]:
            """Get transactions filtered by category."""
            return [
                {
                    "date": t.get("date"),
                    "description": t.get("description"),
                    "amount": t.get("amount", 0) / 100,
                    "category": t.get("category"),
                }
                for t in ctx.transactions
                if t.get("category", "").lower() == category.lower()
            ]
        
        @agent.tool
        async def get_account_balances(ctx: AgentContext) -> list[dict]:
            """Get current balances for all accounts."""
            return [
                {
                    "name": a.get("name"),
                    "type": a.get("type"),
                    "balance": a.get("balance", 0) / 100,
                    "credit_limit": a.get("creditLimit", 0) / 100 if a.get("creditLimit") else None,
                }
                for a in ctx.accounts
            ]

        @agent.tool
        async def search_transaction_memory(ctx: AgentContext, search_query: str) -> dict:
            """Search the RAG memory for relevant transaction information."""
            try:
                # Import RAG functions
                from rag import search_data
                result = await search_data(search_query, "google/gemini-3-flash-preview")
                return result
            except Exception as e:
                return {"status": "error", "message": f"RAG search failed: {str(e)}"}

    async def run(self, query: str, context: AgentContext = None) -> AgentResponse:
        """Run the agent with a query and optional context."""
        if context is None:
            context = AgentContext()
        
        context.user_query = query
        
        trace_id = self.tracer.trace_start("run", query=query[:200])
        
        try:
            result = await self._agent.run(query, deps=context)
            self.tracer.trace_end(trace_id, result=result.data)
            return result.data
        except Exception as e:
            self.tracer.trace_end(trace_id, error=str(e))
            return AgentResponse(
                success=False,
                message=f"Agent error: {str(e)}",
            )
    
    def get_traces(self) -> list[dict]:
        """Get all traces for this agent."""
        return self.tracer.get_all_traces()

