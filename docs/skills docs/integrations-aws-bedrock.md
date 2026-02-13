> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# AWS Bedrock Integration

> Use AWS Bedrock LLMs with Cognee through LiteLLM proxy

Integrate AWS Bedrock LLMs with Cognee using **LiteLLM Proxy** (not the SDK) for seamless access to Anthropic Claude, Amazon Titan, and other Bedrock models. The proxy acts as a server that Cognee connects to, providing a unified interface for all Bedrock models.

## Prerequisites

* AWS account with Bedrock access
* Python 3.8+
* Cognee 0.2.0+

## Setup

### 1. Install LiteLLM Proxy

<Warning>
  Use **LiteLLM Proxy** (not the SDK) for this integration. The proxy acts as a server that Cognee can connect to.
</Warning>

```bash  theme={null}
pip install litellm[proxy]
```

<Note>
  For detailed setup instructions, refer to the [official LiteLLM Bedrock tutorial](https://docs.litellm.ai/docs/providers/bedrock).
</Note>

### 2. Configure LiteLLM Proxy

Create a `config.yaml` file:

```yaml  theme={null}
model_list:
  - model_name: bedrock-claude-3-5-sonnet
    litellm_params:
      model: bedrock/anthropic.claude-3-5-sonnet-20240620-v1:0
      aws_access_key_id: your_aws_id
      aws_secret_access_key: your_aws_key
      aws_region_name: your_aws_region_name
      drop_params: true
```

<Warning>
  The `drop_params: true` setting is important for proper Bedrock integration.
</Warning>

### 3. Start LiteLLM Proxy

```bash  theme={null}
litellm --config config.yaml
```

The proxy will run on `http://localhost:4000` by default.

### 4. Configure Cognee

Create a `.env` file:

```env  theme={null}
LLM_API_KEY = "doesn't matter"
LLM_MODEL = "litellm_proxy/bedrock-claude-3-5-sonnet"
LLM_PROVIDER = "openai"
LLM_ENDPOINT = "http://localhost:4000"

EMBEDDING_PROVIDER=fastembed
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
EMBEDDING_DIMENSIONS=384
EMBEDDING_MAX_TOKENS=256
```

<Warning>
  Set `LLM_PROVIDER = "openai"` - LiteLLM works with this format for Bedrock models.
</Warning>

### 5. Install Cognee

```bash  theme={null}
pip install cognee==0.2.0
```

## Usage Example

```python  theme={null}
import cognee
import asyncio


async def main():
    # Add text to cognee
    await cognee.add("Natural language processing (NLP) is an interdisciplinary subfield of computer science and information retrieval.")

    # Generate the knowledge graph
    await cognee.cognify()

    # Query the knowledge graph
    results = await cognee.search("Tell me about NLP")

    # Display the results
    for result in results:
        print(result)


if __name__ == '__main__':
    asyncio.run(main())
```

## Supported Bedrock Models

* **Anthropic Claude**: `bedrock/anthropic.claude-3-5-sonnet-20240620-v1:0`
* **Amazon Titan**: `bedrock/amazon.titan-text-express-v1`
* **Cohere Command**: `bedrock/cohere.command-text-v14`
* **AI21 Jurassic**: `bedrock/ai21.j2-ultra-v1`

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Verify your AWS credentials and Bedrock permissions
2. **Model Not Found**: Ensure the model name matches exactly in your config
3. **Connection Issues**: Check that LiteLLM proxy is running on the correct port

### Debug Mode

Enable debug logging in LiteLLM:

```bash  theme={null}
litellm --config config.yaml --debug
```

## Resources

<CardGroup cols={2}>
  <Card title="LiteLLM Bedrock Setup" href="https://docs.litellm.ai/docs/providers/bedrock" icon="book">
    **Official LiteLLM Tutorial**

    Complete setup guide for LiteLLM proxy with AWS Bedrock integration.
  </Card>

  <Card title="AWS Bedrock Models" href="https://docs.aws.amazon.com/bedrock/latest/userguide/models.html" icon="cloud">
    **Available Models**

    Explore all available Bedrock models including Claude, Titan, and Cohere.
  </Card>
</CardGroup>
