# Database Setup Guide

## Quick Start

1. **Open Supabase SQL Editor**
   - Go to: https://supabase.com/dashboard/project/ttgkbhzullqkpkxofiuq
   - Click on **SQL Editor** in the left sidebar

2. **Run the Migration**
   - Click **New Query**
   - Open the file: `supabase/migrations/001_initial_schema.sql`
   - Copy all the SQL code
   - Paste it into the SQL Editor
   - Click **Run** (or press Ctrl+Enter)

3. **Verify Tables Created**
   - Go to **Table Editor** in the left sidebar
   - You should see all the tables listed:
     - tenants
     - users
     - vessels
     - charter_parties
     - cargo_names
     - owner_names
     - charterer_names
     - counterparties
     - ports
     - terms
     - voyages
     - claims
     - calculation_events

## Creating Your First Super Admin

After running the migration, you'll need to create a super admin user. You can do this via SQL:

```sql
-- First, create a tenant (your organization)
INSERT INTO tenants (name, slug, subscription_tier)
VALUES ('Your Company Name', 'your-company', 'enterprise')
RETURNING id;

-- Note the tenant_id from above, then create a super admin user
-- Replace 'your-tenant-id' with the actual UUID from above
-- Replace 'your-email@example.com' and 'Your Name' with your details
INSERT INTO users (email, full_name, role, tenant_id)
VALUES ('your-email@example.com', 'Your Name', 'super_admin', 'your-tenant-id');
```

**Note:** For production, you'll want to:
- Hash passwords properly (we'll implement authentication next)
- Use environment variables for sensitive data
- Set up proper authentication flow

## Testing the Connection

Once the database is set up, you can test it by running:

```bash
npm run dev
```

The application should now be able to connect to Supabase successfully!

