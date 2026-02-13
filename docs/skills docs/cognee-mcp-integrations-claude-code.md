> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Claude Code

# Claude Code Integration

Claude Code is Anthropic's command-line AI assistant with built-in MCP support. It runs in your terminal and can access MCP servers configured in your project or user settings.

## Prerequisites

* Node.js and npm installed
* Cognee MCP server running (see [Quickstart](/cognee-mcp/mcp-quickstart) or [Local Setup](/cognee-mcp/mcp-local-setup))
* OpenAI API key (for Cognee's LLM operations)

## Setup Steps

<Steps>
  <Step title="Install Claude Code">
    ```bash  theme={null}
    npm install -g @anthropic-ai/claude-code
    ```
  </Step>

  <Step title="Navigate to Your Project">
    ```bash  theme={null}
    cd /path/to/your/project
    ```
  </Step>

  <Step title="Add Cognee Server">
    Choose the command that matches how you started the Cognee MCP server:

    <Tabs>
      <Tab title="Docker (HTTP)">
        Use this if you started the server with Docker:

        ```bash  theme={null}
        claude mcp add --transport http cognee http://localhost:8000/mcp -s project
        ```

        This creates a configuration in your project's `.mcp.json` file that connects to the HTTP endpoint.

        **Options:**

        * `-s project`: Stores configuration in the project (requires approval per project)
        * Omit `-s project` to store at user level (applies to all projects)
      </Tab>

      <Tab title="Local (stdio)">
        Use this if you cloned the repository and run from source:

        ```bash  theme={null}
        claude mcp add cognee \
          -s project \
          -e LLM_API_KEY="your-openai-key" \
          -- uv --directory /absolute/path/to/cognee-mcp run cognee-mcp
        ```

        Replace:

        * `your-openai-key` with your OpenAI API key
        * `/absolute/path/to/cognee-mcp` with the path to your local cognee-mcp directory
      </Tab>
    </Tabs>
  </Step>

  <Step title="Start Claude Code and Approve">
    ```bash  theme={null}
    claude
    ```

    On first run in this project, you will see:

    ```
    Approve project MCP servers?
    • cognee    /path/to/cognee-mcp
    ```

    Select **Enable** or press Enter. Claude Code can now call Cognee tools automatically.
  </Step>

  <Step title="Use Cognee Tools">
    Claude Code will use Cognee tools when relevant to your requests. You can explicitly ask:

    * "Add this code to Cognee memory"
    * "Search Cognee for authentication patterns"
    * "Use Cognee to codify this repository"
  </Step>
</Steps>

## Where to Use This Configuration

The configuration is stored in `.mcp.json` in your project directory (with `-s project`) or in your user settings (without it). Claude Code reads this file when starting a session in that directory.

## Need Help?

<Card title="Join Our Community" icon="discord" href="https://discord.gg/m63hxKsp4p">
  Get support and connect with other developers using Cognee MCP.
</Card>
