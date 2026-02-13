> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Vector Stores

> Configure vector databases for embedding storage and semantic search in Cognee

Vector stores hold embeddings for semantic similarity search. They enable Cognee to find conceptually related content based on meaning rather than exact text matches.

<Info>
  **New to configuration?**

  See the [Setup Configuration Overview](./overview) for the complete workflow:

  install extras → create `.env` → choose providers → handle pruning.
</Info>

## Supported Providers

Cognee supports multiple vector store options:

* **LanceDB** — File-based vector store, works out of the box (default)
* **PGVector** — Postgres-backed vector storage with pgvector extension
* **Qdrant** — High-performance vector database and similarity search engine
* **Redis** — Fast vector similarity search via Redis Search module
* **ChromaDB** — HTTP server-based vector database
* **FalkorDB** — Hybrid graph + vector database
* **Neptune Analytics** — Amazon Neptune Analytics hybrid solution

## Configuration

<Accordion title="Environment Variables">
  Set these environment variables in your `.env` file:

  * `VECTOR_DB_PROVIDER` — The vector store provider (lancedb, pgvector, qdrant, redis, chromadb, falkordb, neptune\_analytics)
  * `VECTOR_DB_URL` — Database URL or connection string
  * `VECTOR_DB_KEY` — Authentication key (provider-specific)
  * `VECTOR_DB_PORT` — Database port (for some providers)
</Accordion>

## Setup Guides

