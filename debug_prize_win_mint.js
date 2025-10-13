#!/usr/bin/env node

/**
 * Debug Sidebar Cart Mint Address Issue
 * 
 * This script checks what's actually stored in the prizeWin table
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://zkltmkbmzxvfovsgotpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprbHRta2Jtenh2Zm92c2dvdHB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA4Njk3MjIsImV4cCI6MjAzNjQ0NTcyMn0.6tE9XPKidVj-iEoJP7bmtXP22reuvx20syljOy-_TNI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugPrizeWinTable() {
    console.log('🔍 DEBUGGING PRIZE WIN TABLE...\n');
    
    try {
        // Get all prizeWin records
        const { data, error } = await supabase
            .from('prizeWin')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);
            
        if (error) {
            console.error('❌ Error fetching prizeWin data:', error);
            return;
        }
        
        console.log(`📊 Found ${data.length} prizeWin records:`);
        console.log('=' .repeat(80));
        
        data.forEach((item, index) => {
            console.log(`\n${index + 1}. Record ID: ${item.id}`);
            console.log(`   User ID: ${item.userId}`);
            console.log(`   Name: ${item.name}`);
            console.log(`   Image: ${item.image}`);
            console.log(`   SOL: ${item.sol}`);
            console.log(`   Is Withdraw: ${item.isWithdraw}`);
            console.log(`   Reward Type: ${item.reward_type}`);
            console.log(`   Mint: ${item.mint || 'NOT SET'}`);
            console.log(`   Created: ${item.created_at}`);
        });
        
        console.log('\n🎯 SUMMARY:');
        console.log(`   Total records: ${data.length}`);
        console.log(`   Records with mint: ${data.filter(item => item.mint).length}`);
        console.log(`   Records without mint: ${data.filter(item => !item.mint).length}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

debugPrizeWinTable();
