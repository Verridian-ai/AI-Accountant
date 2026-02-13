> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Dataset Database Handlers: How to use them?

> How to use Dataset Database Handlers in Cognee for multi-user mode

## Core Responsibilities and Lifecycle

All handlers implement the `DatasetDatabaseHandlerInterface`, which defines three lifecycle entry points.

<Accordion title="Handler Interface Methods">
  Handlers must implement the following methods:

  * **`create_dataset(dataset_id, user) -> dict`**
    Creates or resolves backing storage for the dataset and returns a dictionary of connection and identification fields.
    This may:
    * Provision new infrastructure (e.g., create a Neo4j Aura instance), or
    * Return connection details to an existing shared or pooled backend.

  * **`resolve_dataset_connection_info(dataset_database) -> DatasetDatabase`** *(optional override)*
    Converts stored references into runtime-ready connection details.
    Typical use cases include:
    * Decrypting stored secrets
    * Fetching short-lived access tokens
      The default implementation returns the input unchanged.

  * **`delete_dataset(dataset_database) -> None`**
    Deprovisions, deletes, or prunes the dataset’s backing storage.
</Accordion>

## Persisted Dataset Database Records

The dictionary returned from `create_dataset()` is persisted as a `DatasetDatabase` row in the relational database and later merged into runtime connection flows.

Typical stored fields include:

<Accordion title="Vector database fields">
  * `vector_database_provider`
  * `vector_database_url`
  * `vector_database_key`
  * `vector_database_name`
  * `vector_dataset_database_handler`
  * `vector_database_connection_info`
    *(JSON dictionary for extended or sensitive parameters such as usernames, passwords, or custom options)*
</Accordion>

<Accordion title="Graph database fields">
  * `graph_database_provider`
  * `graph_database_url`
  * `graph_database_key`
  * `graph_database_name`
  * `graph_dataset_database_handler`
  * `graph_database_connection_info`
    *(JSON dictionary for extended or sensitive parameters such as usernames, passwords, or custom options)*
</Accordion>

## Where Dataset Database Handlers Are Used

Handlers are invoked automatically by the system based on configuration.

* **Vector storage**
  * Selected via `VECTOR_DATASET_DATABASE_HANDLER` environment variable
* **Graph storage**
  * Selected via `GRAPH_DATASET_DATABASE_HANDLER` environment variable

When a dataset is accessed:

* A new `DatasetDatabase` row is created if one does not already exist.
* The handler name, provider, and connection metadata are stored for reuse.
* At runtime, the handler may resolve secrets or transform stored references before connections are opened.
* On dataset deletion, the handler is responsible for cleaning up the underlying storage. The dataset deletion call happens when pruning data in Cognee and when datasets are explicitly deleted.

## List of Supported Dataset Database Handlers:

### Core handlers included with Cognee:

* neo4j\_aura\_dev → Neo4j Aura development cloud handler
* kuzu → Kuzu graph handler
* lancedb → LanceDB vector handler

### Community-contributed handlers from the [community repository](https://github.com/topoteretes/cognee-community):

* qdrant → Qdrant vector handler using local docker
* falkor\_vector\_local -> FalkorDB vector handler using local docker
* falkor\_graph\_local -> FalkorDB graph handler using local docker

## Using Custom Dataset Database Handlers

You can add your own at runtime with a register function, then point configuration to your handler name.
For example:

```python  theme={null}
# --- STEP 1: Tell Cognee to look for custom handlers ---
# Note: This would typically be done in a .env file or environment configuration, it has to be done before Cognee initialization
os.environ["VECTOR_DATASET_DATABASE_HANDLER"] = "custom_vector_handler"
os.environ["GRAPH_DATASET_DATABASE_HANDLER"] = "custom_graph_handler"

# --- STEP 2: Import your actual custom logic ---
from my_custom_handlers import CustomVectorDatasetDatabaseHandler, CustomGraphDatasetDatabaseHandler

# --- STEP 3: Register the handlers ---
from cognee.infrastructure.databases.dataset_database_handler.use_dataset_database_handler import use_dataset_database_handler

# Register custom vector database handler
use_dataset_database_handler(
    "custom_vector_handler", # -> Name to register for the handler, should match the env var above
    CustomVectorDatasetDatabaseHandler, # -> Your custom class implementing DatasetDatabaseHandlerInterface
    "vector_db_name" # -> What is the vector database provider for this handler
)

# Register custom graph database handler
use_dataset_database_handler(
    "custom_graph_handler", # -> Name to register for the handler, should match the env var above
    CustomGraphDatasetDatabaseHandler, # -> Your custom class implementing DatasetDatabaseHandlerInterface
    "graph_db_name" # -> What is the graph database provider for this handler
)
```

