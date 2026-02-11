"""
Cognee Knowledge Graph Seeding Script

Seeds the Cognee knowledge graph with:
1. All 29 categories from the app's single source of truth
2. GST rules from ATO guidelines
3. Australian tax brackets and deduction rates

Usage:
    python seed.py                  # Seed all datasets
    python seed.py categories       # Seed categories only
    python seed.py gst              # Seed GST rules only
    python seed.py tax              # Seed tax config only
"""

import os
import sys
import json
import asyncio
from dotenv import load_dotenv

# Load environment variables
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(SCRIPT_DIR, "../../../../.env"))
load_dotenv(dotenv_path=os.path.join(SCRIPT_DIR, "../../../../env.local"))

# Configure Cognee environment before importing
api_key = os.getenv("VITE_OPENROUTER_API_KEY", "")
os.environ["LLM_PROVIDER"] = "openai"
os.environ["LLM_MODEL"] = os.getenv("LLM_MODEL", "openrouter/openai/gpt-4o")
os.environ["LLM_API_KEY"] = api_key
os.environ["OPENROUTER_API_KEY"] = api_key
os.environ["OPENAI_API_KEY"] = api_key
os.environ["LLM_ENDPOINT"] = os.getenv("LLM_ENDPOINT", "https://openrouter.ai/api/v1")
os.environ["OPENAI_API_BASE"] = "https://openrouter.ai/api/v1"
os.environ["EMBEDDING_PROVIDER"] = "fastembed"
os.environ["EMBEDDING_MODEL"] = "BAAI/bge-small-en-v1.5"
os.environ["EMBEDDING_DIMENSIONS"] = "384"
os.environ["DB_PROVIDER"] = "postgres"
os.environ["DB_HOST"] = os.getenv("POSTGRES_HOST", "localhost")
os.environ["DB_PORT"] = os.getenv("POSTGRES_PORT", "5432")
os.environ["DB_NAME"] = os.getenv("POSTGRES_DB", "ai_accountant")
os.environ["DB_USERNAME"] = os.getenv("POSTGRES_USER", "app_user")
os.environ["DB_PASSWORD"] = os.getenv("POSTGRES_PASSWORD", "")
os.environ["VECTOR_DB_PROVIDER"] = "pgvector"
os.environ["GRAPH_DATABASE_PROVIDER"] = "kuzu"
os.environ["TELEMETRY_DISABLED"] = "true"

from cognee.api.v1.add import add
from cognee.api.v1.cognify import cognify


# ═══════════════════════════════════════════════════════════════════
# Category definitions — mirrored from categories.ts
# ═══════════════════════════════════════════════════════════════════

