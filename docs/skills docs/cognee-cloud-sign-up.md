> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cognee.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Sign Up & Prerequisites

> Create your Cognee Cloud account, subscription, and API key

Get access to the Cognee Cloud console, enable billing, and prepare everything you need before uploading data.

<Info>
  Cognee Cloud currently supports **Google** OAuth. Have access to a Google account plus a payment method ready.
</Info>

## Checklist before you start

* Google account for authentication
* Payment card for the subscription prompt on first login
* Optional: AWS credentials if you plan to connect an S3 bucket via the notebook

## Account and API key setup

<Steps>
  <Step title="Open the console">
    Visit [https://platform.cognee.ai/](https://platform.cognee.ai/) and choose **Continue with Google**.

    <Note>
      **Prerequisites**: A Google account and a valid credit/debit card.
    </Note>
  </Step>

  <Step title="Authorize access">
    Approve the OAuth request. Cognee Cloud uses the provider for sign-in only—no passwords to manage.
  </Step>

  <Step title="Pick a workspace name">
    The workspace name appears in the notebook UI and API responses. You can update it later in **Settings → Workspace**.
  </Step>

  <Step title="Subscribe & Payment">
    On first sign-in, you'll be prompted to subscribe and add a payment method. Enter your card details and click **Save** to activate your account.
  </Step>

  <Step title="Go to API Keys">
    In the console, go to <b>Settings → API Keys</b>.
  </Step>

  <Step title="Create an API Key">
    Click <b>Create API Key</b> and give it a recognizable name.
  </Step>
</Steps>

<Tip>
  Copy the key when you need it—you can always access it later from the settings page.
</Tip>

## What you can do now

With your [API key](/cognee-cloud/permissions-security), you can:

1. **Use the UI to upload files and create Cognee's AI memory** — [Try the Cognee Cloud UI](/cognee-cloud/cognee-cloud-ui) to upload your first dataset and explore it through the interface.

2. **Use the notebook interface to run pipelines and core operations** — Learn how to use `add`, `cognify`, `memify`, and `search` operations with [Cognee Cloud Notebooks](/cognee-cloud/cognee-cloud-notebooks).

3. **Use the platform programmatically via cogwit-sdk** — Automate ingestion and search using the [Cognee Cloud SDK](/cognee-cloud/cognee-cloud-sdk).

## Next steps

<CardGroup cols={3}>
  <Card title="Cognee Cloud UI" href="/cognee-cloud/cognee-cloud-ui" icon="monitor">
    Upload your first dataset and explore it through the interface.
  </Card>

  <Card title="Cognee Cloud Notebooks" href="/cognee-cloud/cognee-cloud-notebooks" icon="book-open">
    Run code against datasets using Cognee Cloud notebooks.
  </Card>

  <Card title="Automate with the SDK" href="/cognee-cloud/cognee-cloud-sdk" icon="terminal">
    Ingest and search programmatically using the Python SDK.
  </Card>
</CardGroup>
