> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Permissions & Security

> Dataset isolation and security features in Cognee Cloud

Cognee Cloud provides dataset-level isolation and security features to keep your data organized and protected.

## Dataset Isolation

Cognee Cloud automatically creates separate knowledge graphs and vector stores for each dataset:

* **Separate storage**: Each dataset gets its own Kùzu graph database and LanceDB vector store
* **Data isolation**: Documents and their processed knowledge graphs are completely isolated by dataset
* **Search flexibility**: Choose to search within a single dataset or across all datasets

### Working with datasets

**Single dataset search** (default):

```python  theme={null}
# Search within a specific dataset
results = cognee.search("your query", dataset_names=["my_dataset"])
```

**Combined search** (across all datasets):

```python  theme={null}
# Search across all your datasets
results = cognee.search("your query", use_combined_context=True)
```

## Advanced RBAC (Coming to Cognee Cloud)

Cognee's comprehensive role-based access control (RBAC) system will be available in Cognee Cloud soon:

* **User management** — Create and manage users, roles, and tenants
* **Granular permissions** — Read, write, delete, and share permissions at the dataset level
* **Team collaboration** — Multi-user workspaces with role-based access
* **Audit logging** — Complete activity tracking and compliance reporting

<Note>
  These features are already available in [self-hosted Cognee](/getting-started/installation) and will be enabled in Cognee Cloud's cloud platform. See the [Cognee Permissions System](/core-concepts/multi-user-mode/permissions-system/overview) for complete documentation.
</Note>

## Related docs

<CardGroup cols={1}>
  <Card title="Cognee Cloud architecture" href="/cognee-cloud/cognee-cloud-architecture" icon="building">
    Understand where permissions enforcement happens in the stack.
  </Card>
</CardGroup>
