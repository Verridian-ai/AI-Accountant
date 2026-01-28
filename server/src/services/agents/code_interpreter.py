"""Sandboxed code interpreter for executing Python code safely."""

import ast
import sys
import io
import traceback
from typing import Any
from contextlib import redirect_stdout, redirect_stderr
from datetime import datetime
import math
import statistics
from decimal import Decimal, ROUND_HALF_UP

from .config import CODE_INTERPRETER_TIMEOUT, CODE_INTERPRETER_MAX_MEMORY


# Safe built-in functions allowed in the sandbox
SAFE_BUILTINS = {
    'abs': abs,
    'all': all,
    'any': any,
    'bool': bool,
    'dict': dict,
    'enumerate': enumerate,
    'filter': filter,
    'float': float,
    'format': format,
    'frozenset': frozenset,
    'int': int,
    'isinstance': isinstance,
    'len': len,
    'list': list,
    'map': map,
    'max': max,
    'min': min,
    'pow': pow,
    'print': print,
    'range': range,
    'reversed': reversed,
    'round': round,
    'set': set,
    'sorted': sorted,
    'str': str,
    'sum': sum,
    'tuple': tuple,
    'zip': zip,
    'Decimal': Decimal,
    'ROUND_HALF_UP': ROUND_HALF_UP,
}

# Safe modules that can be imported
SAFE_MODULES = {
    'math': math,
    'statistics': statistics,
    'datetime': datetime,
    'decimal': __import__('decimal'),
}


class CodeInterpreterResult:
    """Result of code execution."""
    
    def __init__(
        self,
        success: bool,
        output: str = "",
        result: Any = None,
        error: str = None,
        execution_time_ms: float = 0,
    ):
        self.success = success
        self.output = output
        self.result = result
        self.error = error
        self.execution_time_ms = execution_time_ms
    
    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "output": self.output,
            "result": self.result,
            "error": self.error,
            "execution_time_ms": self.execution_time_ms,
        }


class CodeInterpreter:
    """Sandboxed Python code interpreter for financial calculations."""
    
    def __init__(self):
        self.timeout = CODE_INTERPRETER_TIMEOUT
        self.max_memory = CODE_INTERPRETER_MAX_MEMORY
    
    def _validate_code(self, code: str) -> tuple[bool, str]:
        """Validate code for safety before execution."""
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return False, f"Syntax error: {e}"
        
        # Check for dangerous operations
        dangerous_nodes = (
            ast.Import,
            ast.ImportFrom,
        )
        
        for node in ast.walk(tree):
            # Allow only safe imports
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name not in SAFE_MODULES:
                        return False, f"Import of '{alias.name}' is not allowed"
            
            if isinstance(node, ast.ImportFrom):
                if node.module not in SAFE_MODULES:
                    return False, f"Import from '{node.module}' is not allowed"
            
            # Block dangerous attribute access
            if isinstance(node, ast.Attribute):
                if node.attr.startswith('_'):
                    return False, f"Access to private attribute '{node.attr}' is not allowed"
            
            # Block exec/eval calls
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    if node.func.id in ('exec', 'eval', 'compile', 'open', '__import__'):
                        return False, f"Call to '{node.func.id}' is not allowed"
        
        return True, ""
    
    def execute(self, code: str, context: dict = None) -> CodeInterpreterResult:
        """Execute Python code in a sandboxed environment."""
        import time
        start_time = time.time()
        
        # Validate code first
        is_valid, error_msg = self._validate_code(code)
        if not is_valid:
            return CodeInterpreterResult(
                success=False,
                error=error_msg,
                execution_time_ms=(time.time() - start_time) * 1000,
            )
        
        # Prepare sandbox environment
        sandbox_globals = {
            '__builtins__': SAFE_BUILTINS,
            **SAFE_MODULES,
        }
        
        # Add context variables if provided
        if context:
            sandbox_globals.update(context)
        
        # Capture stdout/stderr
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()
        
        result = None
        error = None
        
        try:
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                # Execute the code
                exec(compile(code, '<sandbox>', 'exec'), sandbox_globals)
                
                # Try to get the result variable if it exists
                if 'result' in sandbox_globals:
                    result = sandbox_globals['result']
        
        except Exception as e:
            error = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
        
        execution_time = (time.time() - start_time) * 1000
        output = stdout_capture.getvalue()
        
        if stderr_capture.getvalue():
            output += f"\nStderr: {stderr_capture.getvalue()}"
        
        return CodeInterpreterResult(
            success=error is None,
            output=output,
            result=result,
            error=error,
            execution_time_ms=execution_time,
        )

