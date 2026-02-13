> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Google ADK

Give your [Google ADK](https://google.github.io/adk-docs/) agents cognee's memory. Store structured knowledge, retrieve via natural language, and maintain context across sessions - all through two async tools.

## Why Use This Integration

* **Advanced Memory Features**: Structured knowledge graphs with embeddings for multi-hop reasoning
* **Cross-Session Persistence**: Memory survives agent restarts and conversation threads
* **Semantic Search**: Natural language queries with graph traversal
* **Session Isolation**: Multi-tenant support with per-user data boundaries
* **Native ADK Tools**: Works as `LongRunningFunctionTool`—async-first, production-ready

## Installation

```bash  theme={null}
pip install cognee-integration-google-adk
```

## Quick Start

Before using the integration, configure your environment variables:

```bash  theme={null}
export GOOGLE_API_KEY="your-google-api-key-here"  # for Google ADK
export LLM_API_KEY="your-openai-api-key-here"     # for cognee
```

Add memory tools to your Google ADK agent:

```python  theme={null}
import asyncio
from google.adk.agents import Agent
from google.adk.runners import InMemoryRunner
from cognee_integration_google_adk import add_tool, search_tool

async def main():
    # Create agent with memory
    agent = Agent(
        model="gemini-2.0-flash",
        name="assistant",
        description="An assistant with persistent memory",
        instruction="You are a helpful assistant with access to a knowledge base.",
        tools=[add_tool, search_tool],
    )

    runner = InMemoryRunner(agent=agent)

    # Store information
    await runner.run_debug(
        "Remember: Acme Corp, healthcare, $1.2M contract"
    )

    # Retrieve information
    events = await runner.run_debug(
        "What healthcare contracts do we have?"
    )

    for event in events:
        if event.is_final_response() and event.content:
            for part in event.content.parts:
                if part.text:
                    print(part.text)

asyncio.run(main())
```

## Cross-Session Persistence

Memory persists across different agent instances:

```python  theme={null}
from cognee_integration_google_adk import get_sessionized_cognee_tools

# Session 1: Store information
add_tool, search_tool = get_sessionized_cognee_tools("user-123")

agent_1 = Agent(
    model="gemini-2.0-flash",
    name="assistant",
    description="Assistant with memory",
    instruction="You are a helpful assistant.",
    tools=[add_tool, search_tool],
)
runner_1 = InMemoryRunner(agent=agent_1)
await runner_1.run_debug("I'm working on authentication")

# Session 2: Different instance, same memory
add_tool, search_tool = get_sessionized_cognee_tools("user-123")

agent_2 = Agent(
    model="gemini-2.0-flash",
    name="assistant",
    description="Assistant with memory",
    instruction="You are a helpful assistant.",
    tools=[add_tool, search_tool],
)
runner_2 = InMemoryRunner(agent=agent_2)
events = await runner_2.run_debug("What was I working on?")
# Returns: "authentication"
```

## Custom Session Management

Control session isolation with custom session IDs:

```python  theme={null}
# User-specific memory
add_tool, search_tool = get_sessionized_cognee_tools(session_id="user_123")

# Org-specific memory
add_tool, search_tool = get_sessionized_cognee_tools(session_id="org_acme")

# Generate unique session automatically
add_tool, search_tool = get_sessionized_cognee_tools()  # Uses UUID-based session ID
```

<Info>
  Sessionized tools scope data to their session ID. Use non-sessionized `add_tool` and `search_tool` to access data across all sessions.
</Info>

## How It Works

1. **Add Tool**: Stores data in cognee's knowledge graph with embeddings
2. **Search Tool**: Retrieves relevant information via semantic search
3. **Auto-Processing**: cognee extracts entities, relationships, and context automatically
4. **Session Scoping**: Sessionized tools filter data by session ID; non-sessionized tools access all data

## Use Cases

<AccordionGroup>
  <Accordion title="Knowledge Accumulation">
    Build domain knowledge incrementally over multiple sessions:

    ```python  theme={null}
    # Pre-load documents into cognee
    import cognee

    for doc_path in document_paths:
        with open(doc_path, 'r') as f:
            content = f.read()
            await cognee.add(content)
    await cognee.cognify()

    # Query across all documents
    events = await runner.run_debug(
        "Find information about contract terms"
    )
    ```
  </Accordion>

  <Accordion title="Context-Aware Assistance">
    Maintain user context across work sessions:

    ```python  theme={null}
    # Monday
    await runner.run_debug("Debugging payment flow")

    # Wednesday
    events = await runner.run_debug("What was I debugging?")
    ```
  </Accordion>

  <Accordion title="Multi-Tenant Applications">
    Isolate data per user/organization while sharing global knowledge:

    ```python  theme={null}
    # Per-user isolation
    add_tool, search_tool = get_sessionized_cognee_tools(session_id=user_id)

    agent = Agent(
        model="gemini-2.0-flash",
        name="assistant",
        description="User assistant",
        instruction="You are a helpful assistant.",
        tools=[add_tool, search_tool]
    )
    ```
  </Accordion>

  <Accordion title="Multi-Agent Workflows">
    Share knowledge between specialized agents:

    ```python  theme={null}
    # Data collector agent
    data_agent = Agent(
        model="gemini-2.0-flash",
        name="data_collector",
        description="Collects and stores information",
        instruction="You collect and store important information.",
        tools=[add_tool]
    )

    # Research agent
    research_agent = Agent(
        model="gemini-2.0-flash",
        name="researcher",
        description="Searches stored information",
        instruction="You search and analyze the knowledge base.",
        tools=[search_tool]
    )
    ```
  </Accordion>
</AccordionGroup>

***

<CardGroup cols={2}>
  <Card title="GitHub Repository" icon="github" href="https://github.com/topoteretes/cognee-integration-google-adk">
    View source code and examples
  </Card>

  <Card title="Example Notebook" icon="book" href="https://github.com/topoteretes/cognee-integration-google-adk/blob/main/cognee_integration_google_adk/guide.ipynb">
    Step-by-step tutorial with demos
  </Card>
</CardGroup>
