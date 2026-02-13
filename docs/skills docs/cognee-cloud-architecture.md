> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Cognee Cloud Architecture

> Understanding Cognee's managed infrastructure and how components work together

Cognee Cloud layers orchestration and managed services on top of the open-source Cognee storage model. This document explains how the main components fit together.

<Info>
  Behind the scenes, every pipeline step runs as a Modal job that talks to managed LanceDB, Kuzu, and PostgreSQL clusters.
</Info>

## System Overview

Cognee Cloud's architecture centers around three main layers that work together to provide a managed knowledge processing platform:

### Modal (Managed Infrastructure)

Modal provides the compute foundation for all Cognee Cloud operations:

* **API Services**: Hosts the FastAPI service that handles all REST endpoints and authentication (see [Cognee Cloud SDK](/cognee-cloud/cognee-cloud-sdk))
* **Notebook Sandbox**: Provides isolated environments for running user code with 24-hour timeout support (see [Cognee Cloud Notebooks](/cognee-cloud/cognee-cloud-notebooks))
* **Container Orchestration**: Every API request runs inside a Modal container with secrets managed internally by Cognee Cloud
* **Code Execution**: Notebook code runs in short-lived sandboxes that forward the user's Cognee Cloud API key to the managed API

This infrastructure ensures reliable, scalable execution while keeping all compute resources managed by Cognee Cloud.

### Storage Services (Managed by Cognee Cloud)

All data persistence is handled through Cognee Cloud's managed storage infrastructure:

* **S3** – Central storage for all raw uploads, LanceDB tables, and Kuzu graph files in Cognee Cloud's managed S3 infrastructure
* **LanceDB** – Vector database that stores embeddings generated during the [cognify process](/cognee-cloud/cognee-cloud-sdk#cognify)
* **Kuzu** – Graph database that maintains knowledge graph relationships and entities
* **PostgreSQL** – Relational database for users, datasets, permissions, quotas, and billing records

Each dataset maintains separate storage namespaces for isolation, and all workers share the same state through Cognee Cloud's managed S3 infrastructure.

## Key Architectural Principles

* **Dataset Isolation**: All processing happens at the dataset level, with separate storage namespaces (see [permissions & security](/cognee-cloud/permissions-security) for details)
* **Managed Infrastructure**: Users don't configure Modal, S3, or database credentials—everything is managed by Cognee Cloud
* **Compatibility**: Storage schemas remain compatible with [self-hosted Cognee](/getting-started/installation) for easy [migration](/cognee-cloud/local-mode-and-sync)

## Continue exploring

<CardGroup cols={1}>
  <Card title="Permissions & Security" href="/cognee-cloud/permissions-security" icon="shield">
    See how tenant isolation and RBAC layer onto the storage services.
  </Card>
</CardGroup>
