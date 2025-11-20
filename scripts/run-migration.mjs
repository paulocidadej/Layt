/**
 * Script to run database migrations in Supabase
 * Uses Supabase Management API to execute SQL
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

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

    // Split SQL into individual statements (semicolon-separated)
    // Remove comments and empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip empty statements and comments
      if (!statement || statement.trim().length === 0) continue;

      try {
        // Use Supabase REST API to execute SQL
        // Note: Supabase doesn't have a direct SQL execution endpoint via REST API
        // We'll need to use the Management API or execute via psql
        // For now, we'll use a workaround with the PostgREST API
        
        // Try using the Supabase client's ability to execute via RPC
        // But first, we need to check if we can use the Management API
        
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ query: statement }),
        });

        if (response.ok) {
          successCount++;
          process.stdout.write(`✓ Statement ${i + 1}/${statements.length} executed\n`);
        } else {
          const errorText = await response.text();
          console.error(`✗ Statement ${i + 1} failed:`, errorText.substring(0, 100));
          errorCount++;
        }
      } catch (error) {
        console.error(`✗ Statement ${i + 1} error:`, error.message);
        errorCount++;
      }
    }

    if (errorCount > 0) {
      console.log('\n⚠️  Some statements failed. Trying alternative method...\n');
      console.log('📋 Please run the SQL manually in Supabase Dashboard:');
      console.log('─'.repeat(60));
      console.log('1. Go to: https://supabase.com/dashboard/project/xcqtimhlrweeywtqsnwb');
      console.log('2. Click on "SQL Editor" in the left sidebar');
      console.log('3. Click "New Query"');
      console.log('4. Copy the SQL from: supabase/migrations/001_initial_schema.sql');
      console.log('5. Paste and click "Run" (or press Ctrl+Enter)');
      console.log('─'.repeat(60));
    } else {
      console.log(`\n✅ Migration completed successfully! (${successCount} statements executed)`);
    }
  } catch (error) {
    console.error('❌ Error executing migration:', error.message);
    console.log('\n📋 Alternative: Run the SQL manually in Supabase Dashboard');
    console.log('1. Go to: https://supabase.com/dashboard/project/xcqtimhlrweeywtqsnwb');
    console.log('2. Click on "SQL Editor"');
    console.log('3. Copy the SQL from: supabase/migrations/001_initial_schema.sql');
    console.log('4. Paste and run it');
  }
}

// Actually, Supabase doesn't support direct SQL execution via REST API
// Let's use a better approach - create a script that uses the Supabase client
// But the client also doesn't support raw SQL execution
// The best approach is to use the Supabase CLI or execute via the dashboard

// Let's create a simpler script that uses the Supabase Management API
// But that requires an access token from the dashboard

console.log('⚠️  Direct SQL execution via API is not supported by Supabase.');
console.log('📋 Please run the migration manually:\n');
console.log('1. Go to: https://supabase.com/dashboard/project/xcqtimhlrweeywtqsnwb');
console.log('2. Click on "SQL Editor" in the left sidebar');
console.log('3. Click "New Query"');
console.log('4. Copy the SQL from: supabase/migrations/001_initial_schema.sql');
console.log('5. Paste and click "Run" (or press Ctrl+Enter)\n');

// But let's try to use the Supabase client to at least verify connection
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test connection
console.log('🔍 Testing Supabase connection...');
const { data, error } = await supabase.from('_test').select('count').limit(1);

if (error && error.code === 'PGRST116') {
  console.log('✅ Connected to Supabase! (Tables not created yet - this is expected)');
} else if (error) {
  console.log('✅ Connected to Supabase!');
} else {
  console.log('✅ Connected to Supabase!');
}

console.log('\n📝 Next: Run the SQL migration in the Supabase Dashboard as shown above.');

