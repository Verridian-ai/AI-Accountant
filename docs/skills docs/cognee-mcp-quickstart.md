> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Quickstart

> Get Cognee MCP running in minutes with Docker

Start the Cognee MCP server using Docker to quickly test AI memory integration.

## Prerequisites

* Docker installed and running
* OpenAI API key

## Setup Steps

<Steps>
  <Step title="Set Your API Key">
    ```bash  theme={null}
    export LLM_API_KEY=your_api_key_here
    ```
  </Step>

  <Step title="Create Environment File">
    ```bash  theme={null}
    echo "LLM_API_KEY=your_api_key_here" > .env
    ```
  </Step>

  <Step title="Start the Server">
    ```bash  theme={null}
    docker run -e TRANSPORT_MODE=http --env-file ./.env -p 8000:8000 --rm -it cognee/cognee-mcp:main
    ```

    The server starts on port 8000 with HTTP transport mode.
  </Step>

  <Step title="Verify the Server">
    ```bash  theme={null}
    curl http://localhost:8000/health
    ```

    You should see a healthy response from the server.
  </Step>
</Steps>

<Note>
  The container removes all data when stopped. Use volume mounts for persistent storage.
</Note>

## API Mode (Shared Knowledge Graph)

To connect multiple clients to a shared knowledge graph, run MCP in API mode pointing to a centralized Cognee backend:

<Steps>
  <Step title="Start Cognee Backend">
    First, start a Cognee backend instance:

    ```bash  theme={null}
    docker run -e LLM_API_KEY=your_api_key_here -p 8080:8000 --rm -it cognee/cognee:main
    ```
  </Step>

  <Step title="Start MCP in API Mode">
    Start the MCP server and point it to the backend:

    ```bash  theme={null}
    docker run -e TRANSPORT_MODE=sse -e API_URL=http://localhost:8080 -p 8000:8000 --rm -it cognee/cognee-mcp:main
    ```

    The container automatically converts `localhost` to `host.docker.internal` so the MCP container can reach your host machine. The MCP server now acts as an interface to the shared backend.
  </Step>

  <Step title="Connect Additional Clients (Optional)">
    If you need to support multiple clients, start additional MCP instances on different ports:

    ```bash  theme={null}
    docker run -e TRANSPORT_MODE=sse -e API_URL=http://localhost:8080 -p 8001:8000 --rm -it cognee/cognee-mcp:main
    ```

    Each client connects to its own MCP instance, but all share the same knowledge graph through the backend.
  </Step>
</Steps>

<Note>
  * The API mode requires SSE or HTTP transport
  * The `localhost` in `API_URL` is automatically mapped to work from inside the container
  * Add `-e API_TOKEN=your_token` if your backend requires authentication
</Note>

## Connect to AI Clients

After starting the server, connect it to your AI development tool:

<CardGroup cols={2}>
  <Card title="Cursor" href="/cognee-mcp/integrations/cursor" icon="code">
    AI-powered code editor with native MCP support
  </Card>

  <Card title="Claude Code" href="/cognee-mcp/integrations/claude-code" icon="bot">
    Command-line AI assistant from Anthropic
  </Card>
</CardGroup>

<CardGroup cols={3}>
  <Card title="Cline" href="/cognee-mcp/integrations/cline" icon="terminal">
    VS Code extension for AI-assisted development
  </Card>

  <Card title="Continue" href="/cognee-mcp/integrations/continue" icon="play">
    Open-source AI coding assistant
  </Card>

  <Card title="Roo Code" href="/cognee-mcp/integrations/roo-code" icon="zap">
    AI-powered development environment
  </Card>
</CardGroup>

## Next Steps

<CardGroup cols={2}>
  <Card title="Tools Reference" href="/cognee-mcp/mcp-tools" icon="wrench">
    See all available MCP tools and operations
  </Card>

  <Card title="Local Setup" href="/cognee-mcp/mcp-local-setup" icon="code">
    Run from source for customization and development
  </Card>
</CardGroup>
