> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Deployment Overview

> Deploy Cognee with flexible data storage options for any scale

Cognee is designed for flexible deployment across development and production environments, with configurable data storage backends that scale with your needs.

## Data Storage Architecture

Cognee operates on a three-tier data storage model, each optimized for specific data types and query patterns:

<CardGroup cols={3}>
  <Card title="Graph Database" icon="network">
    **Relationships & Entities**

    Stores knowledge graph structure, entity relationships, and semantic connections.
  </Card>

  <Card title="Vector Database" icon="brain">
    **Embeddings & Search**

    Handles semantic embeddings for similarity search and content retrieval.
  </Card>

  <Card title="Relational Database" icon="database">
    **Metadata & State**

    Manages datasets, user permissions, pipeline state, and operational data.
  </Card>
</CardGroup>

<Info>
  Each storage layer can be deployed as managed services, self-hosted servers, or file-based systems (like S3 buckets), giving you complete flexibility over your infrastructure.
</Info>

## Deployment Options

Choose the deployment strategy that matches your requirements:

<Tabs>
  <Tab title="Development">
    **Local & Testing**

    * **Docker**: Containerized local deployment with embedded databases
    * **MCP**: Direct integration with code editors and IDEs
    * **File-based**: SQLite, local files, and embedded vector stores
  </Tab>

  <Tab title="Production">
    **Scalable & Managed**

    * **Modal**: Serverless deployment with auto-scaling
    * **Kubernetes**: Container orchestration with Helm charts
    * **EC2**: Traditional cloud server deployment
    * **Cloud Services**: Managed databases (RDS, Neo4j Aura, Qdrant)
  </Tab>

  <Tab title="Hybrid">
    **Flexible Storage**

    * **S3 + Servers**: File storage in S3 with managed database services
    * **Multi-cloud**: Different storage tiers across cloud providers
    * **Edge**: Local processing with cloud storage backends
  </Tab>
</Tabs>

## Storage Configuration Examples

<AccordionGroup>
  <Accordion title="Local Development" defaultOpen>
    **Embedded & File-based**

    ```bash  theme={null}
    # All data stored locally
    GRAPH_DATABASE=networkx
    VECTOR_DATABASE=lancedb
    RELATIONAL_DATABASE=sqlite://./cognee.db
    ```

    <Warning>
      **Multi-Agent Limitation**: Default Kuzu graph store uses file-based locking and is not suitable for concurrent access from multiple agents. Use Neo4j or FalkorDB for multi-agent deployments.
    </Warning>
  </Accordion>

  <Accordion title="Cloud Production">
    **Managed Services**

    ```bash  theme={null}
    # Fully managed cloud services
    GRAPH_DATABASE=neo4j://your-aura-instance
    VECTOR_DATABASE=pinecone://your-index
    RELATIONAL_DATABASE=postgresql://your-rds-instance
    ```
  </Accordion>

  <Accordion title="Hybrid S3">
    **S3 + Managed Databases**

    ```bash  theme={null}
    # Vector data in S3, databases managed
    VECTOR_DATABASE=s3://your-bucket/vectors/
    GRAPH_DATABASE=neo4j://managed-instance
    RELATIONAL_DATABASE=postgresql://rds-instance
    ```
  </Accordion>
</AccordionGroup>

## Quick Start Guide

<Steps>
  <Step title="Choose Deployment">
    Select your deployment method based on scale and requirements
  </Step>

  <Step title="Configure Storage">
    Set up your preferred combination of graph, vector, and relational databases
  </Step>

  <Step title="Deploy & Test">
    Launch Cognee and verify connectivity to all storage backends
  </Step>

  <Step title="Scale">
    Adjust storage and compute resources based on usage patterns
  </Step>
</Steps>

## Deployment Methods

<CardGroup cols={2}>
  <Card title="Modal Deployment" href="/how-to-guides/cognee-sdk/deployment/modal" icon="zap">
    **Serverless & Auto-scaling**

    Perfect for variable workloads with automatic resource management.
  </Card>

  <Card title="Kubernetes (Helm)" href="/how-to-guides/cognee-sdk/deployment/helm" icon="ship">
    **Enterprise & Production**

    Container orchestration with full control and high availability.
  </Card>

  <Card title="EC2 Deployment" href="/how-to-guides/cognee-sdk/deployment/ec2" icon="server">
    **Traditional Cloud**

    Standard server deployment with custom configurations.
  </Card>
</CardGroup>

## Architecture Benefits

<Tip>
  **Flexible Data Tiers**: Each storage layer can be independently scaled, managed, or migrated without affecting others.
</Tip>

<Note>
  **Cost Optimization**: Use file-based storage (S3) for archival data and managed services for active workloads.
</Note>

<Warning>
  **Security**: Ensure proper network security and access controls across all storage tiers in production deployments.
</Warning>

## Need Help?

<Card title="Join Our Community" href="https://discord.gg/m63hxKsp4p" icon="discord">
  Get deployment support, share configurations, and connect with other Cognee users.
</Card>
