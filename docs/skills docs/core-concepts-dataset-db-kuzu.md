> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Kuzu Dataset Database Handler

> Handler for connecting to a Kuzu database, enabling multi-user mode.

<Warning>
  Make sure that `ENABLE_BACKEND_ACCESS_CONTROL` in your `.env` file is **NOT** set to `False`.
  Multi-user mode is enabled by default, therefore `ENABLE_BACKEND_ACCESS_CONTROL=True` by default.
</Warning>

The Kuzu adapter is one of Cognee's core vector adapters, along with Neo4j.

## Installation

Kuzu is part of Cognee's core dependencies, so no extra installation steps are required.

## Setup and Usage

Since Kuzu is a file-based database, and its handler is registered in Cognee by default,
all that needs to be set is the information about the provider, and to let Cognee know which
handler you are using:

```dotenv  theme={null}
GRAPH_DATABASE_PROVIDER="kuzu"
GRAPH_DATASET_DATABASE_HANDLER="kuzu"
```

Graph files are stored by default in the .cognee\_system folder (within the Cognee package), with each dataset assigned its own persistent graph file.

<CardGroup cols={2}>
  <Card title="Graph Stores" icon="book" href="/setup-configuration/graph-stores">
    Details About Cognee's Graph Stores
  </Card>

  <Card title="Multi-User Overview" icon="users" href="/core-concepts/multi-user-mode/multi-user-mode-overview">
    More Details About Multi-User Mode
  </Card>
</CardGroup>
