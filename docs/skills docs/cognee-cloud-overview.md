> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Cognee Cloud Overview

> Our hosted environment for running Cognee’s pipelines without installing or managing any infrastructure. 

Cognee Cloud gives you the functionality of Cognee without local installation and offers a clear path to persistent, production-ready, and collaborative workflows.

Below is an overview of the core parts of the Cognee Cloud environment.

### Managed Environment

* Persistent cloud storage for AI memory—documents, knowledge graphs, and [embeddings](/guides/search-basics#embeddings-and-vector-search).
* Preconfigured [Modal](https://modal.com/) environment instead of local installation, configuration, and maintenance.
* Backed by managed [PostgreSQL](https://postgresql.org/), [LanceDB](https://lancedb.com/), and [Kuzu](https://kuzudb.com/) stores.
* Access is provided through a Cognee Cloud [subscription and API keys](/cognee-cloud/sign-up) used by the UI and SDK.

### Pipeline execution

* Trigger [add](/core-concepts/main-operations/add) → [cognify](/core-concepts/main-operations/cognify) → [memify](/core-concepts/main-operations/memify) pipelines from the [Cloud UI](/cognee-cloud/cognee-cloud-ui), [notebooks](/cognee-cloud/cognee-cloud-notebooks), or the [Python SDK](/cognee-cloud/cognee-cloud-sdk).
* Execution and scheduling run in an isolated workspace context within the cloud runtime.
* [Multi-tenancy and audit logging](/cognee-cloud/permissions-security) keep each workspace’s data and activity separate.

### Python SDK

* Dedicated [`cogwit-sdk`](/cognee-cloud/cognee-cloud-sdk) library with API-key authentication.
* Mirrors the [open-source Cognee API](/core-concepts/overview) signature and behavior.
* Supports uploads, pipeline execution, and [graph-backed search](/guides/search-basics).

### UI

* Notebook-style [web console](/cognee-cloud/cognee-cloud-ui) for uploading files and reviewing memory.
* Surfaces pipeline runs, statuses, and outputs in one place.
* Enables interactive search, browsing, and [dataset management](/core-concepts/further-concepts/datasets).

### Relationship to Cognee OSS

* Cognee Cloud uses the same concepts, operations, and API patterns as [open-source Cognee](/core-concepts/overview), but differs in deployment and use.
  * Cognee Cloud provides hosted persistence and collaboration.
  * Open-source Cognee is for local development, custom infrastructure, or air-gapped needs.
* Local setups can sync with Cognee Cloud for combined workflows.

## Explore Cognee Cloud

<CardGroup cols={3}>
  <Card title="Create account & API key" icon="key" href="/cognee-cloud/sign-up">
    Complete the sign-up checklist, billing, and key creation steps.
  </Card>

  <Card title="Use the Cloud UI" icon="mouse-pointer" href="/cognee-cloud/cognee-cloud-ui">
    Manage datasets, upload files, and trigger cognify from the console.
  </Card>

  <Card title="Use the Python SDK" icon="square-code" href="/cognee-cloud/cognee-cloud-sdk">
    Install `cogwit-sdk` and run add, cognify, and search from Python.
  </Card>

  <Card title="Review the architecture" icon="building" href="/cognee-cloud/cognee-cloud-architecture">
    See how Modal compute, storage services, and datasets fit together.
  </Card>

  <Card title="Check permissions & security" icon="shield" href="/cognee-cloud/permissions-security">
    Understand dataset isolation today and the planned RBAC rollout.
  </Card>

  <Card title="Connect local mode & sync" icon="link" href="/cognee-cloud/local-mode-and-sync">
    Link a local instance and review current sync behavior and limits.
  </Card>
</CardGroup>
