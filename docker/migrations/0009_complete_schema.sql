-- ============================================================================
-- 0009: Add columns that may be missing on fresh deploy
-- ============================================================================

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS gst_amount integer DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS gst_category text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_owner_contribution boolean DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_hash text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS parser_version text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS extraction_hash text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ownership_tag text DEFAULT 'business';
