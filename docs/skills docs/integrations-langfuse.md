> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Observability with Langfuse

## Observability with Langfuse

[Langfuse](https://langfuse.com/) is an open-source observability and analytics platform for LLM-powered applications. It collects traces, generations, and custom metrics so that you can debug, evaluate, and monitor your AI features in production.

## Integration inside Cognee

Cognee ships with Langfuse support as an optional dependency. The integration is intentionally lightweight and consists of just a few lines of code. Anywhere in the codebase where we want observability we add:

```python  theme={null}
from cognee.modules.observability.get_observe import get_observe
observe = get_observe()

@observe(as_type="generation")  # optional label
async def acreate_structured_output(...):
    ...
```

> The decorator is a thin wrapper around Langfuse and automatically creates a **span** every time the function is executed.

The data is sent to the Langfuse backend specified via environment variables and can be inspected in the Langfuse UI.

## Quick start

### 1. Install cognee with monitoring support

Langfuse is included as part of cognee's `monitoring` optional dependencies. You need to install cognee with the monitoring extra:

```bash  theme={null}
pip install 'cognee[monitoring]'
```

<Note>
  Cognee currently supports `langfuse>=2.32.0,<3`.
</Note>

**Running from the cognee source repository?**

If you're developing with the cognee core repo, run the following from the project root on the main branch:

```bash  theme={null}
uv sync --all-extras
```

This will install all optional dependencies, including monitoring/Langfuse support.

### 2. Create a Langfuse project

Create a project at [Langfuse Cloud](https://cloud.langfuse.com/) and copy the *public* and *secret* keys.

### 3. Configure environment variables

Export the following environment variables (for example in your `.env` file):

```
LANGFUSE_PUBLIC_KEY=<your public key>
LANGFUSE_SECRET_KEY=<your secret key>
LANGFUSE_HOST=https://cloud.langfuse.com
```

`BaseConfig` reads these values on startup, so nothing else is required. Start Cognee as usual and open the Langfuse UI – traces will appear in real time.

### 4. Run your regular Cognee workflows

```python  theme={null}
import cognee
import asyncio
from cognee.modules.observability.get_observe import get_observe

observe = get_observe()

@observe(name="simple_example_run", as_type="example")
async def main():
    await cognee.add("Natural language processing (NLP) is ...")
    await cognee.cognify()
    results = await cognee.search("Tell me about NLP")
    for r in results:
        print(r)

asyncio.run(main())
```

## Adding your own spans

You can instrument **any** function in your codebase:

```python  theme={null}
from cognee.modules.observability.get_observe import get_observe
observe = get_observe()

@observe(as_type="my_tool", metadata={"foo": "bar"})
def my_helper(arg1, arg2):
    ...
```

All keyword arguments accepted by `langfuse.decorators.observe` (`name`, `as_type`, `metadata`, …) are forwarded unchanged – see the [Langfuse Python SDK docs](https://langfuse.com/docs/sdk/python) for the full reference.

***

Join [Langfuse](https://discord.langfuse.com/) and [cognee](https://discord.gg/cqF6RhDYWz) communities on Discord for any questions.
