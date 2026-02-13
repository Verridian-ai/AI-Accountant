> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# OpenAI Agents SDK

Give your [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) agents structured memory that persists across sessions.

## Why Use This Integration

* **Persistent Memory**: Knowledge survives agent restarts and session boundaries
* **Advanced Retrieval**: Natural language queries backed by graph + vector search
* **Sessionized tools**: Built in session data organization in memory
* **Native SDK Tools**: Works directly with OpenAI's `function_tool` pattern
* **Async-First**: Built for high-performance applications with proper concurrency handling

## Installation

```bash  theme={null}
pip install cognee-integration-openai-agents
```

## Quick Start

Configure your environment variables:

```bash  theme={null}
export OPENAI_API_KEY="your-openai-api-key-here"  # for OpenAI Agents SDK
export LLM_API_KEY="your-openai-api-key-here"     # for cognee
```

Add memory tools to your agent:

```python  theme={null}
import asyncio
from agents import Agent, Runner
from cognee_integration_openai_agents import add_tool, search_tool

async def main():
    # Create agent with memory
    agent = Agent(
        name="assistant",
        instructions="You are a helpful assistant with access to a knowledge base.",
        tools=[add_tool, search_tool],
    )

    # Store information
    await Runner.run(
        agent,
        "Remember: Acme Corp, healthcare, $1.2M contract"
    )

    # Retrieve information
    result = await Runner.run(
        agent,
        "What healthcare contracts do we have?"
    )
    print(result.final_output)

asyncio.run(main())
```

## Cross-Session Persistence

Memory persists across different agent instances:

```python  theme={null}
from agents import Agent, Runner
from cognee_integration_openai_agents import get_sessionized_cognee_tools

# Session 1: Store information
add_tool, search_tool = get_sessionized_cognee_tools("user-123")

agent_1 = Agent(
    name="assistant",
    instructions="You are a helpful assistant.",
    tools=[add_tool, search_tool],
)
await Runner.run(agent_1, "I'm working on authentication")

# Session 2: Different instance, same memory
add_tool, search_tool = get_sessionized_cognee_tools("user-123")

agent_2 = Agent(
    name="assistant",
    instructions="You are a helpful assistant.",
    tools=[add_tool, search_tool],
)
result = await Runner.run(agent_2, "What was I working on?")
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
4. **Session Scoping**: Sessionized tools filter by session; non-sessionized tools access everything

## Use Cases

<AccordionGroup>
  <Accordion title="Knowledge Accumulation">
    Pre-load documents into cognee before creating agents:

    ```python  theme={null}
    import cognee
    from agents import Agent, Runner
    from cognee_integration_openai_agents import search_tool

    # Pre-load documents
    for doc_path in document_paths:
        with open(doc_path, 'r') as f:
            await cognee.add(f.read())
    await cognee.cognify()

    # Query across all documents
    agent = Agent(
        name="analyst",
        instructions="You have access to our knowledge base.",
        tools=[search_tool]
    )
    result = await Runner.run(agent, "Find information about contract terms")
    ```
  </Accordion>

  <Accordion title="Context-Aware Assistance">
    Maintain user context across work sessions:

    ```python  theme={null}
    # Monday
    await Runner.run(agent, "Debugging payment flow")

    # Wednesday
    result = await Runner.run(agent, "What was I debugging?")
    ```
  </Accordion>

  <Accordion title="Multi-Tenant Applications">
    Isolate data per user or organization:

    ```python  theme={null}
    add_tool, search_tool = get_sessionized_cognee_tools(session_id=user_id)

    agent = Agent(
        name="assistant",
        instructions="You are a helpful assistant.",
        tools=[add_tool, search_tool]
    )
    ```
  </Accordion>

  <Accordion title="Multi-Agent Workflows">
    Share knowledge between specialized agents:

    ```python  theme={null}
    from cognee_integration_openai_agents import add_tool, search_tool

    # Data collector agent
    data_agent = Agent(
        name="data_collector",
        instructions="You collect and store important information.",
        tools=[add_tool]
    )

    # Research agent
    research_agent = Agent(
        name="researcher",
        instructions="You search and analyze the knowledge base.",
        tools=[search_tool]
    )
    ```
  </Accordion>

  <Accordion title="Agent Handoffs">
    Route requests to specialized agents with shared memory:

    ```python  theme={null}
    storage_agent = Agent(
        name="storage_specialist",
        instructions="You specialize in storing information.",
        tools=[add_tool]
    )

    search_agent = Agent(
        name="search_specialist", 
        instructions="You specialize in finding information.",
        tools=[search_tool]
    )

    triage_agent = Agent(
        name="triage",
        instructions="Route to storage_specialist for saving, search_specialist for queries.",
        handoffs=[storage_agent, search_agent]
    )

    result = await Runner.run(triage_agent, "Find our healthcare contracts")
    ```
  </Accordion>
</AccordionGroup>

***

<CardGroup cols={2}>
  <Card title="GitHub Repository" icon="github" href="https://github.com/topoteretes/cognee-integration-openai-agents">
    View source code and examples
  </Card>

  <Card title="Example Notebook" icon="book" href="https://github.com/topoteretes/cognee-integration-openai-agents/blob/main/cognee_integration_openai_agents/guide.ipynb">
    Step-by-step tutorial with demos
  </Card>
</CardGroup>