CATEGORIES = [
    # Revenue (4-xxxx)
    {"name": "Sales Revenue", "accountCode": "4-0100", "type": "revenue", "taxCode": "GST",
     "keywords": ["sale", "sales"]},
    {"name": "Service Revenue", "accountCode": "4-0200", "type": "revenue", "taxCode": "GST",
     "keywords": ["service"]},
    {"name": "Interest Income", "accountCode": "4-0300", "type": "revenue", "taxCode": "FRE",
     "keywords": ["interest"]},
    {"name": "Other Income", "accountCode": "4-0400", "type": "revenue", "taxCode": "GST",
     "keywords": ["other", "income"]},
    {"name": "Export Revenue", "accountCode": "4-0500", "type": "revenue", "taxCode": "EXP",
     "keywords": ["export"]},

    # Cost of Sales (5-xxxx)
    {"name": "Cost of Goods Sold", "accountCode": "5-0100", "type": "cogs", "taxCode": "GST",
     "keywords": ["cogs", "cost of goods"]},
    {"name": "Direct Labour", "accountCode": "5-0200", "type": "cogs", "taxCode": "N-T",
     "keywords": ["direct labour", "labor"]},
    {"name": "Freight Costs", "accountCode": "5-0300", "type": "cogs", "taxCode": "GST",
     "keywords": ["freight", "shipping"]},

    # Expenses (6-xxxx)
    {"name": "Advertising & Marketing", "accountCode": "6-0100", "type": "expense", "taxCode": "GST",
     "keywords": ["advertising", "marketing"]},
    {"name": "Bank Fees", "accountCode": "6-0200", "type": "expense", "taxCode": "FRE",
     "keywords": ["bank", "fee"]},
    {"name": "Computer & IT", "accountCode": "6-0300", "type": "expense", "taxCode": "GST",
     "keywords": ["computer", "software", "it"]},
    {"name": "Depreciation", "accountCode": "6-0400", "type": "expense", "taxCode": "N-T",
     "keywords": ["depreciation"]},
    {"name": "Entertainment", "accountCode": "6-0500", "type": "expense", "taxCode": "GST",
     "keywords": ["entertainment", "meal"]},
    {"name": "Insurance", "accountCode": "6-0600", "type": "expense", "taxCode": "FRE",
     "keywords": ["insurance"]},
    {"name": "Interest Expense", "accountCode": "6-0700", "type": "expense", "taxCode": "FRE",
     "keywords": ["interest"]},
    {"name": "Motor Vehicle Expenses", "accountCode": "6-0800", "type": "expense", "taxCode": "GST",
     "keywords": ["vehicle", "fuel", "car"]},
    {"name": "Office Supplies", "accountCode": "6-0900", "type": "expense", "taxCode": "GST",
     "keywords": ["office", "stationery"]},
    {"name": "Professional Fees", "accountCode": "6-1000", "type": "expense", "taxCode": "GST",
     "keywords": ["professional", "legal", "accounting"]},
    {"name": "Rent", "accountCode": "6-1100", "type": "expense", "taxCode": "GST",
     "keywords": ["rent", "lease"]},
    {"name": "Repairs & Maintenance", "accountCode": "6-1200", "type": "expense", "taxCode": "GST",
     "keywords": ["repair", "maintenance"]},
    {"name": "Subscriptions", "accountCode": "6-1300", "type": "expense", "taxCode": "GST",
     "keywords": ["subscription"]},
    {"name": "Telephone & Internet", "accountCode": "6-1400", "type": "expense", "taxCode": "GST",
     "keywords": ["phone", "internet", "telecom"]},
    {"name": "Travel", "accountCode": "6-1500", "type": "expense", "taxCode": "GST",
     "keywords": ["travel", "flight", "accommodation"]},
    {"name": "Utilities", "accountCode": "6-1600", "type": "expense", "taxCode": "GST",
     "keywords": ["utility", "electric", "gas", "water"]},
    {"name": "Wages & Salaries", "accountCode": "6-1700", "type": "expense", "taxCode": "N-T",
     "keywords": ["wage", "salary", "payroll"]},
    {"name": "Superannuation", "accountCode": "6-1800", "type": "expense", "taxCode": "N-T",
     "keywords": ["super", "superannuation"]},
    {"name": "Work from Home Expenses", "accountCode": "6-1900", "type": "expense", "taxCode": "N-T",
     "keywords": ["wfh", "home office"]},
    {"name": "Miscellaneous", "accountCode": "6-2000", "type": "expense", "taxCode": "GST",
     "keywords": ["miscellaneous", "misc", "other"]},

    # System
    {"name": "Uncategorized", "accountCode": "", "type": "system", "taxCode": "GST",
     "keywords": []},
]


async def seed_categories():
    """Seed the categorizer dataset with all app categories."""
    print("Seeding categories into 'categorizer' dataset...")

    category_texts = []
    for cat in CATEGORIES:
        tax_desc = {
            "GST": "Standard 10% GST applies",
            "FRE": "GST-free (no GST charged)",
            "N-T": "Not taxable (out of GST scope)",
            "EXP": "Export (GST-free for exports)",
        }.get(cat["taxCode"], "Unknown tax treatment")

        text = (
            f"CATEGORY: {cat['name']} (Account Code: {cat['accountCode']})\n"
            f"Type: {cat['type']}\n"
            f"Tax Code: {cat['taxCode']} - {tax_desc}\n"
            f"Keywords: {', '.join(cat['keywords']) if cat['keywords'] else 'none'}\n"
            f"Use this category for transactions related to: {', '.join(cat['keywords'])}"
        )
        category_texts.append(text)

    await add(category_texts, "categorizer")
    await cognify()
    print(f"  Seeded {len(category_texts)} categories")
    return len(category_texts)


