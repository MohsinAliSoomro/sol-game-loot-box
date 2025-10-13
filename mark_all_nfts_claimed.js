#!/usr/bin/env node

/**
 * Mark All Withdrawn NFTs as Claimed
 * 
 * This script marks all NFTs as claimed in the database
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://zkltmkbmzxvfovsgotpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprbHRta2Jtenh2Zm92c2dvdHB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA4Njk3MjIsImV4cCI6MjAzNjQ0NTcyMn0.6tE9XPKidVj-iEoJP7bmtXP22reuvx20syljOy-_TNI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function markAllNFTsAsClaimed() {
    console.log('🔄 MARKING ALL NFTS AS CLAIMED...\n');
    
    try {
        // Get all NFT records (with mint addresses)
        const { data: allNFTs, error: fetchError } = await supabase
            .from('prizeWin')
            .select('*')
            .not('mint', 'is', null);
            
        if (fetchError) {
            console.error('❌ Error fetching NFT records:', fetchError);
            return;
        }
        
        console.log(`📊 Found ${allNFTs.length} NFT records`);
        
        // Count current status
        const claimedCount = allNFTs.filter(nft => nft.isWithdraw === true).length;
        const unclaimedCount = allNFTs.filter(nft => nft.isWithdraw === false).length;
        
        console.log(`   - Already claimed: ${claimedCount}`);
        console.log(`   - Currently unclaimed: ${unclaimedCount}`);
        
        if (unclaimedCount === 0) {
            console.log('✅ All NFTs are already marked as claimed');
            return;
        }
        
        // Mark all NFTs as claimed
        const { error: updateError } = await supabase
            .from('prizeWin')
            .update({ isWithdraw: true })
            .not('mint', 'is', null);
            
        if (updateError) {
            console.error('❌ Error updating NFT records:', updateError);
            return;
        }
        
        console.log(`✅ Successfully marked ${unclaimedCount} NFTs as claimed`);
        console.log('\n🎯 Result:');
        console.log('   - All NFTs are now marked as claimed');
        console.log('   - Sidebar cart will show empty (no pending NFTs)');
        console.log('   - Wheel will only show token rewards');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

markAllNFTsAsClaimed();
