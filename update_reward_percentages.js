#!/usr/bin/env node

/**
 * Update Reward Percentages Script
 * 
 * This script allows you to update reward percentages directly
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://zkltmkbmzxvfovsgotpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprbHRta2Jtenh2Zm92c2dvdHB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA4Njk3MjIsImV4cCI6MjAzNjQ0NTcyMn0.6tE9XPKidVj-iEoJP7bmtXP22reuvx20syljOy-_TNI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateRewardPercentages() {
    console.log('🎯 UPDATING REWARD PERCENTAGES...\n');
    
    try {
        // Example: Update percentages for different rewards
        const updates = [
            { reward_price: '100', percentage: 40.0 },   // 100 OGX = 40%
            { reward_price: '200', percentage: 30.0 },   // 200 OGX = 30%
            { reward_price: '500', percentage: 20.0 },   // 500 OGX = 20%
            { reward_price: '1000', percentage: 8.0 },   // 1000 OGX = 8%
            { reward_price: '2000', percentage: 2.0 }    // 2000 OGX = 2%
        ];
        
        console.log('📊 Updating percentages:');
        updates.forEach(update => {
            console.log(`   - ${update.reward_price} OGX: ${update.percentage}%`);
        });
        
        // Update each reward
        for (const update of updates) {
            const { error } = await supabase
                .from('token_reward_percentages')
                .update({ 
                    percentage: update.percentage,
                    updated_at: new Date().toISOString()
                })
                .eq('reward_price', update.reward_price);
                
            if (error) {
                console.error(`❌ Error updating ${update.reward_price}:`, error);
            } else {
                console.log(`✅ Updated ${update.reward_price} OGX to ${update.percentage}%`);
            }
        }
        
        // Verify total percentage
        const { data: allRewards, error: fetchError } = await supabase
            .from('token_reward_percentages')
            .select('percentage')
            .eq('is_active', true);
            
        if (!fetchError && allRewards) {
            const total = allRewards.reduce((sum, reward) => sum + reward.percentage, 0);
            console.log(`\n📊 Total percentage: ${total.toFixed(2)}%`);
            
            if (total !== 100) {
                console.log(`⚠️ Warning: Total should be 100%, but it's ${total.toFixed(2)}%`);
            } else {
                console.log('✅ Total percentage is correct (100%)');
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// You can customize the percentages here:
async function setCustomPercentages() {
    console.log('🎯 SETTING CUSTOM PERCENTAGES...\n');
    
    // CUSTOMIZE THESE PERCENTAGES:
    const customPercentages = {
        '100': 60.0,   // 100 OGX = 60% (very common)
        '200': 25.0,   // 200 OGX = 25% (common)
        '500': 10.0,   // 500 OGX = 10% (uncommon)
        '1000': 4.0,   // 1000 OGX = 4% (rare)
        '2000': 1.0    // 2000 OGX = 1% (very rare)
    };
    
    console.log('📊 Custom percentages:');
    Object.entries(customPercentages).forEach(([price, percentage]) => {
        console.log(`   - ${price} OGX: ${percentage}%`);
    });
    
    // Update database
    for (const [price, percentage] of Object.entries(customPercentages)) {
        const { error } = await supabase
            .from('token_reward_percentages')
            .update({ 
                percentage: percentage,
                updated_at: new Date().toISOString()
            })
            .eq('reward_price', price);
            
        if (error) {
            console.error(`❌ Error updating ${price}:`, error);
        } else {
            console.log(`✅ Updated ${price} OGX to ${percentage}%`);
        }
    }
}

// Run the update
updateRewardPercentages();
