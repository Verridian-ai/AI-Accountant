> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Multi-User Mode Overview

> How Cognee handles multiple users and data isolation between users.

Multi-user mode is the architectural directive in Cognee that enforces strict data isolation between different users and [datasets](/core-concepts/further-concepts/datasets). It is primarily controlled by the environment variable ENABLE\_BACKEND\_ACCESS\_CONTROL.

Starting with version 0.5.0, this mode is enabled by default to ensure a "secure-by-default" posture for all deployments.

To turn off multi-user mode, set the environment variable `ENABLE_BACKEND_ACCESS_CONTROL=false`.

<Info>Data Isolation Enforcement — When active, Cognee partitions the knowledge graph and vector stores, ensuring data created by one user is neither visible nor accessible to another, unless read permission has been given to the other user.</Info>

When multi-user mode is active, the system unlocks several multi-tenant features:

* **Isolated Search**: Search operations are strictly scoped to datasets the authenticated user has explicit read access to. To learn more about the permissions system and access types, read about our [Permission System](/core-concepts/multi-user-mode/permissions-system/overview).

* **Granular Management**: Adding or removing documents is scoped at the dataset level, preventing global knowledge pool pollution.

* **Automatic Routing**: The system automatically determines which local/cloud database or logical schema to connect to based on the dataset. This is done with the help of [Dataset Database Handlers](/core-concepts/multi-user-mode/dataset-database-handlers/dataset-database-handlers-what-are-they).

<Columns cols={2}>
  <Card title="Permission System" icon="user" href="/core-concepts/multi-user-mode/permissions-system/overview">
    Learn about the permission system that powers multi-user mode
  </Card>

  <Card title="Dataset Database Handlers" icon="building" href="/core-concepts/multi-user-mode/dataset-database-handlers/dataset-database-handlers-what-are-they">
    Understand database connection resolution per dataset
  </Card>
</Columns>
