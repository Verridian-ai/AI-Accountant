# Australian GST & BAS Rules Reference

> Comprehensive rules for GST classification and BAS reporting in the CBA Statements Parse app.
> Based on ATO requirements for the 2024-25 and 2025-26 financial years.

---

## 1. GST Overview

### What is GST?
Australia's Goods and Services Tax (GST) is a broad-based 10% tax on most goods, services, and other items sold or consumed in Australia. Businesses registered for GST include the tax in the price of sales and can claim credits for the GST in the price of eligible business purchases.

### Registration Threshold
- **$75,000** annual turnover (mandatory registration)
- **$150,000** for non-profit organisations
- Voluntary registration available below threshold

### GST Formula
```
GST-inclusive price = GST-exclusive price x 1.10
GST component = GST-inclusive price / 11
GST-exclusive = GST-inclusive price x 10/11
```

---

## 2. GST Categories

### 2.1 Taxable Supplies (10% GST)
Standard rate. GST is charged and input tax credits can be claimed.

| Category | GST Treatment | BAS Label (Sales) | BAS Label (Purchases) | Notes |
|---|---|---|---|---|
| Commercial rent | 10% GST | G1 | G11 | Commercial property only |
| Professional services | 10% GST | G1 | G11 | Legal, accounting, consulting |
| Office supplies | 10% GST | G1 | G11 | Stationery, equipment |
| Motor vehicle expenses | 10% GST | G1 | G11/G10 | Fuel, repairs, purchase |
| Utilities (electricity, gas) | 10% GST | G1 | G11 | Business portion only |
| Telephone & internet | 10% GST | G1 | G11 | Business portion only |
| Advertising & marketing | 10% GST | G1 | G11 | |
| Repairs & maintenance | 10% GST | G1 | G11 | |
| Subscriptions (business) | 10% GST | G1 | G11 | Software, journals |
| Travel (domestic) | 10% GST | G1 | G11 | Accommodation, transport |
| Entertainment (50%) | 10% GST | G1 | G11 | Only 50% claimable in most cases |
| Computer & IT equipment | 10% GST | G1 | G10 (>$1K) or G11 | Capital vs non-capital threshold |

### 2.2 GST-Free Supplies (0% GST, input credits claimable)
No GST charged, but the business CAN claim GST credits on related business inputs.

| Category | Reason | BAS Label (Sales) |
|---|---|---|
| Most basic/fresh food | GST Act Schedule 1 | G3 |
| Medical & health services | Health-related | G3 |
| Educational courses | Education supply | G3 |
| Childcare services | Education/care | G3 |
| Exports of goods/services | Export | G2 |
| Religious/charitable supplies | Non-commercial | G3 |
| Water & sewerage (residential) | Essential service | G3 |
| Precious metals (investment grade) | Financial/investment | G3 |
| International transport | Export-related | G2 |
| Donations to DGR | Charitable | G3 |

**Key fresh food rules:**
- Fresh fruit, vegetables, meat, fish = GST-free
- Prepared/restaurant food = 10% GST
- Confectionery, soft drinks, snack foods = 10% GST
- Supermarket purchases are MIXED (some GST, some GST-free)

### 2.3 Input-Taxed Supplies (0% GST, NO input credits)
No GST charged, and the supplier CANNOT claim GST credits on related inputs.

| Category | Examples | Notes |
|---|---|---|
| Financial supplies | Bank fees, loan interest, credit card interest, share brokerage | ATO Division 40 |
| Residential rent (as landlord) | Residential rental income | Commercial rent IS taxable |
| Sales of existing residential premises | Second-hand houses | New residential = taxable |
| Superannuation fund fees | Management fees | |
| Life insurance | Premiums | General insurance IS taxable |

**Financial supplies detail:**
- Bank account fees: Input-taxed (no GST credit)
- Loan interest charges: Input-taxed
- Credit card annual fees: Input-taxed
- Share brokerage: Input-taxed
- Financial adviser fees: Input-taxed
- **Exception:** Reduced input tax credit (75%) available for certain acquisitions by financial suppliers

