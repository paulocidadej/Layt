/**
 * Script to run database migrations in Supabase
 * Uses Supabase REST API to execute SQL
 */

const fs = require('fs');
const path = require('path');

// Read environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

async function runMigration() {
  try {
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/001_initial_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Reading migration file...');
    console.log('🚀 Executing migration in Supabase...\n');

    // Supabase REST API endpoint for executing SQL
    // Note: This uses the PostgREST API which has limitations
    // For full SQL execution, we need to use the Management API or SQL Editor
    
    // Alternative: Use Supabase Management API
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      // If RPC doesn't work, try direct SQL execution via Management API
      console.log('⚠️  RPC method not available, trying alternative method...\n');
      
      // For Supabase, the best way is through the SQL Editor in dashboard
      // But we can try the PostgREST approach for simple queries
      console.log('📋 SQL Migration Content:');
      console.log('─'.repeat(50));
      console.log('Please run this SQL in your Supabase SQL Editor:');
      console.log('─'.repeat(50));
      console.log(sql);
      console.log('─'.repeat(50));
      console.log('\n✅ Migration file prepared!');
      console.log('\n📝 Next steps:');
      console.log('1. Go to: https://supabase.com/dashboard/project/ttgkbhzullqkpkxofiuq');
      console.log('2. Click on "SQL Editor" in the left sidebar');
      console.log('3. Click "New Query"');
      console.log('4. Copy and paste the SQL above');
      console.log('5. Click "Run" (or press Ctrl+Enter)');
      return;
    }

    const result = await response.json();
    console.log('✅ Migration executed successfully!');
    console.log(result);
  } catch (error) {
    console.error('❌ Error executing migration:', error.message);
    console.log('\n📋 Alternative: Run the SQL manually in Supabase Dashboard');
    console.log('1. Go to: https://supabase.com/dashboard/project/ttgkbhzullqkpkxofiuq');
    console.log('2. Click on "SQL Editor"');
    console.log('3. Copy the SQL from: supabase/migrations/001_initial_schema.sql');
    console.log('4. Paste and run it');
    process.exit(1);
  }
}

runMigration();

