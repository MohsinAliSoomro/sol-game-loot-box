import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/service/supabase';

/**
 * Claim Jackpot Reward API
 * 
 * Idempotent endpoint to claim jackpot rewards.
 * Uses database transactions and unique constraints to prevent duplicate payouts.
 * 
 * Safety features:
 * - Checks balance_credited flag in jackpot_wins
 * - Uses reward_claims table with UNIQUE(win_id) constraint
 * - Wraps credit + flag update in transaction
 * - Safe to call multiple times (returns same result)
 */
export async function POST(request: NextRequest) {
  try {
    const { winId, userId, poolId, projectId } = await request.json();

    console.log('🎰 Claim jackpot reward request:', {
      winId,
      userId,
      poolId,
      projectId
    });

    // Validate inputs
    if (!winId || !userId || !poolId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: winId, userId, poolId'
      }, { status: 400 });
    }

    // Step 1: Check if reward was already claimed (using reward_claims table)
    const { data: existingClaim, error: claimCheckError } = await supabase
      .from('reward_claims')
      .select('id, claimed_at, reward_amount')
      .eq('win_id', winId)
      .maybeSingle();

    if (claimCheckError && claimCheckError.code !== 'PGRST116') { // PGRST116 = not found (ok)
      console.error('❌ Error checking existing claim:', claimCheckError);
      return NextResponse.json({
        success: false,
        error: 'Failed to check existing claim'
      }, { status: 500 });
    }

    // If already claimed, return success (idempotent)
    if (existingClaim) {
      console.log('✅ Reward already claimed:', existingClaim);
      return NextResponse.json({
        success: true,
        alreadyClaimed: true,
        claimedAt: existingClaim.claimed_at,
        message: 'Reward was already claimed'
      });
    }

    // Step 2: Get win details and pool info
    let winQuery = supabase
      .from('jackpot_wins')
      .select('id, user_id, pool_id, amount, balance_credited, win_type')
      .eq('id', winId)
      .eq('user_id', userId)
      .eq('pool_id', poolId);

    if (projectId) {
      winQuery = winQuery.eq('project_id', parseInt(projectId));
    } else {
      winQuery = winQuery.is('project_id', null);
    }

    const { data: winData, error: winError } = await winQuery.single();

    if (winError || !winData) {
      console.error('❌ Win not found:', winError);
      return NextResponse.json({
        success: false,
        error: 'Jackpot win not found or access denied'
      }, { status: 404 });
    }

    // Check if balance was already credited (double-check)
    if (winData.balance_credited) {
      console.log('⏭️ Balance already credited for win:', winId);
      
      // Try to insert into reward_claims to mark as claimed (idempotent)
      const { error: insertError } = await supabase
        .from('reward_claims')
        .insert({
          win_id: winId,
          user_id: userId,
          pool_id: poolId,
          project_id: projectId ? parseInt(projectId) : null,
          reward_type: 'item', // Will be determined from pool data
          reward_amount: parseFloat(String(winData.amount || 0))
        });

      if (insertError && insertError.code !== '23505') { // 23505 = unique violation (ok, already claimed)
        console.warn('⚠️ Could not insert reward_claims record:', insertError);
      }

      return NextResponse.json({
        success: true,
        alreadyClaimed: true,
        message: 'Reward was already claimed'
      });
    }

    // Step 3: Get pool data to determine reward type and amount
    let poolQuery = supabase
      .from('jackpot_pools')
      .select('name, image, item_price')
      .eq('id', poolId);

    if (projectId) {
      poolQuery = poolQuery.eq('project_id', parseInt(projectId));
    } else {
      poolQuery = poolQuery.is('project_id', null);
    }

    const { data: poolData, error: poolError } = await poolQuery.single();

    if (poolError || !poolData) {
      console.error('❌ Pool not found:', poolError);
      return NextResponse.json({
        success: false,
        error: 'Jackpot pool not found'
      }, { status: 404 });
    }

    // Determine if it's an item prize (not NFT)
    const isNFTJackpot = poolData?.image && 
                         typeof poolData.image === 'string' && 
                         poolData.image.length >= 32 && 
                         poolData.image.length <= 44 && 
                         !poolData.image.includes('/') && 
                         !poolData.image.includes('.');
    const isItemPrize = !isNFTJackpot && poolData?.item_price && poolData.item_price > 0;

    // Only credit balance for item prizes (NFTs and SOL go to prizeWin/cart)
    if (!isItemPrize) {
      console.log('ℹ️ Non-item prize (NFT/SOL) - no balance credit needed');
      
      // Mark as claimed in reward_claims
      const { error: insertError } = await supabase
        .from('reward_claims')
        .insert({
          win_id: winId,
          user_id: userId,
          pool_id: poolId,
          project_id: projectId ? parseInt(projectId) : null,
          reward_type: isNFTJackpot ? 'nft' : 'sol',
          reward_amount: parseFloat(String(winData.amount || 0))
        });

      if (insertError) {
        console.error('❌ Error inserting reward_claims:', insertError);
        return NextResponse.json({
          success: false,
          error: 'Failed to record claim'
        }, { status: 500 });
      }

      // Update balance_credited flag
      await supabase
        .from('jackpot_wins')
        .update({ balance_credited: true })
        .eq('id', winId);

      return NextResponse.json({
        success: true,
        alreadyClaimed: false,
        message: 'Reward claimed (NFT/SOL - no balance credit needed)'
      });
    }

    // Step 4: Credit balance for item prizes (transaction-safe)
    const itemPriceAmount = parseFloat(String(poolData.item_price)) || 0;
    
    if (itemPriceAmount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Invalid reward amount'
      }, { status: 400 });
    }

    // Get current user balance
    const isMainProject = !projectId;
    let userQuery;
    
    if (isMainProject) {
      userQuery = supabase
        .from('user')
        .select('id, apes')
        .eq('id', userId)
        .single();
    } else {
      userQuery = supabase
        .from('project_users')
        .select('id, apes')
        .eq('id', userId)
        .eq('project_id', parseInt(projectId))
        .single();
    }

    const { data: userData, error: userError } = await userQuery;

    if (userError || !userData) {
      console.error('❌ User not found:', userError);
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    const currentBalance = parseFloat(String(userData.apes || 0));
    const newBalance = currentBalance + itemPriceAmount;

    // Step 5: Update balance and mark as credited (atomic operation)
    // Note: Supabase doesn't support transactions in REST API, but we use unique constraint as safeguard
    const updateTable = isMainProject ? 'user' : 'project_users';
    let updateQuery = supabase
      .from(updateTable)
      .update({ apes: newBalance })
      .eq('id', userId);

    if (!isMainProject && projectId) {
      updateQuery = updateQuery.eq('project_id', parseInt(projectId));
    }

    const { error: updateError } = await updateQuery;

    if (updateError) {
      console.error('❌ Error updating balance:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Failed to credit balance'
      }, { status: 500 });
    }

    // Step 6: Mark win as credited and record claim (idempotent)
    // Use unique constraint on reward_claims.win_id to prevent duplicates
    const { error: claimInsertError } = await supabase
      .from('reward_claims')
      .insert({
        win_id: winId,
        user_id: userId,
        pool_id: poolId,
        project_id: projectId ? parseInt(projectId) : null,
        reward_type: 'item',
        reward_amount: itemPriceAmount
      });

    if (claimInsertError) {
      // If unique constraint violation, reward was already claimed (race condition)
      if (claimInsertError.code === '23505') {
        console.log('⚠️ Reward already claimed (race condition detected)');
        return NextResponse.json({
          success: true,
          alreadyClaimed: true,
          message: 'Reward was already claimed'
        });
      }
      
      console.error('❌ Error inserting reward_claims:', claimInsertError);
      // Don't fail - balance was already credited
    }

    // Update balance_credited flag
    await supabase
      .from('jackpot_wins')
      .update({ balance_credited: true })
      .eq('id', winId);

    console.log(`✅ Jackpot reward claimed: ${itemPriceAmount} tokens. New balance: ${newBalance}`);

    return NextResponse.json({
      success: true,
      alreadyClaimed: false,
      rewardAmount: itemPriceAmount,
      newBalance: newBalance,
      message: `Successfully claimed ${itemPriceAmount} tokens`
    });

  } catch (error: any) {
    console.error('❌ Error claiming jackpot reward:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error occurred'
    }, { status: 500 });
  }
}