### 2.4 Out-of-Scope / Private
Not reported on BAS. These are personal/non-business transactions.

| Category | Examples |
|---|---|
| ATM withdrawals | Cash withdrawal |
| Transfer to self | Internal transfers |
| Personal expenses | Groceries (personal), entertainment |
| Wages/salary paid | Employment payments (N-T) |
| Superannuation contributions | Employer contributions (N-T) |
| Loan principal repayments | Not a supply |
| Dividends received/paid | Not a supply |

### 2.5 Capital Acquisitions (G10)
Business purchases of capital items with GST. Reported separately at G10 on the BAS.

**Threshold:** Items over $1,000 (GST-exclusive) are generally capital.

| Item | Effective Life | GST Credit |
|---|---|---|
| Computer/laptop | 4 years | Full credit (business portion) |
| Furniture (desk, chair) | 10 years | Full credit |
| Motor vehicle | 8 years | Limited to car limit ($68,108 for 2024-25) |
| Plant & equipment | 10-15 years | Full credit |
| Office fit-out | 10+ years | Full credit |

**Instant Asset Write-Off:** Items under $20,000 can be immediately deducted (2024-25).

---

## 3. BAS Label Reference

### 3.1 Simpler BAS (GST turnover < $10M)
Most small businesses use this. Only 3 GST fields required:

| Label | Description | What to Include |
|---|---|---|
| **G1** | Total sales | All sales including GST-free, input-taxed, and exports |
| **1A** | GST on sales | GST collected on taxable sales (G1 x 1/11 for taxable portion) |
| **1B** | GST on purchases | GST credits claimable on business purchases |

### 3.2 Full BAS (GST turnover >= $10M or voluntary)
All GST labels reported:

| Label | Description | Calculation |
|---|---|---|
| **G1** | Total sales (incl. GST) | Sum of all sales revenue |
| **G2** | Export sales | GST-free export sales |
| **G3** | Other GST-free sales | Domestic GST-free sales |
| **G4** | Input-taxed sales | Financial supplies, residential rent |
| **G5** | G2 + G3 + G4 | Total non-taxable sales |
| **G6** | G1 - G5 | Total taxable sales |
| **G7** | Adjustments | Bad debts recovered, etc. |
| **G8** | G6 + G7 | Total subject to GST |
| **G9** | G8 / 11 | GST on sales (equals 1A) |
| **G10** | Capital purchases | GST-inclusive capital items |
| **G11** | Non-capital purchases | GST-inclusive operating expenses |
| **G12** | G10 + G11 | Total purchases |
| **G13** | Purchases with no GST credit | Input-taxed, private purchases |
| **G14** | Estimated purchases for private use | Apportioned amounts |
| **G15** | G13 + G14 | Total non-creditable purchases |
| **G16** | G12 - G15 | Purchases with GST credit |
| **G17** | Adjustments | |
| **G18** | G16 + G17 | Total purchases for GST credits |
| **G19** | G18 / 11 | GST credits (equals 1B) |
| **G20** | 1A - 1B | Net GST payable/refundable |

### 3.3 PAYG Labels

| Label | Description |
|---|---|
| **W1** | Total salary, wages and other payments |
| **W2** | Amounts withheld from payments (PAYG withholding) |
| **T1** | Instalment income |
| **T2** | Instalment rate (%) |
| **5A** | PAYG instalment amount |

### 3.4 Other Labels

| Label | Description |
|---|---|
| **7C** | Fuel tax credits - business use |
| **7D** | Fuel tax credits - non-business use |
| **8A** | Total amount payable |
| **8B** | Total amount refundable |
| **9** | Net amount (payable or refundable) |

---

## 4. GST Classification Rules by Transaction Category

### Mapping from App Categories to GST Treatment

