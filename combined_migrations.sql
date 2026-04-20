-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Note: Row Level Security is enabled on tables below
-- JWT secret is managed by Supabase automatically

-- ============================================
-- TENANTS TABLE (Multi-tenant organizations)
-- ============================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  subscription_tier VARCHAR(50) DEFAULT 'free',
  features JSONB DEFAULT '{}'::jsonb
);

-- ============================================
-- USERS TABLE (User accounts with roles)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  full_name VARCHAR(255),
  role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'customer_admin', 'operator')),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Index for faster tenant lookups
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- LOOKUP DATA TABLES (Dropdown data)
-- ============================================

-- Vessels
CREATE TABLE vessels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, tenant_id)
);

CREATE INDEX idx_vessels_tenant_id ON vessels(tenant_id);

-- Charter Parties
CREATE TABLE charter_parties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, tenant_id)
);

CREATE INDEX idx_charter_parties_tenant_id ON charter_parties(tenant_id);

-- Cargo Names
CREATE TABLE cargo_names (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, tenant_id)
);

CREATE INDEX idx_cargo_names_tenant_id ON cargo_names(tenant_id);

-- Owner Names
CREATE TABLE owner_names (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, tenant_id)
);

CREATE INDEX idx_owner_names_tenant_id ON owner_names(tenant_id);

-- Charterer Names
CREATE TABLE charterer_names (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, tenant_id)
);

CREATE INDEX idx_charterer_names_tenant_id ON charterer_names(tenant_id);

-- Counter Parties
CREATE TABLE counterparties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, tenant_id)
);

CREATE INDEX idx_counterparties_tenant_id ON counterparties(tenant_id);

-- Port Names
CREATE TABLE ports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, tenant_id)
);

CREATE INDEX idx_ports_tenant_id ON ports(tenant_id);

-- Terms Used
CREATE TABLE terms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, tenant_id)
);

CREATE INDEX idx_terms_tenant_id ON terms(tenant_id);

-- ============================================
-- VOYAGES TABLE
-- ============================================
CREATE TABLE voyages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voyage_reference VARCHAR(100) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  vessel_id UUID REFERENCES vessels(id),
  voyage_number VARCHAR(100),
  cargo_quantity DECIMAL(15, 2),
  cargo_name_id UUID REFERENCES cargo_names(id),
  owner_name_id UUID REFERENCES owner_names(id),
  charterer_name_id UUID REFERENCES charterer_names(id),
  charter_party_id UUID REFERENCES charter_parties(id),
  cp_date DATE,
  external_reference VARCHAR(255),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(voyage_reference, tenant_id)
);

CREATE INDEX idx_voyages_tenant_id ON voyages(tenant_id);
CREATE INDEX idx_voyages_vessel_id ON voyages(vessel_id);
CREATE INDEX idx_voyages_created_at ON voyages(created_at DESC);

-- ============================================
-- CLAIMS TABLE
-- ============================================
CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_reference VARCHAR(100) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  voyage_id UUID REFERENCES voyages(id) ON DELETE CASCADE NOT NULL,
  counterparty_id UUID REFERENCES counterparties(id),
  port_id UUID REFERENCES ports(id),
  demurrage_rate DECIMAL(15, 2),
  despatch_rate DECIMAL(15, 2),
  activity VARCHAR(50) CHECK (activity IN ('loading', 'discharging')),
  load_discharge_rate DECIMAL(15, 2),
  terms_id UUID REFERENCES terms(id),
  cargo_quantity DECIMAL(15, 2),
  cargo_name_id UUID REFERENCES cargo_names(id),
  laycan_start DATE,
  laycan_end DATE,
  claim_status VARCHAR(50) DEFAULT 'draft' CHECK (claim_status IN ('draft', 'in_progress', 'completed', 'archived')),
  amount_in_discussion DECIMAL(15, 2) DEFAULT 0,
  amount_type VARCHAR(20) CHECK (amount_type IN ('demurrage', 'despatch')),
  laytime_allowed DECIMAL(15, 2),
  laytime_used DECIMAL(15, 2),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(claim_reference, tenant_id)
);

CREATE INDEX idx_claims_tenant_id ON claims(tenant_id);
CREATE INDEX idx_claims_voyage_id ON claims(voyage_id);
CREATE INDEX idx_claims_status ON claims(claim_status);
CREATE INDEX idx_claims_created_at ON claims(created_at DESC);

-- ============================================
-- CALCULATION EVENTS TABLE (SOF Events)
-- ============================================
CREATE TABLE calculation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  deduction_name VARCHAR(255),
  from_datetime TIMESTAMP WITH TIME ZONE,
  to_datetime TIMESTAMP WITH TIME ZONE,
  rate_of_calculation DECIMAL(5, 2) DEFAULT 100.00 CHECK (rate_of_calculation >= 0 AND rate_of_calculation <= 100),
  time_used DECIMAL(15, 2), -- Calculated: (to_datetime - from_datetime) * rate_of_calculation
  incremental_time_used DECIMAL(15, 2), -- Cumulative time
  row_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_calculation_events_claim_id ON calculation_events(claim_id);
CREATE INDEX idx_calculation_events_tenant_id ON calculation_events(tenant_id);
CREATE INDEX idx_calculation_events_row_order ON calculation_events(claim_id, row_order);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_voyages_updated_at BEFORE UPDATE ON voyages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calculation_events_updated_at BEFORE UPDATE ON calculation_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE charter_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE cargo_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE charterer_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE counterparties ENABLE ROW LEVEL SECURITY;
ALTER TABLE ports ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE voyages ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculation_events ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies will be set up after authentication is implemented
-- For now, we'll create basic policies that allow access based on tenant_id

-- Basic policy: Users can only see data from their tenant
-- This will be refined when we implement proper authentication

CREATE POLICY "Users can view their tenant data" ON tenants
  FOR SELECT USING (true); -- Will be refined with auth

CREATE POLICY "Users can view their tenant users" ON users
  FOR SELECT USING (true); -- Will be refined with auth

-- Similar policies for other tables (will be refined with proper auth)
-- For development, we can temporarily allow all access, then restrict with proper auth

-- Migration to expand lookup tables for more detailed data management

