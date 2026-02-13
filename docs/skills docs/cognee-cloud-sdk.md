> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Cognee Cloud SDK

> Use the Cognee Cloud SDK to upload data, cognify it, and search your knowledge graph

The Cognee Cloud SDK is the recommended way to interact with Cognee Cloud programmatically. It is open source and provides a clean Python interface for working with the Cognee Cloud platform. In particular, it makes it easy to perform core Cognee operations—add, cognify, memify, and search—that power Cognee Cloud. You'll need an [API key](/cognee-cloud/sign-up) to get started.

<Note>
  While you can call Cognee Cloud API endpoints directly, the SDK is recommended for its error handling, type safety, and overall developer experience.
</Note>

## Install and configure

```bash  theme={null}
# 1. Create a virtual environment (optional)
uv venv && source .venv/bin/activate

# 2. Install the SDK
uv pip install cogwit-sdk

# 3. Store your key and base URL
export COGWIT_API_KEY="<your key>"
```

## Complete example

Let's jump straight in with a full code example of Cognee Cloud in action. We'll then go over the code piece by piece and explain all the relevant parts in detail.

```python  theme={null}
import asyncio
import os
from cogwit_sdk import cogwit, CogwitConfig
from cogwit_sdk.responses import (
    AddResponse,
    CognifyResponse,
    CombinedSearchResult,
    SearchResult,
)

# Create configuration with your API key
cogwit_config = CogwitConfig(
    api_key=os.getenv("COGWIT_API_KEY", ""),
)

# Create the client instance
cogwit_instance = cogwit(cogwit_config)

async def main():
    # Add data to your dataset
    result = await cogwit_instance.add(
        data="Cognee Cloud automates knowledge graph creation in the cloud.",
        dataset_name="demo_dataset",
    )
    print(f"Added data: {result.status}")
    dataset_id = result.dataset_id

    # Transform data into knowledge graph
    cognify_result = await cogwit_instance.cognify(
        dataset_ids=[dataset_id],
    )
    print(f"Cognify status: {cognify_result[str(dataset_id)].status}")

    # Search with graph completion
    search_results = await cogwit_instance.search(
        query_text="What does Cognee Cloud automate?",
        query_type=cogwit_instance.SearchType.GRAPH_COMPLETION,
    )
    for result in search_results:
        print(f"  {result.search_result}")

    # Search for raw chunks
    chunk_results = await cogwit_instance.search(
        query_text="What does Cognee Cloud automate?",
        query_type=cogwit_instance.SearchType.CHUNKS,
    )
    for result in chunk_results:
        print(f"  {result.search_result[0]['text']}")

asyncio.run(main())
```

## What just happened

### Client setup

```python  theme={null}
cogwit_config = CogwitConfig(
    api_key=os.getenv("COGWIT_API_KEY", ""),
)
cogwit_instance = cogwit(cogwit_config)
```

The SDK uses a client pattern to manage your connection to Cognee Cloud. The client handles authentication, request formatting, and response parsing for you. All SDK operations are async, so we wrap everything in `async def main()` and run it with `asyncio.run(main())`.

### Adding data

```python  theme={null}
result = await cogwit_instance.add(
    data="Cognee Cloud automates knowledge graph creation in the cloud.",
    dataset_name="demo_dataset",
)
```

The `add` operation uploads text to Cognee Cloud and schedules preprocessing. All data is organized by [dataset](/cognee-cloud/permissions-security) for proper isolation. It returns an `AddResponse` with:

* `status` - Whether the operation completed successfully
* `dataset_id` - Unique identifier for your dataset (save this!)
* `dataset_name` - The name you provided

### Cognifying data

```python  theme={null}
cognify_result = await cogwit_instance.cognify(
    dataset_ids=[dataset_id],
)
```

The `cognify` operation transforms your data into a knowledge graph. It returns a `CognifyResponse` that maps dataset IDs to their processing status. Wait for `PipelineRunCompleted` before searching.

### Searching your data

```python  theme={null}
# Graph completion search
search_results = await cogwit_instance.search(
    query_text="What does Cognee Cloud automate?",
    query_type=cogwit_instance.SearchType.GRAPH_COMPLETION,
)
```

The `search` operation queries your knowledge graph. By default it uses `GRAPH_COMPLETION`, but you can use any of the [Cognee search types](/core-concepts/main-operations/search). See also [Search Basics](/guides/search-basics) for detailed parameter explanations.

## Next steps

<CardGroup cols={2}>
  <Card title="Cognee Cloud architecture" href="/cognee-cloud/cognee-cloud-architecture" icon="building">
    Design end-to-end add → cognify → memify → search automations.
  </Card>

  <Card title="Cognee Cloud UI" href="/cognee-cloud/cognee-cloud-ui" icon="mouse-pointer">
    Learn to manage datasets and upload files through the UI.
  </Card>
</CardGroup>