| App Category | Account Code | Tax Code | GST Rate | BAS Treatment | Claimable |
|---|---|---|---|---|---|
| Sales Revenue | 4-0100 | GST | 10% | G1 sales, 1A GST | N/A (collected) |
| Service Revenue | 4-0200 | GST | 10% | G1 sales, 1A GST | N/A (collected) |
| Interest Income | 4-0300 | FRE | 0% | Input-taxed (not on BAS) | No |
| Other Income | 4-0400 | GST | 10% | G1 sales, 1A GST | N/A |
| Export Revenue | 4-0500 | EXP | 0% | G2 exports | N/A |
| Cost of Goods Sold | 5-0100 | GST | 10% | G11 purchases, 1B credit | Yes |
| Direct Labour | 5-0200 | N-T | 0% | W1 wages | No |
| Freight Costs | 5-0300 | GST | 10% | G11 purchases, 1B credit | Yes |
| Advertising & Marketing | 6-0100 | GST | 10% | G11 purchases, 1B credit | Yes |
| Bank Fees | 6-0200 | FRE | 0% | Input-taxed (no credit) | No |
| Computer & IT | 6-0300 | GST | 10% | G10/G11, 1B credit | Yes |
| Depreciation | 6-0400 | N-T | 0% | Not on BAS | No |
| Entertainment | 6-0500 | GST | 10% | G11 (50% only), 1B credit | Partial |
| Insurance | 6-0600 | FRE/GST | Varies | General: GST; Life: FRE | Depends |
| Interest Expense | 6-0700 | FRE | 0% | Input-taxed (no credit) | No |
| Motor Vehicle Expenses | 6-0800 | GST | 10% | G11 purchases, 1B credit | Yes |
| Office Supplies | 6-0900 | GST | 10% | G11 purchases, 1B credit | Yes |
| Professional Fees | 6-1000 | GST | 10% | G11 purchases, 1B credit | Yes |
| Rent | 6-1100 | GST | 10% | G11 purchases, 1B credit | Commercial only |
| Repairs & Maintenance | 6-1200 | GST | 10% | G11 purchases, 1B credit | Yes |
| Subscriptions | 6-1300 | GST | 10% | G11 purchases, 1B credit | Yes |
| Telephone & Internet | 6-1400 | GST | 10% | G11 purchases, 1B credit | Yes |
| Travel | 6-1500 | GST | 10% | G11 purchases, 1B credit | Yes |
| Utilities | 6-1600 | GST | 10% | G11 purchases, 1B credit | Yes |
| Wages & Salaries | 6-1700 | N-T | 0% | W1/W2 (PAYG) | No |
| Superannuation | 6-1800 | N-T | 0% | Not on BAS | No |
| Work from Home | 6-1900 | N-T | 0% | Not on BAS | No |
| Miscellaneous | 6-2000 | GST | 10% | G11 purchases, 1B credit | Yes |

### Insurance GST Rules (Special Case)
| Insurance Type | GST Treatment |
|---|---|
| General insurance (business) | 10% GST - claimable |
| Professional indemnity | 10% GST - claimable |
| Workers compensation | Stamp duty varies by state, GST on premium |
| Life insurance | Input-taxed (no GST) |
| Income protection | Input-taxed (no GST) |
| CTP motor vehicle | 10% GST on premium |
| Health insurance | Input-taxed (no GST) |

---

## 5. BAS Reporting Periods & Deadlines

### Quarterly Reporting (Default)

| Quarter | Period | Due Date | Description |
|---|---|---|---|
| Q1 | 1 Jul - 30 Sep | 28 October | First quarter of FY |
| Q2 | 1 Oct - 31 Dec | 28 February | Christmas quarter |
| Q3 | 1 Jan - 31 Mar | 28 April | Third quarter |
| Q4 | 1 Apr - 30 Jun | 28 July | End of financial year |

**Extensions:** If lodging through a tax agent, extensions typically apply.

### Monthly Reporting
Required when GST turnover >= $20 million. Due 21st of following month.

