> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Local Setup

> Deploy Cognee MCP server from source for development and customization

Build and run Cognee MCP from source to access advanced customization, multiple transport options, and the latest development features.

## Advantages of Local Setup

* **Full Control**: Customize server configuration, add providers, and modify behavior
* **Latest Features**: Access development features before they reach Docker releases
* **Multiple Transports**: Choose stdio, SSE, or HTTP transport modes
* **Development Ready**: Debug, modify, and contribute to the codebase

## Setup Steps

<Steps>
  <Step title="Clone Repository">
    ```bash  theme={null}
    git clone https://github.com/topoteretes/cognee.git
    cd cognee
    ```
  </Step>

  <Step title="Create Environment File">
    Create a `.env` file with your configuration:

    ```bash  theme={null}
    LLM_API_KEY="your-openai-api-key"
    ```
  </Step>

  <Step title="Install Dependencies">
    ```bash  theme={null}
    # Install uv package manager
    brew install uv

    # Install project dependencies
    cd cognee-mcp
    uv sync --dev --all-extras --reinstall
    ```
  </Step>

  <Step title="Activate and Run">
    ```bash  theme={null}
    # Activate virtual environment
    source .venv/bin/activate

    # Run with default stdio transport
    python src/server.py
    ```
  </Step>
</Steps>

## Transport Modes

Choose the transport mode based on your client requirements:

<Tabs>
  <Tab title="stdio">
    Default mode for most MCP clients. The client starts the server as a subprocess and communicates through standard input/output.

    ```bash  theme={null}
    python src/server.py
    ```

    Use this with Cursor, Claude Code, Cline, and Roo Code when running from source.
  </Tab>

  <Tab title="HTTP">
    HTTP mode for clients that connect over HTTP. The server runs on port 8000 and exposes an HTTP endpoint.

    ```bash  theme={null}
    python src/server.py --transport http
    ```

    Use this if you want to run the server separately and have clients connect to it.
  </Tab>

  <Tab title="SSE">
    Server-Sent Events mode for real-time streaming communication.

    ```bash  theme={null}
    python src/server.py --transport sse
    ```

    Use this for advanced streaming scenarios.
  </Tab>
</Tabs>

<Tip>
  If you encounter errors on first run, reset your MCP configuration and restart.
</Tip>

## Running in API Mode

To connect the MCP server to an existing Cognee backend instead of running standalone:

```bash  theme={null}
# Set the backend API URL
export API_URL=http://localhost:8080

# Optional: Set authentication token if backend requires it
export API_TOKEN=your_backend_token

# Start MCP in HTTP or SSE mode pointing to the backend
python src/server.py --transport http
```

When `API_URL` is set, the MCP server acts as an interface to the centralized backend. This allows multiple MCP instances and clients to share the same knowledge graph.

You can also pass these as command-line arguments:

```bash  theme={null}
python src/server.py --transport http --api-url http://localhost:8080 --api-token your_token
```

**Use cases:**

* Team collaboration with shared memory
* Multiple AI clients accessing consistent data
* Centralized knowledge graph management

## Next Steps

After starting the server, configure your AI client to connect to it. See the [integrations](/cognee-mcp/integrations) section for client-specific setup instructions.

## Need Help?

<Card title="Join Our Community" icon="discord" href="https://discord.gg/m63hxKsp4p">
  Get support and connect with other developers using Cognee MCP.
</Card>
