> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Observability with Keywords AI

## Observability with Keywords AI

[Keywords AI](https://www.keywordsai.co/) provides observability and tracing for LLM-powered and agentic applications. In Cognee, it captures spans for tasks and workflows via the same `@observe` decorator used across providers.

## Keywords AI inside Cognee

Cognee exposes a single abstraction for observability: `get_observe()` returning the `@observe` decorator. The Keywords AI integration is provided via the `cognee-community` extension hub as `cognee-community-observability-keywordsai`.

* **About `cognee-community`**: This is Cognee’s extension hub. Adapters for third‑party databases, pipelines, and community-contributed tasks live here, evolving independently from core. Installs stay slim (only what you need), and a predictable layout under `packages/*` keeps providers consistent.
* **Drop-in**: Importing the package patches Cognee’s `get_observe()` to return a Keywords AI–backed decorator when `MONITORING_TOOL=keywordsai`.
* **Decorator mapping**: `@observe` and `@observe(workflow=True)` map to Keywords AI’s `task()` and `workflow()` decorators from `keywordsai-tracing`.

### Installation and Configuration

```bash  theme={null}
pip install cognee-community-observability-keywordsai

# Required
export MONITORING_TOOL=keywordsai
export KEYWORDSAI_API_KEY=<your_KeywordsAI_key>

# If your pipeline elsewhere calls LLMs (optional)
export LLM_API_KEY=<your_OpenAI_key>
```

### Minimal Example

```python  theme={null}
# 1) Import to patch Cognee
import cognee_community_observability_keywordsai  # noqa: F401

# 2) Use Cognee's abstraction
from cognee.modules.observability.get_observe import get_observe
observe = get_observe()  # returns Keywords AI decorator when MONITORING_TOOL=keywordsai

# 3) Decorate a task
@observe
def ingest_files(data: list[dict]):
    ...

# 4) Decorate a workflow
@observe(workflow=True)
async def main():
    ...
```

Behind the scenes, Cognee’s community adapter:

1. Patches `get_observe()` so it returns a Keywords AI–aware decorator when configured.
2. Initializes telemetry via `KeywordsAITelemetry()` once on import.
3. Wraps tasks with `task()` and workflows with `workflow()` from `keywordsai-tracing`.

## Quick Start

1. Install the integration:

   ```bash  theme={null}
   pip install cognee-community-observability-keywordsai
   ```

2. Configure your environment:

   ```bash  theme={null}
   export MONITORING_TOOL=keywordsai
   export KEYWORDSAI_API_KEY=<your_KeywordsAI_key>

   export LLM_API_KEY=<your_OpenAI_key>
   ```

3. Import the package early (so `get_observe()` is patched), decorate your tasks/workflows, and run your pipeline.

4. Open your Keywords AI dashboard to inspect spans across tasks and workflows.

## Useful Links

* Get a Keywords AI API key: [Keywords AI Platform](https://platform.keywordsai.co/)
* Community package: [cognee-community/packages/observability/keywordsai](https://github.com/topoteretes/cognee-community/tree/main/packages/observability/keywordsai)

***

Join the conversation on [Discord](https://discord.gg/m63hxKsp4p) and let us know how the Keywords AI integration works for you!