### Annual Reporting
Available for voluntary GST registrants with turnover < $75,000. Due with income tax return (31 October or tax agent deadline).

---

## 6. Cash vs Accrual Accounting for GST

### Cash Basis
- **Eligibility:** GST turnover < $10 million
- **GST on sales:** Report when payment RECEIVED
- **GST on purchases:** Claim when payment MADE
- **Best for:** Small businesses, cash flow management
- **Advantage:** Don't pay GST on unpaid invoices

### Accrual Basis
- **Required when:** GST turnover >= $10 million
- **GST on sales:** Report when invoice ISSUED
- **GST on purchases:** Claim when invoice RECEIVED
- **Best for:** Larger businesses, financial accuracy
- **Advantage:** More accurate financial picture

### Impact on BAS
```
Cash basis:
  1A = GST on payments received this quarter
  1B = GST on payments made this quarter

Accrual basis:
  1A = GST on invoices issued this quarter
  1B = GST on invoices received this quarter
```

---

## 7. Input Tax Credit Rules

### Requirements to Claim
1. Must be **registered for GST**
2. Must have a **valid tax invoice** (for purchases > $82.50 incl. GST)
3. Purchase must be for a **creditable purpose** (business use)
4. Supplier must be **GST-registered** (or you withhold top of invoice)
5. Must claim within **4 years** of the BAS period

### Partial Credits (Apportionment)
When a purchase is used for both business and private purposes:
```
Claimable GST = Total GST x Business Use %

Example: Phone bill $110 (incl. $10 GST), 60% business use
Claimable = $10 x 60% = $6.00
```

### Items You CANNOT Claim GST Credits On
- Wages and salaries (not a taxable supply)
- Bank fees and loan interest (input-taxed)
- Residential rent (input-taxed)
- Life insurance and health insurance premiums (input-taxed)
- Donations (not a taxable supply)
- Government fees (fines, taxes - not taxable supply)
- Purchases from non-GST-registered suppliers
- Private/domestic portion of mixed-use items

### Motor Vehicle Limit
GST credit on car purchases is limited to the car cost limit:
- **2024-25:** $68,108
- Maximum GST credit = $68,108 / 11 = **$6,191.64**

---

## 8. Common Edge Cases

### 8.1 Supermarket Purchases
Supermarket receipts contain MIXED GST items:
- Fresh food = GST-free
- Snacks, confectionery, soft drinks = 10% GST
- Cleaning products, paper goods = 10% GST
- **Rule:** If no breakdown available, treat as 50/50 mixed

### 8.2 Restaurant/Cafe Expenses
- All prepared food and beverages = 10% GST
- Entertainment: Only 50% of meal costs deductible
- FBT may apply if providing meals to employees

### 8.3 PayPal/Stripe Fees
- Processing fees from Australian payment processors = 10% GST, claimable
- International payment fees (PayPal overseas) = No GST (overseas supply)

### 8.4 Amazon/Online Purchases
- From Australian seller/Amazon AU = 10% GST
- From overseas (< $1,000 before July 2018, now all) = GST applied at purchase
- Digital supplies from overseas = GST applied since 1 July 2017

### 8.5 Petrol/Fuel
- Fuel purchases = 10% GST (claimable)
- May also qualify for fuel tax credits (label 7C) if business use
- Fuel tax credit rates change quarterly

### 8.6 Mixed Personal/Business
- Mobile phone: Apportion by business use %
- Home office: Fixed rate ($0.67/hr) or actual cost method
- Vehicle: Logbook method or cents-per-km method

### 8.7 Bad Debts
- If you've reported GST on a sale but customer doesn't pay:
  - After 12 months overdue, you can claim a GST adjustment
  - Reduces 1A in the period of write-off

### 8.8 Second-Hand Goods
- Purchasing from unregistered seller: Can claim a "notional" input tax credit
- Only if purchased for business use and price > $82.50
- Credit = 1/11 of purchase price

---

