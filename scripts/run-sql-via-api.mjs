/**
 * Execute SQL migration using Supabase Management API
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

async function executeSQL() {
  try {
    const migrationPath = path.join(__dirname, '../supabase/migrations/001_initial_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Reading migration file...\n');

    // Extract project reference from URL
    const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    
    if (!projectRef) {
      throw new Error('Could not extract project reference');
    }

    console.log('🚀 Attempting to execute SQL via Supabase Management API...\n');

    // Try using the Supabase Management API
    // The Management API endpoint for executing SQL is:
    // https://api.supabase.com/v1/projects/{project_ref}/database/query
    
    const managementApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
    
    // Note: Management API requires a different token (access token from dashboard)
    // The service role key won't work here
    // We need to use the Supabase Dashboard's access token
    
    // For now, let's try with the service role key (might not work)
    const response = await fetch(managementApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        query: sql
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Migration executed successfully!');
      console.log(result);
      return;
    }

    const errorText = await response.text();
    console.log('⚠️  Management API requires access token from dashboard.');
    console.log('📋 Using alternative method: Supabase Dashboard\n');
    
  } catch (error) {
    console.log('⚠️  API execution not available.');
    console.log('📋 Using alternative method: Supabase Dashboard\n');
  }

  // Fallback: Provide instructions
  const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  const migrationPath = path.join(__dirname, '../supabase/migrations/001_initial_schema.sql');
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  MANUAL MIGRATION INSTRUCTIONS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('1. Open your browser and go to:');
  console.log(`   https://supabase.com/dashboard/project/${projectRef}\n`);
  console.log('2. Click on "SQL Editor" in the left sidebar\n');
  console.log('3. Click "New Query" button\n');
  console.log('4. Open the file: supabase/migrations/001_initial_schema.sql\n');
  console.log('5. Copy ALL the SQL code (Ctrl+A, Ctrl+C)\n');
  console.log('6. Paste it into the SQL Editor (Ctrl+V)\n');
  console.log('7. Click "Run" button (or press Ctrl+Enter)\n');
  console.log('8. Wait for the execution to complete\n');
  console.log('9. Verify tables were created in "Table Editor"\n');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Also try to open the SQL file for easy copying
  console.log('💡 TIP: The SQL file is located at:');
  console.log(`   ${path.resolve(migrationPath)}\n`);
}

executeSQL();

