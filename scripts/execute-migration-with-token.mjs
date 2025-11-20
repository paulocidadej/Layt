/**
 * Execute SQL migration using Supabase Management API with access token
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
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_URL || !SUPABASE_ACCESS_TOKEN) {
  console.error('❌ Missing Supabase credentials');
  console.error('Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

async function executeSQL() {
  try {
    const migrationPath = path.join(__dirname, '../supabase/migrations/001_initial_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Reading migration file...');
    console.log(`📏 SQL file size: ${(sql.length / 1024).toFixed(2)} KB\n`);

    // Extract project reference from URL
    const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    
    if (!projectRef) {
      throw new Error('Could not extract project reference from URL');
    }

    console.log(`🔍 Project Reference: ${projectRef}`);
    console.log('🚀 Executing migration via Supabase Management API...\n');

    // Use Supabase Management API
    // Endpoint: https://api.supabase.com/v1/projects/{project_ref}/database/query
    const managementApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
    
    console.log('📡 Sending request to Management API...');
    
    const response = await fetch(managementApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        query: sql
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ SUCCESS! Migration executed successfully!\n');
      console.log('📊 Result:', JSON.stringify(result, null, 2));
      console.log('\n🎉 Database schema has been created!');
      console.log('\n📋 Next steps:');
      console.log('1. Verify tables in Supabase Dashboard → Table Editor');
      console.log('2. Check that all 13 tables were created');
      console.log('3. Ready to start building the application!');
      return;
    }

    // Handle errors
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: await response.text() };
    }

    console.error('❌ Migration failed!');
    console.error(`Status: ${response.status} ${response.statusText}`);
    console.error('Error:', errorData);
    
    if (response.status === 401) {
      console.log('\n💡 Authentication failed. Please check your access token.');
    } else if (response.status === 400) {
      console.log('\n💡 SQL syntax error. Check the migration file.');
    }
    
  } catch (error) {
    console.error('❌ Error executing migration:', error.message);
    console.error(error.stack);
  }
}

executeSQL();

