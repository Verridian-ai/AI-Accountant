> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# n8n

Connect [n8n](https://n8n.io/) to cognee's AI memory engine and build powerful automation workflows with persistent knowledge graphs. Add data, process it into memory, and run semantic searches - all without writing code.

## Why Use This Integration

* **No-Code Memory**: Build AI memory pipelines using n8n's visual workflow editor
* **Knowledge Graph Search**: Query your data using natural language with graph-enhanced retrieval within n8n workflows
* **Workflow Automation**: Combine cognee memory with 400+ n8n integrations
* **Self-Hosted Ready**: Works with self-hosted n8n instances out of the box

## Installation

The cognee node is available as an n8n community node. Install it directly from n8n:

1. Login to your self-hosted n8n
2. Go to **Settings → Community Nodes**
3. Click **Install** button to add a new node and search for `n8n-nodes-cognee`
4. Click **Install** to complete.

Or install via npm in your n8n instance directory:

```bash  theme={null}
npm install n8n-nodes-cognee
```

<Info>
  For self-hosted n8n, you can quickly spin up an instance following their [documentation](https://docs.n8n.io/hosting/installation/docker/#starting-n8n):

  Don't forget to set your timezone. After setup, access n8n at `localhost:5678`.
</Info>

## Credentials Setup

Before using the cognee node in your workflows, configure your API credentials:

1. Get your API key from [platform.cognee.ai](https://platform.cognee.ai)
2. In your workflow, click + icon and search for cognee, you will see the 3 actions (add, cognify, search available)
3. Click on the Add action to start
4. Add your cognee credentials from the first step

| Field    | Value                                                 |
| -------- | ----------------------------------------------------- |
| Base URL | `https://cognee--cognee-saas-backend-serve.modal.run` |
| API Key  | Your key from platform.cognee.ai                      |

## Quick Start

Build a complete Add → Cognify → Search workflow in minutes:

### Step 1: Add Data

Add the cognee node to your workflow and configure it:

* **Resource**: Add Data
* **Operation**: Add
* **Dataset Name**: `my-dataset`
* **Text Data**: Your content to store

```json  theme={null}
{
  "datasetName": "my-dataset",
  "text_data": ["Natural language processing is an interdisciplinary subfield of computer science and information retrieval."]
}
```

### Step 2: Cognify

Process your data into cognee's knowledge graph memory:

* **Resource**: Cognify
* **Operation**: Cognify
* **Datasets**: `my-dataset`

### Step 3: Search

Query your memory using natural language:

* **Resource**: Search
* **Operation**: Search
* **Search Type**: GraphCompletion
* **Datasets**: `my-dataset`
* **Query**: `Tell me about NLP`
* **Top K**: `10`

## Operations Reference

You can interact with your data cross platform. You can query a dataset that you already have in your [Cognee Cloud](/cognee-cloud/overview) or you can view and interact with your new data from n8n in Cognee Cloud thanks to your cognee credentials.

### Add Data

Stores text content in a cognee dataset for later processing.

| Parameter    | Required | Description                          |
| ------------ | -------- | ------------------------------------ |
| Dataset Name | Yes      | Name of the dataset to store data in |
| Text Data    | Yes      | One or more text strings to add      |

**API Endpoint**: `POST /api/add`

### Cognify

Transforms raw data into structured knowledge graph memory with embeddings.

| Parameter | Required | Description                          |
| --------- | -------- | ------------------------------------ |
| Datasets  | Yes      | One or more dataset names to process |

**API Endpoint**: `POST /api/cognify`

### Search

Queries the knowledge graph memory using semantic search.

| Parameter   | Required | Description                                 |
| ----------- | -------- | ------------------------------------------- |
| Search Type | Yes      | Search algorithm to use                     |
| Datasets    | Yes      | Datasets to search within                   |
| Query       | Yes      | Natural language search query               |
| Top K       | No       | Number of results to retrieve (default: 10) |

**API Endpoint**: `POST /api/search`

## Search Types

Choose the search type that best fits your use case:

<AccordionGroup>
  <Accordion title="GraphCompletion">
    Combines graph traversal with vector search for comprehensive retrieval. Best for:

    * General-purpose queries
    * Finding related entities and relationships
    * Balanced accuracy and context

    ```json  theme={null}
    { "searchType": "GRAPH_COMPLETION" }
    ```
  </Accordion>

  <Accordion title="ChainOfThought">
    Uses step-by-step reasoning over the knowledge graph. Best for:

    * Complex multi-hop questions
    * Queries requiring logical inference
    * Detailed explanations

    ```json  theme={null}
    { "searchType": "GRAPH_COMPLETION_COT" }
    ```
  </Accordion>

  <Accordion title="RagCompletion">
    Standard RAG (Retrieval-Augmented Generation) search. Best for:

    * Simple factual queries
    * Direct document retrieval
    * Fast response times

    ```json  theme={null}
    { "searchType": "RAG_COMPLETION" }
    ```
  </Accordion>
</AccordionGroup>

Learn more about search [here](/guides/search-basics)

## Use Cases

<AccordionGroup>
  <Accordion title="Customer Support Automation">
    Build a support bot that learns from your documentation:

    1. **Add** FAQ documents, guides, and knowledge base articles
    2. **Cognify** to build searchable memory
    3. **Search** with customer questions to retrieve relevant answers

    Connect to Slack, email, or chat integrations in n8n for end-to-end automation.
  </Accordion>

  <Accordion title="Document Intelligence Pipeline">
    Process and query large document collections:

    1. Use n8n's file triggers to watch for new documents
    2. Extract text and **Add** to cognee datasets
    3. Schedule periodic **Cognify** runs
    4. Build search interfaces or connect to chatbots
  </Accordion>

  <Accordion title="Research Assistant">
    Create a research workflow that accumulates knowledge:

    1. Pull data from RSS feeds, APIs, or web scraping nodes
    2. **Add** relevant content to topic-specific datasets
    3. **Cognify** to extract entities and relationships
    4. **Search** across all research to find connections
  </Accordion>

  <Accordion title="Sales Intelligence">
    Build memory from sales interactions:

    1. Connect CRM triggers (HubSpot, Salesforce)
    2. **Add** meeting notes, emails, and deal information
    3. **Cognify** to build relationship graphs
    4. **Search** for context before calls: "What do we know about Acme Corp?"
  </Accordion>
</AccordionGroup>

## Example Workflow

Here's a complete workflow configuration:

```json  theme={null}
{
  "nodes": [
    {
      "name": "Add Data",
      "type": "n8n-nodes-cognee.cognee",
      "parameters": {
        "resource": "addData",
        "operation": "add",
        "datasetName": "support_docs",
        "textData": ["FAQ: Reset password via account settings.", "Guide: Export data as CSV from dashboard."]
      }
    },
    {
      "name": "Cognify",
      "type": "n8n-nodes-cognee.cognee",
      "parameters": {
        "resource": "cognify",
        "operation": "cognify",
        "datasets": ["support_docs"]
      }
    },
    {
      "name": "Search",
      "type": "n8n-nodes-cognee.cognee",
      "parameters": {
        "resource": "search",
        "operation": "search",
        "searchType": "GRAPH_COMPLETION",
        "datasets": ["support_docs"],
        "query": "How do I export my data?",
        "topK": 5
      }
    }
  ]
}
```

## Troubleshooting

| Issue                | Solution                                                 |
| -------------------- | -------------------------------------------------------- |
| 401/403 errors       | Verify your API key is correct and active                |
| Connection errors    | Check the Base URL and network access from your n8n host |
| Empty search results | Ensure you've run Cognify after adding data              |

***

<CardGroup cols={2}>
  <Card title="GitHub Repository" icon="github" href="https://github.com/topoteretes/cognee-n8n">
    View source code and contribute
  </Card>

  <Card title="n8n Documentation" icon="book" href="https://docs.n8n.io/integrations/community-nodes/">
    Learn more about n8n community nodes
  </Card>
</CardGroup>
