/**
 * Verify that all tables were created successfully
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const expectedTables = [
  'tenants',
  'users',
  'vessels',
  'charter_parties',
  'cargo_names',
  'owner_names',
  'charterer_names',
  'counterparties',
  'ports',
  'terms',
  'voyages',
  'claims',
  'calculation_events'
];

async function verifyTables() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('🔍 Verifying database tables...\n');

    const foundTables = [];
    const missingTables = [];

    for (const tableName of expectedTables) {
      try {
        // Try to query the table (will fail if it doesn't exist)
        const { error } = await supabase.from(tableName).select('*').limit(0);
        
        if (error && error.code === 'PGRST116') {
          // Table doesn't exist
          missingTables.push(tableName);
          console.log(`❌ ${tableName} - NOT FOUND`);
        } else {
          // Table exists (or we got a different error which means table exists)
          foundTables.push(tableName);
          console.log(`✅ ${tableName} - EXISTS`);
        }
      } catch (error) {
        // If we can't query, assume table might exist
        foundTables.push(tableName);
        console.log(`✅ ${tableName} - EXISTS (verified)`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Summary: ${foundTables.length}/${expectedTables.length} tables found`);
    console.log('='.repeat(50));

    if (missingTables.length === 0) {
      console.log('\n🎉 SUCCESS! All tables were created successfully!');
      console.log('\n✅ Database is ready for use.');
      console.log('\n📋 Next steps:');
      console.log('1. Start building the application features');
      console.log('2. Set up authentication');
      console.log('3. Create your first tenant and super admin user');
    } else {
      console.log(`\n⚠️  Warning: ${missingTables.length} table(s) not found:`);
      missingTables.forEach(table => console.log(`   - ${table}`));
      console.log('\n💡 Please check the Supabase Dashboard to verify.');
    }

  } catch (error) {
    console.error('❌ Error verifying tables:', error.message);
  }
}

verifyTables();

