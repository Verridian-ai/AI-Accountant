# Cognee Documentation

## Docs

- [Add](https://docs.cognee.ai/api-reference/add/add.md): Add data to a dataset for processing and knowledge graph construction.

This endpoint accepts various types of data (files, URLs, GitHub repositories)
and adds them to a specified dataset for processing. The data is ingested,
analyzed, and integrated into the knowledge graph.

## Request Parameters

- **data** (List[UploadFile]): List of files to upload. Can also include:
  - HTTP URLs (if ALLOW_HTTP_REQUESTS is enabled)
  - GitHub repository URLs (will be cloned and processed)
  - Regular file uploads
- **datasetName** (Optional[str]): Name of the dataset to add data to
- **datasetId** (Optional[UUID]): UUID of an already existing dataset

Either datasetName or datasetId must be provided.

## Response

Returns information about the add operation containing:

- Status of the operation
- Details about the processed data
- Any relevant metadata from the ingestion process

## Error Codes

- **400 Bad Request**: Neither datasetId nor datasetName provided
- **409 Conflict**: Error during add operation
- **403 Forbidden**: User doesn't have permission to add to dataset

## Notes

- To add data to datasets not owned by the user, use dataset_id (when ENABLE_BACKEND_ACCESS_CONTROL is set to True)
- GitHub repositories are cloned and all files are processed
- HTTP URLs are fetched and their content is processed
- The ALLOW_HTTP_REQUESTS environment variable controls URL processing
- datasetId value can only be the UUID of an already existing dataset
- [Auth:Cookie.Login](https://docs.cognee.ai/api-reference/auth/auth:cookielogin.md)
- [Auth:Cookie.Logout](https://docs.cognee.ai/api-reference/auth/auth:cookielogout.md)
- [Register:Register](https://docs.cognee.ai/api-reference/auth/register:register.md)
- [Reset:Forgot Password](https://docs.cognee.ai/api-reference/auth/reset:forgot-password.md)
- [Reset:Reset Password](https://docs.cognee.ai/api-reference/auth/reset:reset-password.md)
- [Verify:Request-Token](https://docs.cognee.ai/api-reference/auth/verify:request-token.md)
- [Verify:Verify](https://docs.cognee.ai/api-reference/auth/verify:verify.md)
- [Code Pipeline Index](https://docs.cognee.ai/api-reference/code-pipeline/code-pipeline-index.md): Run indexation on a code repository.

This endpoint processes a code repository to create a knowledge graph
of the codebase structure, dependencies, and relationships.

## Request Parameters

- **repo_path** (str): Path to the code repository
- **include_docs** (bool): Whether to include documentation files (default: false)

## Response

No content returned. Processing results are logged.

## Error Codes

- **409 Conflict**: Error during indexation process
- [Code Pipeline Retrieve](https://docs.cognee.ai/api-reference/code-pipeline/code-pipeline-retrieve.md): Retrieve context from the code knowledge graph.

This endpoint searches the indexed code repository to find relevant
context based on the provided query.

## Request Parameters

- **query** (str): Search query for code context
- **full_input** (str): Full input text for processing

## Response

Returns a list of relevant code files and context as JSON.

## Error Codes

- **409 Conflict**: Error during retrieval process
- [Cognify](https://docs.cognee.ai/api-reference/cognify/cognify.md): Transform datasets into structured knowledge graphs through cognitive processing.

This endpoint is the core of Cognee's intelligence layer, responsible for converting
raw text, documents, and data added through the add endpoint into semantic knowledge graphs.
It performs deep analysis to extract entities, relationships, and insights from ingested content.

## Processing Pipeline

1. Document classification and permission validation
2. Text chunking and semantic segmentation
3. Entity extraction using LLM-powered analysis
4. Relationship detection and graph construction
5. Vector embeddings generation for semantic search
6. Content summarization and indexing

## Request Parameters

- **datasets** (Optional[List[str]]): List of dataset names to process. Dataset names are resolved to datasets owned by the authenticated user.
- **dataset_ids** (Optional[List[UUID]]): List of existing dataset UUIDs to process. UUIDs allow processing of datasets not owned by the user (if permitted).
- **run_in_background** (Optional[bool]): Whether to execute processing asynchronously. Defaults to False (blocking).

## Response

- **Blocking execution**: Complete pipeline run information with entity counts, processing duration, and success/failure status
- **Background execution**: Pipeline run metadata including pipeline_run_id for status monitoring via WebSocket subscription

## Error Codes

- **400 Bad Request**: When neither datasets nor dataset_ids are provided, or when specified datasets don't exist
- **409 Conflict**: When processing fails due to system errors, missing LLM API keys, database connection failures, or corrupted content

## Example Request

```json
{
    "datasets": ["research_papers", "documentation"],
    "run_in_background": false
}
```

## Notes

To cognify data in datasets not owned by the user and for which the current user has write permission,
the dataset_id must be used (when ENABLE_BACKEND_ACCESS_CONTROL is set to True).

## Next Steps

After successful processing, use the search endpoints to query the generated knowledge graph for insights, relationships, and semantic search.

- [Create New Dataset](https://docs.cognee.ai/api-reference/datasets/create-new-dataset.md): Create a new dataset or return existing dataset with the same name.

This endpoint creates a new dataset with the specified name. If a dataset
with the same name already exists for the user, it returns the existing
dataset instead of creating a duplicate. The user is automatically granted
all permissions (read, write, share, delete) on the created dataset.

## Request Parameters

- **dataset_data** (DatasetCreationPayload): Dataset creation parameters containing:
  - **name**: The name for the new dataset

## Response

Returns the created or existing dataset object containing:

- **id**: Unique dataset identifier
- **name**: Dataset name
- **created_at**: When the dataset was created
- **updated_at**: When the dataset was last updated
- **owner_id**: ID of the dataset owner

## Error Codes

- **418 I'm a teapot**: Error creating dataset
- [Delete Data](https://docs.cognee.ai/api-reference/datasets/delete-data.md): Delete a specific data item from a dataset.

This endpoint removes a specific data item from a dataset while keeping
the dataset itself intact. The user must have delete permissions on the
dataset to perform this operation.

## Path Parameters

- **dataset_id** (UUID): The unique identifier of the dataset containing the data
- **data_id** (UUID): The unique identifier of the data item to delete

## Response

No content returned on successful deletion.

## Error Codes

- **404 Not Found**: Dataset or data item doesn't exist, or user doesn't have access
- **500 Internal Server Error**: Error during deletion
- [Delete Dataset](https://docs.cognee.ai/api-reference/datasets/delete-dataset.md): Delete a dataset by its ID.

This endpoint permanently deletes a dataset and all its associated data.
The user must have delete permissions on the dataset to perform this operation.

## Path Parameters

- **dataset_id** (UUID): The unique identifier of the dataset to delete

## Response

No content returned on successful deletion.

## Error Codes

- **404 Not Found**: Dataset doesn't exist or user doesn't have access
- **500 Internal Server Error**: Error during deletion
- [Get Dataset Data](https://docs.cognee.ai/api-reference/datasets/get-dataset-data.md): Get all data items in a dataset.

This endpoint retrieves all data items (documents, files, etc.) that belong
to a specific dataset. Each data item includes metadata such as name, type,
creation time, and storage location.

## Path Parameters

- **dataset_id** (UUID): The unique identifier of the dataset

## Response

Returns a list of data objects containing:

- **id**: Unique data item identifier
- **name**: Data item name
- **created_at**: When the data was added
- **updated_at**: When the data was last updated
- **extension**: File extension
- **mime_type**: MIME type of the data
- **raw_data_location**: Storage location of the raw data

## Error Codes

- **404 Not Found**: Dataset doesn't exist or user doesn't have access
- **500 Internal Server Error**: Error retrieving data
- [Get Dataset Graph](https://docs.cognee.ai/api-reference/datasets/get-dataset-graph.md): Get the knowledge graph visualization for a dataset.

This endpoint retrieves the knowledge graph data for a specific dataset,
including nodes and edges that represent the relationships between entities
in the dataset. The graph data is formatted for visualization purposes.

## Path Parameters

- **dataset_id** (UUID): The unique identifier of the dataset

## Response

Returns the graph data containing:

- **nodes**: List of graph nodes with id, label, and properties
- **edges**: List of graph edges with source, target, and label

## Error Codes

- **404 Not Found**: Dataset doesn't exist or user doesn't have access
- **500 Internal Server Error**: Error retrieving graph data
- [Get Dataset Status](https://docs.cognee.ai/api-reference/datasets/get-dataset-status.md): Get the processing status of datasets.

This endpoint retrieves the current processing status of one or more datasets,
indicating whether they are being processed, have completed processing, or
encountered errors during pipeline execution.

## Query Parameters

- **dataset** (List[UUID]): List of dataset UUIDs to check status for

## Response

Returns a dictionary mapping dataset IDs to their processing status:

- **pending**: Dataset is queued for processing
- **running**: Dataset is currently being processed
- **completed**: Dataset processing completed successfully
- **failed**: Dataset processing encountered an error

## Error Codes

- **500 Internal Server Error**: Error retrieving status information
- [Get Datasets](https://docs.cognee.ai/api-reference/datasets/get-datasets.md): Get all datasets accessible to the authenticated user.

This endpoint retrieves all datasets that the authenticated user has
read permissions for. The datasets are returned with their metadata
including ID, name, creation time, and owner information.

## Response

Returns a list of dataset objects containing:

- **id**: Unique dataset identifier
- **name**: Dataset name
- **created_at**: When the dataset was created
- **updated_at**: When the dataset was last updated
- **owner_id**: ID of the dataset owner

## Error Codes

- **418 I'm a teapot**: Error retrieving datasets
- [Get Raw Data](https://docs.cognee.ai/api-reference/datasets/get-raw-data.md): Download the raw data file for a specific data item.

This endpoint allows users to download the original, unprocessed data file
for a specific data item within a dataset. The file is returned as a direct
download with appropriate headers.

## Path Parameters

- **dataset_id** (UUID): The unique identifier of the dataset containing the data
- **data_id** (UUID): The unique identifier of the data item to download

## Response

Returns the raw data file as a downloadable response.

## Error Codes

- **404 Not Found**: Dataset or data item doesn't exist, or user doesn't have access
- **500 Internal Server Error**: Error accessing the raw data file
- [Delete](https://docs.cognee.ai/api-reference/delete/delete.md): Delete data by its ID from the specified dataset.

Args:
    data_id: The UUID of the data to delete
    dataset_id: The UUID of the dataset containing the data
    mode: "soft" (default) or "hard" - hard mode also deletes degree-one entity nodes
    user: Authenticated user

Returns:
    JSON response indicating success or failure

- [Detailed Health Check](https://docs.cognee.ai/api-reference/detailed-health-check.md): Comprehensive health status with component details.
- [Health Check](https://docs.cognee.ai/api-reference/health-check.md): Health check endpoint for liveness/readiness probes.
- [API Reference](https://docs.cognee.ai/api-reference/introduction.md): Complete API documentation for Cognee's knowledge graph platform
- [Add User To Role](https://docs.cognee.ai/api-reference/permissions/add-user-to-role.md): Add a user to a role.

This endpoint assigns a user to a specific role, granting them all the
permissions associated with that role. The authenticated user must be
the owner of the role or have appropriate administrative permissions.

## Path Parameters

- **user_id** (UUID): The UUID of the user to add to the role

## Request Parameters

- **role_id** (UUID): The UUID of the role to assign the user to

## Response

Returns a success message indicating the user was added to the role.

## Error Codes

- **400 Bad Request**: Invalid user or role ID
- **403 Forbidden**: User doesn't have permission to assign roles
- **404 Not Found**: User or role doesn't exist
- **500 Internal Server Error**: Error adding user to role
- [Add User To Tenant](https://docs.cognee.ai/api-reference/permissions/add-user-to-tenant.md): Add a user to a tenant.

This endpoint assigns a user to a specific tenant, allowing them to access
resources and data associated with that tenant. The authenticated user must
be the owner of the tenant or have appropriate administrative permissions.

## Path Parameters

- **user_id** (UUID): The UUID of the user to add to the tenant

## Request Parameters

- **tenant_id** (UUID): The UUID of the tenant to assign the user to

## Response

Returns a success message indicating the user was added to the tenant.

## Error Codes

- **400 Bad Request**: Invalid user or tenant ID
- **403 Forbidden**: User doesn't have permission to assign tenants
- **404 Not Found**: User or tenant doesn't exist
- **500 Internal Server Error**: Error adding user to tenant
- [Create Role](https://docs.cognee.ai/api-reference/permissions/create-role.md): Create a new role.

This endpoint creates a new role with the specified name. Roles are used
to group permissions and can be assigned to users to manage access control
more efficiently. The authenticated user becomes the owner of the created role.

## Request Parameters

- **role_name** (str): The name of the role to create

## Response

Returns a success message indicating the role was created.

## Error Codes

- **400 Bad Request**: Invalid role name or role already exists
- **500 Internal Server Error**: Error creating the role
- [Create Tenant](https://docs.cognee.ai/api-reference/permissions/create-tenant.md): Create a new tenant.

This endpoint creates a new tenant with the specified name. Tenants are used
to organize users and resources in multi-tenant environments, providing
isolation and access control between different groups or organizations.

## Request Parameters

- **tenant_name** (str): The name of the tenant to create

## Response

Returns a success message indicating the tenant was created.

## Error Codes

- **400 Bad Request**: Invalid tenant name or tenant already exists
- **500 Internal Server Error**: Error creating the tenant
- [Give Datasets Permission To Principal](https://docs.cognee.ai/api-reference/permissions/give-datasets-permission-to-principal.md): Grant permission on datasets to a principal (user or role).

This endpoint allows granting specific permissions on one or more datasets
to a principal (which can be a user or role). The authenticated user must
have appropriate permissions to grant access to the specified datasets.

## Path Parameters

- **principal_id** (UUID): The UUID of the principal (user or role) to grant permission to

## Request Parameters

- **permission_name** (str): The name of the permission to grant (e.g., "read", "write", "delete")
- **dataset_ids** (List[UUID]): List of dataset UUIDs to grant permission on

## Response

Returns a success message indicating permission was assigned.

## Error Codes

- **400 Bad Request**: Invalid request parameters
- **403 Forbidden**: User doesn't have permission to grant access
- **500 Internal Server Error**: Error granting permission
- [Create Response](https://docs.cognee.ai/api-reference/responses/create-response.md): OpenAI-compatible responses endpoint with function calling support.

This endpoint provides OpenAI-compatible API responses with integrated
function calling capabilities for Cognee operations.

## Request Parameters

- **input** (str): The input text to process
- **model** (str): The model to use for processing
- **tools** (Optional[List[Dict]]): Available tools for function calling
- **tool_choice** (Any): Tool selection strategy (default: "auto")
- **temperature** (float): Response randomness (default: 1.0)

## Response

Returns an OpenAI-compatible response body with function call results.

## Error Codes

- **400 Bad Request**: Invalid request parameters
- **500 Internal Server Error**: Error processing request

## Notes

- Compatible with OpenAI API format
- Supports function calling with Cognee tools
- Uses default tools if none provided
- [Root](https://docs.cognee.ai/api-reference/root.md): Root endpoint that returns a welcome message.
- [Get Search History](https://docs.cognee.ai/api-reference/search/get-search-history.md): Get search history for the authenticated user.

This endpoint retrieves the search history for the authenticated user,
returning a list of previously executed searches with their timestamps.

## Response

Returns a list of search history items containing:

- **id**: Unique identifier for the search
- **text**: The search query text
- **user**: User who performed the search
- **created_at**: When the search was performed

## Error Codes

- **500 Internal Server Error**: Error retrieving search history
- [Search](https://docs.cognee.ai/api-reference/search/search.md): Search for nodes in the graph database.

This endpoint performs semantic search across the knowledge graph to find
relevant nodes based on the provided query. It supports different search
types and can be scoped to specific datasets.

## Request Parameters

- **search_type** (SearchType): Type of search to perform
- **datasets** (Optional[List[str]]): List of dataset names to search within
- **dataset_ids** (Optional[List[UUID]]): List of dataset UUIDs to search within
- **query** (str): The search query string
- **top_k** (Optional[int]): Maximum number of results to return (default: 10)

## Response

Returns a list of search results containing relevant nodes from the graph.

## Error Codes

- **409 Conflict**: Error during search operation
- **403 Forbidden**: User doesn't have permission to search datasets (returns empty list)

## Notes

- Datasets sent by name will only map to datasets owned by the request sender
- To search datasets not owned by the request sender, dataset UUID is needed
- If permission is denied, returns empty list instead of error
- [Get Settings](https://docs.cognee.ai/api-reference/settings/get-settings.md): Get the current system settings.

This endpoint retrieves the current configuration settings for the system,
including LLM (Large Language Model) configuration and vector database
configuration. These settings determine how the system processes and stores data.

## Response

Returns the current system settings containing:

- **llm**: LLM configuration (provider, model, API key)
- **vector_db**: Vector database configuration (provider, URL, API key)

## Error Codes

- **500 Internal Server Error**: Error retrieving settings
- [Save Settings](https://docs.cognee.ai/api-reference/settings/save-settings.md): Save or update system settings.

This endpoint allows updating the system configuration settings. You can
update either the LLM configuration, vector database configuration, or both.
Only provided settings will be updated; others remain unchanged.

## Request Parameters

- **llm** (Optional[LLMConfigInputDTO]): LLM configuration (provider, model, API key)
- **vector_db** (Optional[VectorDBConfigInputDTO]): Vector database configuration (provider, URL, API key)

## Response

No content returned on successful save.

## Error Codes

- **400 Bad Request**: Invalid settings provided
- **500 Internal Server Error**: Error saving settings
- [Users:Current User](https://docs.cognee.ai/api-reference/users/users:current-user.md)
- [Users:Delete User](https://docs.cognee.ai/api-reference/users/users:delete-user.md)
- [Users:Patch Current User](https://docs.cognee.ai/api-reference/users/users:patch-current-user.md)
- [Users:Patch User](https://docs.cognee.ai/api-reference/users/users:patch-user.md)
- [Users:User](https://docs.cognee.ai/api-reference/users/users:user.md)
- [Visualize](https://docs.cognee.ai/api-reference/visualize/visualize.md): Generate an HTML visualization of the dataset's knowledge graph.

This endpoint creates an interactive HTML visualization of the knowledge graph
for a specific dataset. The visualization displays nodes and edges representing
entities and their relationships, allowing users to explore the graph structure
visually.

## Query Parameters

- **dataset_id** (UUID): The unique identifier of the dataset to visualize

## Response

Returns an HTML page containing the interactive graph visualization.

## Error Codes

- **404 Not Found**: Dataset doesn't exist
- **403 Forbidden**: User doesn't have permission to read the dataset
- **500 Internal Server Error**: Error generating visualization

## Notes

- User must have read permissions on the dataset
- Visualization is interactive and allows graph exploration
- [Cognee CLI Overview](https://docs.cognee.ai/cognee-cli/overview.md): Command line interface for Cognee AI memory operations
- [Cognee Cloud Architecture](https://docs.cognee.ai/cognee-cloud/cognee-cloud-architecture.md): Understanding Cognee's managed infrastructure and how components work together
- [Cognee Cloud Notebooks](https://docs.cognee.ai/cognee-cloud/cognee-cloud-notebooks.md): Run code against datasets using Cognee Cloud notebooks
- [Cognee Cloud SDK](https://docs.cognee.ai/cognee-cloud/cognee-cloud-sdk.md): Use the Cognee Cloud SDK to upload data, cognify it, and search your knowledge graph
- [Cognee Cloud UI](https://docs.cognee.ai/cognee-cloud/cognee-cloud-ui.md): Work with datasets and data ingestion through the Cognee Cloud UI
- [Local Mode & Sync](https://docs.cognee.ai/cognee-cloud/local-mode-and-sync.md): Connect to local Cognee instances and sync data between local and cloud environments
- [Cognee Cloud Overview](https://docs.cognee.ai/cognee-cloud/overview.md): Our hosted environment for running Cognee’s pipelines without installing or managing any infrastructure.
- [Permissions & Security](https://docs.cognee.ai/cognee-cloud/permissions-security.md): Dataset isolation and security features in Cognee Cloud
- [Sign Up & Prerequisites](https://docs.cognee.ai/cognee-cloud/sign-up.md): Create your Cognee Cloud account, subscription, and API key
- [Claude Code](https://docs.cognee.ai/cognee-mcp/integrations/claude-code.md)
- [Cline](https://docs.cognee.ai/cognee-mcp/integrations/cline.md)
- [Continue](https://docs.cognee.ai/cognee-mcp/integrations/continue.md)
- [Cursor](https://docs.cognee.ai/cognee-mcp/integrations/cursor.md)
- [Roo Code](https://docs.cognee.ai/cognee-mcp/integrations/roo-code.md)
- [Local Setup](https://docs.cognee.ai/cognee-mcp/mcp-local-setup.md): Deploy Cognee MCP server from source for development and customization
- [Overview](https://docs.cognee.ai/cognee-mcp/mcp-overview.md): Connect Cognee's knowledge graph platform with MCP-compatible AI tools
- [Quickstart](https://docs.cognee.ai/cognee-mcp/mcp-quickstart.md): Get Cognee MCP running in minutes with Docker
- [Tools Reference](https://docs.cognee.ai/cognee-mcp/mcp-tools.md): Complete reference for all Cognee MCP tools and operations
- [Contributing Overview](https://docs.cognee.ai/contributing/contributing-overview.md): Contribute to the cognee project
- [Architecture](https://docs.cognee.ai/core-concepts/architecture.md): Understanding Cognee's storage architecture and system components
- [DataPoints](https://docs.cognee.ai/core-concepts/building-blocks/datapoints.md): Atomic units of knowledge in Cognee
- [Pipelines](https://docs.cognee.ai/core-concepts/building-blocks/pipelines.md): Orchestrating tasks into coordinated workflows for data processing
- [Tasks](https://docs.cognee.ai/core-concepts/building-blocks/tasks.md): Building blocks of processing that transform data in Cognee pipelines
- [Datasets](https://docs.cognee.ai/core-concepts/further-concepts/datasets.md): Project-level containers for organization, permissions, and processing
- [NodeSets](https://docs.cognee.ai/core-concepts/further-concepts/node-sets.md): Tagging and grouping data in Cognee
- [Ontologies](https://docs.cognee.ai/core-concepts/further-concepts/ontologies.md): Enrich your knowledge graph with external vocabularies
- [Add](https://docs.cognee.ai/core-concepts/main-operations/add.md): Ingesting and preparing data for processing in Cognee
- [Cognify](https://docs.cognee.ai/core-concepts/main-operations/cognify.md): Transforming ingested data into a knowledge graph with embeddings, chunks, and summaries
- [Memify](https://docs.cognee.ai/core-concepts/main-operations/memify.md): Semantic enrichment of existing knowledge graphs with derived facts
- [Search](https://docs.cognee.ai/core-concepts/main-operations/search.md): Query your AI memory with vectors, graphs, and LLMs
- [Dataset Database Handlers: How to use them?](https://docs.cognee.ai/core-concepts/multi-user-mode/dataset-database-handlers/dataset-database-handlers-how-to-use-them.md): How to use Dataset Database Handlers in Cognee for multi-user mode
- [Dataset Database Handlers: What are they?](https://docs.cognee.ai/core-concepts/multi-user-mode/dataset-database-handlers/dataset-database-handlers-what-are-they.md): How Cognee maps datasets to graph and vector storage backends
- [FalkorDB Dataset Database Handler](https://docs.cognee.ai/core-concepts/multi-user-mode/dataset-database-handlers/existing-dataset-database-handlers/falkor.md): Handler for connecting to a FalkorDB database, enabling multi-user mode on the FalkorDB database instance.
- [Kuzu Dataset Database Handler](https://docs.cognee.ai/core-concepts/multi-user-mode/dataset-database-handlers/existing-dataset-database-handlers/kuzu.md): Handler for connecting to a Kuzu database, enabling multi-user mode.
- [LanceDB Dataset Database Handler](https://docs.cognee.ai/core-concepts/multi-user-mode/dataset-database-handlers/existing-dataset-database-handlers/lancedb.md): Handler for connecting to a LanceDB database, enabling multi-user mode.
- [Neo4j Aura Dataset Database Handler](https://docs.cognee.ai/core-concepts/multi-user-mode/dataset-database-handlers/existing-dataset-database-handlers/neo4j-aura-dev.md): Handler for connecting to a Neo4j database, enabling multi-user mode on a Neo4j database instance hosted on their cloud, Neo4j Aura.
- [PGVector Dataset Database Handler](https://docs.cognee.ai/core-concepts/multi-user-mode/dataset-database-handlers/existing-dataset-database-handlers/pgvector.md): Handler for connecting to a Postgres database with the PGVector extension, enabling multi-user mode on the Postgres database instance.
- [Qdrant Dataset Database Handler](https://docs.cognee.ai/core-concepts/multi-user-mode/dataset-database-handlers/existing-dataset-database-handlers/qdrant.md): Handler for connecting to a Qdrant database, enabling multi-user mode on the Qdrant database instance.
- [Multi-User Mode Overview](https://docs.cognee.ai/core-concepts/multi-user-mode/multi-user-mode-overview.md): How Cognee handles multiple users and data isolation between users.
- [ACL](https://docs.cognee.ai/core-concepts/multi-user-mode/permissions-system/acl.md): Access Control List system for permission storage and inheritance in Cognee
- [Datasets](https://docs.cognee.ai/core-concepts/multi-user-mode/permissions-system/datasets.md): The core unit of data in Cognee's permission system
- [Overview](https://docs.cognee.ai/core-concepts/multi-user-mode/permissions-system/overview.md): Introduction to Cognee's permission system and access control architecture
- [Principals](https://docs.cognee.ai/core-concepts/multi-user-mode/permissions-system/principals.md): The unified abstraction for entities that can hold permissions in Cognee
- [Roles](https://docs.cognee.ai/core-concepts/multi-user-mode/permissions-system/roles.md): Role-based permissions within tenants for granular access control
- [Tenants](https://docs.cognee.ai/core-concepts/multi-user-mode/permissions-system/tenants.md): Organization-level access control and permission inheritance in Cognee
- [Users](https://docs.cognee.ai/core-concepts/multi-user-mode/permissions-system/users.md): Individual users and authentication in Cognee's permission system
- [Overview](https://docs.cognee.ai/core-concepts/overview.md): Learn about Cognee's core concepts, architecture, and how to get started
- [Sessions and Caching](https://docs.cognee.ai/core-concepts/sessions-and-caching.md): Understanding how Cognee maintains conversational memory through sessions and cache adapters
- [Data Silos](https://docs.cognee.ai/examples/data-silos.md)
- [Edge AI](https://docs.cognee.ai/examples/edge-ai.md)
- [Cognee Walkthrough](https://docs.cognee.ai/examples/getting-started-with-cognee.md): From Data to Interactive Memory: End-to-end tutorial with nodesets, ontologies, memify, graph visualization, and feedback system using a coding assistant example
- [Migrate from Mem0](https://docs.cognee.ai/examples/migrate-from-mem0.md): Move from Mem0 to Cognee
- [Overview](https://docs.cognee.ai/examples/overview.md)
- [Vertical AI Agents](https://docs.cognee.ai/examples/vertical-ai-agents.md)
- [Installation](https://docs.cognee.ai/getting-started/installation.md): Set up your environment and install Cognee
- [Introduction](https://docs.cognee.ai/getting-started/introduction.md): Cognee organizes your data into AI memory.
- [Quickstart](https://docs.cognee.ai/getting-started/quickstart.md): Get started with Cognee quickly and efficiently
- [Code Graph](https://docs.cognee.ai/guides/code-graph.md): Step-by-step guide to building code-level graphs from repositories
- [Custom Data Models](https://docs.cognee.ai/guides/custom-data-models.md): Step-by-step guide to creating custom data models and using add_data_points
- [Custom Prompts](https://docs.cognee.ai/guides/custom-prompts.md): Step-by-step guide to using custom prompts to control graph extraction
- [Custom Tasks and Pipelines](https://docs.cognee.ai/guides/custom-tasks-pipelines.md): Step-by-step guide to creating custom tasks and pipelines
- [Deploy REST API Server](https://docs.cognee.ai/guides/deploy-rest-api-server.md): Deploy Cognee as a REST API server using Docker or Python
- [Distributed Execution](https://docs.cognee.ai/guides/distributed-execution.md): Step-by-step guide to running Cognee pipelines across Modal containers
- [Feedback System](https://docs.cognee.ai/guides/feedback-system.md): Step-by-step guide to using feedback to improve Cognee's knowledge graphs
- [Graph Visualization](https://docs.cognee.ai/guides/graph-visualization.md): Step-by-step guide to rendering interactive knowledge graphs
- [Low-Level LLM](https://docs.cognee.ai/guides/low-level-llm.md): Step-by-step guide to using acreate_structured_output for direct LLM interaction
- [Memify Quickstart](https://docs.cognee.ai/guides/memify-quickstart.md): Step-by-step guide to enriching existing knowledge graphs with derived facts
- [Ontology Quickstart](https://docs.cognee.ai/guides/ontology-support.md): Step-by-step guide to using OWL ontologies to ground Cognee knowledge graphs
- [Permission Snippets](https://docs.cognee.ai/guides/permission-snippets.md): Practical code snippets and scenarios for Cognee's permission system
- [S3 Storage](https://docs.cognee.ai/guides/s3-storage.md): Step-by-step guide to using S3 for data ingestion and storage
- [Search Basics](https://docs.cognee.ai/guides/search-basics.md): Step-by-step guide to running your first Cognee search and understanding core parameters
- [Sessions](https://docs.cognee.ai/guides/sessions.md): Step-by-step guide to using sessions for conversational memory in Cognee
- [Temporal Cognify](https://docs.cognee.ai/guides/time-awareness.md): Step-by-step guide to using temporal mode for time-aware queries
- [EC2 Deployment](https://docs.cognee.ai/how-to-guides/cognee-sdk/deployment/ec2.md): Deploy Cognee on Amazon EC2 for traditional cloud server deployments with custom configurations
- [Kubernetes (Helm)](https://docs.cognee.ai/how-to-guides/cognee-sdk/deployment/helm.md): Deploy Cognee on Kubernetes with Helm charts for enterprise-grade, production-ready deployments
- [Deployment Overview](https://docs.cognee.ai/how-to-guides/cognee-sdk/deployment/index.md): Deploy Cognee with flexible data storage options for any scale
- [Modal Deployment](https://docs.cognee.ai/how-to-guides/cognee-sdk/deployment/modal.md): Deploy Cognee on Modal for serverless, auto-scaling knowledge graph processing
- [AWS Bedrock Integration](https://docs.cognee.ai/integrations/aws-bedrock-integration.md): Use AWS Bedrock LLMs with Cognee through LiteLLM proxy
- [Claude Agent SDK](https://docs.cognee.ai/integrations/claude-agent-sdk-integration.md)
- [Evaluation with DeepEval](https://docs.cognee.ai/integrations/deepeval-integration.md)
- [Google ADK](https://docs.cognee.ai/integrations/google-adk-integration.md)
- [Integrations](https://docs.cognee.ai/integrations/index.md): Connect Cognee with your favorite Agent frameworks and for observability, evaluation, and development tools
- [Observability with Keywords AI](https://docs.cognee.ai/integrations/keywordsai-integration.md)
- [Observability with Langfuse](https://docs.cognee.ai/integrations/langfuse-integration.md)
- [LangGraph](https://docs.cognee.ai/integrations/langgraph-integration.md)
- [n8n](https://docs.cognee.ai/integrations/n8n-integration.md)
- [OpenAI Agents SDK](https://docs.cognee.ai/integrations/openai-agents-sdk-integration.md)
- [OpenClaw](https://docs.cognee.ai/integrations/openclaw-integration.md)
- [Python API Documentation](https://docs.cognee.ai/python-api/index.md): Comprehensive Python API reference coming soon
- [FalkorDB](https://docs.cognee.ai/setup-configuration/community-maintained/falkordb.md): Use FalkorDB as both a graph and vector store (hybrid store) through a community-maintained adapter
- [Adapters Overview](https://docs.cognee.ai/setup-configuration/community-maintained/overview.md): Adapters and extensions built by the Cognee community
- [Qdrant](https://docs.cognee.ai/setup-configuration/community-maintained/qdrant.md): Use Qdrant as a vector store through a community-maintained adapter
- [Redis](https://docs.cognee.ai/setup-configuration/community-maintained/redis.md): Use Redis as a vector store through a community-maintained adapter
- [Embedding Providers](https://docs.cognee.ai/setup-configuration/embedding-providers.md): Configure embedding providers for semantic search in Cognee
- [Graph Stores](https://docs.cognee.ai/setup-configuration/graph-stores.md): Configure graph databases for knowledge graph storage and relationship reasoning in Cognee
- [LLM Providers](https://docs.cognee.ai/setup-configuration/llm-providers.md): Configure LLM providers for text generation and reasoning in Cognee
- [Setup Configuration](https://docs.cognee.ai/setup-configuration/overview.md): Configure Cognee to use your preferred LLM, embedding engine, and storage backends
- [Permissions Setup](https://docs.cognee.ai/setup-configuration/permissions.md): Configure Cognee's permission system and access control
- [Relational Databases](https://docs.cognee.ai/setup-configuration/relational-databases.md): Configure relational databases for metadata and state storage in Cognee
- [Structured Output Backends](https://docs.cognee.ai/setup-configuration/structured-output-backends.md): Configure structured output frameworks for reliable data extraction in Cognee
- [Vector Stores](https://docs.cognee.ai/setup-configuration/vector-stores.md): Configure vector databases for embedding storage and semantic search in Cognee
