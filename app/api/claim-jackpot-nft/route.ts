import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * BACKEND-AUTHORITATIVE Jackpot NFT Claim API
 * 
 * CRITICAL SECURITY: This endpoint enforces that ONLY the winner can claim the NFT.
 * 
 * Security checks:
 * 1. Verify requester userId matches winner_user_id in jackpot_pools
 * 2. Verify nft_claimed === false (not already claimed)
 * 3. Reject ALL non-winners with 403 Forbidden
 * 4. Atomic update to prevent double-claims
 */

// Hardcoded Supabase credentials (same as service/supabase.ts)
const SUPABASE_URL = "https://zkltmkbmzxvfovsgotpt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprbHRta2Jtenh2Zm92c2dvdHB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA4Njk3MjIsImV4cCI6MjAzNjQ0NTcyMn0.6tE9XPKidVj-iEoJP7bmtXP22reuvx20syljOy-_TNI";

const supabaseAdmin = createClient(
  SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

interface ClaimRequest {
  userId: string;
  poolId: number;
  projectId?: number | null;
  prizeWinId?: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { userId, poolId, projectId, prizeWinId } = await request.json() as ClaimRequest;

    // Security logging
    console.log('🔐 [NFT-CLAIM] Claim request received:', {
      claimantUserId: userId,
      poolId,
      projectId,
      prizeWinId,
      timestamp: new Date().toISOString(),
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    });

    // Validate inputs
    if (!userId || !poolId) {
      console.error('❌ [NFT-CLAIM] Missing required parameters');
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: userId, poolId'
      }, { status: 400 });
    }

    // Step 1: Get jackpot pool and verify winner (CRITICAL SECURITY CHECK)
    // First try with project_id filter, then without if not found
    let poolData: any = null;
    let poolError: any = null;
    
    let poolQuery = supabaseAdmin
      .from('jackpot_pools')
      .select('id, name, image, winner_user_id, is_settled, project_id')
      .eq('id', poolId);

    if (projectId !== undefined && projectId !== null) {
      poolQuery = poolQuery.eq('project_id', projectId);
    } else {
      poolQuery = poolQuery.is('project_id', null);
    }

    const result1 = await poolQuery.single();
    poolData = result1.data;
    poolError = result1.error;
    
    // If not found with project_id filter, try without it
    if (poolError && poolError.code === 'PGRST116') {
      console.log('⚠️ [NFT-CLAIM] Pool not found with project_id filter, trying without...');
      const result2 = await supabaseAdmin
        .from('jackpot_pools')
        .select('id, name, image, winner_user_id, is_settled, project_id')
        .eq('id', poolId)
        .single();
      
      poolData = result2.data;
      poolError = result2.error;
      
      if (poolData) {
        console.log(`✅ [NFT-CLAIM] Found pool without filter. Pool project_id: ${poolData.project_id}`);
      }
    }

    if (poolError || !poolData) {
      console.error('❌ [NFT-CLAIM] Pool not found:', poolError);
      return NextResponse.json({
        success: false,
        error: 'Pool not found'
      }, { status: 404 });
    }

    // Step 2: CRITICAL - Verify the claimant is the actual winner
    if (poolData.winner_user_id !== userId) {
      console.error('🚨 [NFT-CLAIM] SECURITY VIOLATION: Non-winner attempting to claim NFT!', {
        claimantUserId: userId,
        actualWinnerUserId: poolData.winner_user_id,
        poolId: poolId,
        poolName: poolData.name
      });
      
      return NextResponse.json({
        success: false,
        error: 'Access denied. You are not the winner of this jackpot.',
        isWinner: false
      }, { status: 403 });
    }

    // Step 3: Verify this is an NFT jackpot
    const poolImage = poolData.image;
    const isNFTJackpot = poolImage && 
                         typeof poolImage === 'string' && 
                         poolImage.length >= 32 && 
                         poolImage.length <= 44 && 
                         !poolImage.includes('/') && 
                         !poolImage.includes('.');

    if (!isNFTJackpot) {
      console.error('❌ [NFT-CLAIM] Not an NFT jackpot:', poolId);
      return NextResponse.json({
        success: false,
        error: 'This jackpot does not have an NFT prize'
      }, { status: 400 });
    }

    // Step 4: Check if NFT was already claimed
    let winQuery = supabaseAdmin
      .from('jackpot_wins')
      .select('id, nft_claimed, nft_claim_tx, nft_claimed_at')
      .eq('pool_id', poolId)
      .eq('user_id', userId)
      .eq('win_type', 'jackpot_final');

    if (projectId !== undefined && projectId !== null) {
      winQuery = winQuery.eq('project_id', projectId);
    } else {
      winQuery = winQuery.is('project_id', null);
    }

    const { data: winData, error: winError } = await winQuery.single();

    if (winError) {
      console.error('❌ [NFT-CLAIM] Win record not found:', winError);
      return NextResponse.json({
        success: false,
        error: 'Win record not found'
      }, { status: 404 });
    }

    // Step 5: Check if already claimed (IDEMPOTENT)
    if (winData.nft_claimed) {
      console.log('✅ [NFT-CLAIM] NFT already claimed:', {
        userId,
        poolId,
        claimedAt: winData.nft_claimed_at,
        txHash: winData.nft_claim_tx
      });
      
      return NextResponse.json({
        success: true,
        alreadyClaimed: true,
        claimedAt: winData.nft_claimed_at,
        txHash: winData.nft_claim_tx,
        message: 'NFT was already claimed'
      });
    }

    // Step 6: Mark as claimed BEFORE transfer (prevents double-claims)
    // Use atomic update with condition check
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('jackpot_wins')
      .update({
        nft_claimed: true,
        nft_claimed_at: new Date().toISOString()
      })
      .eq('id', winData.id)
      .eq('nft_claimed', false) // CRITICAL: Only update if not already claimed
      .select()
      .single();

    if (updateError) {
      // Check if another request already claimed
      const { data: recheckData } = await supabaseAdmin
        .from('jackpot_wins')
        .select('nft_claimed')
        .eq('id', winData.id)
        .single();

      if (recheckData?.nft_claimed) {
        console.log('⚠️ [NFT-CLAIM] Race condition: NFT already claimed by parallel request');
        return NextResponse.json({
          success: true,
          alreadyClaimed: true,
          message: 'NFT was already claimed'
        });
      }

      console.error('❌ [NFT-CLAIM] Error marking as claimed:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Failed to process claim'
      }, { status: 500 });
    }

    // Step 7: Also update prizeWin entry if it exists
    let prizeWinUpdateQuery = supabaseAdmin
      .from('prizeWin')
      .update({ isWithdraw: true })
      .eq('userId', userId)
      .eq('mint', poolImage)
      .eq('reward_type', 'nft');

    if (projectId !== undefined && projectId !== null) {
      prizeWinUpdateQuery = prizeWinUpdateQuery.eq('project_id', projectId);
    } else {
      prizeWinUpdateQuery = prizeWinUpdateQuery.is('project_id', null);
    }

    await prizeWinUpdateQuery;

    const elapsed = Date.now() - startTime;
    console.log(`✅ [NFT-CLAIM] Claim authorized in ${elapsed}ms:`, {
      userId,
      poolId,
      nftMint: poolImage,
      poolName: poolData.name
    });

    // Return success - actual NFT transfer handled by frontend/wallet
    return NextResponse.json({
      success: true,
      alreadyClaimed: false,
      authorized: true,
      nftMint: poolImage,
      poolName: poolData.name,
      message: 'NFT claim authorized. Proceed with wallet transfer.'
    });

  } catch (error: any) {
    console.error('❌ [NFT-CLAIM] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error occurred'
    }, { status: 500 });
  }
}

