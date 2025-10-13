#!/usr/bin/env node

/**
 * Add New Reward Script
 * 
 * This script helps you add new rewards to the database
 * and automatically adjusts percentages to maintain 100% total
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://zkltmkbmzxvfovsgotpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprbHRta2Jtenh2Zm92c2dvdHB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA4Njk3MjIsImV4cCI6MjAzNjQ0NTcyMn0.6tE9XPKidVj-iEoJP7bmtXP22reuvx20syljOy-_TNI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function addNewReward() {
    console.log('🎯 ADDING NEW REWARD...\n');
    
    try {
        // Get current active rewards
        const { data: currentRewards, error: fetchError } = await supabase
            .from('token_reward_percentages')
            .select('*')
            .eq('is_active', true)
            .order('reward_price');
            
        if (fetchError) {
            console.error('❌ Error fetching current rewards:', fetchError);
            return;
        }
        
        console.log('📊 Current active rewards:');
        currentRewards.forEach((reward, i) => {
            console.log(`   ${i+1}. ${reward.reward_price} OGX: ${reward.percentage}%`);
        });
        
        const currentTotal = currentRewards.reduce((sum, r) => sum + r.percentage, 0);
        console.log(`📊 Current total: ${currentTotal}%`);
        
        // NEW REWARD TO ADD - CUSTOMIZE THIS:
        const newReward = {
            reward_name: 'OGX Token',
            reward_image: '/ogx-token.png',
            reward_price: '3000', // NEW PRICE - CHANGE THIS
            percentage: 5.0,      // NEW PERCENTAGE - CHANGE THIS
            is_active: true
        };
        
        console.log(`\n🆕 Adding new reward: ${newReward.reward_price} OGX with ${newReward.percentage}%`);
        
        // Check if reward already exists
        const existingReward = currentRewards.find(r => r.reward_price === newReward.reward_price);
        if (existingReward) {
            console.log(`⚠️ Reward ${newReward.reward_price} OGX already exists!`);
            console.log('   Use the admin interface to update the percentage instead.');
            return;
        }
        
        // Calculate new total
        const newTotal = currentTotal + newReward.percentage;
        console.log(`📊 New total will be: ${newTotal}%`);
        
        if (newTotal > 100) {
            console.log(`⚠️ Warning: New total (${newTotal}%) exceeds 100%!`);
            console.log('   Consider reducing some existing percentages first.');
            
            // Ask if user wants to proceed
            console.log('\n🔄 Would you like to automatically scale down existing rewards?');
            console.log('   This will proportionally reduce all existing percentages to make room.');
            
            // For now, let's auto-scale
            const scaleFactor = (100 - newReward.percentage) / currentTotal;
            console.log(`📊 Scale factor: ${scaleFactor.toFixed(3)}`);
            
            // Update existing rewards
            for (const reward of currentRewards) {
                const newPercentage = reward.percentage * scaleFactor;
                const { error: updateError } = await supabase
                    .from('token_reward_percentages')
                    .update({ 
                        percentage: Math.round(newPercentage * 100) / 100, // Round to 2 decimals
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', reward.id);
                    
                if (updateError) {
                    console.error(`❌ Error updating ${reward.reward_price}:`, updateError);
                } else {
                    console.log(`✅ Updated ${reward.reward_price} OGX: ${reward.percentage}% → ${Math.round(newPercentage * 100) / 100}%`);
                }
            }
        }
        
        // Add the new reward
        const { error: insertError } = await supabase
            .from('token_reward_percentages')
            .insert([newReward]);
            
        if (insertError) {
            console.error('❌ Error adding new reward:', insertError);
            return;
        }
        
        console.log(`✅ Successfully added new reward: ${newReward.reward_price} OGX (${newReward.percentage}%)`);
        
        // Verify final totals
        const { data: finalRewards, error: finalError } = await supabase
            .from('token_reward_percentages')
            .select('percentage')
            .eq('is_active', true);
            
        if (!finalError && finalRewards) {
            const finalTotal = finalRewards.reduce((sum, r) => sum + r.percentage, 0);
            console.log(`\n📊 Final total: ${finalTotal.toFixed(2)}%`);
            
            if (Math.abs(finalTotal - 100) < 0.01) {
                console.log('✅ Total is exactly 100% - Perfect!');
            } else {
                console.log(`⚠️ Total is ${finalTotal.toFixed(2)}% (should be 100%)`);
            }
        }
        
        console.log('\n🎯 Result:');
        console.log('   - New reward added to database');
        console.log('   - Wheel will automatically show the new reward');
        console.log('   - Percentages are displayed on wheel segments');
        console.log('   - Real-time updates are enabled');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Quick function to add multiple rewards at once
async function addMultipleRewards() {
    console.log('🎯 ADDING MULTIPLE NEW REWARDS...\n');
    
    const newRewards = [
        { reward_name: 'OGX Token', reward_image: '/ogx-token.png', reward_price: '3000', percentage: 3.0, is_active: true },
        { reward_name: 'OGX Token', reward_image: '/ogx-token.png', reward_price: '5000', percentage: 1.0, is_active: true },
        { reward_name: 'OGX Token', reward_image: '/ogx-token.png', reward_price: '10000', percentage: 0.5, is_active: true }
    ];
    
    console.log('📊 Adding rewards:');
    newRewards.forEach(reward => {
        console.log(`   - ${reward.reward_price} OGX: ${reward.percentage}%`);
    });
    
    const totalNewPercentage = newRewards.reduce((sum, r) => sum + r.percentage, 0);
    console.log(`📊 Total new percentage: ${totalNewPercentage}%`);
    
    // Get current total
    const { data: currentRewards, error: fetchError } = await supabase
        .from('token_reward_percentages')
        .select('percentage')
        .eq('is_active', true);
        
    if (fetchError) {
        console.error('❌ Error fetching current rewards:', fetchError);
        return;
    }
    
    const currentTotal = currentRewards.reduce((sum, r) => sum + r.percentage, 0);
    const newTotal = currentTotal + totalNewPercentage;
    
    console.log(`📊 Current total: ${currentTotal}%`);
    console.log(`📊 New total will be: ${newTotal}%`);
    
    if (newTotal > 100) {
        console.log(`⚠️ Warning: New total (${newTotal}%) exceeds 100%!`);
        console.log('   Scaling down existing rewards...');
        
        const scaleFactor = (100 - totalNewPercentage) / currentTotal;
        console.log(`📊 Scale factor: ${scaleFactor.toFixed(3)}`);
        
        // Update existing rewards
        for (const reward of currentRewards) {
            const newPercentage = reward.percentage * scaleFactor;
            const { error: updateError } = await supabase
                .from('token_reward_percentages')
                .update({ 
                    percentage: Math.round(newPercentage * 100) / 100,
                    updated_at: new Date().toISOString()
                })
                .eq('id', reward.id);
                
            if (updateError) {
                console.error(`❌ Error updating reward:`, updateError);
            }
        }
    }
    
    // Add new rewards
    const { error: insertError } = await supabase
        .from('token_reward_percentages')
        .insert(newRewards);
        
    if (insertError) {
        console.error('❌ Error adding new rewards:', insertError);
        return;
    }
    
    console.log(`✅ Successfully added ${newRewards.length} new rewards!`);
    console.log('🎯 Wheel will automatically update with new rewards');
}

// Run the function
addNewReward();