async def seed_gst_rules():
    """Seed the gst_rules dataset with Australian GST rules."""
    print("Seeding GST rules into 'gst_rules' dataset...")

    gst_rules = [
        # GST-free supplies
        "GST-FREE SUPPLIES (no GST charged, but can claim inputs):\n"
        "- Medical and health: doctors, GPs, hospitals, pharmacies, pathology, radiology, "
        "physiotherapy, dentists, optometrists, psychologists, Medicare, health funds (Medibank, BUPA, HCF, NIB)\n"
        "- Education: universities, TAFE, colleges, school fees, tuition, course fees, "
        "childcare, kindergarten, preschool\n"
        "- Fresh food (basic): Woolworths, Coles, Aldi, IGA (excluding liquor), "
        "fruit & veg, greengrocer, butcher, baker, fish market\n"
        "- Exports: export sales, overseas sales, international sales\n"
        "- Charitable: donations, charities, Red Cross, Salvation Army, Lifeline, Beyond Blue\n"
        "- Water and sewerage: water corp, Sydney Water, SA Water, sewerage services",

        # Input-taxed supplies
        "INPUT-TAXED SUPPLIES (no GST charged, cannot claim input credits):\n"
        "- Financial services: bank fees, account fees, monthly fees, loan interest, "
        "mortgage interest, credit card interest, share brokerage, investment fees, "
        "management fees, financial advice, superannuation fees\n"
        "- Residential rent: residential rent received, rental income",

        # Standard GST
        "STANDARD 10% GST (most goods and services):\n"
        "- GST is calculated from inclusive prices: GST = Amount / 11\n"
        "- GST-exclusive = Amount - (Amount / 11)\n"
        "- Sales reported at BAS label G1, GST collected at label 1A\n"
        "- Purchases reported at BAS label G11, GST credits at label 1B",

        # Capital acquisitions
        "CAPITAL ACQUISITIONS (GST claimable, reported separately at G10):\n"
        "- Computers, laptops, desktops, MacBooks, iPads, tablets\n"
        "- Furniture, desks, chairs, office fit-outs\n"
        "- Vehicles, car purchases, motor vehicles\n"
        "- Equipment, machinery, plant & equipment\n"
        "- Renovations, fit-outs, construction\n"
        "- Servers, networking equipment, printers, photocopiers\n"
        "- Phone systems, security systems\n"
        "- Instant asset write-off threshold: $20,000 (FY2024-25)",

        # Private/non-business
        "PRIVATE / NON-BUSINESS (not reported on BAS):\n"
        "- ATM withdrawals, cash withdrawals\n"
        "- Transfers to self, personal transactions\n"
        "- Personal groceries\n"
        "- Entertainment subscriptions: Netflix, Spotify, Disney+\n"
        "- Gym memberships, Fitness First\n"
        "These transactions are out of scope for GST purposes.",

        # Fuel tax credits
        "FUEL TAX CREDITS:\n"
        "- Claimable for fuel used in business activities\n"
        "- Fuel suppliers: BP, Shell, Caltex, Ampol, 7-Eleven, United Petrol\n"
        "- Types: petrol, diesel, fuel\n"
        "- Report at BAS label 7C (business use) and 7D (other activities)\n"
        "- Rates change quarterly based on ATO schedule",

        # BAS labels reference
        "BAS LABEL REFERENCE:\n"
        "G1 = Total sales (including GST)\n"
        "G2 = Export sales\n"
        "G3 = Other GST-free sales\n"
        "G10 = Capital purchases (including GST)\n"
        "G11 = Non-capital purchases (including GST)\n"
        "1A = GST on sales (G1 * 1/11)\n"
        "1B = GST on purchases (G10 + G11) * 1/11\n"
        "W1 = Total salary, wages, and other payments\n"
        "W2 = Amounts withheld from W1\n"
        "5A = PAYG instalment\n"
        "7C = Fuel tax credits - business use\n"
        "7D = Fuel tax credits - other activities",

        # Quarter dates
        "AUSTRALIAN BAS QUARTERS (Financial Year July-June):\n"
        "Q1: 1 July - 30 September, lodgement due 28 October\n"
        "Q2: 1 October - 31 December, lodgement due 28 February\n"
        "Q3: 1 January - 31 March, lodgement due 28 April\n"
        "Q4: 1 April - 30 June, lodgement due 28 July",

        # No ABN
        "NO ABN QUOTED RULE:\n"
        "If a supplier does not quote an ABN and the payment exceeds $75 (excluding GST), "
        "the payer must withhold 47% from the payment. "
        "This does not apply to payments for: private/domestic supplies, "
        "or where the supplier has notified the payer of their ABN.",
    ]

    await add(gst_rules, "gst_rules")
    await cognify()
    print(f"  Seeded {len(gst_rules)} GST rule documents")
    return len(gst_rules)


