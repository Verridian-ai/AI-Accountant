"""Observability and tracing setup using Logfire for Pydantic AI agents."""

import os
import functools
import time
from typing import Any, Callable, TypeVar
from datetime import datetime
import json

# Try to import logfire, but make it optional
try:
    import logfire
    LOGFIRE_AVAILABLE = True
except ImportError:
    LOGFIRE_AVAILABLE = False

from .config import LOGFIRE_TOKEN, LOGFIRE_PROJECT

# Type variable for generic function decoration
F = TypeVar('F', bound=Callable[..., Any])


def init_observability():
    """Initialize Logfire observability if token is available."""
    if LOGFIRE_AVAILABLE and LOGFIRE_TOKEN:
        logfire.configure(
            token=LOGFIRE_TOKEN,
            service_name=LOGFIRE_PROJECT,
            send_to_logfire=True,
        )
        # Instrument Pydantic AI
        logfire.instrument_pydantic_ai()
        return True
    return False


class AgentTracer:
    """Tracer for agent operations with structured logging."""
    
    def __init__(self, agent_name: str):
        self.agent_name = agent_name
        self.traces: list[dict] = []
    
    def trace_start(self, operation: str, **kwargs) -> str:
        """Start a trace for an operation."""
        trace_id = f"{self.agent_name}_{operation}_{int(time.time() * 1000)}"
        trace = {
            "trace_id": trace_id,
            "agent": self.agent_name,
            "operation": operation,
            "start_time": datetime.utcnow().isoformat(),
            "status": "started",
            "metadata": kwargs,
        }
        self.traces.append(trace)
        
        if LOGFIRE_AVAILABLE and LOGFIRE_TOKEN:
            logfire.info(f"Agent {self.agent_name} started {operation}", **kwargs)
        
        return trace_id
    
    def trace_step(self, trace_id: str, step: str, **kwargs):
        """Record a step within a trace."""
        step_data = {
            "trace_id": trace_id,
            "step": step,
            "timestamp": datetime.utcnow().isoformat(),
            **kwargs,
        }
        
        # Find and update the trace
        for trace in self.traces:
            if trace["trace_id"] == trace_id:
                if "steps" not in trace:
                    trace["steps"] = []
                trace["steps"].append(step_data)
                break
        
        if LOGFIRE_AVAILABLE and LOGFIRE_TOKEN:
            logfire.info(f"Agent {self.agent_name} step: {step}", **kwargs)
    
    def trace_tool_use(self, trace_id: str, tool_name: str, input_data: Any, output_data: Any = None):
        """Record tool usage within a trace."""
        self.trace_step(
            trace_id,
            f"tool:{tool_name}",
            tool_name=tool_name,
            input=str(input_data)[:500],  # Truncate for logging
            output=str(output_data)[:500] if output_data else None,
        )
    
    def trace_reasoning(self, trace_id: str, reasoning: str):
        """Record agent reasoning/thinking."""
        self.trace_step(trace_id, "reasoning", thought=reasoning[:1000])
    
    def trace_end(self, trace_id: str, result: Any = None, error: str = None):
        """End a trace with result or error."""
        for trace in self.traces:
            if trace["trace_id"] == trace_id:
                trace["end_time"] = datetime.utcnow().isoformat()
                trace["status"] = "error" if error else "completed"
                if error:
                    trace["error"] = error
                if result:
                    trace["result_summary"] = str(result)[:500]
                break
        
        if LOGFIRE_AVAILABLE and LOGFIRE_TOKEN:
            if error:
                logfire.error(f"Agent {self.agent_name} failed", error=error)
            else:
                logfire.info(f"Agent {self.agent_name} completed")
    
    def get_trace(self, trace_id: str) -> dict | None:
        """Get a specific trace by ID."""
        for trace in self.traces:
            if trace["trace_id"] == trace_id:
                return trace
        return None
    
    def get_all_traces(self) -> list[dict]:
        """Get all traces for this agent."""
        return self.traces.copy()
    
    def export_traces(self) -> str:
        """Export all traces as JSON."""
        return json.dumps(self.traces, indent=2, default=str)


def trace_operation(operation_name: str = None):
    """Decorator to automatically trace agent operations."""
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def async_wrapper(self, *args, **kwargs):
            op_name = operation_name or func.__name__
            tracer = getattr(self, 'tracer', None)
            
            if tracer:
                trace_id = tracer.trace_start(op_name, args=str(args)[:200], kwargs=str(kwargs)[:200])
                try:
                    result = await func(self, *args, **kwargs)
                    tracer.trace_end(trace_id, result=result)
                    return result
                except Exception as e:
                    tracer.trace_end(trace_id, error=str(e))
                    raise
            else:
                return await func(self, *args, **kwargs)
        
        @functools.wraps(func)
        def sync_wrapper(self, *args, **kwargs):
            op_name = operation_name or func.__name__
            tracer = getattr(self, 'tracer', None)
            
            if tracer:
                trace_id = tracer.trace_start(op_name, args=str(args)[:200], kwargs=str(kwargs)[:200])
                try:
                    result = func(self, *args, **kwargs)
                    tracer.trace_end(trace_id, result=result)
                    return result
                except Exception as e:
                    tracer.trace_end(trace_id, error=str(e))
                    raise
            else:
                return func(self, *args, **kwargs)
        
        # Return appropriate wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator

