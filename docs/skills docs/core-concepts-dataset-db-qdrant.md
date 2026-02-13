> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Qdrant Dataset Database Handler

> Handler for connecting to a Qdrant database, enabling multi-user mode on the Qdrant database instance.

The Qdrant adapter is one of Cognee's community adapters, which can be found on our [community repo](https://github.com/topoteretes/cognee-community/tree/main/packages/vector/qdrant).

<Warning>
  Make sure that `ENABLE_BACKEND_ACCESS_CONTROL` in your `.env` file is **NOT** set to `False`.
  Multi-user mode is enabled by default, therefore `ENABLE_BACKEND_ACCESS_CONTROL=True` by default.
</Warning>

## Installation

Firstly, you will need to install the adapter package:

```bash  theme={null}
pip install cognee-community-vector-adapter-qdrant
```

## Setup

You will need a running Qdrant database instance, and the existing handler works with both **local** and **cloud** setups.
All you need to do is provide the necessary connection information, like the following example does for a local setup:

```dotenv  theme={null}
VECTOR_DB_PROVIDER="qdrant"
VECTOR_DB_URL="http://localhost:6333"
```

For a local database instance, you can use docker, as in the code below. For a cloud setup,
you can read [Qdrant's docs](https://qdrant.tech/documentation/cloud-intro/) on how to set it up.

```bash  theme={null}
docker run -p 6333:6333 -p 6334:6334 \
    -v "$(pwd)/qdrant_storage:/qdrant/storage:z" \
    qdrant/qdrant
```

## Usage

After setting up your instance and connection information, you will need to register the adapter and handler to Cognee,
so it knows which database to use. Registering the adapter also registers the dataset database handler.
In your code, add the following import statement:

```bash  theme={null}
from cognee_community_vector_adapter_qdrant import register
```

The final important piece of information is to let Cognee know which handler you are using.
This can be done by setting the following `.env` variable:

```dotenv  theme={null}
VECTOR_DATASET_DATABASE_HANDLER="qdrant"
```

<CardGroup cols={2}>
  <Card title="Qdrant Adapter" icon="book" href="/setup-configuration/community-maintained/qdrant">
    Details About Cognee's Qdrant Adapter
  </Card>

  <Card title="Multi-User Overview" icon="users" href="/core-concepts/multi-user-mode/multi-user-mode-overview">
    More Details About Multi-User Mode
  </Card>
</CardGroup>
