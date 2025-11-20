/**
 * Clear all sample/test data from the database
 * This will delete all data but keep the table structure
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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function clearData() {
  try {
    console.log('\n🗑️  Clearing all data from database...\n');
    console.log('⚠️  This will delete all records but keep table structure.\n');

    // Delete in order (respecting foreign keys)
    const tables = [
      'calculation_events',
      'claims',
      'voyages',
      'users',
      'vessels',
      'charter_parties',
      'cargo_names',
      'owner_names',
      'charterer_names',
      'counterparties',
      'ports',
      'terms',
      'tenants'
    ];

    let successCount = 0;
    let errorCount = 0;

    for (const table of tables) {
      try {
        // Use delete with a condition that matches all rows
        // Since we're using service role, we can delete everything
        const { error, count } = await supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // This matches all real UUIDs
        
        if (error) {
          // Try alternative: delete all without condition
          const { error: error2 } = await supabase
            .from(table)
            .delete()
            .gte('created_at', '1970-01-01'); // Match all dates
          
          if (error2) {
            console.log(`⚠️  ${table}: ${error2.message}`);
            errorCount++;
          } else {
            console.log(`✅ Cleared ${table}`);
            successCount++;
          }
        } else {
          console.log(`✅ Cleared ${table}`);
          successCount++;
        }
      } catch (error) {
        console.log(`⚠️  ${table}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`✅ Data clearing complete!`);
    console.log(`   Successfully cleared: ${successCount} tables`);
    if (errorCount > 0) {
      console.log(`   Errors: ${errorCount} tables`);
    }
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('📝 Database is now clean and ready for fresh data.');
    console.log('   You can now create new records through the application.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

clearData();