/**
 * GET endpoint to check NFT claim eligibility
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const userId = searchParams.get('userId');
    const projectId = searchParams.get('projectId');

    if (!poolId || !userId) {
      return NextResponse.json({
        success: false,
        error: 'Missing poolId or userId'
      }, { status: 400 });
    }

    // Get pool and check winner - try with project_id filter first, then without
    let poolData: any = null;
    let poolError: any = null;
    
    let poolQuery = supabaseAdmin
      .from('jackpot_pools')
      .select('id, name, image, winner_user_id, is_settled, project_id')
      .eq('id', parseInt(poolId));

    if (projectId) {
      poolQuery = poolQuery.eq('project_id', parseInt(projectId));
    } else {
      poolQuery = poolQuery.is('project_id', null);
    }

    const result1 = await poolQuery.single();
    poolData = result1.data;
    poolError = result1.error;
    
    // If not found with project_id filter, try without it
    if (poolError && poolError.code === 'PGRST116') {
      const result2 = await supabaseAdmin
        .from('jackpot_pools')
        .select('id, name, image, winner_user_id, is_settled, project_id')
        .eq('id', parseInt(poolId))
        .single();
      
      poolData = result2.data;
      poolError = result2.error;
    }

    if (poolError || !poolData) {
      return NextResponse.json({
        success: false,
        error: 'Pool not found'
      }, { status: 404 });
    }

    const isWinner = poolData.winner_user_id === userId;
    const isNFTJackpot = poolData.image && 
                         typeof poolData.image === 'string' && 
                         poolData.image.length >= 32 && 
                         poolData.image.length <= 44 && 
                         !poolData.image.includes('/') && 
                         !poolData.image.includes('.');

    // Check claim status
    let claimed = false;
    if (isWinner) {
      let winQuery = supabaseAdmin
        .from('jackpot_wins')
        .select('nft_claimed')
        .eq('pool_id', parseInt(poolId))
        .eq('user_id', userId)
        .eq('win_type', 'jackpot_final');

      if (projectId) {
        winQuery = winQuery.eq('project_id', parseInt(projectId));
      } else {
        winQuery = winQuery.is('project_id', null);
      }

      const { data: winData } = await winQuery.single();
      claimed = winData?.nft_claimed || false;
    }

    return NextResponse.json({
      success: true,
      isWinner,
      isNFTJackpot,
      nftMint: isWinner && isNFTJackpot ? poolData.image : null,
      claimed,
      canClaim: isWinner && isNFTJackpot && !claimed && poolData.is_settled
    });

  } catch (error: any) {
    console.error('❌ [NFT-CLAIM/GET] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
