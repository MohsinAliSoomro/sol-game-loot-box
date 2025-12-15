/**
 * Create Master Admin Script
 * 
 * This script helps you create a master admin user in the database.
 * Run: node scripts/create-master-admin.js
 */

import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import readline from 'readline';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createMasterAdmin() {
  console.log('\n========================================');
  console.log('🔐 Create Master Admin');
  console.log('========================================\n');

  try {
    // Get email
    const email = await question('Enter admin email: ');
    if (!email || !email.includes('@')) {
      console.error('❌ Invalid email address');
      process.exit(1);
    }

    // Check if admin already exists
    const { data: existing } = await supabase
      .from('master_admins')
      .select('id, email')
      .eq('email', email)
      .single();

    if (existing) {
      console.log(`\n⚠️  Admin with email ${email} already exists!`);
      const overwrite = await question('Do you want to update the password? (y/n): ');
      if (overwrite.toLowerCase() !== 'y') {
        console.log('Cancelled.');
        process.exit(0);
      }
    }

    // Get password
    const password = await question('Enter password: ');
    if (!password || password.length < 6) {
      console.error('❌ Password must be at least 6 characters');
      process.exit(1);
    }

    // Get full name (optional)
    const fullName = await question('Enter full name (optional): ') || null;

    // Hash password
    console.log('\n⏳ Hashing password...');
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert or update admin
    if (existing) {
      // Update existing admin
      const { data, error } = await supabase
        .from('master_admins')
        .update({
          password_hash: passwordHash,
          full_name: fullName,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('email', email)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating admin:', error.message);
        process.exit(1);
      }

      console.log('\n✅ Master admin updated successfully!');
      console.log(`   Email: ${data.email}`);
      console.log(`   Full Name: ${data.full_name || 'N/A'}`);
      console.log(`   Role: ${data.role}`);
    } else {
      // Create new admin
      const { data, error } = await supabase
        .from('master_admins')
        .insert({
          email,
          password_hash: passwordHash,
          full_name: fullName,
          role: 'master_admin',
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating admin:', error.message);
        process.exit(1);
      }

      console.log('\n✅ Master admin created successfully!');
      console.log(`   ID: ${data.id}`);
      console.log(`   Email: ${data.email}`);
      console.log(`   Full Name: ${data.full_name || 'N/A'}`);
      console.log(`   Role: ${data.role}`);
    }

    console.log('\n📝 You can now login with:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log('\n========================================\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
createMasterAdmin();

