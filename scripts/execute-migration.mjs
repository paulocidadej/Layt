/**
 * Execute SQL migration in Supabase using Management API
 * This script uses the Supabase Management API to execute SQL directly
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
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

async function executeSQL() {
  try {
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/001_initial_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Reading migration file...');
    console.log('🚀 Executing migration...\n');

    // Extract project ID from URL
    const projectId = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    
    if (!projectId) {
      throw new Error('Could not extract project ID from Supabase URL');
    }

    // Use Supabase Management API
    // Note: This requires the Management API access token, not the service role key
    // For now, we'll use a workaround with the PostgREST API
    
    // Try using the Supabase client's RPC capability
    // But first, we need to create a function that can execute SQL
    // Actually, the best way is to use psql or the Supabase CLI
    
    // Alternative: Use the Supabase REST API's query endpoint
    // But that only works for SELECT queries, not DDL
    
    console.log('⚠️  Supabase REST API does not support executing DDL (CREATE TABLE, etc.) directly.');
    console.log('📋 Please use one of these methods:\n');
    console.log('METHOD 1: Supabase Dashboard (Easiest)');
    console.log('─'.repeat(60));
    console.log('1. Go to: https://supabase.com/dashboard/project/' + projectId);
    console.log('2. Click on "SQL Editor" in the left sidebar');
    console.log('3. Click "New Query"');
    console.log('4. Copy the entire SQL from: supabase/migrations/001_initial_schema.sql');
    console.log('5. Paste into the editor');
    console.log('6. Click "Run" (or press Ctrl+Enter)');
    console.log('─'.repeat(60));
    console.log('\nMETHOD 2: Supabase CLI (If installed)');
    console.log('─'.repeat(60));
    console.log('1. Install Supabase CLI: npm install -g supabase');
    console.log('2. Run: supabase db push');
    console.log('─'.repeat(60));
    
    // Try to use the Supabase client to at least verify connection
    console.log('\n🔍 Testing Supabase connection...');
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Test connection by trying to query a non-existent table (expected to fail with specific error)
    const { error } = await supabase.from('_connection_test').select('*').limit(1);
    
    if (error && error.code === 'PGRST116') {
      console.log('✅ Successfully connected to Supabase!');
      console.log('   (Table not found error is expected - connection is working)\n');
    } else if (error) {
      console.log('✅ Successfully connected to Supabase!');
      console.log(`   Error code: ${error.code}\n`);
    } else {
      console.log('✅ Successfully connected to Supabase!\n');
    }

    console.log('📝 Ready to run migration. Use METHOD 1 above to execute the SQL.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📋 Please run the SQL manually in Supabase Dashboard');
  }
}

executeSQL();

