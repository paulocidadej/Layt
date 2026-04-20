ALTER TABLE charter_parties
  ADD COLUMN IF NOT EXISTS cp_number TEXT,
  ADD COLUMN IF NOT EXISTS voyage_id UUID REFERENCES voyages(id);

CREATE INDEX IF NOT EXISTS idx_charter_parties_voyage_id ON charter_parties(voyage_id);
