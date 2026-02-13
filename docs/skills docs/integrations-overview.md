> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Integrations

> Connect Cognee with your favorite Agent frameworks and for observability, evaluation, and development tools

Cognee works seamlessly with AI Agent frameworks and popular tools in the AI ecosystem.
These integrations help you **observe**, **evaluate**, **use** your AI Memory.

<Info>
  All integrations are designed to be lightweight and easy to configure, requiring minimal setup to get started.
</Info>

## Observability & Monitoring

Track performance, debug issues, and monitor your knowledge graph operations in production.

<CardGroup cols={2}>
  <Card title="Langfuse" href="/integrations/langfuse-integration" icon="activity">
    **Open-source LLM observability**

    Distributed tracing and metrics for every Cognee task with granular pipeline performance insights.
  </Card>

  <Card title="Keywords AI" href="/integrations/keywordsai-integration" icon="tag">
    **LLM application tracing**

    Span-level tracing across tasks and workflows with minimal code using Cognee's observe abstraction.
  </Card>
</CardGroup>

## Evaluation & Testing

Measure and improve the quality of your knowledge graph outputs with comprehensive evaluation frameworks.

<CardGroup cols={1}>
  <Card title="DeepEval" href="/integrations/deepeval-integration" icon="test-tube">
    **Comprehensive RAG evaluation**

    Run QA & RAG metrics including Contextual Relevancy, Precision/Recall, and Coverage using LLM-as-a-judge workflows.
  </Card>
</CardGroup>

## Cloud LLM Providers

Connect to enterprise-grade LLM services through Cognee's flexible integration layer.

<CardGroup cols={1}>
  <Card title="AWS Bedrock" href="/integrations/aws-bedrock-integration" icon="cloud">
    **Enterprise LLM access**

    Use AWS Bedrock models including Claude, Titan, and Cohere through LiteLLM proxy integration.
  </Card>
</CardGroup>

## Agent Frameworks

Build stateful AI agents with persistent semantic memory that endures across sessions.

<CardGroup cols={3}>
  <Card title="LangGraph" href="/integrations/langgraph-integration" icon="bot">
    Works with `create_react_agent`—no manual state management.
  </Card>

  <Card title="Google ADK" href="/integrations/google-adk-integration" icon="bot">
    Native `LongRunningFunctionTool` for async-first Gemini agents.
  </Card>

  <Card title="OpenClaw" href="/integrations/openclaw-integration" icon="person-standing">
    Auto-index and recall for your personal AI agent.
  </Card>
</CardGroup>

<CardGroup cols={3}>
  <Card title="n8n" href="/integrations/n8n-integration" icon="workflow">
    No-code memory workflows with all n8n integrations.
  </Card>

  <Card title="Claude Agent SDK" href="/integrations/claude-agent-sdk-integration" icon="bot">
    Native MCP server tools for Claude's tool protocol.
  </Card>

  <Card title="OpenAI Agent SDK" href="/integrations/openai-agents-sdk-integration" icon="bot">
    Native `function_tool` pattern with agent handoffs support.
  </Card>
</CardGroup>

## Agent IDEs & Development Tools

Integrate Cognee directly into your development workflow with MCP-compatible tools and AI assistants.

<Accordion title="MCP Integrations" defaultOpen>
  <CardGroup cols={3}>
    <Card title="Cursor" href="/cognee-mcp/integrations/cursor" icon="code">
      AI-powered code editor integration
    </Card>

    <Card title="Continue" href="/cognee-mcp/integrations/continue" icon="play">
      VS Code AI assistant plugin
    </Card>

    <Card title="Claude Code" href="/cognee-mcp/integrations/claude-code" icon="brain">
      Anthropic's Claude integration
    </Card>
  </CardGroup>

  <CardGroup cols={2}>
    <Card title="Cline" href="/cognee-mcp/integrations/cline" icon="terminal">
      Command-line AI assistant
    </Card>

    <Card title="Roo Code" href="/cognee-mcp/integrations/roo-code" icon="robot">
      Advanced coding assistant
    </Card>
  </CardGroup>
</Accordion>

<Note>
  Cognee's Model Context Protocol (MCP) adapter enables seamless integration with AI assistants, providing direct access to your knowledge graphs for in-context assistance.
</Note>

## Contributing Integrations

Don't see your favorite tool? Cognee is open and extensible—help us grow the ecosystem!

<Info>
  All community database integrations are maintained in the [cognee-community](https://github.com/topoteretes/cognee-community) repository, keeping the core Cognee package lean while providing extensibility.
</Info>
