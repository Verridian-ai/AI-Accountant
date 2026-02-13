> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Migrate from Mem0

> Move from Mem0 to Cognee

This guide shows how to export your existing Mem0 memories and import them into Cognee.

<Note>
  Need help with a large migration? [Chat with us](https://calendly.com/vasilije-topoteretes/)
</Note>

<Accordion title="Why Migrate to Cognee?">
  | Capability             | **Cognee**                                                                      | **Mem0**                                                        |
  | ---------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------- |
  | **Primary Storage**    | Built-in knowledge graph + vector store, with scalable options                  | Vectors (optional graphs)                                       |
  | **Data Ingestion**     | Creates memories from any data (chats, documents, etc.) allows batch processing | Creates memories from conversations                             |
  | **Entity Extraction**  | Multi-layer semantic connections that tie the graph together more densely       | Lean with basic entity nets                                     |
  | **Memory Enrichment**  | `memify()` derives new facts and enriches existing graphs over time             | Not available                                                   |
  | **Ontology Support**   | RDF/OWL ontologies and Pydantic models for custom schemas                       | Not available                                                   |
  | **Temporal Awareness** | Time-aware entity extraction and temporal search type                           | Not available                                                   |
  | **Feedback Loop**      | User feedback during search is stored to improve reasoning                      | Not available                                                   |
  | **Search Types**       | 15 retrieval types available to optimize for use case                           | Vector similarity with filters (basic graph queries if enabled) |
  | **Data Isolation**     | Dataset-scoped permissions and per-dataset storage                              | Isolation through user\_id, agent\_id, and run\_id              |
  | **API Style**          | Asynchronous (async/await)                                                      | Synchronous (sync)                                              |
</Accordion>

## Data Migration Script

Export from Mem0 and import to Cognee in one script:

```python  theme={null}
import asyncio
from mem0 import Memory
import cognee
from cognee.api.v1.search import SearchType

async def migrate():
    # Export from Mem0
    m = Memory()
    mem0_data = m.get_all(user_id="alice")

    # Reset Cognee (optional, for clean start)
    await cognee.prune.prune_data()
    await cognee.prune.prune_system(metadata=True)

    # Import to Cognee
    for memory in mem0_data.get("results", []):
        content = memory.get("memory", "")
        if content:
            await cognee.add(content, dataset_name="alice")

    # Build knowledge graph
    await cognee.cognify()

    # Verify
    result = await cognee.search(
        query_type=SearchType.GRAPH_COMPLETION,
        query_text="What do you know?"
    )
    print(result)

asyncio.run(migrate())
```

## API Mapping

Use this table to translate Mem0 operations to Cognee equivalents:

| **Operation**    | **Cognee**                                                                           | **Mem0**                               |
| ---------------- | ------------------------------------------------------------------------------------ | -------------------------------------- |
| Add text         | `await cognee.add("text", dataset_name="alice")`                                     | `m.add("text", user_id="alice")`       |
| Add file         | `await cognee.add("/path/to/file.pdf", dataset_name="docs")`                         | *Not supported*                        |
| Add URL          | `await cognee.add("https://example.com", dataset_name="web")`                        | *Not supported*                        |
| Build graph      | `await cognee.cognify()`                                                             | Automatic (if graph\_store configured) |
| Search           | `await cognee.search(query_text="query", query_type=SearchType.GRAPH_COMPLETION)`    | `m.search("query", user_id="alice")`   |
| Get all          | `await cognee.datasets.list_data(dataset_id)`                                        | `m.get_all(user_id="alice")`           |
| Delete user data | `await cognee.datasets.delete_dataset(dataset_id)`                                   | `m.delete_all(user_id="alice")`        |
| Reset all        | `await cognee.prune.prune_data()` + `await cognee.prune.prune_system(metadata=True)` | `m.reset()`                            |

<Tip>
  To get the `dataset_id`, use `await cognee.datasets.list_datasets()`.
</Tip>

### Code Migration Examples

Below are side-by-side comparisons of the most common memory operations in Cognee and Mem0.

#### Adding Data

<CodeGroup>
  ```python Cognee theme={null}
  import cognee

  # Single text
  await cognee.add("User loves pizza", dataset_name="alice")

  # Conversation messages
  messages = [
      {"role": "user", "content": "I love pizza"},
      {"role": "assistant", "content": "Noted!"}
  ]
  await cognee.add(messages, dataset_name="alice")

  # Build graph after adding
  await cognee.cognify()
  ```

  ```python Mem0 theme={null}
  from mem0 import Memory
  m = Memory()

  # Single text
  m.add("User loves pizza", user_id="alice")

  # Conversation messages
  messages = [
      {"role": "user", "content": "I love pizza"},
      {"role": "assistant", "content": "Noted!"}
  ]
  m.add(messages, user_id="alice")
  ```
</CodeGroup>

#### Searching

<CodeGroup>
  ```python Cognee theme={null}
  import cognee
  from cognee.api.v1.search import SearchType

  # Basic search
  answer = await cognee.search(
      query_text="What does user like?",
      query_type=SearchType.GRAPH_COMPLETION,
  )

  # With dataset filter (like user_id)
  answer = await cognee.search(
      query_text="What does user like?",
      query_type=SearchType.GRAPH_COMPLETION,
      datasets=["alice"],
  )
  ```

  ```python Mem0 theme={null}
  from mem0 import Memory
  m = Memory()

  # Basic search
  results = m.search("What does user like?", user_id="alice")

  for r in results["results"]:
      print(r["memory"])
  ```
</CodeGroup>

#### Deleting

<CodeGroup>
  ```python Cognee theme={null}
  import cognee

  # Delete an entire dataset
  await cognee.datasets.delete_dataset("alice")

  # Full reset
  await cognee.prune.prune_data()
  await cognee.prune.prune_system(metadata=True)
  ```

  ```python Mem0 theme={null}
  from mem0 import Memory
  m = Memory()

  # Delete all for user
  m.delete_all(user_id="alice")

  # Reset everything
  m.reset()
  ```
</CodeGroup>

<Note>
  For a detailed comparison of AI memory architectures and benchmark results, see [Deep Dive: AI Memory Comparison](https://www.cognee.ai/blog/deep-dives/competition-comparison-form-vs-function).
</Note>

## Next Steps

<CardGroup cols={2}>
  <Card title="Installation" icon="download" href="/getting-started/installation">
    Set up Cognee in your environment
  </Card>

  <Card title="Configuration" icon="settings" href="/setup-configuration/overview">
    Configure LLM, embedding, and storage backends
  </Card>

  <Card title="Add Data" icon="plus" href="/core-concepts/main-operations/add">
    Learn about supported data sources
  </Card>

  <Card title="Search" icon="search" href="/core-concepts/main-operations/search">
    Explore available search types
  </Card>
</CardGroup>
