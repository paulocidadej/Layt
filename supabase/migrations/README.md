# Database Migrations

This directory contains SQL migration files for the Laytime platform database schema.

## Running Migrations in Supabase

### Option 1: Using Supabase Dashboard (Recommended for first-time setup)

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the contents of `001_initial_schema.sql`
5. Paste into the SQL editor
6. Click **Run** (or press Ctrl+Enter)
7. Verify the tables were created by checking the **Table Editor** section

### Option 2: Using Supabase CLI (For future migrations)

If you have Supabase CLI installed:

```bash
# Initialize Supabase (if not already done)
supabase init

# Link to your project
supabase link --project-ref ttgkbhzullqkpkxofiuq

# Run migrations
supabase db push
```

## Migration Files

- `001_initial_schema.sql` - Initial database schema with all tables, indexes, and basic RLS policies

## Schema Overview

The database includes:

- **tenants** - Multi-tenant organizations
- **users** - User accounts with roles (super_admin, customer_admin, operator)
- **voyages** - Voyage information
- **claims** - Claims linked to voyages
- **calculation_events** - SOF events for laytime calculations
- **Lookup tables** - vessels, charter_parties, cargo_names, owner_names, charterer_names, counterparties, ports, terms

All tables include:
- Row Level Security (RLS) enabled
- Tenant isolation (tenant_id foreign keys)
- Timestamps (created_at, updated_at)
- Proper indexes for performance

## Next Steps

After running the migration:

1. Create a super admin user (manually or via API)
2. Set up proper RLS policies based on user roles
3. Test the connection from the application

