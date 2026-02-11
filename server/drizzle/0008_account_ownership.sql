ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ownership_tag TEXT DEFAULT 'business';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_owner_contribution INTEGER DEFAULT 0;
