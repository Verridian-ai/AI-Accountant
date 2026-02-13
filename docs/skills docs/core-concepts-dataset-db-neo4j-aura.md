> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Neo4j Aura Dataset Database Handler

> Handler for connecting to a Neo4j database, enabling multi-user mode on a Neo4j database instance hosted on their cloud, Neo4j Aura.

<Warning>
  Make sure that `ENABLE_BACKEND_ACCESS_CONTROL` in your `.env` file is **NOT** set to `False`.
  Multi-user mode is enabled by default, therefore `ENABLE_BACKEND_ACCESS_CONTROL=True` by default.
</Warning>

The Neo4j adapter is one of Cognee's core graph adapters, along with Kuzu. Multi-user mode, however,
is only enabled via the Neo4j Aura Cloud with this handler. You can read more about Aura in the official
[Neo4j Aura docs](https://neo4j.com/docs/aura/).

## Installation

Firstly, you will need to install specific dependencies necessary for working with Neo4j:

```bash  theme={null}
pip install "cognee[neo4j]"
```

## Setup

Since this handler works for the Neo4j Aura Cloud, you will need to provide the necessary connection information:

```dotenv  theme={null}
GRAPH_DB_PROVIDER="neo4j"
NEO4J_CLIENT_ID=<your_client_id>
NEO4J_CLIENT_SECRET=<your_client_secret>
NEO4J_TENANT_ID=<your_tenant_id>
NEO4J_ENCRYPTION_KEY=<your_encryption_key>
```

## Usage

The Neo4j Aura handler is registered in Cognee by default, so all that is left to do is to let
Cognee know which handler you are using. This can be done by setting the following `.env` variable:

```dotenv  theme={null}
GRAPH_DATASET_DATABASE_HANDLER="neo4j_aura_dev"
```

<CardGroup cols={2}>
  <Card title="Graph Stores" icon="book" href="/setup-configuration/graph-stores">
    Details About Cognee's Graph Stores
  </Card>

  <Card title="Multi-User Overview" icon="users" href="/core-concepts/multi-user-mode/multi-user-mode-overview">
    More Details About Multi-User Mode
  </Card>
</CardGroup>
