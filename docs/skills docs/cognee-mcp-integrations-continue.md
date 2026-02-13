> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Continue

# Continue Integration

Continue is an open-source AI coding assistant for VS Code and JetBrains IDEs. It supports MCP servers through YAML configuration files in your workspace.

## Prerequisites

* VS Code or JetBrains IDE installed
* Continue extension installed
* Cognee MCP server running (see [Quickstart](/cognee-mcp/mcp-quickstart) or [Local Setup](/cognee-mcp/mcp-local-setup))
* OpenAI API key

## Setup Steps

<Steps>
  <Step title="Install Continue">
    1. Open your IDE
    2. Install the Continue extension from the marketplace ([documentation](https://www.continue.dev))
  </Step>

  <Step title="Create MCP Configuration Directory">
    Create a folder called `.continue/mcpServers` at the top level of your workspace:

    ```bash  theme={null}
    mkdir -p .continue/mcpServers
    ```
  </Step>

  <Step title="Add Cognee MCP Configuration">
    Choose the configuration that matches how you started the Cognee MCP server:

    <Tabs>
      <Tab title="Docker (SSE)">
        Create a file `.continue/mcpServers/cognee.yaml` with:

        ```yaml  theme={null}
        name: Cognee MCP Server
        version: 0.0.1
        schema: v1
        mcpServers:
          - name: Cognee
            type: sse
            url: http://localhost:8000/sse
        ```

        This connects to the SSE endpoint exposed by the Docker container.
      </Tab>

      <Tab title="Local (stdio)">
        Create a file `.continue/mcpServers/cognee.yaml` with:

        ```yaml  theme={null}
        name: Cognee MCP Server
        version: 0.0.1
        schema: v1
        mcpServers:
          - name: Cognee
            type: stdio
            command: uv
            args:
              - --directory
              - /absolute/path/to/cognee-mcp
              - run
              - cognee-mcp
            env:
              LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
        ```

        Replace `/absolute/path/to/cognee-mcp` with your local path.
      </Tab>
    </Tabs>
  </Step>

  <Step title="Use Cognee Tools in Agent Mode">
    Open Continue and switch to **Agent mode** (MCP only works in agent mode).

    Example prompts:

    * "Codify this repository using Cognee"
    * "Use Cognee CODE search to find authentication logic"
    * "Search my code for database connections"
  </Step>
</Steps>

## Where to Use This Configuration

The `.continue/mcpServers/` directory is at the workspace level. Each workspace can have its own MCP server configurations. Continue automatically detects YAML files in this directory.

## Alternative: Using JSON Format

If you have JSON MCP configuration from another tool, you can copy it directly:

```bash  theme={null}
# Copy from Cursor, Claude, or Cline
cp ~/.cursor/mcp.json .continue/mcpServers/cognee.json
```

Continue automatically picks up both YAML and JSON configurations.

## Need Help?

<Card title="Join Our Community" icon="discord" href="https://discord.gg/m63hxKsp4p">
  Get support and connect with other developers using Cognee MCP.
</Card>
