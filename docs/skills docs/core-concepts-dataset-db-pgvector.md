> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# PGVector Dataset Database Handler

> Handler for connecting to a Postgres database with the PGVector extension, enabling multi-user mode on the Postgres database instance.

<Warning>
  Make sure that `ENABLE_BACKEND_ACCESS_CONTROL` in your `.env` file is **NOT** set to `False`.
  Multi-user mode is enabled by default, therefore `ENABLE_BACKEND_ACCESS_CONTROL=True` by default.
</Warning>

The PGVector adapter is one of Cognee's core vector adapters, along with LanceDB. Even though PGVector is
an extension of Postgres, you can use PGVector as a vector store with other relational databases, such as SQLite.

## Installation

Firstly, you will need to install specific dependencies necessary for working with Postgres and PGVector:

```bash  theme={null}
pip install "cognee[postgres]"
# or for binary version
pip install "cognee[postgres-binary]"
```

## Setup

You will need a running Postgres database instance, and the existing handler works with both **local** and **cloud** setups.
All you need to do is provide the necessary connection information, like the following example does for a local setup:

```dotenv  theme={null}
VECTOR_DB_PROVIDER=pgvector
VECTOR_DB_NAME=<your_db_name>
VECTOR_DB_URL=127.0.0.1
VECTOR_DB_PORT=5432
VECTOR_DB_USERNAME=<your_db_username>
VECTOR_DB_PASSWORD=<your_db_password>
```

For the server setup, you can use the one from the Cognee `docker-compose.yml` file, or your own:

```bash  theme={null}
docker compose --profile postgres up
```

## Usage

The PGVector handler is registered in Cognee by default, so all that is left to do is to let
Cognee know which handler you are using. This can be done by setting the following `.env` variable:

```dotenv  theme={null}
VECTOR_DATASET_DATABASE_HANDLER="pgvector"
```

<CardGroup cols={2}>
  <Card title="Vector Stores" icon="book" href="/setup-configuration/vector-stores">
    Details About Cognee's Vector Stores
  </Card>

  <Card title="Multi-User Overview" icon="users" href="/core-concepts/multi-user-mode/multi-user-mode-overview">
    More Details About Multi-User Mode
  </Card>
</CardGroup>
