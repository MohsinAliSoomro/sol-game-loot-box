#!/usr/bin/env node

/**
 * Add More SOL Rewards to Different Lootboxes
 * 
 * This script adds various SOL reward amounts to different lootboxes
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://zkltmkbmzxvfovsgotpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprbHRta2Jtenh2Zm92c2dvdHB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA4Njk3MjIsImV4cCI6MjAzNjQ0NTcyMn0.6tE9XPKidVj-iEoJP7bmtXP22reuvx20syljOy-_TNI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function addMoreSolRewards() {
    console.log('💰 Adding more SOL rewards to different lootboxes...\n');
    
    try {
        // Step 1: Get all lootboxes
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
        
        console.log(`✅ Found ${products.length} lootboxes`);
        
        // Step 2: Define SOL rewards to add for each lootbox
        // Format: { lootboxIndex: [array of SOL amounts and percentages] }
        const solRewardsConfig = {
            0: [ // Lootbox #1
                { amount: '0.005', percentage: 15.0 },
                { amount: '0.01', percentage: 10.0 }
            ],
            1: [ // Lootbox #2
                { amount: '0.05', percentage: 8.0 },
                { amount: '0.1', percentage: 5.0 }
            ],
            2: [ // Lootbox #3
                { amount: '0.2', percentage: 6.0 },
                { amount: '0.5', percentage: 4.0 }
            ],
            3: [ // Lootbox #4
                { amount: '1.0', percentage: 3.0 },
                { amount: '2.0', percentage: 2.0 }
            ],
            4: [ // Lootbox #5
                { amount: '5.0', percentage: 1.5 },
                { amount: '10.0', percentage: 1.0 }
            ],
            5: [ // Lootbox #6
                { amount: '0.15', percentage: 7.0 },
                { amount: '0.25', percentage: 5.0 }
            ],
            6: [ // Lootbox #7
                { amount: '0.3', percentage: 6.0 },
                { amount: '0.75', percentage: 3.5 }
            ]
        };
        
        // Step 3: Add SOL rewards to each lootbox
        let totalAdded = 0;
        let totalErrors = 0;
        
        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            const rewards = solRewardsConfig[i] || [];
            
            if (rewards.length === 0) {
                console.log(`\n⏭️  Skipping ${product.name} (ID: ${product.id}) - no rewards configured`);
                continue;
            }
            
            console.log(`\n📦 Adding SOL rewards to ${product.name} (ID: ${product.id}):`);
            
            for (const reward of rewards) {
                // Check if reward already exists
                const { data: existing, error: checkError } = await supabase
                    .from('token_reward_percentages')
                    .select('id')
                    .eq('product_id', product.id)
                    .eq('reward_name', `${reward.amount} SOL`)
                    .eq('reward_price', reward.amount)
                    .single();
                
                if (existing) {
                    console.log(`   ⏭️  ${reward.amount} SOL already exists, skipping...`);
                    continue;
                }
                
                const solReward = {
                    product_id: product.id,
                    reward_name: `${reward.amount} SOL`,
                    reward_price: reward.amount,
                    reward_image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
                    percentage: reward.percentage,
                    is_active: true
                };
                
                const { data, error: insertError } = await supabase
                    .from('token_reward_percentages')
                    .insert([solReward])
                    .select();
                
                if (insertError) {
                    console.error(`   ❌ Error adding ${reward.amount} SOL:`, insertError.message);
                    totalErrors++;
                } else {
                    console.log(`   ✅ Added ${reward.amount} SOL (${reward.percentage}%)`);
                    totalAdded++;
                }
            }
        }
        
        // Step 4: Show final summary
        console.log(`\n📊 Summary:`);
        console.log(`   - Successfully added: ${totalAdded} SOL rewards`);
        if (totalErrors > 0) {
            console.log(`   - Errors: ${totalErrors}`);
        }
        
        // Step 5: Show final distribution
        console.log(`\n📊 Final SOL rewards distribution per lootbox:`);
        for (const product of products) {
            const { data: solRewards, error: countError } = await supabase
                .from('token_reward_percentages')
                .select('id, reward_name, reward_price, percentage')
                .eq('product_id', product.id)
                .like('reward_name', '%SOL%')
                .order('reward_price');
            
            if (!countError && solRewards) {
                console.log(`\n   ${product.name} (ID: ${product.id}): ${solRewards.length} SOL rewards`);
                solRewards.forEach(reward => {
                    console.log(`      - ${reward.reward_name} (${reward.reward_price} SOL): ${reward.percentage}%`);
                });
            }
        }
        
        console.log('\n🎯 Done! SOL rewards have been added to lootboxes.');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run the function
addMoreSolRewards();

