> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Dataset Database Handlers: What are they?

> How Cognee maps datasets to graph and vector storage backends

# What is a Dataset Database Handler?

Dataset Database Handlers are small, pluggable classes that define how a Cognee dataset maps to concrete storage backends for:

* **Graph databases**
* **Vector databases**

They act as the abstraction layer between a logical dataset and its physical storage.

Extensible by design: You can write custom handlers to integrate Cognee with any database and database backend (AWS, Azure, GCP, local setups and etc.) without modifying core code.

<img src="https://mintcdn.com/cognee/3RV_CQWmg4lCODVU/images/dataset-database-handler.jpg?fit=max&auto=format&n=3RV_CQWmg4lCODVU&q=85&s=20c4303641b960dad0a0358bc4a7d967" alt="Dataset Database Handler Diagram" data-og-width="1024" width="1024" data-og-height="687" height="687" data-path="images/dataset-database-handler.jpg" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/cognee/3RV_CQWmg4lCODVU/images/dataset-database-handler.jpg?w=280&fit=max&auto=format&n=3RV_CQWmg4lCODVU&q=85&s=56ed73e62d3b703fb30db1d97e97838b 280w, https://mintcdn.com/cognee/3RV_CQWmg4lCODVU/images/dataset-database-handler.jpg?w=560&fit=max&auto=format&n=3RV_CQWmg4lCODVU&q=85&s=6db9ca13bed20e72bcfc03df4749922a 560w, https://mintcdn.com/cognee/3RV_CQWmg4lCODVU/images/dataset-database-handler.jpg?w=840&fit=max&auto=format&n=3RV_CQWmg4lCODVU&q=85&s=472570c0cb735e25200b288037fdbf37 840w, https://mintcdn.com/cognee/3RV_CQWmg4lCODVU/images/dataset-database-handler.jpg?w=1100&fit=max&auto=format&n=3RV_CQWmg4lCODVU&q=85&s=c06bf1ab302dc7f9be680a1023e400f9 1100w, https://mintcdn.com/cognee/3RV_CQWmg4lCODVU/images/dataset-database-handler.jpg?w=1650&fit=max&auto=format&n=3RV_CQWmg4lCODVU&q=85&s=a4989ba7360d2b323886081ea6eef943 1650w, https://mintcdn.com/cognee/3RV_CQWmg4lCODVU/images/dataset-database-handler.jpg?w=2500&fit=max&auto=format&n=3RV_CQWmg4lCODVU&q=85&s=51b8487c0d58a5d46ec3ba91a4bb6669 2500w" />

In this diagram, we can see that each dataset is mapped to its own unique Neo4j graph database instance using a Neo4j Aura Dataset Database Handler.
This connection is automatically resolved at runtime based on the authenticated user and dataset being accessed and is done when searching/creating/deleting or adding to a dataset.

<Info> If you're using Cognee with `ENABLE_BACKEND_ACCESS_CONTROL` set to `False`, you don't need to configure handlers. </Info>

## What Dataset Database Handlers Do

Handlers encapsulate all backend-specific logic required to manage dataset storage, including:

* **Provisioning or resolution** of per-dataset storage
* **Runtime connection resolution**, such as:
  * Secret decryption
  * Fetching short-lived credentials
* **Teardown and deletion** of per-dataset storage

Handlers are selected through configuration and registered in a central handler registry. This allows Cognee to support multiple providers and custom storage setups without modifying core pipeline code.

## Why Dataset Database Handlers Exist

Dataset Database Handlers solve several core system needs:

* **Multi-tenant isolation** — Each dataset can map to its own graph and/or vector database, enabling clean separation when backend access control is enabled.
* **Pluggability** — Providers like LanceDB, Kùzu, or Neo4j Aura can be added or swapped without changing application logic.
* **Secure secret handling** — Credentials can be resolved at connection time instead of being stored in plaintext in the relational database.
* **Lifecycle control** — All create, resolve, and delete semantics for a backend live in one well-defined place.

<Warning> Cognee requires database instances provisioned via the Dataset Database Handler to be active and running. While Cognee facilitates the creation and deletion of these databases, it does not manage the operational lifecycle—such as starting or stopping containers—during its own startup or shutdown processes. </Warning>

<Columns cols={2}>
  <Card title="Datasets" icon="user" href="/core-concepts/multi-user-mode/permissions-system/datasets">
    Learn about datasets as the core unit of storage in Cognee
  </Card>

  <Card title="Dataset Database Handlers: How to use them" icon="building" href="/core-concepts/multi-user-mode/dataset-database-handlers/dataset-database-handlers-how-to-use-them">
    Deep dive into configuring and using dataset database handlers
  </Card>
</Columns>
