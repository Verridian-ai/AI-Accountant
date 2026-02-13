> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Roo Code

# Roo Code Integration

Roo Code is a VS Code extension that provides AI-powered development assistance with support for MCP servers. It enables direct interaction with external tools through natural language.

## Prerequisites

* Visual Studio Code installed
* Cognee MCP server running (see [Quickstart](/cognee-mcp/mcp-quickstart) or [Local Setup](/cognee-mcp/mcp-local-setup))
* OpenAI API key

## Setup Steps

<Steps>
  <Step title="Install Roo Code">
    1. Open Visual Studio Code
    2. Go to the Extensions panel
    3. Search for "Roo Code" or visit the [Marketplace page](https://marketplace.visualstudio.com/items?itemName=RooVeterinaryInc.roo-cline)
    4. Click Install
    5. Complete the authentication process
  </Step>

  <Step title="Open MCP Settings">
    Follow the [Roo Code MCP documentation](https://docs.roocode.com/features/mcp/using-mcp-in-roo) to access settings:

    1. Click the MCP Servers icon in the top navigation of the Roo Code pane
    2. Scroll to the bottom of the MCP settings view
    3. Choose your configuration level:
       * **Edit Global MCP**: Opens `mcp_settings.json` (applies to all workspaces)
       * **Edit Project MCP**: Opens `.roo/mcp.json` (project-specific, can be committed to version control)

    The file will have the base structure:

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
              "type": "sse",
              "url": "http://localhost:8000/sse",
              "disabled": false
            }
          }
        }
        ```

        This configuration tells Roo Code to connect to the SSE endpoint exposed by the Docker container.
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

    Save the file after adding your configuration. The Cognee server will appear in the MCP servers list and connect automatically.
  </Step>

  <Step title="Use Cognee Tools">
    Open the Roo Code interface and interact with Cognee:

    Example commands:

    * "Codify this codebase using Cognee" - Generate a knowledge graph from your code
    * "Use Cognee CODE search to find authentication logic" - Query the code graph
    * "List my Cognee datasets" - View stored data
  </Step>
</Steps>

## Where to Use This Configuration

**Global Configuration** (`mcp_settings.json`): Settings apply across all your workspaces unless overridden by project configuration. Accessed via "Edit Global MCP" button.

**Project Configuration** (`.roo/mcp.json`): Defined in your project root. Allows project-specific servers and can be committed to version control for team sharing. Accessed via "Edit Project MCP" button.

If a server exists in both configurations, the project-level configuration takes precedence.

You can manage servers through the Roo Code UI - use the toggle to enable/disable servers, click restart if needed, or adjust the network timeout. See the [Roo Code MCP documentation](https://docs.roocode.com/features/mcp/using-mcp-in-roo) for details.

## Need Help?

<Card title="Join Our Community" icon="discord" href="https://discord.gg/m63hxKsp4p">
  Get support and connect with other developers using Cognee MCP.
</Card>
