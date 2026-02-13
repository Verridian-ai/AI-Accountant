> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Tools Reference

> Complete reference for all Cognee MCP tools and operations

Cognee MCP provides 11 tools that MCP-compatible AI assistants can use for memory management, code intelligence, and data operations.

## Available Tools

<AccordionGroup>
  <Accordion title="Memory Management" defaultOpen>
    * **`cognify`**: Transform raw data into structured memories and knowledge graphs
    * **`cognee_add_developer_rules`**: Ingest core developer rule files into memory
    * **`search`**: Retrieve relevant memories using semantic search
    * **`prune`**: Clear all memory for a fresh start
  </Accordion>

  <Accordion title="Code Intelligence">
    * **`codify`**: Generate code-specific knowledge graphs from source code
    * **`save_interaction`**: Store user-assistant exchanges to build development rules
    * **`get_developer_rules`**: Retrieve stored developer rules and patterns
  </Accordion>

  <Accordion title="Data Management">
    * **`list_data`**: List all datasets and their data items with IDs for deletion operations
    * **`delete`**: Remove specific data items from datasets
    * **`cognify_status`** & **`cognify_status`**: track pipeline status
  </Accordion>
</AccordionGroup>

## Usage Notes

* Run `codify` before using `search` with the CODE search type
* Use `prune` to reset the database when testing or starting fresh
* The `cognify` tool processes general documents while `codify` is optimized for source code

## Next Steps

<Card title="Client Integrations" href="/cognee-mcp/integrations" icon="code">
  Learn how to use these tools with your AI development environment
</Card>