-- ============================================
-- STEP 1: CREATE NEW 'parties' TABLE
-- This table will replace owner_names, charterer_names, counterparties
-- ============================================
CREATE TABLE parties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  party_type VARCHAR(100), -- e.g., 'Vessel Owner', 'Charterer', 'Port Agent'
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  tax_id VARCHAR(100),
  kyc_status VARCHAR(50) DEFAULT 'Pending', -- e.g., 'Pending', 'Verified', 'Rejected'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, tenant_id)
);
CREATE INDEX idx_parties_tenant_id ON parties(tenant_id);
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_parties_updated_at BEFORE UPDATE ON parties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- STEP 2: REMOVE FOREIGN KEY CONSTRAINTS FROM OLD TABLES
-- We must do this before we can drop the old tables.
-- ============================================
-- Alter voyages table
ALTER TABLE voyages DROP CONSTRAINT IF EXISTS voyages_owner_name_id_fkey;
ALTER TABLE voyages DROP CONSTRAINT IF EXISTS voyages_charterer_name_id_fkey;
-- Alter claims table
ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_counterparty_id_fkey;


-- ============================================
-- STEP 3: DROP OLD LOOKUP TABLES
-- ============================================
DROP TABLE IF EXISTS owner_names;
DROP TABLE IF EXISTS charterer_names;
DROP TABLE IF EXISTS counterparties;


-- ============================================
-- STEP 4: ADD NEW FOREIGN KEY COLUMNS to voyages/claims
-- These will link to the new 'parties' table
-- ============================================
ALTER TABLE voyages ADD COLUMN owner_id UUID REFERENCES parties(id);
ALTER TABLE voyages ADD COLUMN charterer_id UUID REFERENCES parties(id);
-- Remove old columns
ALTER TABLE voyages DROP COLUMN IF EXISTS owner_name_id;
ALTER TABLE voyages DROP COLUMN IF EXISTS charterer_name_id;

ALTER TABLE claims ADD COLUMN counterparty_id_new UUID REFERENCES parties(id);
-- We'll rename this back to counterparty_id later, this is to avoid type conflicts
ALTER TABLE claims DROP COLUMN IF EXISTS counterparty_id;
ALTER TABLE claims RENAME COLUMN counterparty_id_new TO counterparty_id;


-- ============================================
-- STEP 5: EXPAND 'vessels' TABLE
-- ============================================
ALTER TABLE vessels ADD COLUMN imo_number INT;
ALTER TABLE vessels ADD COLUMN call_sign VARCHAR(50);
ALTER TABLE vessels ADD COLUMN mmsi INT;
ALTER TABLE vessels ADD COLUMN flag VARCHAR(100);
ALTER TABLE vessels ADD COLUMN year_built INT;
ALTER TABLE vessels ADD COLUMN dwt DECIMAL(15, 2);
ALTER TABLE vessels ADD COLUMN gross_tonnage DECIMAL(15, 2);
ALTER TABLE vessels ADD COLUMN net_tonnage DECIMAL(15, 2);
ALTER TABLE vessels ADD COLUMN vessel_type VARCHAR(100);
ALTER TABLE vessels ADD COLUMN technical_owner_id UUID REFERENCES parties(id);
ALTER TABLE vessels ADD COLUMN commercial_owner_id UUID REFERENCES parties(id);
-- Add unique constraint for IMO number per tenant
ALTER TABLE vessels ADD CONSTRAINT unique_imo_tenant UNIQUE (imo_number, tenant_id);


-- ============================================
-- STEP 6: EXPAND 'ports' TABLE
-- ============================================
ALTER TABLE ports ADD COLUMN un_locode VARCHAR(10);
ALTER TABLE ports ADD COLUMN country VARCHAR(100);
ALTER TABLE ports ADD COLUMN latitude DECIMAL(9, 6);
ALTER TABLE ports ADD COLUMN longitude DECIMAL(9, 6);
-- Add unique constraint for UN/LOCODE per tenant
ALTER TABLE ports ADD CONSTRAINT unique_unlocode_tenant UNIQUE (un_locode, tenant_id);


-- ============================================
-- STEP 7: EXPAND 'charter_parties' TABLE
-- ============================================
ALTER TABLE charter_parties ADD COLUMN charter_party_type VARCHAR(100); -- 'Voyage' or 'Time'
ALTER TABLE charter_parties ADD COLUMN signed_date DATE;
ALTER TABLE charter_parties ADD COLUMN document_url TEXT; -- Link to stored document

-- Note: No changes to 'cargo_names' or 'terms' in this migration.

-- Final notification
SELECT 'Migration 002_expand_lookup_tables.sql executed successfully.' as result;
-- ============================================
-- MIGRATION 004: SETUP RLS POLICIES (WORKAROUND)
-- This migration uses a direct JWT claim access method within each policy
-- to avoid the 'permission denied for schema auth' error.
-- ============================================

-- ============================================
-- TABLE: parties
-- ============================================
CREATE POLICY "Allow tenant members to read parties"
  ON public.parties FOR SELECT
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to insert parties"
  ON public.parties FOR INSERT
  WITH CHECK (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to update parties"
  ON public.parties FOR UPDATE
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to delete parties"
  ON public.parties FOR DELETE
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));


-- ============================================
-- TABLE: vessels
-- ============================================
CREATE POLICY "Allow tenant members to read vessels"
  ON public.vessels FOR SELECT
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to insert vessels"
  ON public.vessels FOR INSERT
  WITH CHECK (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to update vessels"
  ON public.vessels FOR UPDATE
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to delete vessels"
  ON public.vessels FOR DELETE
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));


-- ============================================
-- TABLE: ports
-- ============================================
CREATE POLICY "Allow tenant members to read ports"
  ON public.ports FOR SELECT
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to insert ports"
  ON public.ports FOR INSERT
  WITH CHECK (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to update ports"
  ON public.ports FOR UPDATE
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to delete ports"
  ON public.ports FOR DELETE
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));


-- ============================================
-- TABLE: cargo_names
-- ============================================
CREATE POLICY "Allow tenant members to read cargo_names"
  ON public.cargo_names FOR SELECT
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to insert cargo_names"
  ON public.cargo_names FOR INSERT
  WITH CHECK (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to update cargo_names"
  ON public.cargo_names FOR UPDATE
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to delete cargo_names"
  ON public.cargo_names FOR DELETE
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));


-- ============================================
-- TABLE: charter_parties
-- ============================================
CREATE POLICY "Allow tenant members to read charter_parties"
  ON public.charter_parties FOR SELECT
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to insert charter_parties"
  ON public.charter_parties FOR INSERT
  WITH CHECK (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to update charter_parties"
  ON public.charter_parties FOR UPDATE
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to delete charter_parties"
  ON public.charter_parties FOR DELETE
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));


-- ============================================
-- TABLE: voyages
-- ============================================
CREATE POLICY "Allow tenant members to read voyages"
  ON public.voyages FOR SELECT
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to insert voyages"
  ON public.voyages FOR INSERT
  WITH CHECK (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to update voyages"
  ON public.voyages FOR UPDATE
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to delete voyages"
  ON public.voyages FOR DELETE
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));


