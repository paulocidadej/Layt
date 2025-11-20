/**
 * Attempt to execute SQL using Supabase service role key
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

async function tryExecuteSQL() {
  try {
    const migrationPath = path.join(__dirname, '../supabase/migrations/001_initial_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Reading migration file...\n');

    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('🔍 Attempting to execute SQL using service role key...\n');

    // Try method 1: Using RPC (requires a function to exist first - won't work)
    // Try method 2: Using direct PostgREST (doesn't support DDL)
    // Try method 3: Using Management API with service role key
    
    const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    
    // Try Management API endpoint
    const managementUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
    
    console.log('🚀 Trying Management API...');
    
    const response = await fetch(managementUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        query: sql
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ SUCCESS! Migration executed via Management API!\n');
      console.log('Result:', result);
      return;
    }

    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: await response.text() };
    }
    console.log('⚠️  Management API response:', response.status, errorData);
    
    // Try alternative: Use Supabase client's ability to execute via REST
    console.log('\n🔍 Trying alternative method...');
    
    // Split SQL into statements and try to execute via REST API
    // But REST API doesn't support DDL, so this won't work
    
    console.log('\n❌ Cannot execute DDL (CREATE TABLE, etc.) via REST API.');
    console.log('📋 The service role key works for data operations, but SQL execution');
    console.log('   requires either:');
    console.log('   1. Management API access token (from Supabase dashboard)');
    console.log('   2. Direct database connection (psql)');
    console.log('   3. Supabase CLI');
    console.log('   4. Manual execution in SQL Editor\n');
    
    console.log('💡 To get Management API access token:');
    console.log('   1. Go to: https://supabase.com/dashboard/account/tokens');
    console.log('   2. Generate a new access token');
    console.log('   3. Add it to .env.local as: SUPABASE_ACCESS_TOKEN=your-token');
    console.log('   4. Then we can execute SQL programmatically\n');
    
    console.log('📝 For now, please run the SQL manually in the SQL Editor:');
    console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql/new`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📋 Please run the SQL manually in Supabase Dashboard');
  }
}

tryExecuteSQL();

