#!/usr/bin/env node

/**
 * Test Mint Address Filter
 * 
 * This script verifies that only rewards with mint addresses are shown
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://zkltmkbmzxvfovsgotpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprbHRta2Jtenh2Zm92c2dvdHB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA4Njk3MjIsImV4cCI6MjAzNjQ0NTcyMn0.6tE9XPKidVj-iEoJP7bmtXP22reuvx20syljOy-_TNI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testMintFilter() {
    console.log('🔍 TESTING MINT ADDRESS FILTER...\n');
    
    const userId = '241d5d57-ae52-487b-8ca8-050b5cc1bae7';
    
    try {
        // Test old query (all records)
        console.log('📊 OLD QUERY (all records):');
        const { data: allData, error: allError } = await supabase
            .from('prizeWin')
            .select()
            .eq('userId', userId)
            .eq('isWithdraw', false);
            
        if (allError) {
            console.error('❌ Error:', allError);
            return;
        }
        
        console.log(`   Total records: ${allData.length}`);
        console.log(`   Records with mint: ${allData.filter(item => item.mint).length}`);
        console.log(`   Records without mint: ${allData.filter(item => !item.mint).length}`);
        
        // Test new query (only with mint addresses)
        console.log('\n📊 NEW QUERY (only with mint addresses):');
        const { data: mintData, error: mintError } = await supabase
            .from('prizeWin')
            .select()
            .eq('userId', userId)
            .eq('isWithdraw', false)
            .not('mint', 'is', null);
            
        if (mintError) {
            console.error('❌ Error:', mintError);
            return;
        }
        
        console.log(`   Records with mint addresses: ${mintData.length}`);
        
        console.log('\n🎯 FILTERED RESULTS:');
        mintData.forEach((item, index) => {
            console.log(`   ${index + 1}. ${item.name} (Mint: ${item.mint})`);
        });
        
        console.log('\n✅ EXPECTED BEHAVIOR:');
        console.log('   - SidebarCart will only show rewards with mint addresses');
        console.log('   - Only NFT rewards will be displayed');
        console.log('   - Token rewards without mint addresses will be filtered out');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testMintFilter();
