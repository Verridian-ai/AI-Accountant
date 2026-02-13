> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Evaluation with DeepEval

## Why DeepEval?

[DeepEval](https://deepeval.com/) is an open-source evaluation framework that provides ready-made metrics (both traditional and LLM-as-a-judge) for LLM pipelines. Compared with hand-rolled evaluation scripts, DeepEval lets you:

* Track **Contextual Relevancy**, **Contextual Precision/Recall**, **Coverage** and more.
* Swap between automatic string-based metrics (EM/F1) and LLM-based scoring with a single flag.
* Re-use the same metrics across different projects and datasets.

> DeepEval stores no data – it simply runs metrics locally or via your preferred LLM. That makes it a perfect drop-in evaluator for Cognee’s pipelines.

## DeepEval inside Cognee

Cognee ships with a dedicated **`DeepEvalAdapter`**. When enabled, every answer produced by your pipeline is scored with the metrics you choose.

```python  theme={null}
evaluating_answers: bool = True
evaluating_contexts: bool = True
evaluation_engine: str = "DeepEval"  # Options: 'DeepEval', 'DirectLLM'
evaluation_metrics: list[str] = [
    "correctness",   # LLM-based correctness
    "EM",            # Exact-Match
    "f1",            # Token-level precision / recall
]
deepeval_model: str = "gpt-4o-mini"  # Any OpenAI-compatible LLM
```

Behind the scenes the adapter:

1. Transforms Cognee’s `Answer` objects into DeepEval’s `LLMTestCase` format.
2. Runs the selected metrics.
3. Stores the raw scores alongside rationales so they appear in Cognee’s HTML dashboard.

## Quick Start

1. **Install Cognee** (DeepEval is declared in `pyproject.toml` so you automatically get the dependency).
2. Set your LLM API key so DeepEval can run LLM-based metrics:

```python  theme={null}
import os
os.environ["LLM_API_KEY"] = "<YOUR_OPENAI_API_KEY>"
```

You can also export the variable in your shell (`export LLM_API_KEY=...`).
3\. (Optional) Configure the model DeepEval should call:

```bash  theme={null}
export DEEPEVAL_MODEL=gpt-4o
```

4. Run a standard Cognee pipeline (add → cognify → search). The evaluation executor will automatically invoke DeepEval.

## Useful Links

* DeepEval integration guide – [deepeval.com » Cognee](https://deepeval.com/integrations/vector-databases/cognee)
* DeepEval docs – [deepeval.com/docs](https://deepeval.com/docs/getting-started)

***

Join the conversation on [Discord](https://discord.gg/m63hxKsp4p) and let us know how DeepEval works for you!
