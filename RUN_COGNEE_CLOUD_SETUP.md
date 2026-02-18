# Cognee Cloud Setup — Quick Start Guide

**API Key**: `13ac8b717cd9f072a79f703455546a8334c5e27f2f3238ff`

---

## Step 1: Install Dependencies

```bash
cd server
pip install cogwit-sdk pydantic aiohttp
```

Or use the requirements file:

```bash
pip install -r requirements-cognee-cloud.txt
```

---

## Step 2: Set Environment Variable

Add to your `.env` file:

```env
COGWIT_API_KEY=13ac8b717cd9f072a79f703455546a8334c5e27f2f3238ff
```

Or export it:

```bash
export COGWIT_API_KEY=13ac8b717cd9f072a79f703455546a8334c5e27f2f3238ff
```

---

## Step 3: Run Dataset Initialization

```bash
cd server
python -m src.services.cognee-cloud.init_datasets
```

This will:
1. ✅ Test connection to Cognee Cloud
2. ✅ Create 6 shared knowledge datasets
3. ✅ Create 33 per-tenant datasets
4. ✅ Report success/failure for each

Expected output:

```
================================================================================
Cognee Cloud Dataset Initialization
================================================================================

📊 Total datasets to create: 39
   - Shared (public): 6
   - Per-tenant: 33

Testing connection to Cognee Cloud...

✅ Connection successful!
   Dataset ID: abc123...
   Status: success

================================================================================
SHARED DATASETS (Public Knowledge)
================================================================================

Creating dataset: gst_rules
  Description: ATO GST rulings, tax rules, and GST-free/input-taxed categories
  Category: shared
  Public: True
  ✅ Created: dataset_xyz789
  Status: success

...

================================================================================
SUMMARY
================================================================================
Total datasets created: 39/39

🎉 All datasets created successfully!
```

---

## Step 4: Verify in Cognee Cloud UI

1. Go to: https://app.cognee.ai
2. Log in with your account
3. Navigate to **Datasets**
4. You should see all 39 datasets listed

---

## Step 5: Upload Shared Knowledge (Manual)

Upload the following shared knowledge to Cognee Cloud:

### 1. GST Rules (`gst_rules` dataset)

Upload ATO GST rulings and tax rules from:
- `docs/GST_BAS_RULES.md`
- `docs/GST_MERCHANT_INTELLIGENCE.md`

### 2. Tax Tables (`tax_tables` dataset)

Upload tax brackets and rates from:
- Australian tax brackets 2024-25
- Medicare levy rates
- HELP/HECS thresholds

### 3. Deduction Patterns (`deduction_patterns` dataset)

Upload common tax deduction patterns:
- Work-related expenses
- Self-education
- Home office
- Vehicle expenses

### 4. Award Rates (`award_rates` dataset)

Upload award wage rates for payroll:
- Modern Awards
- Penalty rates
- Allowances

### 5. STP Compliance (`stp_compliance` dataset)

Upload Single Touch Payroll compliance rules:
- Reporting requirements
- Payroll event types
- ATO validation rules

### 6. ATO Rulings (`ato_rulings` dataset)

Upload ATO rulings and interpretations:
- Tax rulings
- Interpretations
- Guidance documents

---

## Step 6: Test Search

Create a test script to verify search works:

```python
import asyncio
from src.services.cognee_cloud.client import get_cognee_cloud_client

async def test_search():
    client = get_cognee_cloud_client()
    
    # Search GST rules
    results = await client.search(
        query_text="What is the GST rate for food?",
        search_type="GRAPH_COMPLETION",
        dataset_names=["gst_rules"]
    )
    
    for result in results:
        print(result.search_result)

asyncio.run(test_search())
```

---

## Troubleshooting

### Error: "Module not found: cogwit_sdk"

**Solution**: Install the SDK:
```bash
pip install cogwit-sdk
```

### Error: "Authentication failed"

**Solution**: Check your API key:
```bash
echo $COGWIT_API_KEY
```

Should output: `13ac8b717cd9f072a79f703455546a8334c5e27f2f3238ff`

### Error: "Connection timeout"

**Solution**: Check your internet connection and firewall settings.

### Error: "Dataset already exists"

**Solution**: This is normal if you run the script multiple times. The script will skip existing datasets.

---

## Next Steps

After datasets are created:

1. **Upload DataPoint Models** — Register all 10 Pydantic models with Cognee Cloud
2. **Upload Ontologies** — Upload 3 OWL ontology files
3. **Configure NodeSets** — Set up temporal and categorical tagging
4. **Integrate with Agents** — Wire all 20+ agents to use Cognee Cloud
5. **Test Full Application** — End-to-end testing

---

## Support

- **Cognee Cloud Docs**: https://docs.cognee.ai
- **Cognee Cloud UI**: https://app.cognee.ai
- **API Reference**: https://docs.cognee.ai/cognee-cloud/cognee-cloud-sdk

---

✅ **Ready to run! Execute Step 3 to create all datasets.**