<AccordionGroup>
  <Accordion title="LanceDB (Default)">
    LanceDB is file-based and requires no additional setup. It's perfect for local development and single-user scenarios.

    ```dotenv  theme={null}
    VECTOR_DB_PROVIDER="lancedb"
    # Optional, can be a path or URL. Defaults to <SYSTEM_ROOT_DIRECTORY>/databases/cognee.lancedb
    # VECTOR_DB_URL=/absolute/or/relative/path/to/cognee.lancedb
    ```

    **Installation**: LanceDB is included by default with Cognee. No additional installation required.

    **Data Location**: Vectors are stored in a local directory. Defaults under the Cognee system path if `VECTOR_DB_URL` is empty.
  </Accordion>

  <Accordion title="PGVector">
    PGVector stores vectors inside your Postgres database using the pgvector extension.

    ```dotenv  theme={null}
    VECTOR_DB_PROVIDER="pgvector"
    # Uses the same Postgres connection as your relational DB (DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, DB_PASSWORD)
    ```

    **Installation**: Install the Postgres extras:

    ```bash  theme={null}
    pip install "cognee[postgres]"
    # or for binary version
    pip install "cognee[postgres-binary]"
    ```

    **Docker Setup**: Use the built-in Postgres with pgvector:

    ```bash  theme={null}
    docker compose --profile postgres up -d
    ```

    **Note**: If using your own Postgres, ensure `CREATE EXTENSION IF NOT EXISTS vector;` is available in the target database.
  </Accordion>

  <Accordion title="Qdrant">
    Qdrant requires a running instance of the Qdrant server.

    ```dotenv  theme={null}
    VECTOR_DB_PROVIDER="qdrant"
    VECTOR_DB_URL="http://localhost:6333"
    ```

    **Installation**: Since Qdrant is a community adapter, you have to install the community package:

    ```bash  theme={null}
    pip install cognee-community-vector-adapter-qdrant
    ```

    **Configuration**: To make sure Cognee uses Qdrant, you have to register it beforehand with the following line:

    ```python  theme={null}
    from cognee_community_vector_adapter_qdrant import register
    ```

    For more details on setting up Qdrant, visit the [more detailed description](/setup-configuration/community-maintained/qdrant) of this adapter.

    **Docker Setup**: Start the Qdrant service:

    ```bash  theme={null}
    docker run -p 6333:6333 -p 6334:6334 \
        -v "$(pwd)/qdrant_storage:/qdrant/storage:z" \
        qdrant/qdrant
    ```

    **Access**: Default port is 6333 for the database, and you can access the Qdrant dashboard at "localhost:6333/dashboard".
  </Accordion>

  <Accordion title="Redis">
    Redis can be used as a vector store through the Redis Search module, providing fast vector similarity search capabilities.

    ```dotenv  theme={null}
    VECTOR_DB_PROVIDER="redis"
    VECTOR_DB_URL="redis://localhost:6379"
    # VECTOR_DB_KEY is optional and not used by Redis
    ```

    **Installation**: Since Redis is a community adapter, you have to install the community package:

    ```bash  theme={null}
    pip install cognee-community-vector-adapter-redis
    ```

    **Configuration**: To make sure Cognee uses Redis, you have to register it beforehand with the following line:

    ```python  theme={null}
    from cognee_community_vector_adapter_redis import register
    ```

    You can also configure Redis programmatically:

    ```python  theme={null}
    from cognee import config

    config.set_vector_db_config({
        "vector_db_provider": "redis",
        "vector_db_url": "redis://localhost:6379",
    })
    ```

    For more details on setting up Redis, visit the [more detailed description](/setup-configuration/community-maintained/redis) of this adapter.

    **Docker Setup**: Start a Redis instance with Search module enabled:

    ```bash  theme={null}
    docker run -d --name redis -p 6379:6379 redis:8.0.2
    ```

    Or use **Redis Cloud** with the Search module enabled: [Redis Cloud](https://redis.io/try-free)

    **Connection URL Examples**:

    * Local: `redis://localhost:6379`
    * With authentication: `redis://user:password@localhost:6379`
    * With SSL: `rediss://localhost:6380`
  </Accordion>

  <Accordion title="ChromaDB">
    ChromaDB requires a running Chroma server and authentication token.

    ```dotenv  theme={null}
    VECTOR_DB_PROVIDER="chromadb"
    VECTOR_DB_URL="http://localhost:3002"
    VECTOR_DB_KEY="<your_token>"
    ```

    **Installation**: Install ChromaDB extras:

    ```bash  theme={null}
    pip install "cognee[chromadb]"
    # or directly
    pip install chromadb
    ```

    **Docker Setup**: Start the bundled ChromaDB server:

    ```bash  theme={null}
    docker compose --profile chromadb up -d
    ```
  </Accordion>

  <Accordion title="FalkorDB">
    FalkorDB can serve as both graph and vector store, providing a hybrid solution.

    ```dotenv  theme={null}
    VECTOR_DB_PROVIDER="falkordb"
    VECTOR_DB_URL="localhost"
    VECTOR_DB_PORT="6379"
    ```

    **Installation**: Since FalkorDB is a community adapter, you have to install the community package:

    ```bash  theme={null}
    pip install cognee-community-hybrid-adapter-falkor
    ```

    **Configuration**: To make sure Cognee uses FalkorDB, you have to register it beforehand with the following line:

    ```python  theme={null}
    from cognee_community_hybrid_adapter_falkor import register
    ```

    For more details on setting up FalkorDB, visit the [more detailed description](/setup-configuration/community-maintained/falkordb) of this adapter.

    **Docker Setup**: Start the FalkorDB service:

    ```bash  theme={null}
    docker run -p 6379:6379 -p 3000:3000 -it --rm falkordb/falkordb:edge
    ```

    **Access**: Default ports are 6379 (DB) and 3000 (UI).
  </Accordion>

  <Accordion title="Neptune Analytics">
    Use Amazon Neptune Analytics as a hybrid vector + graph backend.

    ```dotenv  theme={null}
    VECTOR_DB_PROVIDER="neptune_analytics"
    VECTOR_DB_URL="neptune-graph://<GRAPH_ID>"
    # AWS credentials via environment or default SDK chain
    ```

    **Installation**: Install Neptune extras:

    ```bash  theme={null}
    pip install "cognee[neptune]"
    ```

    **Note**: URL must start with `neptune-graph://` and AWS credentials should be configured via environment variables or AWS SDK.
  </Accordion>
</AccordionGroup>

## Important Considerations

<Accordion title="Dimension Consistency">
  Ensure `EMBEDDING_DIMENSIONS` matches your vector store collection/table schemas:

  * PGVector column size
  * LanceDB Vector size
  * ChromaDB collection schema

  Changing dimensions requires recreating collections.
</Accordion>

<Accordion title="Provider Comparison">
  | Provider          | Setup             | Performance | Use Case                       |
  | ----------------- | ----------------- | ----------- | ------------------------------ |
  | LanceDB           | Zero setup        | Good        | Local development              |
  | PGVector          | Postgres required | Excellent   | Production with Postgres       |
  | Qdrant            | Server required   | Excellent   | High-performance vector search |
  | Redis             | Server required   | Excellent   | Low-latency in-memory search   |
  | ChromaDB          | Server required   | Good        | Dedicated vector store         |
  | FalkorDB          | Server required   | Good        | Hybrid graph + vector          |
  | Neptune Analytics | AWS required      | Excellent   | Cloud hybrid solution          |
</Accordion>

## Community-Maintained Providers

Additional vector stores are available through community-maintained adapters:

* **[Qdrant](/setup-configuration/community-maintained/qdrant)** — Vector search engine with cloud and self-hosted options
* **[Redis](/setup-configuration/community-maintained/redis)** — Fast vector similarity search
* **[FalkorDB](/setup-configuration/community-maintained/falkordb)** — Hybrid vector and graph store
* **Milvus, Pinecone, Weaviate, and more** — See [all community adapters](/setup-configuration/community-maintained/overview)

## Notes

* **Embedding Integration**: Vector stores use your embedding engine from the Embeddings section
* **Dimension Matching**: Keep `EMBEDDING_DIMENSIONS` consistent between embedding provider and vector store
* **Performance**: Local providers (LanceDB) are simpler but cloud providers offer better scalability

<Columns cols={3}>
  <Card title="Embedding Providers" icon="layers" href="/setup-configuration/embedding-providers">
    Configure embedding providers for vector generation
  </Card>

  <Card title="Graph Stores" icon="network" href="/setup-configuration/graph-stores">
    Set up graph databases for knowledge graphs
  </Card>

  <Card title="Overview" icon="settings" href="/setup-configuration/overview">
    Return to setup configuration overview
  </Card>
</Columns>
