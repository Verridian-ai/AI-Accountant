> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# FalkorDB Dataset Database Handler

> Handler for connecting to a FalkorDB database, enabling multi-user mode on the FalkorDB database instance.

The FalkorDB adapter is one of Cognee's community adapters, which can be found on our [community repo](https://github.com/topoteretes/cognee-community/tree/main/packages/hybrid/falkordb).

<Warning>
  Make sure that `ENABLE_BACKEND_ACCESS_CONTROL` in your `.env` file is **NOT** set to `False`.
  Multi-user mode is enabled by default, therefore `ENABLE_BACKEND_ACCESS_CONTROL=True` by default.
</Warning>

## Installation

Firstly, you will need to install the adapter package:

```bash  theme={null}
pip install cognee-community-hybrid-adapter-falkor
```

## Setup

You will need a running FalkorDB database instance, and the existing handler works with local setups.
All you need to do is provide the necessary connection information, like the following example:

```dotenv  theme={null}
VECTOR_DB_PROVIDER=falkordb
VECTOR_DB_URL=localhost
VECTOR_DB_PORT=6379

GRAPH_DATABASE_PROVIDER=falkor
GRAPH_DATABASE_URL=localhost
GRAPH_DATABASE_PORT=6379
```

Falkor is a hybrid vector/graph store, therefore we need to provide Cognee with information about both
databases, even though it is the same Falkor database instance. You can run a local instance with the
following command:

```bash  theme={null}
docker run -p 6379:6379 -p 3000:3000 -it --rm falkordb/falkordb:edge
```

## Usage

After setting up your instance and connection information, you will need to register the adapter and handler to Cognee,
so it knows which database to use. Registering the adapter also registers the dataset database handler.
In your code, add the following import statement:

```bash  theme={null}
from cognee_community_hybrid_adapter_falkor import register
```

The final important piece of information is to let Cognee know which handler you are using.
This can be done by setting the following `.env` variables:

```dotenv  theme={null}
GRAPH_DATASET_DATABASE_HANDLER="falkor_graph_local"
VECTOR_DATASET_DATABASE_HANDLER="falkor_vector_local"
```

Since Falkor is a hybrid adapter, we have to set variables for both vector and graph databases.

<CardGroup cols={2}>
  <Card title="Falkor Adapter" icon="book" href="/setup-configuration/community-maintained/falkordb">
    Details About Cognee's FalkorDB Adapter
  </Card>

  <Card title="Multi-User Overview" icon="users" href="/core-concepts/multi-user-mode/multi-user-mode-overview">
    More Details About Multi-User Mode
  </Card>
</CardGroup>
