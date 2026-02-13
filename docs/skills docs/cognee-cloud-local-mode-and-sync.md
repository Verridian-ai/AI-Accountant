> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Local Mode & Sync

> Connect to local Cognee instances and sync data between local and cloud environments

Cognee Cloud can connect to your local Cognee instance, allowing you to work with local data through the cloud interface and sync between environments.

## Local Mode

Cognee Cloud automatically detects and connects to local Cognee instances:

* **Connection Status**: When connected, the "Local Cognee" section shows "Connected" in the UI
* **Full Functionality**: Browse datasets, upload files, run cognify, and execute notebook cells against your local engine
* **Same Interface**: All operations use the same UI whether working with local or cloud data

<Info>
  Local mode requires a running Cognee server on `localhost:8000`. Start your local server with `cognee serve` to enable local mode features.
</Info>

## Data Sync

Cognee Cloud provides powerful sync capabilities for moving data between local and cloud environments:

### Sync Features

* **Binary file handling** — Upload and download files for data connectors
* **Hash-based synchronization** — Only syncs files that have changed, reducing unnecessary transfers
* **Dataset-specific storage** — Files are organized by dataset with proper isolation

### How sync works

1. **Detect changes** — Compare file hashes to identify what needs to be synchronized
2. **Upload changes** — Transfer only modified files to the target environment
3. **Verify integrity** — Confirm files are properly stored and accessible
4. **Update metadata** — Sync dataset information and permissions

<Danger>
  **Sync is currently experiencing issues and is under construction.** Some sync features may not work as expected. We're working to resolve these problems and will update this documentation once sync is fully operational.
</Danger>

## Related resources

<CardGroup cols={2}>
  <Card title="Cognee Cloud architecture" href="/cognee-cloud/cognee-cloud-architecture" icon="building">
    Understand how Cognee Cloud pipelines stay online once you migrate.
  </Card>

  <Card title="Permissions & Security" href="/cognee-cloud/permissions-security" icon="lock">
    Map local user roles to Cognee Cloud workspaces and dataset permissions.
  </Card>
</CardGroup>