async def seed_tax_config():
    """Seed tax brackets and deduction rates from tax_config.py."""
    print("Seeding tax configuration into 'gst_rules' dataset...")

    tax_texts = [
        # 2024-25 tax brackets
        "AUSTRALIAN INCOME TAX BRACKETS FY2024-25 (Stage 3 Tax Cuts):\n"
        "$0 - $18,200: Nil (tax-free threshold)\n"
        "$18,201 - $45,000: 16 cents per $1 over $18,200\n"
        "$45,001 - $135,000: $4,288 + 30 cents per $1 over $45,000\n"
        "$135,001 - $190,000: $31,288 + 37 cents per $1 over $135,000\n"
        "Over $190,000: $51,638 + 45 cents per $1 over $190,000",

        # Previous year for comparison
        "AUSTRALIAN INCOME TAX BRACKETS FY2023-24:\n"
        "$0 - $18,200: Nil\n"
        "$18,201 - $45,000: 19 cents per $1 over $18,200\n"
        "$45,001 - $120,000: $5,092 + 32.5 cents per $1 over $45,000\n"
        "$120,001 - $180,000: $29,467 + 37 cents per $1 over $120,000\n"
        "Over $180,000: $51,667 + 45 cents per $1 over $180,000",

        # Company tax rate
        "COMPANY TAX RATE:\n"
        "Base rate entities (aggregated turnover < $50M): 25%\n"
        "All other companies: 30%",

        # Tax offsets
        "TAX OFFSETS FY2024-25:\n"
        "Low Income Tax Offset (LITO): up to $700, phases out from $37,500 to $66,833\n"
        "Seniors and Pensioners Tax Offset (SAPTO): up to $2,398 (single), "
        "phases out from $32,752",

        # Medicare levy
        "MEDICARE LEVY FY2024-25:\n"
        "Base rate: 2% of taxable income\n"
        "Low income threshold: $24,276 (no levy below this)\n"
        "Shade-in range: $24,276 - $30,345 (10% of excess over threshold)\n"
        "Medicare Levy Surcharge (no private health):\n"
        "  $93,001-$108,000: 1.0%\n"
        "  $108,001-$144,000: 1.25%\n"
        "  Over $144,000: 1.5%\n"
        "Family threshold increase: $4,232 per dependent child",

        # Deduction rates
        "DEDUCTION RATES FY2024-25:\n"
        "Work from home: $0.67 per hour (fixed rate method)\n"
        "Motor vehicle: 85 cents per km (max 5,000 km)\n"
        "Laundry (no records): max $150\n"
        "Gifts (no records): max $10\n"
        "Instant asset write-off threshold: $20,000",

        # CGT
        "CAPITAL GAINS TAX FY2024-25:\n"
        "50% CGT discount for assets held > 12 months (individuals)\n"
        "Main residence exemption available\n"
        "Small business CGT concessions available for eligible businesses",

        # Depreciation
        "DEPRECIATION FY2024-25:\n"
        "Diminishing value method: 200% of prime cost rate\n"
        "Prime cost method: 100% of effective life\n"
        "Low value pool: existing assets 37.5%, new assets 18.75%\n"
        "Low value pool threshold: items under $1,000",
    ]

    await add(tax_texts, "gst_rules")
    await cognify()
    print(f"  Seeded {len(tax_texts)} tax configuration documents")
    return len(tax_texts)


async def seed_all():
    """Seed all datasets."""
    print("=" * 60)
    print("CBA Statements Parse — Cognee Knowledge Graph Seeding")
    print("=" * 60)
    print()

    total = 0
    total += await seed_categories()
    total += await seed_gst_rules()
    total += await seed_tax_config()

    print()
    print(f"Seeding complete! Total documents indexed: {total}")
    print("=" * 60)


async def main():
    """Entry point for seeding script."""
    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == "categories":
            await seed_categories()
        elif command == "gst":
            await seed_gst_rules()
        elif command == "tax":
            await seed_tax_config()
        else:
            print(f"Unknown command: {command}")
            print("Usage: python seed.py [categories|gst|tax]")
            sys.exit(1)
    else:
        await seed_all()


if __name__ == "__main__":
    asyncio.run(main())
