> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# OpenClaw

Give your [OpenClaw](https://github.com/openclaw/openclaw) agents persistent memory via plugin powered by cognee. Automatically index memory files, recall relevant context before each agent run, and search across sessions with natural language.

## Why Use This Integration

* **Auto-Index**: Memory files sync to Cognee on startup and after each agent run
* **Auto-Recall**: Relevant memories are injected as context before every prompt
* **Graph Search**: Natural language queries powered by knowledge graph traversal
* **Zero Friction**: Works with OpenClaw's native Markdown memory files

## Installation

```bash  theme={null}
openclaw plugins install @cognee/cognee-openclaw
```

Or install locally for development:

```bash  theme={null}
cd integrations/openclaw
npm install && npm run build
openclaw plugins install -l .
```

## Quick Start

### 1. Start Cognee

Use the [Local Docker setup](/api-reference/introduction#local-docker) to run Cognee quickly.
You can also use this [minimal Docker Compose file](https://github.com/topoteretes/cognee-integrations/blob/main/integrations/openclaw/cognee-docker-compose.yaml).

### 2. Get Your API Key

Register a user and login to get your bearer token:

```bash  theme={null}
# Register a new user
curl -X POST "http://localhost:8000/api/v1/users/register" \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "your-password"}'

# Login to get your bearer token
curl -X POST "http://localhost:8000/api/v1/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "your-password"}'
```

The login response contains your bearer token — use this as your `COGNEE_API_KEY`.

<Info>
  You can also explore the API at [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger UI) to register and login interactively.
</Info>

### 3. Enable the Plugin

Add to `~/.openclaw/config.yaml`:

```yaml  theme={null}
plugins:
  entries:
    memory-cognee:
      enabled: true
      config:
        baseUrl: "http://localhost:8000"
        apiKey: "${COGNEE_API_KEY}"
        datasetName: "my-project"
        searchType: "GRAPH_COMPLETION"
        autoRecall: true
        autoIndex: true
```

That's it. Your OpenClaw memory files are now backed by Cognee's knowledge graph.

## How It Works

Memory persists across OpenClaw sessions automatically. The plugin syncs your `MEMORY.md` and `memory/*.md` files to Cognee, building a knowledge graph that can traverse relationships between concepts.

1. **On Startup**: Scans memory directory and syncs files to Cognee (add new, update changed, skip unchanged)
2. **Before Agent Run**: Searches Cognee for memories relevant to your prompt and injects them as context
3. **After Agent Run**: Re-scans memory files and syncs any changes the agent made
4. **State Tracking**: Maintains sync index at `~/.openclaw/memory/cognee/` for efficient updates

<Info>
  The plugin uses hash-based change detection to minimize API calls. Only new or modified files are synced to Cognee.
</Info>

### Search Types

Here are the available search types:

* `GRAPH_COMPLETION`
* `CHUNKS`
* `SUMMARIES`

You can learn more in [Search Types](/core-concepts/main-operations/search) and extend these if you want from the source.

## CLI Commands

```bash  theme={null}
# Manually sync memory files to Cognee
openclaw cognee index

# Check sync status (indexed files, pending changes)
openclaw cognee status
```

***

<CardGroup cols={3}>
  <Card title="GitHub Repository" icon="github" href="https://github.com/topoteretes/cognee-integrations/tree/main/integrations/openclaw">
    View source code and examples
  </Card>

  <Card title="Blog Post" icon="newspaper" href="https://www.cognee.ai/blog/integrations/what-is-openclaw-ai-and-how-we-give-it-memory-with-cognee">
    Deep dive into building this plugin
  </Card>

  <Card title="OpenClaw Docs" icon="book" href="https://docs.openclaw.ai/concepts/memory">
    Learn about OpenClaw's memory system
  </Card>
</CardGroup>