-- ============================================
-- TABLE: claims
-- ============================================
CREATE POLICY "Allow tenant members to read claims"
  ON public.claims FOR SELECT
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to insert claims"
  ON public.claims FOR INSERT
  WITH CHECK (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to update claims"
  ON public.claims FOR UPDATE
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "Allow tenant members to delete claims"
  ON public.claims FOR DELETE
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));


-- Final notification
SELECT 'Migration 004_setup_rls_policies_workaround.sql executed successfully.' as result;

-- ============================================
-- MIGRATION 005: ADD IS_PUBLIC FLAG AND UPDATE RLS POLICIES (DIRECT)
-- This migration adds an is_public boolean flag to all lookup tables
-- to allow super admins to create records that are visible to all tenants,
-- and it updates the RLS policies accordingly.
-- This version uses the direct current_setting call to avoid issues with the auth.tenant_id() function.
-- This migration is idempotent and can be run multiple times.
-- ============================================

-- Add is_public column to parties table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='parties' AND column_name='is_public') THEN
    ALTER TABLE public.parties ADD COLUMN is_public BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add is_public column to vessels table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='vessels' AND column_name='is_public') THEN
    ALTER TABLE public.vessels ADD COLUMN is_public BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add is_public column to ports table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='ports' AND column_name='is_public') THEN
    ALTER TABLE public.ports ADD COLUMN is_public BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add is_public column to cargo_names table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='cargo_names' AND column_name='is_public') THEN
    ALTER TABLE public.cargo_names ADD COLUMN is_public BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add is_public column to charter_parties table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='charter_parties' AND column_name='is_public') THEN
    ALTER TABLE public.charter_parties ADD COLUMN is_public BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- ============================================
-- UPDATE RLS POLICIES
-- This section updates the RLS policies to allow all users to read
-- records where is_public is true.
-- ============================================

-- Update parties read policy
DROP POLICY IF EXISTS "Allow tenant members to read parties" ON public.parties;
CREATE POLICY "Allow tenant members to read parties"
  ON public.parties FOR SELECT
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid) OR is_public = TRUE);

-- Update vessels read policy
DROP POLICY IF EXISTS "Allow tenant members to read vessels" ON public.vessels;
CREATE POLICY "Allow tenant members to read vessels"
  ON public.vessels FOR SELECT
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid) OR is_public = TRUE);

-- Update ports read policy
DROP POLICY IF EXISTS "Allow tenant members to read ports" ON public.ports;
CREATE POLICY "Allow tenant members to read ports"
  ON public.ports FOR SELECT
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid) OR is_public = TRUE);

-- Update cargo_names read policy
DROP POLICY IF EXISTS "Allow tenant members to read cargo_names" ON public.cargo_names;
CREATE POLICY "Allow tenant members to read cargo_names"
  ON public.cargo_names FOR SELECT
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid) OR is_public = TRUE);

-- Update charter_parties read policy
DROP POLICY IF EXISTS "Allow tenant members to read charter_parties" ON public.charter_parties;
CREATE POLICY "Allow tenant members to read charter_parties"
  ON public.charter_parties FOR SELECT
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid) OR is_public = TRUE);


-- Final notification
SELECT 'Migration 005_add_is_public_flag_and_update_rls_direct.sql executed successfully.' as result;
-- ============================================
-- MIGRATION 006: CREATE ROLES
-- This migration creates the customer_admin and operator roles
-- and grants them the necessary permissions.
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'customer_admin') THEN
    CREATE ROLE customer_admin;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'operator') THEN
    CREATE ROLE operator;
  END IF;
END
$$;

-- Grant usage on schema to roles
GRANT USAGE ON SCHEMA public TO customer_admin, operator;

-- Grant permissions to customer_admin
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO customer_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO customer_admin;

-- Grant permissions to operator
GRANT SELECT ON ALL TABLES IN SCHEMA public TO operator;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO operator;

-- Final notification
SELECT 'Migration 006_create_roles.sql executed successfully.' as result;
-- ============================================
-- MIGRATION 007: GRANT ROLES
-- This migration grants the customer_admin and operator roles
-- to the authenticator role.
-- ============================================

GRANT customer_admin, operator TO authenticator;

-- Final notification
SELECT 'Migration 007_grant_roles.sql executed successfully.' as result;
-- Add extended laytime/demurrage fields to claims
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS operation_type VARCHAR(20) CHECK (operation_type IN ('load','discharge')),
  ADD COLUMN IF NOT EXISTS port_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS load_discharge_rate DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS load_discharge_rate_unit VARCHAR(20) CHECK (load_discharge_rate_unit IN ('per_day','per_hour','fixed_duration')),
  ADD COLUMN IF NOT EXISTS fixed_rate_duration_hours DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS reversible BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS demurrage_rate DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS demurrage_currency VARCHAR(10),
  ADD COLUMN IF NOT EXISTS demurrage_after_hours DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS demurrage_rate_after DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS despatch_type VARCHAR(20) CHECK (despatch_type IN ('amount','percent')),
  ADD COLUMN IF NOT EXISTS despatch_rate_value DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS despatch_currency VARCHAR(10),
  ADD COLUMN IF NOT EXISTS laycan_start TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS laycan_end TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS nor_tendered_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS loading_start_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS loading_end_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS laytime_start TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS laytime_end TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS turn_time_method TEXT,
  ADD COLUMN IF NOT EXISTS term_id UUID REFERENCES terms(id);

-- Add weekend/holiday window info and is_public to terms
ALTER TABLE terms
  ADD COLUMN IF NOT EXISTS window_start_day VARCHAR(20),
  ADD COLUMN IF NOT EXISTS window_start_time TIME,
  ADD COLUMN IF NOT EXISTS window_end_day VARCHAR(20),
  ADD COLUMN IF NOT EXISTS window_end_time TIME,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- Update read policy for terms to include public visibility
DROP POLICY IF EXISTS "Allow tenant members to read terms" ON public.terms;
CREATE POLICY "Allow tenant members to read terms"
  ON public.terms FOR SELECT
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid) OR is_public = TRUE);
-- Requests table for operator-submitted lookup additions
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  request_type VARCHAR(50) NOT NULL, -- e.g., parties, vessels, ports, cargo_names, charter_parties, terms
  name TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requests_tenant_id ON requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);

ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

-- Basic RLS: tenant members can see their requests; super_admin unrestricted
CREATE POLICY "requests_select" ON requests
  FOR SELECT
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid) OR (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'super_admin'));

CREATE POLICY "requests_insert" ON requests
  FOR INSERT
  WITH CHECK (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid));

