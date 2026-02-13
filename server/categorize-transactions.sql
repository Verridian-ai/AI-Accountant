-- ============================================================================
-- COMPREHENSIVE TRANSACTION CATEGORIZATION SCRIPT
-- Business: Amica Beauty (beauty salon, Wollongong/Illawarra NSW)
-- Rules: All spending is GST claimable EXCEPT wages & loan payments
--        Only POS deposits are income; other deposits are owner contributions
-- Amounts in cents. gst_amount = ROUND(ABS(amount)/11) for GST-claimable items
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. INCOME: POS deposits = Sales Revenue
-- ============================================================================
UPDATE transactions SET
  category = 'Sales Revenue',
  gst_category = 'taxable_10',
  gst_applicable = true,
  merchant_normalized = 'Amica Beauty POS'
WHERE description LIKE 'POS %' AND amount > 0 AND category = 'Uncategorized';

-- "Payment Received, Thank You" = also business income (online/card payments)
UPDATE transactions SET
  category = 'Sales Revenue',
  gst_category = 'taxable_10',
  gst_applicable = true,
  merchant_normalized = 'Payment Received'
WHERE description LIKE 'Payment Received%' AND amount > 0 AND category = 'Uncategorized';

-- ============================================================================
-- 2. OWNER CONTRIBUTIONS (deposits that are NOT POS)
-- ============================================================================
UPDATE transactions SET
  category = 'Transfer',
  gst_category = 'private',
  gst_applicable = false,
  is_transfer = true,
  is_owner_contribution = 1,
  merchant_normalized = 'Owner Contribution'
WHERE amount > 0
  AND (description LIKE '%Owner contribut%' OR description LIKE '%Owner Contribut%')
  AND category = 'Uncategorized';

-- Transfers from personal accounts = owner contributions
UPDATE transactions SET
  category = 'Transfer',
  gst_category = 'private',
  gst_applicable = false,
  is_transfer = true,
  is_owner_contribution = 1,
  merchant_normalized = 'Owner Contribution'
WHERE amount > 0
  AND description LIKE 'Transfer from xx%CommBank app'
  AND description NOT LIKE '%Owner%'
  AND description NOT LIKE '%Rent%'
  AND description NOT LIKE '%Wages%'
  AND category = 'Uncategorized';

-- Transfers from personal with Wages label = returning wages money
UPDATE transactions SET
  category = 'Transfer',
  gst_category = 'private',
  gst_applicable = false,
  is_transfer = true,
  is_owner_contribution = 1,
  merchant_normalized = 'Owner Contribution'
WHERE amount > 0
  AND description LIKE 'Transfer from xx%CommBank app%Wages%'
  AND category = 'Uncategorized';

-- Cash deposits = owner contributions
UPDATE transactions SET
  category = 'Transfer',
  gst_category = 'private',
  gst_applicable = false,
  is_transfer = true,
  is_owner_contribution = 1,
  merchant_normalized = 'Cash Deposit'
WHERE description LIKE 'CASH DEPOSIT%' AND amount > 0 AND category = 'Uncategorized';

-- ============================================================================
-- 3. BIZCAP LOAN DRAWDOWNS (incoming loan funds, NOT income)
-- ============================================================================
UPDATE transactions SET
  category = 'Loan Repayment',
  gst_category = 'private',
  gst_applicable = false,
  merchant_normalized = 'Bizcap Loan Drawdown'
WHERE description LIKE '%BIZCAP%' AND amount > 0 AND category = 'Uncategorized';

-- ============================================================================
-- 4. LOAN PAYMENT DISHONOUR REVERSALS
-- ============================================================================
UPDATE transactions SET
  category = 'Loan Repayment',
  gst_category = 'private',
  gst_applicable = false,
  merchant_normalized = 'Loan Payment Reversal'
WHERE description LIKE 'Loan Pymt Dishonour%' AND amount > 0 AND category = 'Uncategorized';

-- ============================================================================
-- 5. REFUNDS (positive amounts) - keep original expense GST treatment
-- ============================================================================
UPDATE transactions SET
  category = 'Refund',
  gst_category = 'taxable_10',
  gst_applicable = true,
  merchant_normalized = CASE
    WHEN description LIKE '%UBEREATS%' THEN 'Uber Eats Refund'
    WHEN description LIKE '%UBER %' THEN 'Uber Refund'
    WHEN description LIKE '%Woolworths%' THEN 'Woolworths Refund'
    WHEN description LIKE '%NRMA%' THEN 'NRMA Insurance Refund'
    ELSE 'Refund'
  END
WHERE description LIKE 'Refund%' OR description LIKE 'Return%'
  AND amount > 0 AND category = 'Uncategorized';

-- Direct Credit = misc income / owner contribution
UPDATE transactions SET
  category = 'Transfer',
  gst_category = 'private',
  gst_applicable = false,
  is_transfer = true,
  is_owner_contribution = 1,
  merchant_normalized = 'Direct Credit'
WHERE description LIKE 'Direct Credit%' AND amount > 0 AND category = 'Uncategorized';

-- Rent received back
UPDATE transactions SET
  category = 'Transfer',
  gst_category = 'private',
  gst_applicable = false,
  is_transfer = true,
  merchant_normalized = 'Rent Refund'
WHERE description LIKE 'Transfer from%Rent%' AND amount > 0 AND category = 'Uncategorized';

-- Owner drawings returned
UPDATE transactions SET
  category = 'Transfer',
  gst_category = 'private',
  gst_applicable = false,
  is_transfer = true,
  merchant_normalized = 'Owner Drawings Return'
WHERE description LIKE '%Owner drawings%' AND amount > 0 AND category = 'Uncategorized';

COMMIT;

