> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Cognee Cloud UI

> Work with datasets and data ingestion through the Cognee Cloud UI

Use the Cognee Cloud UI to manage datasets, upload files, and trigger cognify. This page explains what you can do directly in the UI, and where notebooks come into play.

## Cognee instances

* **Cloud instance** — Your Cognee Cloud workspace with managed infrastructure
* **Local instance** — Your local Cognee installation for development and testing
* Both instances contain **[datasets](/core-concepts/further-concepts/datasets)** that can be [synced between environments](/cognee-cloud/local-mode-and-sync)

## Adding datasets

* Use the **+** button next to an instance to create a new dataset.
* Datasets are containers for your documents and all subsequent operations (add, cognify, memify, search). See [permissions & security](/cognee-cloud/permissions-security) for how datasets are isolated.

## Adding data

When you upload a file into a dataset, Cognee performs **add + cognify** under the hood:

* **Dataset menu (three dots)** — choose **Add files** to upload files into that dataset.
* Uploaded files appear as documents under the dataset, already cognified into the knowledge graph.

<Note>
  Since add + cognify runs together, file processing can take a bit of time to complete. Be patient while your files are being processed into the knowledge graph.
</Note>

## Notebooks overview

Notebooks are interactive coding environments connected to your datasets. In a notebook you can:

* Run all four operations (**add, cognify, memify, search**) programmatically.
* By default, notebook operations run on the same datasets as the UI.

See the separate [Cognee Cloud Notebooks](/cognee-cloud/cognee-cloud-notebooks) for details on creating and working inside notebooks.

## Next steps

<CardGroup cols={2}>
  <Card title="Cognee Cloud Notebooks" href="/cognee-cloud/cognee-cloud-notebooks" icon="book-open">
    Learn to run code against datasets using Cognee Cloud notebooks.
  </Card>

  <Card title="Cognee Cloud SDK" href="/cognee-cloud/cognee-cloud-sdk" icon="terminal">
    Automate ingestion and search using the Python SDK.
  </Card>
</CardGroup>
