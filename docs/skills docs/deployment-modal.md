> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Modal Deployment

> Deploy Cognee on Modal for serverless, auto-scaling knowledge graph processing

# Modal Deployment

Deploy Cognee on Modal for serverless, auto-scaling knowledge graph processing with minimal infrastructure management.

<Info>
  Modal is a cloud platform that lets you run code remotely with automatic scaling, perfect for variable Cognee workloads.
</Info>

## Why Modal?

<CardGroup cols={2}>
  <Card title="Serverless Scaling" icon="trending-up">
    Automatically scales based on workload without server management
  </Card>

  <Card title="Cost Efficient" icon="dollar-sign">
    Pay only for compute time used, ideal for batch processing
  </Card>

  <Card title="Fast Deployment" icon="rocket">
    Deploy within seconds with minimal configuration
  </Card>

  <Card title="GPU Support" icon="cpu">
    Access to powerful GPUs for LLM processing when needed
  </Card>
</CardGroup>

## Prerequisites

<Steps>
  <Step title="Modal Account">
    Create a free account at [modal.com](https://modal.com/)
  </Step>

  <Step title="Install Modal CLI">
    ```bash  theme={null}
    pip install modal
    modal token new
    ```
  </Step>

  <Step title="Environment Variables">
    Set up your environment variables:

    ```bash  theme={null}
    # Required
    export OPENAI_API_KEY="your-openai-api-key"

    # Optional - for external databases
    export POSTGRES_URL="postgresql://user:pass@host:5432/db"
    export NEO4J_URL="bolt://user:pass@host:7687"
    export QDRANT_URL="http://host:6333"
    ```
  </Step>
</Steps>

## Quick Deployment

<Steps>
  <Step title="Clone Repository">
    ```bash  theme={null}
    git clone https://github.com/topoteretes/cognee.git
    cd cognee
    ```
  </Step>

  <Step title="Install Dependencies">
    ```bash  theme={null}
    # Install with uv (recommended)
    uv sync --dev --all-extras --reinstall

    # Activate virtual environment
    source .venv/bin/activate
    ```
  </Step>

  <Step title="Deploy to Modal">
    ```bash  theme={null}
    # Run the Modal deployment script
    modal run -d modal_deployment.py
    ```

    <Note>
      The `-d` flag runs the deployment in detached mode. Monitor progress in your Modal dashboard.
    </Note>
  </Step>

  <Step title="Monitor Deployment">
    Visit your [Modal dashboard](https://modal.com/apps) to monitor the deployment status and view logs.
  </Step>
</Steps>

## Configuration Options

<Tabs>
  <Tab title="Basic Setup">
    **Default Configuration**

    Uses embedded databases for quick testing:

    ```python  theme={null}
    # modal_deployment.py configuration
    GRAPH_DATABASE = "networkx"
    VECTOR_DATABASE = "lancedb"
    RELATIONAL_DATABASE = "sqlite"
    ```
  </Tab>

  <Tab title="Production Setup">
    **External Databases**

    Connect to managed database services:

    ```python  theme={null}
    # Production configuration
    POSTGRES_URL = "postgresql://user:pass@rds-host:5432/cognee"
    NEO4J_URL = "bolt://user:pass@aura-host:7687"
    QDRANT_URL = "https://your-cluster.qdrant.io"
    ```
  </Tab>

  <Tab title="Hybrid Setup">
    **Mixed Storage**

    Combine local and cloud storage:

    ```python  theme={null}
    # Hybrid configuration
    VECTOR_DATABASE = "s3://your-bucket/vectors/"
    GRAPH_DATABASE = "neo4j://managed-instance"
    RELATIONAL_DATABASE = "postgresql://rds-instance"
    ```
  </Tab>
</Tabs>

## Deployment Architecture

<AccordionGroup>
  <Accordion title="Compute Resources" defaultOpen>
    Modal automatically provisions compute resources based on your workload:

    * **CPU**: 2-16 cores per container
    * **Memory**: 4-64 GB RAM per container
    * **GPU**: Optional NVIDIA GPUs for LLM processing
    * **Storage**: Ephemeral storage per container
  </Accordion>

  <Accordion title="Auto-scaling">
    Modal scales your deployment automatically:

    * **Cold Start**: \~2-5 seconds to spin up new containers
    * **Concurrent Processing**: Multiple containers for parallel workloads
    * **Auto-shutdown**: Containers shut down when idle to save costs
  </Accordion>

  <Accordion title="Data Persistence">
    Configure persistent storage for your data:

    * **Volumes**: Modal volumes for persistent file storage
    * **External DBs**: Connect to managed database services
    * **S3 Integration**: Direct S3 access for large datasets
  </Accordion>
</AccordionGroup>

## Monitoring & Debugging

<CardGroup cols={2}>
  <Card title="Modal Dashboard" icon="monitor">
    **Real-time Monitoring**

    View logs, metrics, and container status in the Modal web interface.
  </Card>

  <Card title="Log Streaming" icon="terminal">
    **Live Logs**

    Stream logs directly to your terminal:

    ```bash  theme={null}
    modal logs cognee-app
    ```
  </Card>
</CardGroup>

## Video Tutorial

<iframe width="100%" height="400" src="https://www.youtube.com/embed/86SWVdI5K0Y" title="Cognee Modal Deployment Tutorial" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />

## Cost Optimization

<Tip>
  **Batch Processing**: Group multiple documents together to maximize container utilization and reduce cold start costs.
</Tip>

<Note>
  **Database Costs**: Consider using Modal's built-in storage for development and external managed services for production.
</Note>

## Troubleshooting

<AccordionGroup>
  <Accordion title="Common Issues">
    **Container Timeout**

    * Increase timeout limits in `modal_deployment.py`
    * Break large datasets into smaller batches

    **Memory Errors**

    * Increase container memory allocation
    * Use streaming processing for large files
  </Accordion>

  <Accordion title="Environment Variables">
    **Missing API Keys**

    * Ensure all required environment variables are set
    * Use Modal secrets for sensitive data

    **Database Connections**

    * Verify database URLs and credentials
    * Check network connectivity from Modal containers
  </Accordion>
</AccordionGroup>

## Next Steps

<CardGroup cols={2}>
  <Card title="Scale Up" icon="trending-up">
    **Production Deployment**

    Configure external databases and optimize for production workloads.
  </Card>

  <Card title="Monitor Usage" icon="bar-chart">
    **Track Costs**

    Monitor compute usage and optimize batch sizes for cost efficiency.
  </Card>
</CardGroup>

<Card title="Need Help?" href="https://discord.gg/m63hxKsp4p" icon="discord">
  Join our community for Modal deployment support and best practices.
</Card>
