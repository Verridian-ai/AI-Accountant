import os
import asyncio
import json
import sys
from uuid import UUID
from dotenv import load_dotenv

class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, UUID):
            return str(obj)
        return json.JSONEncoder.default(self, obj)

# Get absolute path to the directory containing this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Load environment variables from env.local
load_dotenv(dotenv_path = os.path.join(SCRIPT_DIR, "../../../env.local"))

# Configure Cognee to use OpenRouter via LiteLLM
api_key = os.getenv("VITE_OPENROUTER_API_KEY")

# Set ALL possible keys that Cognee/LiteLLM might look for
os.environ["OPENROUTER_API_KEY"] = api_key
os.environ["LLM_API_KEY"] = api_key
os.environ["OPENAI_API_KEY"] = api_key # Some parts of Cognee might still look for this
os.environ["LLM_API_BASE"] = "https://openrouter.ai/api/v1"
os.environ["OPENAI_API_BASE"] = "https://openrouter.ai/api/v1"

# Use openrouter prefix for the model
# Using gpt-4o for graph extraction as it is more robust with tool calling
os.environ["LLM_MODEL"] = "openrouter/openai/gpt-4o"

# Use local fastembed for embeddings to keep it local as requested
os.environ["EMBEDDING_PROVIDER"] = "fastembed" 
os.environ["EMBEDDING_MODEL"] = "BAAI/bge-small-en-v1.5"
os.environ["EMBEDDING_DIMENSIONS"] = "384" # Match the model's dimensions

# Tell LiteLLM/Cognee to use OpenRouter for these models
# LiteLLM handles the routing if the prefix 'openrouter/' is used

import cognee
from cognee.api.v1.search import search
from cognee.api.v1.add import add
from cognee.api.v1.cognify import cognify

async def add_data(data_list, dataset_name="bank_statements"):
    """Adds a list of transaction strings to Cognee's memory."""
    try:
        # Add data to Cognee
        await add(data_list, dataset_name)
        # Process and index the data
        await cognify()
        return {"status": "success", "message": f"Added {len(data_list)} items to {dataset_name}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

async def search_data(query, model):
    """Searches Cognee's memory for relevant information."""
    try:
        # Use openrouter prefix for LiteLLM
        os.environ["LLM_MODEL"] = f"openrouter/{model}"
        
        # Perform semantic search
        try:
            results = await search(query_text = query)
            return {"status": "success", "results": results}
        except Exception as search_error:
            if "DatabaseNotCreatedError" in str(search_error):
                return {"status": "success", "results": [], "message": "Database empty"}
            raise search_error
            
    except Exception as e:
        return {"status": "error", "message": str(e)}

async def main():
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "No command provided"}))
        return

    command = sys.argv[1]
    
    if command == "add":
        data = json.loads(sys.argv[2])
        dataset_name = sys.argv[3] if len(sys.argv) > 3 else "bank_statements"
        result = await add_data(data, dataset_name)
        print(json.dumps(result, cls = UUIDEncoder))
    
    elif command == "search":
        query = sys.argv[2]
        model = sys.argv[3] if len(sys.argv) > 3 else "google/gemini-3-flash-preview"
        result = await search_data(query, model)
        print(json.dumps(result, cls = UUIDEncoder))
        
    elif command == "prune":
        try:
            from cognee.api.v1.prune import prune
            await prune()
            print(json.dumps({"status": "success", "message": "Cognee database pruned"}, cls = UUIDEncoder))
        except Exception as e:
            print(json.dumps({"status": "error", "message": str(e)}, cls = UUIDEncoder))
    
    else:
        print(json.dumps({"status": "error", "message": f"Unknown command: {command}"}, cls = UUIDEncoder))

if __name__ == "__main__":
    asyncio.run(main())
