> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Cognee Cloud Notebooks

> Run code against datasets using Cognee Cloud notebooks

Notebooks let you use all four Cognee operations: **add()**, **cognify()**, **memify()**, and **search()**. You'll need an [API key](/cognee-cloud/sign-up) to get started.

## Open or create a notebook

* Expand **Notebooks** in the sidebar.
* Open the example notebook (*Python Development with Cognee Tutorial*) or create a new one with **+**.

## Using operations

* **add()** and **cognify()** can also be run in the UI, but in notebooks you can call them programmatically.
* **memify()** and **search()** are available only in notebooks.

We'll cover each operation below, and to see them in action, you can run the example notebook that is available when you sign up for Cognee Cloud.

## Add data

Upload files or text content into your dataset:

```python  theme={null}
# Add a single text string
await cognee.add("Your text content here", node_set=["my_data"])

# Add from a local file
await cognee.add(
    "/path/to/your/local/file.txt",
    node_set=["guido_data"]
)
```

<Note>
  You can only add `.txt` files in notebooks. In particular, you should convert PDFs to text before adding them.
</Note>

## Cognify data

Transform your data into a knowledge graph:

```python  theme={null}
# Basic cognify
await cognee.cognify()

# With temporal processing
await cognee.cognify(temporal_cognify=True)
```

## Memify data

Enrich your knowledge graph with semantic relationships:

```python  theme={null}
# Run memify to infer new connections
await cognee.memify()
```

## Search your data

Query your knowledge graph with natural language:

```python  theme={null}
# Basic search
results = await cognee.search("What does our product aim to deliver?")
print(results[0])

# Graph completion search
results = await cognee.search(
    "What Python type hinting challenges did I face?",
    query_type=cognee.SearchType.GRAPH_COMPLETION
)

# Temporal search
results = await cognee.search(
    "What can we learn from recent contributions?",
    query_type=cognee.SearchType.TEMPORAL
)
```

## Next steps

* Explore memify to infer new relationships.
* Automate ingestion and analysis with the [Cognee Cloud SDK](/cognee-cloud/cognee-cloud-sdk).

<CardGroup cols={2}>
  <Card title="Cognee Cloud UI" href="/cognee-cloud/cognee-cloud-ui" icon="mouse-pointer">
    Learn to manage datasets and upload files through the UI.
  </Card>

  <Card title="Cognee Cloud SDK" href="/cognee-cloud/cognee-cloud-sdk" icon="code">
    Explore advanced SDK examples and automation patterns.
  </Card>
</CardGroup>