CREATE POLICY "requests_update" ON requests
  FOR UPDATE
  USING (tenant_id = (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId', '')::uuid) OR (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'super_admin'));

-- Trigger updated_at
CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Add holiday handling to terms
ALTER TABLE terms
  ADD COLUMN IF NOT EXISTS include_holidays BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS holiday_name TEXT,
  ADD COLUMN IF NOT EXISTS holiday_start DATE,
  ADD COLUMN IF NOT EXISTS holiday_end DATE;

-- Separate table for multiple holidays per term with time support
CREATE TABLE IF NOT EXISTS term_holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  term_id UUID REFERENCES terms(id) ON DELETE CASCADE,
  holiday_name TEXT,
  holiday_start TIMESTAMP WITH TIME ZONE,
  holiday_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_term_holidays_term_id ON term_holidays(term_id);
CREATE TRIGGER update_term_holidays_updated_at BEFORE UPDATE ON term_holidays
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Billing and plans
CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');
CREATE TYPE plan_status AS ENUM ('active', 'inactive');
CREATE TYPE tenant_plan_status AS ENUM ('active', 'canceled', 'trialing');
CREATE TYPE invoice_status AS ENUM ('draft', 'due', 'paid', 'overdue');

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  price_cents BIGINT NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  max_admins INT,
  max_operators INT,
  allow_data_management BOOLEAN DEFAULT TRUE,
  data_tabs JSONB DEFAULT '{}'::jsonb, -- per-tab enable/disable
  max_voyages INT,
  max_claims INT,
  status plan_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES plans(id) ON DELETE RESTRICT NOT NULL,
  status tenant_plan_status NOT NULL DEFAULT 'active',
  seats_admins INT,
  seats_operators INT,
  starts_at DATE DEFAULT CURRENT_DATE,
  ends_at DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  period_start DATE,
  period_end DATE,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  status invoice_status NOT NULL DEFAULT 'draft',
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_tenant_plans_tenant_id ON tenant_plans(tenant_id);

-- Timestamp triggers
CREATE OR REPLACE FUNCTION update_timestamp() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_tenant_plans_updated BEFORE UPDATE ON tenant_plans FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_timestamp();

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS max_claims_per_month INT;
-- Attachments for claims (NOR/SOF/other)
CREATE TABLE IF NOT EXISTS claim_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  attachment_type VARCHAR(20) CHECK (attachment_type IN ('nor','sof','other')) DEFAULT 'other',
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_attachments_claim_id ON claim_attachments(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_attachments_tenant_id ON claim_attachments(tenant_id);

-- Audit trail for calculation_events
CREATE TABLE IF NOT EXISTS calculation_events_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE NOT NULL,
  event_id UUID,
  action VARCHAR(10) CHECK (action IN ('insert','update','delete')),
  data JSONB,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calc_events_audit_claim_id ON calculation_events_audit(claim_id);

CREATE OR REPLACE FUNCTION log_calculation_event_audit() RETURNS trigger AS $$
DECLARE
  uid UUID := null;
BEGIN
  BEGIN
    uid := nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
  EXCEPTION WHEN others THEN
    uid := null;
  END;
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO calculation_events_audit (claim_id, event_id, action, data, user_id)
    VALUES (OLD.claim_id, OLD.id, 'delete', to_jsonb(OLD), uid);
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO calculation_events_audit (claim_id, event_id, action, data, user_id)
    VALUES (NEW.claim_id, NEW.id, 'update', to_jsonb(NEW), uid);
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO calculation_events_audit (claim_id, event_id, action, data, user_id)
    VALUES (NEW.claim_id, NEW.id, 'insert', to_jsonb(NEW), uid);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calc_events_audit ON calculation_events;
CREATE TRIGGER trg_calc_events_audit
AFTER INSERT OR UPDATE OR DELETE ON calculation_events
FOR EACH ROW EXECUTE FUNCTION log_calculation_event_audit();
-- Port calls per voyage
CREATE TABLE IF NOT EXISTS port_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voyage_id UUID REFERENCES voyages(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  port_id UUID REFERENCES ports(id) ON DELETE SET NULL,
  port_name TEXT NOT NULL,
  activity VARCHAR(20) CHECK (activity IN ('load','discharge','bunker','other')) DEFAULT 'other',
  sequence INT DEFAULT 1,
  eta TIMESTAMPTZ,
  etd TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_port_calls_voyage_id ON port_calls(voyage_id);
CREATE INDEX IF NOT EXISTS idx_port_calls_tenant_id ON port_calls(tenant_id);

CREATE OR REPLACE FUNCTION update_port_calls_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_port_calls_updated ON port_calls;
CREATE TRIGGER trg_port_calls_updated BEFORE UPDATE ON port_calls
  FOR EACH ROW EXECUTE FUNCTION update_port_calls_updated_at();

-- Reversible scope for claims (load-only, discharge-only, or all)
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS reversible_scope VARCHAR(20) CHECK (reversible_scope IN ('load_only','discharge_only','all_ports')) DEFAULT 'all_ports',
  ADD COLUMN IF NOT EXISTS port_call_id UUID REFERENCES port_calls(id) ON DELETE SET NULL;
-- Link SOF events to port calls for reversible scope handling
ALTER TABLE calculation_events
  ADD COLUMN IF NOT EXISTS port_call_id UUID REFERENCES port_calls(id) ON DELETE SET NULL;
-- Add allowed hours per port call to support reversible laytime pooling
ALTER TABLE port_calls
  ADD COLUMN IF NOT EXISTS allowed_hours DECIMAL(15,2);
-- Allow calculation_events_audit to keep history after claim deletion
ALTER TABLE calculation_events_audit
  ALTER COLUMN claim_id DROP NOT NULL;

ALTER TABLE calculation_events_audit
  DROP CONSTRAINT IF EXISTS calculation_events_audit_claim_id_fkey,
  ADD CONSTRAINT calculation_events_audit_claim_id_fkey
    FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE SET NULL;
-- Remove FK on calculation_events_audit.claim_id to avoid failures when claims/events are deleted
ALTER TABLE calculation_events_audit
  DROP CONSTRAINT IF EXISTS calculation_events_audit_claim_id_fkey;

ALTER TABLE calculation_events_audit
  ALTER COLUMN claim_id DROP NOT NULL;
-- Persist reversible pooling selection per claim
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS reversible_pool_ids UUID[] DEFAULT '{}';

-- QC fields on claims
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS qc_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS qc_reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qc_notes TEXT;

-- Claim comments for collaboration
CREATE TABLE IF NOT EXISTS claim_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_comments_claim_id ON claim_comments(claim_id);
-- Broaden claim_status to align with QC-driven workflow
-- Map old statuses and expand allowed values
UPDATE claims
SET claim_status = 'created'
WHERE claim_status = 'draft';

ALTER TABLE claims
  DROP CONSTRAINT IF EXISTS claims_claim_status_check,
  ALTER COLUMN claim_status SET DEFAULT 'created',
  ADD CONSTRAINT claims_claim_status_check
    CHECK (claim_status IN (
      'created',
      'in_progress',
      'for_qc',
      'qc_in_progress',
      'pending_reply',
      'missing_information',
      'pending_counter_check',
      'completed',
      'archived'
    ));
-- Notifications table for in-app alerts (QC assignment/status changes)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  level TEXT DEFAULT 'info',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
-- Enable RLS and policies on notifications for per-user access
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'notifications_select_own'
  ) THEN
    CREATE POLICY notifications_select_own
      ON notifications
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'notifications_update_own'
  ) THEN
    CREATE POLICY notifications_update_own
      ON notifications
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'notifications_insert_service'
  ) THEN
    CREATE POLICY notifications_insert_service
      ON notifications
      FOR INSERT
      WITH CHECK (auth.role() = 'service_role' OR auth.uid() = user_id);
  END IF;
END $$;
-- Broaden insert policy so authenticated users can create notifications (for cross-user alerts)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'notifications_insert_service'
  ) THEN
    DROP POLICY notifications_insert_service ON notifications;
  END IF;

  CREATE POLICY notifications_insert_authenticated
    ON notifications
    FOR INSERT
    WITH CHECK (auth.role() IN ('authenticated', 'service_role'));
