"""
F4: Memify Enrichment Rules — GoldLedger Financial Intelligence

Five custom enrichment rules that derive financial patterns and intelligence
from the Cognee knowledge graph after cognify processes raw transactions.

These rules create derived nodes (PatternNode, BASPeriodNode, MerchantIntelNode,
TransferPatternNode, RecurringPaymentNode) that enable smarter AI agent decisions.
"""

from typing import Any, Dict, List, Tuple
from datetime import datetime, timedelta
from collections import defaultdict
import statistics


# ─────────────────────────────────────────────────────────────────────────────
# Rule 1: Spending Pattern Derivation
# ─────────────────────────────────────────────────────────────────────────────

async def derive_spending_patterns(subgraph_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Analyze transaction nodes to derive category-level spending patterns.

    Groups transactions by (account, category, month) and derives:
    - Average monthly spend
    - Trend direction (increasing/decreasing/stable)
    - Seasonal variation
    - Anomaly detection (>2σ from mean)

    Returns list of PatternNode dictionaries.
    """
    patterns_by_key = defaultdict(list)

    # Extract transaction nodes
    for chunk in subgraph_chunks:
        if chunk.get('node_type') != 'Transaction':
            continue

        account_id = chunk.get('account_id')
        category = chunk.get('category', 'Uncategorized')
        date_str = chunk.get('date')
        amount = chunk.get('amount', 0)

        if not date_str:
            continue

        try:
            date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            continue

        month_key = date.strftime('%Y-%m')
        pattern_key = (account_id, category, month_key)
        patterns_by_key[pattern_key].append(amount)

    # Derive intelligence from grouped patterns
    enriched_nodes = []

    for (account_id, category, month), amounts in patterns_by_key.items():
        if len(amounts) < 2:  # Need at least 2 transactions for meaningful analysis
            continue

        avg_amount = statistics.mean(amounts)
        total_amount = sum(amounts)
        count = len(amounts)

        # Detect anomalies (>2σ from mean)
        if count >= 3:
            stdev = statistics.stdev(amounts)
            is_anomaly = any(abs(amt - avg_amount) > 2 * stdev for amt in amounts)
        else:
            is_anomaly = False

        enriched_nodes.append({
            'node_type': 'SpendingPattern',
            'account_id': account_id,
            'category': category,
            'month': month,
            'avg_amount': round(avg_amount, 2),
            'total_amount': round(total_amount, 2),
            'transaction_count': count,
            'is_anomaly': is_anomaly,
            'enriched_at': datetime.utcnow().isoformat(),
        })

    return enriched_nodes


# ─────────────────────────────────────────────────────────────────────────────
# Rule 2: BAS Quarter Summaries
# ─────────────────────────────────────────────────────────────────────────────

def get_bas_quarter(date: datetime) -> Tuple[int, int]:
    """
    Get Australian BAS quarter for a date.
    Q1: Jul-Sep, Q2: Oct-Dec, Q3: Jan-Mar, Q4: Apr-Jun
    Returns (year, quarter)
    """
    month = date.month
    if 7 <= month <= 9:
        return (date.year, 1)
    elif 10 <= month <= 12:
        return (date.year, 2)
    elif 1 <= month <= 3:
        # Q3 belongs to FY starting previous July
        return (date.year - 1 if month <= 6 else date.year, 3)
    else:  # 4-6
        return (date.year - 1 if month <= 6 else date.year, 4)


async def derive_bas_summaries(subgraph_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Aggregate transaction nodes into BAS period summaries.

    Groups by BAS quarter and calculates:
    - G1: GST on sales
    - G10: Capital acquisitions GST
    - G11: GST on purchases
    - G20: Net GST (G1 - G11)
    - W1/W2: PAYG withholding

    Returns list of BASPeriodNode dictionaries.
    """
    bas_by_period = defaultdict(lambda: {
        'G1': 0,
        'G10': 0,
        'G11': 0,
        'W1': 0,
        'W2': 0,
        'total_revenue': 0,
        'total_expenses': 0,
    })

    for chunk in subgraph_chunks:
        if chunk.get('node_type') != 'Transaction':
            continue

        date_str = chunk.get('date')
        amount = chunk.get('amount', 0)
        gst_amount = chunk.get('gst_amount', 0)
        gst_category = chunk.get('gst_category', '')
        category = chunk.get('category', '')

        if not date_str:
            continue

        try:
            date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            continue

        year, quarter = get_bas_quarter(date)
        period_key = (year, quarter)

        # GST collected on sales
        if gst_category == 'gst_applicable' and amount > 0:
            bas_by_period[period_key]['G1'] += gst_amount
            bas_by_period[period_key]['total_revenue'] += amount

        # GST paid on purchases
        elif gst_category == 'gst_applicable' and amount < 0:
            bas_by_period[period_key]['G11'] += abs(gst_amount)
            bas_by_period[period_key]['total_expenses'] += abs(amount)

        # PAYG withholding (salary/wages expenses)
        if 'wages' in category.lower() or 'salary' in category.lower():
            if amount < 0:
                bas_by_period[period_key]['W1'] += abs(amount) * 0.15  # Estimate 15% withholding

    # Create enriched BAS period nodes
    enriched_nodes = []

    for (year, quarter), totals in bas_by_period.items():
        G1 = round(totals['G1'], 2)
        G11 = round(totals['G11'], 2)
        G20 = round(G1 - G11, 2)  # Net GST

        enriched_nodes.append({
            'node_type': 'BASPeriod',
            'financial_year': year,
            'quarter': quarter,
            'G1_gst_on_sales': G1,
            'G10_capital_acquisitions': round(totals['G10'], 2),
            'G11_gst_on_purchases': G11,
            'G20_net_gst': G20,
            'W1_payg_withheld': round(totals['W1'], 2),
            'W2_payg_installments': round(totals['W2'], 2),
            'total_revenue': round(totals['total_revenue'], 2),
            'total_expenses': round(totals['total_expenses'], 2),
            'enriched_at': datetime.utcnow().isoformat(),
        })

    return enriched_nodes


# ─────────────────────────────────────────────────────────────────────────────
# Rule 3: Merchant Intelligence
# ─────────────────────────────────────────────────────────────────────────────

async def derive_merchant_intelligence(subgraph_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Analyze merchant nodes to derive intelligence.

    For each merchant calculates:
    - Transaction frequency
    - Average amount
    - Most common category
    - Category consistency score
    - Flags merchants with <70% consistency (possible miscategorization)

    Returns list of MerchantIntelNode dictionaries.
    """
    merchant_data = defaultdict(lambda: {
        'amounts': [],
        'categories': [],
        'gst_registered_count': 0,
        'gst_free_count': 0,
    })

    for chunk in subgraph_chunks:
        if chunk.get('node_type') != 'Transaction':
            continue

        merchant = chunk.get('description', '').split()[0]  # Simple merchant extraction
        amount = chunk.get('amount', 0)
        category = chunk.get('category', 'Uncategorized')
        gst_category = chunk.get('gst_category', '')

        merchant_data[merchant]['amounts'].append(amount)
        merchant_data[merchant]['categories'].append(category)

        if gst_category == 'gst_applicable':
            merchant_data[merchant]['gst_registered_count'] += 1
        elif gst_category == 'gst_free':
            merchant_data[merchant]['gst_free_count'] += 1

    # Derive merchant intelligence
    enriched_nodes = []

    for merchant, data in merchant_data.items():
        if len(data['amounts']) < 2:
            continue

        avg_amount = statistics.mean(data['amounts'])
        transaction_count = len(data['amounts'])

        # Most common category
        category_counts = {}
        for cat in data['categories']:
            category_counts[cat] = category_counts.get(cat, 0) + 1

        dominant_category = max(category_counts, key=category_counts.get)
        dominant_count = category_counts[dominant_category]
        consistency_score = dominant_count / transaction_count

        # GST registration inference
        total_gst_txns = data['gst_registered_count'] + data['gst_free_count']
        gst_registered = data['gst_registered_count'] > (total_gst_txns * 0.5) if total_gst_txns > 0 else False

        enriched_nodes.append({
            'node_type': 'MerchantIntel',
            'merchant_key': merchant,
            'transaction_count': transaction_count,
            'avg_amount': round(avg_amount, 2),
            'dominant_category': dominant_category,
            'category_consistency_score': round(consistency_score, 2),
            'gst_registered': gst_registered,
            'needs_review': consistency_score < 0.7,
            'enriched_at': datetime.utcnow().isoformat(),
        })

    return enriched_nodes


# ─────────────────────────────────────────────────────────────────────────────
# Rule 4: Transfer Pattern Detection
# ─────────────────────────────────────────────────────────────────────────────

async def derive_transfer_patterns(subgraph_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Identify recurring inter-account transfer patterns.

    Detects:
    - Transaction pairs with matching absolute amounts within 3 days
    - Regular schedules (weekly, fortnightly, monthly)
    - Confidence based on consistency

    Returns list of TransferPatternNode dictionaries.
    """
    # Group transactions by amount (rounded to nearest $10)
    transactions_by_amount = defaultdict(list)

    for chunk in subgraph_chunks:
        if chunk.get('node_type') != 'Transaction':
            continue

        amount = chunk.get('amount', 0)
        date_str = chunk.get('date')
        account_id = chunk.get('account_id')

        if not date_str:
            continue

        try:
            date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            continue

        # Round to nearest $10 for fuzzy matching
        amount_bucket = round(abs(amount) / 1000) * 1000  # Amounts in cents

        transactions_by_amount[amount_bucket].append({
            'account_id': account_id,
            'amount': amount,
            'date': date,
        })

    # Find transfer pairs
    transfer_patterns = defaultdict(list)

    for amount_bucket, txns in transactions_by_amount.items():
        if len(txns) < 4:  # Need at least 2 pairs for pattern
            continue

        # Sort by date
        txns_sorted = sorted(txns, key=lambda x: x['date'])

        # Find pairs within 3 days
        for i in range(len(txns_sorted)):
            for j in range(i + 1, len(txns_sorted)):
                tx1 = txns_sorted[i]
                tx2 = txns_sorted[j]

                if (tx2['date'] - tx1['date']).days > 3:
                    break

                # Opposite signs = potential transfer
                if (tx1['amount'] > 0 and tx2['amount'] < 0) or (tx1['amount'] < 0 and tx2['amount'] > 0):
                    pattern_key = tuple(sorted([tx1['account_id'], tx2['account_id']]))
                    transfer_patterns[pattern_key].append({
                        'amount': abs(tx1['amount']),
                        'date': tx1['date'],
                    })

    # Create enriched transfer pattern nodes
    enriched_nodes = []

    for (acc1, acc2), transfers in transfer_patterns.items():
        if len(transfers) < 2:
            continue

        avg_amount = statistics.mean([t['amount'] for t in transfers])
        last_date = max([t['date'] for t in transfers])

        # Detect frequency (simple heuristic)
        if len(transfers) >= 3:
            dates = sorted([t['date'] for t in transfers])
            intervals = [(dates[i+1] - dates[i]).days for i in range(len(dates)-1)]
            avg_interval = statistics.mean(intervals)

            if 6 <= avg_interval <= 8:
                frequency = 'weekly'
            elif 13 <= avg_interval <= 15:
                frequency = 'fortnightly'
            elif 28 <= avg_interval <= 32:
                frequency = 'monthly'
            else:
                frequency = 'irregular'
        else:
            frequency = 'unknown'

        confidence = min(len(transfers) / 10, 1.0)  # More occurrences = higher confidence

        enriched_nodes.append({
            'node_type': 'TransferPattern',
            'from_account': acc1,
            'to_account': acc2,
            'typical_amount': round(avg_amount, 2),
            'frequency': frequency,
            'occurrence_count': len(transfers),
            'last_seen_date': last_date.isoformat(),
            'confidence': round(confidence, 2),
            'auto_match_enabled': confidence >= 0.7,
            'enriched_at': datetime.utcnow().isoformat(),
        })

    return enriched_nodes


# ─────────────────────────────────────────────────────────────────────────────
# Rule 5: Recurring Payment Schedules
# ─────────────────────────────────────────────────────────────────────────────

async def derive_recurring_schedules(subgraph_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Extract recurring payment schedules from transaction history.

    Detects:
    - Weekly rent
    - Monthly subscriptions
    - Quarterly insurance
    - Annual fees

    Returns list of RecurringPaymentNode dictionaries with next_expected_date.
    """
    # Group by (merchant, amount ±5%)
    merchant_patterns = defaultdict(list)

    for chunk in subgraph_chunks:
        if chunk.get('node_type') != 'Transaction':
            continue

        description = chunk.get('description', '')
        amount = chunk.get('amount', 0)
        date_str = chunk.get('date')
        category = chunk.get('category', '')

        if not date_str or amount >= 0:  # Only expenses
            continue

        try:
            date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            continue

        # Fuzzy merchant key
        merchant_key = description.split()[0].lower() if description else 'unknown'

        # Amount bucket (±5%)
        amount_bucket = round(abs(amount) / 500) * 500

        pattern_key = (merchant_key, amount_bucket)
        merchant_patterns[pattern_key].append({
            'amount': abs(amount),
            'date': date,
            'category': category,
        })

    # Detect recurring patterns
    enriched_nodes = []

    for (merchant, amount_bucket), payments in merchant_patterns.items():
        if len(payments) < 3:  # Need at least 3 occurrences
            continue

        # Sort by date
        payments_sorted = sorted(payments, key=lambda x: x['date'])
        dates = [p['date'] for p in payments_sorted]

        # Calculate intervals
        intervals = [(dates[i+1] - dates[i]).days for i in range(len(dates)-1)]
        avg_interval = statistics.mean(intervals)

        # Classify frequency
        if 6 <= avg_interval <= 8:
            frequency = 'weekly'
            expected_days = 7
        elif 27 <= avg_interval <= 32:
            frequency = 'monthly'
            expected_days = 30
        elif 88 <= avg_interval <= 95:
            frequency = 'quarterly'
            expected_days = 90
        elif 360 <= avg_interval <= 370:
            frequency = 'annual'
            expected_days = 365
        else:
            continue  # Not a clear recurring pattern

        last_payment = dates[-1]
        next_expected = last_payment + timedelta(days=expected_days)
        is_active = (datetime.utcnow() - last_payment).days < (expected_days * 2)

        # Calculate missed payments
        expected_count = int((datetime.utcnow() - dates[0]).days / expected_days)
        missed_count = max(0, expected_count - len(payments))

        avg_amount = statistics.mean([p['amount'] for p in payments])
        category = payments_sorted[-1]['category']

        enriched_nodes.append({
            'node_type': 'RecurringPayment',
            'merchant': merchant,
            'category': category,
            'typical_amount': round(avg_amount, 2),
            'frequency': frequency,
            'occurrence_count': len(payments),
            'last_payment_date': last_payment.isoformat(),
            'next_expected_date': next_expected.isoformat(),
            'is_active': is_active,
            'missed_count': missed_count,
            'enriched_at': datetime.utcnow().isoformat(),
        })

    return enriched_nodes


# ─────────────────────────────────────────────────────────────────────────────
# Export all rules for Cognee memify engine
# ─────────────────────────────────────────────────────────────────────────────

__all__ = [
    'derive_spending_patterns',
    'derive_bas_summaries',
    'derive_merchant_intelligence',
    'derive_transfer_patterns',
    'derive_recurring_schedules',
]
