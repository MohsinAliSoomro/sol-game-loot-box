#!/usr/bin/env node

/**
 * Link Existing Rewards to Lootbox #1
 * 
 * This script links all existing rewards in token_reward_percentages
 * that don't have a product_id to the first product (Lootbox #1)
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://zkltmkbmzxvfovsgotpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprbHRta2Jtenh2Zm92c2dvdHB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA4Njk3MjIsImV4cCI6MjAzNjQ0NTcyMn0.6tE9XPKidVj-iEoJP7bmtXP22reuvx20syljOy-_TNI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function linkRewardsToLootbox1() {
    console.log('🔗 Linking existing rewards to Lootbox #1...\n');
    
    try {
        // Step 1: Get the first product (Lootbox #1)
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, name')
            .order('id', { ascending: true })
            .limit(1);
        
        if (productsError) {
            console.error('❌ Error fetching products:', productsError);
            return;
        }
        
        if (!products || products.length === 0) {
            console.error('❌ No products found in database!');
            return;
        }
        
        const lootbox1 = products[0];
        console.log(`✅ Found Lootbox #1: ID=${lootbox1.id}, Name="${lootbox1.name}"`);
        
        // Step 2: Check if product_id column exists, if not, we'll skip the column in query
        // First try to get rewards with product_id
        let allRewards = null;
        let rewardsError = null;
        
        const { data: rewardsWithId, error: errorWithId } = await supabase
            .from('token_reward_percentages')
            .select('id, reward_name, reward_price, product_id');
        
        if (errorWithId && errorWithId.code === '42703') {
            // Column doesn't exist, we need to add it first
            console.log('\n⚠️  product_id column does not exist in token_reward_percentages table.');
            console.log('📝 Please run the SQL script "add_product_id_column.sql" first to add the column.');
            console.log('   Or run this SQL command in Supabase SQL Editor:\n');
            console.log('   ALTER TABLE token_reward_percentages ADD COLUMN IF NOT EXISTS product_id INTEGER;');
            console.log('\n   Then run this script again.\n');
            return;
        }
        
        if (errorWithId) {
            console.error('❌ Error fetching rewards:', errorWithId);
            return;
        }
        
        allRewards = rewardsWithId;
        
        console.log(`\n📊 Total rewards in database: ${allRewards?.length || 0}`);
        
        // Check how many need to be linked
        const rewardsWithoutProduct = allRewards?.filter(r => r.product_id === null || r.product_id === undefined) || [];
        const rewardsWithProduct = allRewards?.filter(r => r.product_id !== null && r.product_id !== undefined) || [];
        
        console.log(`   - Rewards without product_id: ${rewardsWithoutProduct.length}`);
        console.log(`   - Rewards with product_id: ${rewardsWithProduct.length}`);
        
        // Show current distribution
        if (rewardsWithProduct.length > 0) {
            console.log('\n📋 Current reward distribution:');
            const distribution = {};
            rewardsWithProduct.forEach(r => {
                const pid = r.product_id;
                distribution[pid] = (distribution[pid] || 0) + 1;
            });
            Object.keys(distribution).forEach(pid => {
                console.log(`   - Product ID ${pid}: ${distribution[pid]} rewards`);
            });
        }
        
        // Step 3: Update rewards that don't have product_id
        if (rewardsWithoutProduct.length === 0) {
            console.log('\n✅ All rewards already have a product_id assigned!');
            return;
        }
        
        console.log(`\n🔧 Updating ${rewardsWithoutProduct.length} rewards to link to Lootbox #1...`);
        
        const rewardIds = rewardsWithoutProduct.map(r => r.id);
        
        const { data: updatedRewards, error: updateError } = await supabase
            .from('token_reward_percentages')
            .update({ product_id: lootbox1.id })
            .in('id', rewardIds)
            .select('id, reward_name, reward_price');
        
        if (updateError) {
            console.error('❌ Error updating rewards:', updateError);
            return;
        }
        
        console.log(`\n✅ Successfully linked ${updatedRewards?.length || 0} rewards to Lootbox #1!`);
        
        // Step 4: Verify the update
        const { data: lootbox1Rewards, error: verifyError } = await supabase
            .from('token_reward_percentages')
            .select('id, reward_name, reward_price, percentage')
            .eq('product_id', lootbox1.id)
            .order('reward_price');
        
        if (!verifyError && lootbox1Rewards) {
            console.log(`\n📊 Lootbox #1 now has ${lootbox1Rewards.length} rewards:`);
            lootbox1Rewards.forEach((reward, index) => {
                console.log(`   ${index + 1}. ${reward.reward_name || 'Reward'} - ${reward.reward_price} (${reward.percentage}%)`);
            });
        }
        
        // Step 5: Show final distribution
        const { data: finalDistribution, error: distError } = await supabase
            .from('token_reward_percentages')
            .select('product_id');
        
        if (!distError && finalDistribution) {
            const finalDist = {};
            finalDistribution.forEach(r => {
                const pid = r.product_id || 'NULL';
                finalDist[pid] = (finalDist[pid] || 0) + 1;
            });
            
            console.log('\n📊 Final reward distribution:');
            Object.keys(finalDist).forEach(pid => {
                if (pid === 'NULL') {
                    console.log(`   - No product_id: ${finalDist[pid]} rewards`);
                } else {
                    console.log(`   - Product ID ${pid}: ${finalDist[pid]} rewards`);
                }
            });
        }
        
        console.log('\n🎯 Done! Rewards are now linked to Lootbox #1.');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run the function
linkRewardsToLootbox1();

