> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Claude Agent SDK

Give your [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-python) agents persistent memory powered by cognee, build knowledge graphs, search with natural language, and maintain context across sessions.

## Why Use This Integration

* **Cross-Session Memory**: Context persists across agent instances and restarts
* **Advanced Retrieval**: Natural language queries with graph traversal and vector similarity
* **Sessionized tools**: Built in session data organization in memory
* **Async & Thread-Safe**: Queue-based processing for concurrent operations

## Installation

```bash  theme={null}
pip install cognee-integration-claude
```

## Quick Start

Before using the integration, configure your environment variables:

```bash  theme={null}
export LLM_API_KEY="your-openai-api-key-here"  # for cognee
```

<Info>
  The Claude Agent SDK handles authentication automatically through Cursor or via OAuth/API key on first run.
</Info>

Add memory tools to your Claude agent:

```python  theme={null}
import asyncio
from claude_agent_sdk import (
    create_sdk_mcp_server,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    AssistantMessage,
    TextBlock,
)
from cognee_integration_claude import add_tool, search_tool

async def main():
    # Create MCP server with cognee tools
    server = create_sdk_mcp_server(
        name="memory-tools",
        version="1.0.0",
        tools=[add_tool, search_tool]
    )

    options = ClaudeAgentOptions(
        mcp_servers={"tools": server},
        allowed_tools=["mcp__tools__add_tool", "mcp__tools__search_tool"],
    )

    # Store information
    async with ClaudeSDKClient(options=options) as client:
        await client.query("Remember: Acme Corp, healthcare, $1.2M contract")
        async for msg in client.receive_response():
            pass

    # Retrieve information
    async with ClaudeSDKClient(options=options) as client:
        await client.query("What healthcare contracts do we have?")
        async for msg in client.receive_response():
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock):
                        print(block.text)

asyncio.run(main())
```

## Cross-Session Persistence

Memory persists across different agent instances:

```python  theme={null}
from cognee_integration_claude import get_sessionized_cognee_tools

# Session 1: Store information
add_tool, search_tool = get_sessionized_cognee_tools("user-123")

server_1 = create_sdk_mcp_server(
    name="memory-tools",
    version="1.0.0",
    tools=[add_tool, search_tool]
)

options_1 = ClaudeAgentOptions(
    mcp_servers={"tools": server_1},
    allowed_tools=["mcp__tools__add_tool", "mcp__tools__search_tool"],
)

async with ClaudeSDKClient(options=options_1) as client:
    await client.query("I'm working on authentication")
    async for msg in client.receive_response():
        pass

# Session 2: Different instance, same memory
add_tool, search_tool = get_sessionized_cognee_tools("user-123")

server_2 = create_sdk_mcp_server(
    name="memory-tools",
    version="1.0.0",
    tools=[add_tool, search_tool]
)

options_2 = ClaudeAgentOptions(
    mcp_servers={"tools": server_2},
    allowed_tools=["mcp__tools__add_tool", "mcp__tools__search_tool"],
)

async with ClaudeSDKClient(options=options_2) as client:
    await client.query("What was I working on?")
    async for msg in client.receive_response():
        # Returns: "authentication"
        pass
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

1. **MCP Server**: Tools are exposed via Claude's native tool interface
2. **Add Tool**: Stores data in cognee's memory backed by knowledge graph with embeddings
3. **Search Tool**: Retrieves relevant information via semantic search
4. **Auto-Processing**: cognee extracts entities, relationships, and context automatically
5. **Session Scoping**: Sessionized tools filter data by session ID; non-sessionized tools access all data

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
    async with ClaudeSDKClient(options=options) as client:
        await client.query("Find information about contract terms")
        async for msg in client.receive_response():
            pass
    ```
  </Accordion>

  <Accordion title="Context-Aware Assistance">
    Maintain user context across work sessions:

    ```python  theme={null}
    # Monday
    async with ClaudeSDKClient(options=options) as client:
        await client.query("Debugging payment flow")
        async for _ in client.receive_response():
            pass

    # Wednesday
    async with ClaudeSDKClient(options=options) as client:
        await client.query("What was I debugging?")
        async for msg in client.receive_response():
            pass
    ```
  </Accordion>

  <Accordion title="Multi-Tenant Applications">
    Isolate data per user/organization while sharing global knowledge:

    ```python  theme={null}
    # Per-user isolation
    add_tool, search_tool = get_sessionized_cognee_tools(session_id=user_id)

    server = create_sdk_mcp_server(
        name="user-tools",
        version="1.0.0",
        tools=[add_tool, search_tool]
    )

    options = ClaudeAgentOptions(
        mcp_servers={"tools": server},
        allowed_tools=["mcp__tools__add_tool", "mcp__tools__search_tool"],
    )
    ```
  </Accordion>
</AccordionGroup>

## Data Management

Reset or manage your knowledge base as needed:

```python  theme={null}
import cognee

# Clear all data and reset the knowledge base
await cognee.prune.prune_data()
await cognee.prune.prune_system(metadata=True)
```

***

<CardGroup cols={2}>
  <Card title="GitHub Repository" icon="github" href="https://github.com/topoteretes/cognee-integration-claude">
    View source code and examples
  </Card>

  <Card title="Example Notebook" icon="book" href="https://github.com/topoteretes/cognee-integration-claude/blob/main/cognee_integration_claude/guide.ipynb">
    Step-by-step tutorial with demos
  </Card>
</CardGroup>