## 9. ATO Compliance & Audit Triggers

### Digital Record-Keeping Requirements
- Must keep records for **5 years** from date of preparation or transaction
- Records must be in **English** (or easily translatable)
- Must keep **tax invoices** for all purchases over $82.50
- Electronic records are acceptable (and preferred by ATO)

### Common BAS Mistakes to Avoid
1. **Claiming GST on bank fees/interest** - These are input-taxed, no credit
2. **Claiming GST on wages** - Not a taxable supply
3. **Not having valid tax invoices** - Required for purchases > $82.50
4. **Claiming full GST on mixed-use items** - Must apportion
5. **Including transfers as income/expenses** - Must exclude inter-account transfers
6. **Wrong reporting period** - Cash vs accrual timing errors
7. **Claiming GST on insurance** - Check: general (GST) vs life (no GST)
8. **Exceeding car limit** - Max GST credit capped
9. **Late lodgement** - Penalties and interest apply
10. **Amended BAS too frequently** - ATO red flag for weak bookkeeping

### ATO Audit Red Flags
- GST refunds consistently larger than industry norms
- Input tax credits significantly higher than sales GST
- BAS figures inconsistent with income tax return
- Frequent BAS amendments
- Late or non-lodgement
- Large one-off GST credits
- Cash-intensive business with low reported income

---

## 10. Calculation Examples

### Example 1: Standard Taxable Sale
```
Sale price (GST-inclusive): $1,100.00
GST component: $1,100 / 11 = $100.00
GST-exclusive: $1,100 - $100 = $1,000.00

BAS: G1 += $1,100, 1A += $100
```

### Example 2: Business Purchase with GST
```
Office supplies purchased: $330.00 (incl. GST)
GST component: $330 / 11 = $30.00

BAS: G11 += $330, 1B += $30
```

### Example 3: Capital Purchase
```
New laptop: $2,200.00 (incl. GST)
GST component: $2,200 / 11 = $200.00

BAS: G10 += $2,200, 1B += $200
(Also depreciable over 4 years if >$20K, else instant write-off)
```

### Example 4: Mixed-Use Expense
```
Phone bill: $110.00 (incl. GST), 70% business use
Total GST: $110 / 11 = $10.00
Claimable GST: $10 x 70% = $7.00

BAS: G11 += $77 (70% of $110), 1B += $7
```

### Example 5: Quarterly BAS Summary
```
Quarter: Q2 FY2024-25 (Oct-Dec 2024)

Sales:
  Taxable sales (G1):     $55,000
  Export sales (G2):        $5,000
  GST-free sales (G3):     $2,000
  GST on sales (1A):        $4,364  ($48,000 taxable portion / 11)

Purchases:
  Capital (G10):            $3,300
  Non-capital (G11):       $22,000
  GST on purchases (1B):    $2,300  (sum of GST on G10 + G11)

Net GST: 1A - 1B = $4,364 - $2,300 = $2,064 (payable to ATO)

PAYG:
  W1 (wages):              $30,000
  W2 (withheld):            $7,500

Total payable: $2,064 + $7,500 = $9,564
Due: 28 February 2025
```

---

## 11. Tax Code Quick Reference

| Tax Code | Name | GST Rate | Input Credit | Usage |
|---|---|---|---|---|
| **GST** | GST on Income/Expenses | 10% | Yes (purchases) | Most business transactions |
| **FRE** | GST-Free | 0% | Yes (related inputs) | Medical, education, fresh food, exports |
| **INP** | Input-Taxed | 0% | No | Bank fees, interest, residential rent |
| **N-T** | Not Reportable | N/A | No | Wages, super, depreciation, private |
| **EXP** | Export | 0% | Yes | Goods/services exported |
| **CAP** | Capital Acquisition | 10% | Yes | Equipment, vehicles, fit-out |

---

*Last updated: February 2026*
*Source: ATO publications, GST Act 1999, A New Tax System (Goods and Services Tax) Act 1999*
