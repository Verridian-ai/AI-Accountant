> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Cline

# Cline Integration

Cline is a VS Code extension that provides AI assistance with support for MCP servers. It enables natural language interactions with external tools directly in your development environment.

## Prerequisites

* Visual Studio Code installed
* Cognee MCP server running (see [Quickstart](/cognee-mcp/mcp-quickstart) or [Local Setup](/cognee-mcp/mcp-local-setup))
* OpenAI API key

## Setup Steps

<Steps>
  <Step title="Install Cline">
    1. Open Visual Studio Code
    2. Go to the Extensions panel
    3. Search for "Cline" or visit the [Marketplace page](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev)
    4. Click Install
  </Step>

  <Step title="Open Cline MCP Settings">
    Follow the [Cline MCP configuration guide](https://docs.cline.bot/mcp/configuring-mcp-servers) to access settings:

    1. Click the "MCP Servers" icon in the top navigation bar of the Cline extension
    2. Select the "Configure" tab
    3. Click the "Configure MCP Servers" button at the bottom of the pane

    Cline will open the `cline_mcp_settings.json` file with the base structure:

    ```json  theme={null}
    {
      "mcpServers": {
        
      }
    }
    ```
  </Step>

  <Step title="Add Cognee Server Configuration">
    Add the Cognee server inside the `mcpServers` object. Choose the configuration that matches how you started the Cognee MCP server:

    <Tabs>
      <Tab title="Docker (SSE)">
        Use this if you started the server with Docker:

        ```json  theme={null}
        {
          "mcpServers": {
            "cognee": {
              "url": "http://localhost:8000/sse",
              "disabled": false
            }
          }
        }
        ```

        This configuration tells Cline to connect to the SSE endpoint exposed by the Docker container.
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
                "/absolute/path/to/cognee-mcp",
                "run",
                "cognee-mcp"
              ],
              "env": {
                "LLM_API_KEY": "your-openai-key"
              },
              "disabled": false
            }
          }
        }
        ```

        Replace:

        * `/absolute/path/to/cognee-mcp` with the full path to your cognee-mcp directory
        * `your-openai-key` with your OpenAI API key
      </Tab>
    </Tabs>

    Save the file after adding your configuration. The Cognee server will appear in the MCP Servers panel. You can use the toggle to enable/disable it or click Restart if needed.
  </Step>

  <Step title="Use Cognee Tools">
    Open the Cline interface.

    Example commands:

    * "Prune cognee" - Clear the database
    * "Run codify in this repo" - Build a code knowledge graph
    * "Find dependencies with CODE search" - Query the code graph
  </Step>
</Steps>

## Where to Use This Configuration

The `cline_mcp_settings.json` file is in your VS Code global storage directory. Cline reads this file when the extension starts and applies the configuration to all projects.

You can manage servers through the Cline UI - click the "MCP Servers" icon to enable/disable servers, restart them, or adjust settings without editing JSON directly. See the [Cline MCP documentation](https://docs.cline.bot/mcp/configuring-mcp-servers) for details.

## Need Help?

<Card title="Join Our Community" icon="discord" href="https://discord.gg/m63hxKsp4p">
  Get support and connect with other developers using Cognee MCP.
</Card>