END $$;
-- Laytime foundations: core tables for cargo/CP/profile/calculation/events
CREATE TABLE IF NOT EXISTS charter_parties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  voyage_id UUID REFERENCES voyages(id) ON DELETE CASCADE,
  cp_number TEXT,
  charterer_id UUID REFERENCES parties(id),
  laytime_allowed_value NUMERIC,
  laytime_allowed_unit TEXT CHECK (laytime_allowed_unit IN ('HOURS','DAYS','TONNES_PER_DAY')),
  laytime_scope TEXT CHECK (laytime_scope IN ('PER_PORT','AGGREGATE_PORTS','PER_OPERATION')),
  demurrage_rate_per_day NUMERIC,
  despatch_rate_per_day NUMERIC,
  currency TEXT,
  reversible_terms_enabled BOOLEAN DEFAULT FALSE,
  proration_allowed BOOLEAN DEFAULT FALSE,
  cargo_match_allowed BOOLEAN DEFAULT FALSE,
  despatch_applicability TEXT CHECK (despatch_applicability IN ('ALL','DRY_ONLY','NONE')) DEFAULT 'ALL',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cargoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  voyage_id UUID REFERENCES voyages(id) ON DELETE CASCADE,
  cp_id UUID REFERENCES charter_parties(id) ON DELETE SET NULL,
  cargo_name TEXT NOT NULL,
  grade TEXT,
  quantity NUMERIC,
  unit TEXT,
  load_port_call_id UUID REFERENCES port_calls(id) ON DELETE SET NULL,
  discharge_port_call_id UUID REFERENCES port_calls(id) ON DELETE SET NULL,
  laytime_terms_profile_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS laytime_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  working_time_definition TEXT CHECK (working_time_definition IN ('SHEX','SHINC','WWD','CUSTOM')),
  nor_start_trigger TEXT CHECK (nor_start_trigger IN ('NOR_TENDERED','NOR_ACCEPTED','CUSTOM_DATE')) DEFAULT 'NOR_TENDERED',
  nor_offset_hours NUMERIC DEFAULT 0,
  start_next_working_period BOOLEAN DEFAULT FALSE,
  rounding_rule TEXT CHECK (rounding_rule IN ('EXACT','ROUND_UP_HOUR','ROUND_DOWN_HOUR')) DEFAULT 'EXACT',
  default_count_rules JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS laytime_calculations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  voyage_id UUID REFERENCES voyages(id) ON DELETE CASCADE,
  cp_ids UUID[] DEFAULT '{}',
  cargo_ids UUID[] DEFAULT '{}',
  status TEXT CHECK (status IN ('draft','final','cancelled')) DEFAULT 'draft',
  calculation_method TEXT CHECK (calculation_method IN ('STANDARD','REVERSIBLE','AVERAGE')) DEFAULT 'STANDARD',
  time_on_demurrage_minutes NUMERIC DEFAULT 0,
  time_on_despatch_minutes NUMERIC DEFAULT 0,
  time_used_minutes NUMERIC DEFAULT 0,
  time_allowed_minutes NUMERIC DEFAULT 0,
  demurrage_amount NUMERIC DEFAULT 0,
  despatch_amount NUMERIC DEFAULT 0,
  currency TEXT,
  statement_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS port_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  laytime_calculation_id UUID REFERENCES laytime_calculations(id) ON DELETE CASCADE,
  port_call_id UUID REFERENCES port_calls(id) ON DELETE CASCADE,
  event_type TEXT,
  from_datetime TIMESTAMPTZ,
  to_datetime TIMESTAMPTZ,
  duration_minutes NUMERIC,
  count_behavior JSONB DEFAULT '{}'::jsonb,
  deduction_reason_code TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS port_deductions_additions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  laytime_calculation_id UUID REFERENCES laytime_calculations(id) ON DELETE CASCADE,
  port_call_id UUID REFERENCES port_calls(id) ON DELETE CASCADE,
  applies_to_cargo_ids UUID[] DEFAULT '{}',
  type TEXT CHECK (type IN ('DEDUCTION','ADDITION')),
  reason_code TEXT,
  description TEXT,
  from_datetime TIMESTAMPTZ,
  to_datetime TIMESTAMPTZ,
  flat_duration_minutes NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cargo_port_laytime_rows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  laytime_calculation_id UUID REFERENCES laytime_calculations(id) ON DELETE CASCADE,
  cargo_id UUID REFERENCES cargoes(id) ON DELETE CASCADE,
  port_call_id UUID REFERENCES port_calls(id) ON DELETE CASCADE,
  operation_type TEXT CHECK (operation_type IN ('LOAD','DISCHARGE')),
  laytime_allowed_minutes NUMERIC DEFAULT 0,
  laytime_used_minutes NUMERIC DEFAULT 0,
  deductions_minutes NUMERIC DEFAULT 0,
  additions_minutes NUMERIC DEFAULT 0,
  time_on_demurrage_minutes NUMERIC DEFAULT 0,
  time_on_despatch_minutes NUMERIC DEFAULT 0,
  reversible_group_id TEXT,
  prorate_group_id TEXT,
  cargo_match_group_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS and policies (tenant-scoped; service_role bypasses)
