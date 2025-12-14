#!/usr/bin/env node

/**
 * Distribute Existing Rewards Across Multiple Lootboxes
 * 
 * This script distributes the 15 rewards currently in Lootbox #1
 * across multiple lootboxes evenly
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://zkltmkbmzxvfovsgotpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprbHRta2Jtenh2Zm92c2dvdHB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA4Njk3MjIsImV4cCI6MjAzNjQ0NTcyMn0.6tE9XPKidVj-iEoJP7bmtXP22reuvx20syljOy-_TNI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function distributeRewards() {
    console.log('📦 Distributing rewards across multiple lootboxes...\n');
    
    try {
        // Step 1: Get all lootboxes (products)
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, name')
            .order('id', { ascending: true });
        
        if (productsError) {
            console.error('❌ Error fetching products:', productsError);
            return;
        }
        
        if (!products || products.length === 0) {
            console.error('❌ No products found in database!');
            return;
        }
        
        console.log(`✅ Found ${products.length} lootboxes:`);
        products.forEach((p, index) => {
            console.log(`   ${index + 1}. ID=${p.id}, Name="${p.name}"`);
        });
        
        // Step 2: Get all rewards from Lootbox #1
        const lootbox1Id = products[0].id;
        const { data: allRewards, error: rewardsError } = await supabase
            .from('token_reward_percentages')
            .select('id, reward_name, reward_price, percentage, product_id')
            .eq('product_id', lootbox1Id)
            .order('reward_price');
        
        if (rewardsError) {
            console.error('❌ Error fetching rewards:', rewardsError);
            return;
        }
        
        if (!allRewards || allRewards.length === 0) {
            console.log('✅ No rewards to distribute!');
            return;
        }
        
        // Filter: Only SOL rewards (reward_name contains "SOL")
        const rewards = allRewards.filter(r => 
            r.reward_name && r.reward_name.toLowerCase().includes('sol')
        );
        const nonSolRewards = allRewards.filter(r => 
            !r.reward_name || !r.reward_name.toLowerCase().includes('sol')
        );
        
        console.log(`\n📊 Total rewards in Lootbox #1: ${allRewards.length}`);
        console.log(`   - SOL rewards to distribute: ${rewards.length}`);
        console.log(`   - Non-SOL rewards (will stay in Lootbox #1): ${nonSolRewards.length}`);
        
        if (rewards.length === 0) {
            console.log('✅ No SOL rewards to distribute!');
            return;
        }
        
        // Step 3: Distribute SOL rewards across lootboxes
        // Strategy: Divide SOL rewards evenly across available lootboxes
        const totalSolRewards = rewards.length;
        const totalLootboxes = products.length;
        const rewardsPerLootbox = Math.floor(totalSolRewards / totalLootboxes);
        const remainder = totalSolRewards % totalLootboxes;
        
        console.log(`\n📋 Distribution plan (SOL rewards only):`);
        console.log(`   - Total lootboxes: ${totalLootboxes}`);
        console.log(`   - SOL rewards per lootbox: ${rewardsPerLootbox}`);
        if (remainder > 0) {
            console.log(`   - First ${remainder} lootbox(s) will get ${rewardsPerLootbox + 1} SOL rewards each`);
        }
        console.log(`   - Non-SOL rewards will remain in Lootbox #1 (${lootbox1Id})`);
        
        let rewardIndex = 0;
        let updates = [];
        
        for (let i = 0; i < products.length && rewardIndex < rewards.length; i++) {
            const lootbox = products[i];
            // First few lootboxes get one extra reward if there's a remainder
            const rewardsForThisLootbox = rewardsPerLootbox + (i < remainder ? 1 : 0);
            const endIndex = Math.min(rewardIndex + rewardsForThisLootbox, rewards.length);
            
            const rewardsToAssign = rewards.slice(rewardIndex, endIndex);
            
            console.log(`\n🔗 Assigning ${rewardsToAssign.length} rewards to ${lootbox.name} (ID: ${lootbox.id}):`);
            rewardsToAssign.forEach((reward, idx) => {
                console.log(`   ${idx + 1}. ${reward.reward_name || 'Reward'} - ${reward.reward_price}`);
                updates.push({
                    rewardId: reward.id,
                    lootboxId: lootbox.id,
                    lootboxName: lootbox.name
                });
            });
            
            rewardIndex = endIndex;
        }
        
        // Step 4: Ask for confirmation
        console.log(`\n⚠️  This will update ${updates.length} rewards.`);
        console.log('📝 Proceeding with distribution...\n');
        
        // Update each reward
        let successCount = 0;
        let errorCount = 0;
        
        for (const update of updates) {
            const { error: updateError } = await supabase
                .from('token_reward_percentages')
                .update({ product_id: update.lootboxId })
                .eq('id', update.rewardId);
            
            if (updateError) {
                console.error(`❌ Error updating reward ${update.rewardId}:`, updateError);
                errorCount++;
            } else {
                successCount++;
            }
        }
        
        console.log(`\n✅ Distribution complete!`);
        console.log(`   - Successfully updated: ${successCount} rewards`);
        if (errorCount > 0) {
            console.log(`   - Errors: ${errorCount} rewards`);
        }
        
        // Step 5: Show final distribution
        console.log(`\n📊 Final reward distribution:`);
        for (const lootbox of products) {
            const { data: lootboxRewards, error: countError } = await supabase
                .from('token_reward_percentages')
                .select('id')
                .eq('product_id', lootbox.id);
            
            if (!countError) {
                const count = lootboxRewards?.length || 0;
                console.log(`   - ${lootbox.name} (ID: ${lootbox.id}): ${count} rewards`);
            }
        }
        
        console.log('\n🎯 Done! Rewards are now distributed across lootboxes.');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run the function
distributeRewards();

