> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Overview

> Connect Cognee's knowledge graph platform with MCP-compatible AI tools

Cognee MCP brings persistent AI memory to your workflow through the Model Context Protocol.

## What is MCP?

The [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) is a standard for adding specialized tools to AI assistants. It allows AI tools like Claude or Cursor to work with external systems such as databases, APIs, and AI platforms.

Without MCP, each AI assistant needs custom integrations for every external system. This creates duplication and inconsistency across tools.

MCP provides a single method for extending AI assistants with:

* **Standardized connections** between AI tools and external systems
* **Secure data access** with built-in authentication and permissions
* **Tool interoperability** so you can switch between AI providers
* **Persistent memory** that survives across conversations and sessions

## How Cognee MCP Works

Cognee MCP exposes 11 specialized tools through the MCP protocol. These tools handle memory management, code intelligence, and data operations. You access them through MCP-compatible AI assistants like Cursor, Claude Desktop, Continue, Cline, and Roo Code.

The tools enable your AI assistant to:

* Store and retrieve knowledge from previous conversations
* Build persistent understanding of your codebase and projects
* Access structured memories across different sessions

See the [Tools Reference](/cognee-mcp/mcp-tools) for all available operations.

## Architecture Modes

Cognee MCP can run in two modes:

**Standalone Mode**: The MCP server manages its own database and processing. Each MCP instance maintains separate data. Use this for personal development or when clients need isolated environments.

**API Mode**: The MCP server connects to a centralized Cognee backend via API. Multiple MCP instances can share the same knowledge graph. Use this when you want team members to access shared memory or when running multiple AI clients that need consistent data.

## Setup Options

Choose your deployment method:

<CardGroup cols={3}>
  <Card title="Docker Quickstart" href="/cognee-mcp/mcp-quickstart" icon="docker">
    **Recommended for most users**

    Get running in minutes with a pre-built container.
  </Card>

  <Card title="API Mode (Shared)" href="/cognee-mcp/mcp-quickstart#api-mode-shared-knowledge-graph" icon="network">
    **For teams**

    Connect multiple clients to a shared knowledge graph.
  </Card>

  <Card title="Local Setup" href="/cognee-mcp/mcp-local-setup" icon="code">
    **For development**

    Build from source for full control and latest features.
  </Card>
</CardGroup>

## Next Steps

<CardGroup cols={2}>
  <Card title="Tools Reference" href="/cognee-mcp/mcp-tools" icon="wrench">
    See all available MCP tools and operations
  </Card>

  <Card title="Client Integrations" href="/cognee-mcp/integrations" icon="code">
    Connect with Cursor, Claude, Continue, and more
  </Card>
</CardGroup>
