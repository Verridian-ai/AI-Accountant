> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Redis

> Use Redis as a vector store through a community-maintained adapter

Redis is a fast in-memory data store that supports vector similarity search through the Redis Search module. It supports both cloud-hosted (Redis Cloud) and self-hosted deployments.

<Note>
  Cognee can use Redis as a [vector store](/setup-configuration/vector-stores) backend through this [community-maintained](/setup-configuration/community-maintained/overview) [adapter](https://github.com/topoteretes/cognee-community/tree/main/packages/vector/redis).
</Note>

## Installation

This adapter is a separate package from core Cognee. Before installing, complete the [Cognee installation](/getting-started/installation) and ensure your environment is configured with [LLM and embedding providers](/setup-configuration/overview). After that, install the adapter package:

```bash  theme={null}
uv pip install cognee-community-vector-adapter-redis
```

## Configuration

<Tabs>
  <Tab title="Docker (Local)">
    Run a local Redis instance with the Search module enabled:

    ```bash  theme={null}
    docker run -d --name redis -p 6379:6379 redis:8.0.2
    ```

    Configure in Python:

    ```python  theme={null}
    from cognee_community_vector_adapter_redis import register
    from cognee import config

    config.set_vector_db_config({
        "vector_db_provider": "redis",
        "vector_db_url": "redis://localhost:6379",
    })
    ```

    Or via environment variables:

    ```dotenv  theme={null}
    VECTOR_DB_PROVIDER="redis"
    VECTOR_DB_URL="redis://localhost:6379"
    ```
  </Tab>

  <Tab title="Redis Cloud">
    Get your connection URL from the [Redis Cloud](https://redis.io/try-free) dashboard. Make sure to enable the Search module.

    ```python  theme={null}
    from cognee_community_vector_adapter_redis import register
    from cognee import config

    config.set_vector_db_config({
        "vector_db_provider": "redis",
        "vector_db_url": "redis://user:password@your-redis-cloud-url:port",
    })
    ```

    Or via environment variables:

    ```dotenv  theme={null}
    VECTOR_DB_PROVIDER="redis"
    VECTOR_DB_URL="redis://user:password@your-redis-cloud-url:port"
    ```
  </Tab>

  <Tab title="Redis with SSL">
    For secure connections, use the `rediss://` protocol:

    ```python  theme={null}
    from cognee_community_vector_adapter_redis import register
    from cognee import config

    config.set_vector_db_config({
        "vector_db_provider": "redis",
        "vector_db_url": "rediss://localhost:6380",
    })
    ```

    Or via environment variables:

    ```dotenv  theme={null}
    VECTOR_DB_PROVIDER="redis"
    VECTOR_DB_URL="rediss://localhost:6380"
    ```
  </Tab>
</Tabs>

## Important Notes

<Accordion title="Adapter Registration">
  Import `register` from the adapter package before using Redis with Cognee. This registers the adapter with Cognee's provider system.
</Accordion>

<Accordion title="Troubleshooting">
  1. **Connection Errors**: Ensure Redis is running and accessible at the specified URL
  2. **Search Module Missing**: Make sure Redis has the Search module enabled
  3. **Embedding Dimension Mismatch**: Verify embedding engine dimensions match index configuration
  4. **Collection Not Found**: Always create collections before adding data points
</Accordion>

## Resources

<CardGroup cols={3}>
  <Card title="RedisVL Docs" icon="book" href="https://docs.redisvl.com">
    RedisVL library documentation (powers this adapter)
  </Card>

  <Card title="Adapter Source" icon="github" href="https://github.com/topoteretes/cognee-community/tree/main/packages/vector/redis">
    GitHub repository
  </Card>

  <Card title="Extended Example" icon="lightbulb" href="https://github.com/topoteretes/cognee-community/blob/main/packages/vector/redis/examples/example.py">
    Full usage example script
  </Card>
</CardGroup>

<Columns cols={3}>
  <Card title="Vector Stores" icon="database" href="/setup-configuration/vector-stores">
    Official vector providers
  </Card>

  <Card title="Community Overview" icon="users" href="/setup-configuration/community-maintained/overview">
    All community integrations
  </Card>

  <Card title="Setup Overview" icon="settings" href="/setup-configuration/overview">
    Configuration guide
  </Card>
</Columns>
