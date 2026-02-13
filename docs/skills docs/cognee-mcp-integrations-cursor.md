> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Cursor

# Cursor Integration

Cursor is an AI-powered code editor built on VS Code with native support for the Model Context Protocol. It provides AI assistance through its Composer interface and chat panel.

## Prerequisites

* Cursor installed on your machine
* Cognee MCP server running (see [Quickstart](/cognee-mcp/mcp-quickstart) or [Local Setup](/cognee-mcp/mcp-local-setup))
* OpenAI API key

## Setup Steps

<Steps>
  <Step title="Open MCP Settings">
    1. Launch Cursor
    2. Click the gear icon to open Settings
    3. Navigate to **Tools & MCP**
    4. Click **+ Add MCP Server**

    This opens the `mcp.json` configuration file.
  </Step>

  <Step title="Add Cognee Server Configuration">
    Choose the configuration that matches how you started the Cognee MCP server:

    <Tabs>
      <Tab title="Docker (HTTP)">
        Use this if you started the server with Docker:

        ```json  theme={null}
        {
          "mcpServers": {
            "cognee": {
              "url": "http://localhost:8000/mcp"
            }
          }
        }
        ```

        This configuration tells Cursor to connect to the HTTP endpoint exposed by the Docker container.
      </Tab>

      <Tab title="Local (stdio)">
        Use this if you cloned the repository and run from source:

        ```json  theme={null}
        {
          "mcpServers": {
            "cognee": {
              "command": "uv",
              "args": [
                "--directory",
                "/Users/yourname/path/to/cognee-mcp",
                "run",
                "cognee-mcp"
              ]
            }
          }
        }
        ```

        Replace `/Users/yourname/path/to/cognee-mcp` with the absolute path to your local cognee-mcp directory.
      </Tab>
    </Tabs>

    Save the file after adding your configuration.
  </Step>

  <Step title="Verify Connection">
    Use the toggle in MCP Tools to refresh the connection. You should see a list of available tools from Cognee, confirming the server is connected.
  </Step>

  <Step title="Use Cognee Tools">
    1. Open the Chat panel in Cursor
    2. Make sure **Agent** mode is selected
    3. Issue prompts that use Cognee tools

    Example prompts:

    * "Add this file to memory using cognify"
    * "Search my code for authentication logic"
    * "Codify this repository"
  </Step>
</Steps>

## Where to Use This Configuration

The `mcp.json` file is located in your Cursor settings directory. Cursor reads this file at startup and when you refresh the MCP connection. The configuration applies to all projects you open in Cursor.

## Need Help?

<Card title="Join Our Community" icon="discord" href="https://discord.gg/m63hxKsp4p">
  Get support and connect with other developers using Cognee MCP.
</Card>
