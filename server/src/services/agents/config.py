"""Configuration for Pydantic AI agents with OpenRouter and Logfire observability."""

import os
from dotenv import load_dotenv

# Get absolute path to the directory containing this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Load environment variables from env.local
load_dotenv(dotenv_path=os.path.join(SCRIPT_DIR, "../../../../env.local"))

# OpenRouter API configuration
OPENROUTER_API_KEY = os.getenv("VITE_OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# Default models for different agent types
DEFAULT_MODELS = {
    "reasoning": "openrouter/openai/o3-mini",  # For complex reasoning tasks
    "fast": "openrouter/google/gemini-3-flash-preview",  # For quick responses
    "vision": "openrouter/google/gemini-3-flash-preview",  # For image analysis
    "code": "openrouter/openai/gpt-4o",  # For code generation/interpretation
}

# Logfire configuration for observability
LOGFIRE_TOKEN = os.getenv("LOGFIRE_TOKEN", "")
LOGFIRE_PROJECT = os.getenv("LOGFIRE_PROJECT", "cba-statement-parser")

# Code interpreter settings
CODE_INTERPRETER_TIMEOUT = 30  # seconds
CODE_INTERPRETER_MAX_MEMORY = 256 * 1024 * 1024  # 256MB

# Agent retry settings
MAX_RETRIES = 3
RETRY_DELAY = 1.0  # seconds

