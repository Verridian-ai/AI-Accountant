> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# LangGraph

Give your [LangGraph](https://langchain-ai.github.io/langgraph/) agents persistent semantic memory that survives across sessions. Store data in cognee's knowledge graph and retrieve it via natural language—no manual state management required.

## Why Use This Integration

* **Cross-Session Memory**: Context persists across agent instances and conversation sessions
* **Semantic Search**: Retrieve information using natural language queries
* **Session Isolation**: Multi-tenant support with per-user data separation
* **Zero Setup**: Works with LangGraph's `create_react_agent` out of the box

## Installation

```bash  theme={null}
pip install cognee-integration-langgraph
```

## Quick Start

Before using the integration, configure your environment variables:

```bash  theme={null}
export OPENAI_API_KEY="your-openai-api-key-here"    # for LangGraph
export LLM_API_KEY="your-openai-api-key-here"       # for cognee
export LLM_MODEL="gpt-4o-mini"
```

Add memory tools to your LangGraph agent:

```python  theme={null}
from langgraph.prebuilt import create_react_agent
from cognee_integration_langgraph import get_sessionized_cognee_tools
from langchain_core.messages import HumanMessage

# Get memory tools
add_tool, search_tool = get_sessionized_cognee_tools()

# Create agent with memory
agent = create_react_agent(
    "openai:gpt-4o-mini",
    tools=[add_tool, search_tool],
)

# Store and retrieve information
response = agent.invoke({
    "messages": [
        HumanMessage(content="Remember: Acme Corp, healthcare, $1.2M contract"),
        HumanMessage(content="What healthcare contracts do we have?")
    ],
})
```

## Cross-Session Persistence

Memory persists across different agent instances:

```python  theme={null}
# Session 1: Store information

add_tool, search_tool = get_sessionized_cognee_tools("session-1")

agent_1 = create_react_agent(
    "openai:gpt-4o-mini",
    tools=[add_tool, search_tool],
)
agent_1.invoke({
    "messages": [HumanMessage(content="I'm working on authentication")]
})

# Session 2: Different instance, same memory

add_tool, search_tool = get_sessionized_cognee_tools("session-2")

agent_2 = create_react_agent(
    "openai:gpt-4o-mini", 
    tools=[add_tool, search_tool],
)
response = agent_2.invoke({
    "messages": [HumanMessage(content="What was I working on?")]
})
# Returns: "authentication module"
```

## Custom Session Management

Control session isolation with custom session IDs:

```python  theme={null}
# User-specific memory
user_tools = get_sessionized_cognee_tools(session_id="user_123")

# Org-specific memory
org_tools = get_sessionized_cognee_tools(session_id="org_acme")

# Generate unique session automatically
auto_tools = get_sessionized_cognee_tools()  # Uses UUID-based session ID
```

<Info>
  Each session maintains separate memory clusters while allowing global data access when needed. Data added outside sessions forms separate clusters.
</Info>

## How It Works

1. **Add Tool**: Stores data in cognee's knowledge graph with embeddings
2. **Search Tool**: Retrieves relevant information via semantic search
3. **Auto-Processing**: cognee extracts entities, relationships, and context automatically
4. **Session Scoping**: Data is organized by session clusters but globally accessible

## Use Cases

<AccordionGroup>
  <Accordion title="Knowledge Accumulation">
    Build domain knowledge incrementally over multiple sessions:

    ```python  theme={null}
    # Add knowledge from sessions
    for doc in knowledge_base:
        agent.invoke({"messages": [HumanMessage(content=f"Learn: {doc}")]})

    # Add multiple documents
    for doc_path in document_paths:
        with open(doc_path, 'r') as f:
            content = f.read()
            await cognee.add(content)
    await cognee.cognify()

    # Query across all
    response = agent.invoke({
        "messages": [HumanMessage(content="Find information about contract terms")]
    })
    ```
  </Accordion>

  <Accordion title="Context-Aware Assistance">
    Maintain user context across work sessions:

    ```python  theme={null}
    # Monday
    agent.invoke({"messages": [HumanMessage(content="Debugging payment flow")]})

    # Wednesday
    agent.invoke({"messages": [HumanMessage(content="What was I debugging?")]})
    ```
  </Accordion>

  <Accordion title="Multi-Tenant Applications">
    Isolate data per user/organization while sharing global knowledge:

    ```python  theme={null}
    # Per-user isolation
    user_tools = get_sessionized_cognee_tools(session_id=user_id)
    agent = create_react_agent("openai:gpt-4o-mini", tools=user_tools)
    ```
  </Accordion>
</AccordionGroup>

***

<CardGroup cols={2}>
  <Card title="GitHub Repository" icon="github" href="https://github.com/topoteretes/cognee-integration-langgraph">
    View source code and examples
  </Card>

  <Card title="Example Notebook" icon="book" href="https://github.com/topoteretes/cognee-integration-langgraph/blob/main/examples/guide.ipynb">
    Step-by-step tutorial with demos
  </Card>
</CardGroup>