ALTER TABLE charter_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE cargoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE laytime_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE laytime_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE port_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE port_deductions_additions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cargo_port_laytime_rows ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
  pol_name TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'charter_parties',
      'cargoes',
      'laytime_profiles',
      'laytime_calculations',
      'port_activities',
      'port_deductions_additions',
      'cargo_port_laytime_rows'
    ])
  LOOP
    pol_name := tbl || '_tenant_select';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = pol_name) THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (tenant_id = current_setting(''request.jwt.claim.tenantId'', true)::uuid OR auth.role() = ''service_role'')', pol_name, tbl);
    END IF;

    pol_name := tbl || '_tenant_insert';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = pol_name) THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (tenant_id = current_setting(''request.jwt.claim.tenantId'', true)::uuid OR auth.role() = ''service_role'')', pol_name, tbl);
    END IF;

    pol_name := tbl || '_tenant_update';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = pol_name) THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (tenant_id = current_setting(''request.jwt.claim.tenantId'', true)::uuid OR auth.role() = ''service_role'')', pol_name, tbl);
    END IF;

    pol_name := tbl || '_tenant_delete';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = pol_name) THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING (tenant_id = current_setting(''request.jwt.claim.tenantId'', true)::uuid OR auth.role() = ''service_role'')', pol_name, tbl);
    END IF;
  END LOOP;
