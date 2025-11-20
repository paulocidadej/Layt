/**
 * Script to create the first super admin user
 * Run this once to set up your initial account
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createSuperAdmin() {
  try {
    console.log('\n🚀 Creating Super Admin Account\n');
    console.log('═══════════════════════════════════════════════════════\n');

    // Get user input
    const email = await question('Enter email address: ');
    const password = await question('Enter password (min 8 characters): ');
    const fullName = await question('Enter full name: ');
    const tenantName = await question('Enter your company/tenant name: ');

    if (!email || !password || password.length < 8) {
      console.error('\n❌ Error: Email and password (min 8 chars) are required');
      rl.close();
      process.exit(1);
    }

    console.log('\n⏳ Creating account...\n');

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create tenant first
    const tenantSlug = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: tenantName,
        slug: tenantSlug,
        subscription_tier: 'enterprise',
        is_active: true
      })
      .select()
      .single();

    if (tenantError) {
      console.error('❌ Error creating tenant:', tenantError.message);
      rl.close();
      process.exit(1);
    }

    console.log(`✅ Tenant created: ${tenant.name} (${tenant.slug})`);

    // Create super admin user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        email: email,
        password_hash: passwordHash,
        full_name: fullName,
        role: 'super_admin',
        tenant_id: tenant.id,
        is_active: true
      })
      .select()
      .single();

    if (userError) {
      console.error('❌ Error creating user:', userError.message);
      rl.close();
      process.exit(1);
    }

    console.log(`✅ Super Admin user created: ${user.email}`);
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ Setup Complete!');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('You can now login with:');
    console.log(`  Email: ${email}`);
    console.log(`  Password: [the password you entered]\n`);
    console.log('🌐 Open your browser and go to:');
    console.log('   http://localhost:3000/auth/login\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

createSuperAdmin();

