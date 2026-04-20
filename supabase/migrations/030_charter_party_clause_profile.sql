ALTER TABLE charter_parties
  ADD COLUMN IF NOT EXISTS clause_profile JSONB DEFAULT '{}'::jsonb;
