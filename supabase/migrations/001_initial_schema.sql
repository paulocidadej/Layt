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