By writing your own Dataset Database Handlers, you can integrate Cognee with any graph or vector storage backend while maintaining clean separation of concerns and secure handling of connection details. This extensibility allows Cognee to adapt to a wide range of deployment scenarios and infrastructure setups (AWS, GCP, Azure, Local and etc.).

* For a more detailed example of writing a custom handler, see the [Custom Dataset Database Handlers Example](https://github.com/topoteretes/cognee/blob/main/cognee/tests/test_dataset_database_handler.py).
* For an example of an existing handler implementation, see the [Neo4j Aura Dev Dataset Database Handler source code](https://github.com/topoteretes/cognee/blob/main/cognee/infrastructure/databases/graph/neo4j_driver/Neo4jAuraDevDatasetDatabaseHandler.py).

## Dataset Database Handler Interface

Below is the full interface definition that all Dataset Database Handlers must implement along with docstrings explaining each method and its purpose.

```python  theme={null}
class DatasetDatabaseHandlerInterface(ABC):
    @classmethod
    @abstractmethod
    async def create_dataset(cls, dataset_id: Optional[UUID], user: Optional[User]) -> dict:
        """
        Return a dictionary with database connection/resolution info for a graph or vector database for the given dataset.
        Function can auto handle deploying of the actual database if needed, but is not necessary.
        Only providing connection info is sufficient, this info will be mapped when trying to connect to the provided dataset in the future.
        Needed for Cognee multi-tenant/multi-user and backend access control support.

        Dictionary returned from this function will be used to create a DatasetDatabase row in the relational database.
        From which internal mapping of dataset -> database connection info will be done.

        The returned dictionary is stored verbatim in the relational database and is later passed to
        resolve_dataset_connection_info() at connection time. For safe credential handling, prefer
        returning only references to secrets or role identifiers, not plaintext credentials.

        Each dataset needs to map to a unique graph or vector database when backend access control is enabled to facilitate a separation of concern for data.

        Args:
            dataset_id: UUID of the dataset if needed by the database creation logic
            user: User object if needed by the database creation logic
        Returns:
            dict: Connection info for the created graph or vector database instance.
        """
        pass

    @classmethod
    async def resolve_dataset_connection_info(
        cls, dataset_database: DatasetDatabase
    ) -> DatasetDatabase:
        """
        Resolve runtime connection details for a dataset’s backing graph/vector database.
        Function is intended to be overwritten to implement custom logic for resolving connection info.

        This method is invoked right before the application opens a connection for a given dataset.
        It receives the DatasetDatabase row that was persisted when create_dataset() ran and must
        return a modified instance of DatasetDatabase with concrete connection parameters that the client/driver can use.
        Do not update these new DatasetDatabase values in the relational database to avoid storing secure credentials.

        In case of separate graph and vector database handlers, each handler should implement its own logic for resolving
        connection info and only change parameters related to its appropriate database, the resolution function will then
        be called one after another with the updated DatasetDatabase value from the previous function as the input.

        Typical behavior:
        - If the DatasetDatabase row already contains raw connection fields (e.g., host/port/db/user/password
        or api_url/api_key), return them as-is.
        - If the row stores only references (e.g., secret IDs, vault paths, cloud resource ARNs/IDs, IAM
        roles, SSO tokens), resolve those references by calling the appropriate secret manager or provider
        API to obtain short-lived credentials and assemble the final connection DatasetDatabase object.
        - Do not persist any resolved or decrypted secrets back to the relational database. Return them only
        to the caller.

        Args:
            dataset_database: DatasetDatabase row from the relational database
        Returns:
            DatasetDatabase: Updated instance with resolved connection info
        """
        return dataset_database

    @classmethod
    @abstractmethod
    async def delete_dataset(cls, dataset_database: DatasetDatabase) -> None:
        """
        Delete the graph or vector database for the given dataset.
        Function should auto handle deleting of the actual database or send a request to the proper service to delete/mark the database as not needed for the given dataset.
        Needed for maintaining a database for Cognee multi-tenant/multi-user and backend access control.

        Args:
            dataset_database: DatasetDatabase row containing connection/resolution info for the graph or vector database to delete.
        """
        pass
```