END $$;
-- Ensure claim_id column exists on notifications (in case earlier migration missed cache)
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS claim_id UUID REFERENCES claims(id) ON DELETE CASCADE;
-- SOF canonical events mapping tables
create table if not exists public.sof_canonical_events (
  id text primary key,
  label text,
  keywords text[] default '{}',
  confidence numeric,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sof_unmapped_labels (
  label text primary key,
  count integer default 0,
  last_seen_at timestamptz default now(),
  sample_file text
);

-- Basic indexes
create index if not exists idx_sof_unmapped_labels_count on public.sof_unmapped_labels(count desc);

-- Optional: RLS off by default; enable and add policies as needed.
-- alter table public.sof_canonical_events enable row level security;
-- alter table public.sof_unmapped_labels enable row level security;
-- Seed canonical SOF events from current code mappings
insert into public.sof_canonical_events (id, label, keywords, confidence, created_at, updated_at)
select
  t->>'id' as id,
  coalesce(t->>'label', t->>'id') as label,
  coalesce(ARRAY(SELECT jsonb_array_elements_text(t->'keywords')), '{}') as keywords,
  (t->>'confidence')::numeric as confidence,
  now(),
  now()
from jsonb_array_elements(
$json$
[
  {
    "id": "NAV_EOSP",
    "label": "NAV_EOSP",
    "confidence": 0.7,
    "keywords": [
      "e\\.?o\\.?s\\.?p\\.?",
      "end of sea passage",
      "arrival at pilot station",
      "arrival at port limits"
    ]
  },
  {
    "id": "NAV_NOR_TENDERED",
    "label": "NAV_NOR_TENDERED",
    "confidence": 0.7,
    "keywords": [
      "nor tendered",
      "notice of readiness tendered",
      "n\\.?o\\.?r\\.? presented",
      "nor t\\/d",
      "tendered nor"
    ]
  },
  {
    "id": "NAV_NOR_ACCEPTED",
    "label": "NAV_NOR_ACCEPTED",
    "confidence": 0.7,
    "keywords": [
      "nor accepted",
      "notice of readiness accepted",
      "nor signed",
      "n\\.?o\\.?r\\.?\\s*a\\/c"
    ]
  },
  {
    "id": "NAV_ANCHOR_DROP",
    "label": "NAV_ANCHOR_DROP",
    "confidence": 0.8,
    "keywords": [
      "dropped anchor",
      "anchor(ed)?\\s?(dropped|let go)",
      "\\banchored at\\b",
      "\\blet go (port|stbd)?\\s*anchor"
    ]
  },
  {
    "id": "NAV_ANCHOR_AWEIGH",
    "label": "NAV_ANCHOR_AWEIGH",
    "confidence": 0.8,
    "keywords": [
      "anchor aweigh",
      "heaved up anchor",
      "anchor up",
      "commenced heaving anchor",
      "anchor clear of water"
    ]
  },
  {
    "id": "NAV_PILOT_ON_ARR",
    "label": "NAV_PILOT_ON_ARR",
    "confidence": 0.8,
    "keywords": [
      "pob",
      "pilot on board",
      "pilot boarded",
      "pilot embarked"
    ]
  },
  {
    "id": "NAV_TUGS_MADE_FAST",
    "label": "NAV_TUGS_MADE_FAST",
    "confidence": 0.7,
    "keywords": [
      "tugs?\\s+(fast|made fast)",
      "tug lines fast",
      "tug connected"
    ]
  },
  {
    "id": "NAV_FIRST_LINE",
    "label": "NAV_FIRST_LINE",
    "confidence": 0.7,
    "keywords": [
      "first line",
      "1st line ashore",
      "spring line ashore"
    ]
  },
  {
    "id": "NAV_ALL_FAST",
    "label": "NAV_ALL_FAST",
    "confidence": 0.9,
    "keywords": [
      "all fast",
      "all lines fast",
      "\\bmoored\\b",
      "berthed all fast",
      "\\bf\\.?w\\.?e\\.?\\b",
      "finished with engines",
      "fast at berth"
    ]
  },
  {
    "id": "OPS_GANGWAY_DOWN",
    "label": "OPS_GANGWAY_DOWN",
    "confidence": 0.7,
    "keywords": [
      "gangway down",
      "gangway lowered",
      "gangway secured",
      "access ladder down"
    ]
  },
  {
    "id": "AUTH_FREE_PRATIQUE",
    "label": "AUTH_FREE_PRATIQUE",
    "confidence": 0.7,
    "keywords": [
      "free pratique",
      "health clearance",
      "pratique received",
      "quarantine cleared"
    ]
  },
  {
    "id": "AUTH_CUSTOMS_ON",
    "label": "AUTH_CUSTOMS_ON",
    "confidence": 0.6,
    "keywords": [
      "customs onboard",
      "immigration onboard",
      "authorities onboard",
      "boarding party onboard"
    ]
  },
  {
    "id": "AUTH_CLEARED_INWARD",
    "label": "AUTH_CLEARED_INWARD",
    "confidence": 0.6,
    "keywords": [
      "customs cleared",
      "inward clearance",
      "formalities completed",
      "clearance granted"
    ]
  },
  {
    "id": "PREP_HATCH_OPEN",
    "label": "PREP_HATCH_OPEN",
    "confidence": 0.7,
    "keywords": [
      "hatches?\\s+opened",
      "hatch covers opened",
      "uncovered hatches"
    ]
  },
  {
    "id": "PREP_HATCH_CLOSE",
    "label": "PREP_HATCH_CLOSE",
    "confidence": 0.7,
    "keywords": [
      "hatches?\\s+closed",
      "hatch covers closed",
      "covered hatches"
    ]
  },
  {
    "id": "SURVEY_DRAFT_INITIAL",
    "label": "SURVEY_DRAFT_INITIAL",
    "confidence": 0.75,
    "keywords": [
      "initial draft survey",
      "draft survey commenced",
      "joint draft survey"
    ]
  },
  {
    "id": "SURVEY_HOLD_INSP",
    "label": "SURVEY_HOLD_INSP",
    "confidence": 0.65,
    "keywords": [
      "hold inspection",
      "holds passed",
      "holds failed",
      "holds accepted",
      "cleanliness inspection",
      "tank inspection"
    ]
  },
  {
    "id": "CARGO_OPS_START",
    "label": "CARGO_OPS_START",
    "confidence": 0.8,
    "keywords": [
      "commenced loading",
      "commenced discharging",
      "start (loading|discharge)",
      "cargo ops started",
      "commenced cargo operations",
      "using loader"
    ]
  },
  {
    "id": "CARGO_OPS_STOP",
    "label": "CARGO_OPS_STOP",
    "confidence": 0.75,
    "keywords": [
      "stopped loading",
      "stopped discharging",
      "ceased cargo",
      "suspended cargo",
      "cargo ops stopped"
    ]
  },
  {
    "id": "CARGO_OPS_RESUME",
    "label": "CARGO_OPS_RESUME",
    "confidence": 0.75,
    "keywords": [
      "resumed loading",
      "resumed discharging",
      "recommenced cargo",
      "restarted cargo ops"
    ]
  },
  {
    "id": "CARGO_OPS_COMPLETE",
    "label": "CARGO_OPS_COMPLETE",
    "confidence": 0.75,
    "keywords": [
      "completed loading",
      "completed discharging",
      "cargo completed",
      "finished cargo",
      "loading finish",
      "discharge finish"
    ]
  },
  {
    "id": "DELAY_WEATHER",
    "label": "DELAY_WEATHER",
    "confidence": 0.7,
    "keywords": [
      "rain\\b",
      "bad weather",
      "adverse weather",
      "suspended due to rain",
      "high winds",
      "heavy swell",
      "monsoon",
      "precipitation"
    ]
  },
  {
    "id": "DELAY_MAINTENANCE",
    "label": "DELAY_MAINTENANCE",
    "confidence": 0.7,
    "keywords": [
      "crane breakdown",
      "gear failure",
      "maintenance",
      "winch problem",
      "shore crane breakdown",
      "grab repair",
      "mechanical delay",
      "belt",
      "feeder"
    ]
  },
  {
    "id": "DELAY_STEVEDORE",
    "label": "DELAY_STEVEDORE",
    "confidence": 0.65,
    "keywords": [
      "stevedore",
      "gangs",
      "shift change",
      "meal break",
      "union meeting",
      "awaiting stevedores"
    ]
  },
  {
    "id": "DELAY_WAIT_CARGO",
    "label": "DELAY_WAIT_CARGO",
    "confidence": 0.65,
    "keywords": [
      "awaiting cargo",
      "no trucks",
      "awaiting trucks",
      "awaiting barges",
      "wait cargo",
      "silo empty"
    ]
  },
  {
    "id": "OPS_SHIFTING_START",
    "label": "OPS_SHIFTING_START",
    "confidence": 0.6,
    "keywords": [
      "commenced shifting",
      "shifting berth",
      "warping commenced",
      "move to anchorage"
    ]
  },
  {
    "id": "OPS_SHIFTING_END",
    "label": "OPS_SHIFTING_END",
    "confidence": 0.6,
    "keywords": [
      "completed shifting",
      "shifting finished",
      "fast alongside new berth",
      "all fast after shifting"
    ]
  },
  {
    "id": "AUX_BUNKER_START",
    "label": "AUX_BUNKER_START",
    "confidence": 0.65,
    "keywords": [
      "bunkering started",
      "commenced bunkering",
      "hose connected fuel",
      "taking bunkers"
    ]
  },
  {
    "id": "AUX_BUNKER_STOP",
    "label": "AUX_BUNKER_STOP",
    "confidence": 0.65,
    "keywords": [
      "bunkering completed",
      "finished bunkering",
      "hose disconnected fuel",
      "bunkers received"
    ]
  },
  {
    "id": "AUX_BALLAST_START",
    "label": "AUX_BALLAST_START",
    "confidence": 0.6,
    "keywords": [
      "commenced de-ballasting",
      "commenced ballasting",
      "start ballast ops",
      "pumping ballast"
    ]
  },
  {
    "id": "AUX_BALLAST_STOP",
    "label": "AUX_BALLAST_STOP",
    "confidence": 0.6,
    "keywords": [
      "completed de-ballasting",
      "completed ballasting",
      "ballast tanks dry",
      "stop ballast ops"
    ]
  },
  {
    "id": "AUX_FUMIGATION",
    "label": "AUX_FUMIGATION",
    "confidence": 0.6,
    "keywords": [
      "fumigation",
      "fumigators onboard",
      "tablets applied",
      "recirculation fans on"
    ]
  },
  {
    "id": "SURVEY_SAMPLING",
    "label": "SURVEY_SAMPLING",
    "confidence": 0.6,
    "keywords": [
      "sampling commenced",
      "sampling completed",
      "surveyors sampling",
      "samples taken"
    ]
  },
  {
    "id": "SURVEY_DRAFT_FINAL",
    "label": "SURVEY_DRAFT_FINAL",
    "confidence": 0.75,
    "keywords": [
      "final draft survey",
      "draft survey completed",
      "cargo figures agreed"
    ]
  },
  {
    "id": "PREP_LASHING",
    "label": "PREP_LASHING",
    "confidence": 0.6,
    "keywords": [
      "lashing",
      "securing cargo",
      "dunnage removal",
      "unlashing"
    ]
  },
  {
    "id": "PREP_HATCH_SEAL",
    "label": "PREP_HATCH_SEAL",
    "confidence": 0.6,
    "keywords": [
      "hatches sealed",
      "sealing hatches",
      "seals applied",
      "security seals fixed"
    ]
  },
  {
    "id": "NAV_DOCS_ONBOARD",
    "label": "NAV_DOCS_ONBOARD",
    "confidence": 0.6,
    "keywords": [
      "documents onboard",
      "bill of lading signed",
      "paperwork completed",
      "mate receipt signed"
    ]
  },
  {
    "id": "NAV_PILOT_ON_DEP",
    "label": "NAV_PILOT_ON_DEP",
    "confidence": 0.7,
    "keywords": [
      "pilot onboard.*departure",
      "pob departure",
      "pilot boarded for sailing"
    ]
  },
  {
    "id": "NAV_CAST_OFF",
    "label": "NAV_CAST_OFF",
    "confidence": 0.7,
    "keywords": [
      "cast off",
      "unberthed",
      "last line",
      "lines let go",
      "singled up",
      "all lines clear"
    ]
  },
  {
    "id": "NAV_PILOT_OFF",
    "label": "NAV_PILOT_OFF",
    "confidence": 0.7,
    "keywords": [
      "pilot off",
      "pilot disembarked",
      "pilot left vessel",
      "drop pilot"
    ]
  },
  {
    "id": "NAV_COSP",
    "label": "NAV_COSP",
    "confidence": 0.7,
    "keywords": [
      "c\\.?o\\.?s\\.?p\\.?",
      "commencement of sea passage",
      "full away",
      "\\bsailing\\b",
      "departure from port limits"
    ]
  },
  {
    "id": "ARRIVAL_PILOT_STATION",
    "label": "ARRIVAL_PILOT_STATION",
    "confidence": 0.6,
    "keywords": [
      "pilot station",
      "\\barrived\\b"
    ]
  },
  {
    "id": "PILOT_ON_BOARD",
    "label": "PILOT_ON_BOARD",
    "confidence": 0.8,
    "keywords": [
      "pilot on board",
      "\\bpilot boarded\\b",
      "\\bpilot on\\b"
    ]
  },
  {
    "id": "ANCHOR_DROPPED",
    "label": "ANCHOR_DROPPED",
    "confidence": 0.8,
    "keywords": [
      "anchor(ed)?\\s?(dropped|let go)",
      "\\bat anchor\\b"
    ]
  },
  {
    "id": "ANCHOR_AWEIGH",
    "label": "ANCHOR_AWEIGH",
    "confidence": 0.8,
    "keywords": [
      "anchor aweigh",
      "\\bweighed anchor\\b"
    ]
  },
  {
    "id": "ALL_FAST",
    "label": "ALL_FAST",
    "confidence": 0.9,
    "keywords": [
      "all fast",
      "\\balongside\\b",
      "\\bberthed\\b"
    ]
  },
  {
    "id": "GANGWAY_SECURED",
    "label": "GANGWAY_SECURED",
    "confidence": 0.7,
    "keywords": [
      "gangway\\s+(secured|in position)"
    ]
  },
  {
    "id": "HATCHES_OPENED",
    "label": "HATCHES_OPENED",
    "confidence": 0.7,
    "keywords": [
      "hatches?\\s+(opened|open)",
      "holds?\\s+opened"
    ]
  },
  {
    "id": "HATCHES_CLOSED",
    "label": "HATCHES_CLOSED",
    "confidence": 0.7,
    "keywords": [
      "hatches?\\s+(closed|sealed)",
      "holds?\\s+sealed"
    ]
  },
  {
    "id": "DRAFT_SURVEY_START",
    "label": "DRAFT_SURVEY_START",
    "confidence": 0.75,
    "keywords": [
      "draft survey (commenced|started|initial)"
    ]
  },
  {
    "id": "DRAFT_SURVEY_END",
    "label": "DRAFT_SURVEY_END",
    "confidence": 0.75,
    "keywords": [
      "draft survey (completed|finished|final)"
    ]
  },
  {
    "id": "INSPECTION_START",
    "label": "INSPECTION_START",
    "confidence": 0.6,
    "keywords": [
      "(inspection|survey)\\s+(commenced|started)"
    ]
  },
  {
    "id": "INSPECTION_END",
    "label": "INSPECTION_END",
    "confidence": 0.6,
    "keywords": [
      "(inspection|survey)\\s+(completed|finished)"
    ]
  },
  {
    "id": "LOADING_START",
    "label": "LOADING_START",
    "confidence": 0.8,
    "keywords": [
      "loading\\s+(commenced|started)",
      "\\bload(ing)?\\s*commenced\\b"
    ]
  },
  {
    "id": "LOADING_STOP",
    "label": "LOADING_STOP",
    "confidence": 0.8,
    "keywords": [
      "loading\\s+suspended",
      "loading\\s+stoppage",
      "high winds.*loading",
      "\\bstopped loading\\b"
    ]
  },
  {
    "id": "LOADING_RESUME",
    "label": "LOADING_RESUME",
    "confidence": 0.8,
    "keywords": [
      "loading\\s+resumed"
    ]
  },
  {
    "id": "DISCHARGE_START",
    "label": "DISCHARGE_START",
    "confidence": 0.75,
    "keywords": [
      "discharge\\s+(commenced|started)"
    ]
  },
  {
    "id": "DISCHARGE_STOP",
    "label": "DISCHARGE_STOP",
    "confidence": 0.75,
    "keywords": [
      "discharge\\s+(stopped|suspended)"
    ]
  },
  {
    "id": "DISCHARGE_RESUME",
    "label": "DISCHARGE_RESUME",
    "confidence": 0.75,
    "keywords": [
      "discharge\\s+resumed"
    ]
  },
  {
    "id": "SHIFTING_START",
    "label": "SHIFTING_START",
    "confidence": 0.6,
    "keywords": [
      "shifting\\s+commenced",
      "shift(ed|ing)\\s+to\\b"
    ]
  },
  {
    "id": "SHIFTING_END",
    "label": "SHIFTING_END",
    "confidence": 0.6,
    "keywords": [
      "shifting\\s+completed"
    ]
  },
  {
    "id": "DEPART_PILOT_ON_BOARD",
    "label": "DEPART_PILOT_ON_BOARD",
    "confidence": 0.7,
    "keywords": [
      "pilot on board.*departure",
      "pilot boarded.*depart"
    ]
  },
  {
    "id": "CAST_OFF",
    "label": "CAST_OFF",
    "confidence": 0.7,
    "keywords": [
      "cast off",
      "let go (lines|ropes)",
      "unberthed"
    ]
  },
  {
    "id": "DEPARTED",
    "label": "DEPARTED",
    "confidence": 0.8,
    "keywords": [
      "\\bsailed\\b",
      "\\bdeparted\\b",
      "underway"
    ]
  }
]
$json$
) as t;
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS clause_profile JSONB DEFAULT '{}'::jsonb;

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS cp_id UUID REFERENCES charter_parties(id) ON DELETE SET NULL;
ALTER TABLE charter_parties
  ADD COLUMN IF NOT EXISTS clause_profile JSONB DEFAULT '{}'::jsonb;
ALTER TABLE charter_parties
  ADD COLUMN IF NOT EXISTS cp_number TEXT,
  ADD COLUMN IF NOT EXISTS voyage_id UUID REFERENCES voyages(id);

CREATE INDEX IF NOT EXISTS idx_charter_parties_voyage_id ON charter_parties(voyage_id);
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS nor_accepted_at TIMESTAMP WITH TIME ZONE;
