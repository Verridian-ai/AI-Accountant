"""Agent runner script - entry point for Node.js to call Python agents."""

import os
import sys
import json
import asyncio
from typing import Optional

# Add parent directory to path for imports
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(SCRIPT_DIR))

from agents.base import AgentContext, AgentResponse
from agents.financial_analyst import FinancialAnalystAgent
from agents.bas_agent import BASAgent
from agents.tax_agent import TaxAgent
from agents.reconciliation_agent import ReconciliationAgent
from agents.code_interpreter import CodeInterpreter


# Agent registry
AGENTS = {
    "financial_analyst": FinancialAnalystAgent,
    "bas": BASAgent,
    "tax": TaxAgent,
    "reconciliation": ReconciliationAgent,
}


async def run_agent(
    agent_type: str,
    query: str,
    transactions: list = None,
    accounts: list = None,
    statements: list = None,
) -> dict:
    """Run a specific agent with the given query and context."""
    
    if agent_type not in AGENTS:
        return {
            "success": False,
            "message": f"Unknown agent type: {agent_type}. Available: {list(AGENTS.keys())}",
        }
    
    # Create agent instance
    agent_class = AGENTS[agent_type]
    agent = agent_class()
    
    # Create context
    context = AgentContext(
        transactions=transactions or [],
        accounts=accounts or [],
        statements=statements or [],
    )
    
    # Run agent
    try:
        result = await agent.run(query, context)
        
        # Convert result to dict if it's a Pydantic model
        if hasattr(result, 'model_dump'):
            return result.model_dump()
        elif hasattr(result, 'dict'):
            return result.dict()
        else:
            return {
                "success": True,
                "message": str(result),
                "data": result if isinstance(result, dict) else None,
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Agent execution error: {str(e)}",
            "error": str(e),
        }


async def run_code(code: str, context: dict = None) -> dict:
    """Run Python code in the sandboxed interpreter."""
    interpreter = CodeInterpreter()
    result = interpreter.execute(code, context or {})
    return result.to_dict()


async def get_agent_info(agent_type: str = None) -> dict:
    """Get information about available agents."""
    if agent_type and agent_type in AGENTS:
        agent = AGENTS[agent_type]()
        return {
            "name": agent.agent_name,
            "model_type": agent.model_type,
            "system_prompt": agent.system_prompt[:500],
        }
    
    return {
        "available_agents": list(AGENTS.keys()),
        "descriptions": {
            "financial_analyst": "Analyzes spending patterns, cash flow, and provides financial insights",
            "bas": "Calculates GST and prepares Business Activity Statement data",
            "tax": "Calculates income tax, identifies deductions, estimates refunds",
            "reconciliation": "Matches transactions, finds duplicates, verifies balances",
        },
    }


async def main():
    """Main entry point for CLI usage."""
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "message": "Usage: runner.py <command> [args...]",
            "commands": ["run", "code", "info"],
        }))
        return
    
    command = sys.argv[1]
    
    try:
        if command == "run":
            # runner.py run <agent_type> <query_json>
            if len(sys.argv) < 4:
                print(json.dumps({
                    "success": False,
                    "message": "Usage: runner.py run <agent_type> <query_json>",
                }))
                return
            
            agent_type = sys.argv[2]
            data = json.loads(sys.argv[3])
            
            result = await run_agent(
                agent_type=agent_type,
                query=data.get("query", ""),
                transactions=data.get("transactions", []),
                accounts=data.get("accounts", []),
                statements=data.get("statements", []),
            )
            print(json.dumps(result, default=str))
        
        elif command == "code":
            # runner.py code <code_json>
            if len(sys.argv) < 3:
                print(json.dumps({
                    "success": False,
                    "message": "Usage: runner.py code <code_json>",
                }))
                return
            
            data = json.loads(sys.argv[2])
            result = await run_code(
                code=data.get("code", ""),
                context=data.get("context", {}),
            )
            print(json.dumps(result, default=str))
        
        elif command == "info":
            # runner.py info [agent_type]
            agent_type = sys.argv[2] if len(sys.argv) > 2 else None
            result = await get_agent_info(agent_type)
            print(json.dumps(result, default=str))
        
        else:
            print(json.dumps({
                "success": False,
                "message": f"Unknown command: {command}",
                "commands": ["run", "code", "info"],
            }))
    
    except json.JSONDecodeError as e:
        print(json.dumps({
            "success": False,
            "message": f"Invalid JSON: {str(e)}",
        }))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "message": f"Error: {str(e)}",
            "error_type": type(e).__name__,
        }))


if __name__ == "__main__":
    asyncio.run(main())

