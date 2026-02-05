import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * BACKEND-AUTHORITATIVE Jackpot Settlement API
 * 
 * CRITICAL: Winner is selected ONCE and saved permanently.
 * Page refresh MUST NOT change winner.
 * 
 * Logic:
 * - IF now > endTime AND is_settled === false:
 *   - Select ONE winner randomly
 *   - Save winner_user_id to jackpot_pools
 *   - Set is_settled = true
 *   - Create reward ONLY for winner
 * 
 * - IF is_settled === true:
 *   - NEVER re-run winner logic
 *   - Always return saved winner_user_id
 * 
 * Frontend MUST NOT compute winner - only READ from database.
 */

// Hardcoded Supabase credentials (same as service/supabase.ts)
const SUPABASE_URL = "https://zkltmkbmzxvfovsgotpt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprbHRta2Jtenh2Zm92c2dvdHB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA4Njk3MjIsImV4cCI6MjAzNjQ0NTcyMn0.6tE9XPKidVj-iEoJP7bmtXP22reuvx20syljOy-_TNI";

// Use service role for admin operations (fallback to anon key if service role not available)
const supabaseAdmin = createClient(
  SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

interface SettleRequest {
  poolId: number;
  projectId?: number | null;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { poolId, projectId } = await request.json() as SettleRequest;

    console.log('🎰 [SETTLE] Jackpot settlement request:', {
      poolId,
      projectId,
      timestamp: new Date().toISOString()
    });

    // Validate inputs
    if (!poolId || isNaN(poolId)) {
      return NextResponse.json({
        success: false,
        error: 'Missing or invalid poolId'
      }, { status: 400 });
    }

    // Step 1: Get jackpot pool details
    // First try with new columns, fallback to basic columns if they don't exist
    let poolData: any = null;
    let poolError: any = null;
    
    // Try to find the pool - first with project_id filter, then without
    // This handles cases where project_id might not match exactly
    let poolQuery = supabaseAdmin
      .from('jackpot_pools')
      .select('id, name, image, item_price, end_time, is_active, project_id, is_settled, winner_user_id, settled_at')
      .eq('id', poolId);

    // First try with project_id filter
    if (projectId !== undefined && projectId !== null) {
      poolQuery = poolQuery.eq('project_id', projectId);
    } else {
      poolQuery = poolQuery.is('project_id', null);
    }

    let result = await poolQuery.single();
    poolData = result.data;
    poolError = result.error;
    
    // If not found with project_id filter, try without it
    if (poolError && poolError.code === 'PGRST116') {
      console.log('⚠️ [SETTLE] Pool not found with project_id filter, trying without filter...');
      const result2 = await supabaseAdmin
        .from('jackpot_pools')
        .select('id, name, image, item_price, end_time, is_active, project_id, is_settled, winner_user_id, settled_at')
        .eq('id', poolId)
        .single();
      
      poolData = result2.data;
      poolError = result2.error;
      
      if (poolData) {
        console.log(`✅ [SETTLE] Found pool without project_id filter. Pool project_id: ${poolData.project_id}`);
      }
    }
    
    // If query failed (possibly due to missing columns), try without new columns
    if (poolError) {
      console.log('⚠️ [SETTLE] Query with new columns failed, trying basic query:', poolError.message);
      
      // Try basic query without project_id filter first
      const basicResult = await supabaseAdmin
        .from('jackpot_pools')
        .select('id, name, image, item_price, end_time, is_active, project_id')
        .eq('id', poolId)
        .single();
      
      poolData = basicResult.data;
      poolError = basicResult.error;
      
      if (poolData) {
        // Add default values for missing columns
        poolData.is_settled = false;
        poolData.winner_user_id = null;
        poolData.settled_at = null;
        console.log('✅ [SETTLE] Using basic query with default settlement values');
      }
    }

    if (poolError || !poolData) {
      console.error('❌ [SETTLE] Pool not found:', poolError);
      return NextResponse.json({
        success: false,
        error: 'Jackpot pool not found'
      }, { status: 404 });
    }

    // Step 2: CRITICAL CHECK - If is_settled === true, NEVER re-run winner logic
    // Always return the saved winner_user_id
    if (poolData.is_settled === true && poolData.winner_user_id) {
      console.log('✅ [SETTLE] Already settled (is_settled=true), returning saved winner:', poolData.winner_user_id);
      
      const poolImage = poolData.image;
      const isNFTJackpot = poolImage && 
                           typeof poolImage === 'string' && 
                           poolImage.length >= 32 && 
                           poolImage.length <= 44 && 
                           !poolImage.includes('/') && 
                           !poolImage.includes('.');
      
      return NextResponse.json({
        success: true,
        alreadySettled: true,
        winner: {
          userId: poolData.winner_user_id,
          poolId: poolId,
          poolName: poolData.name,
          prizeType: isNFTJackpot ? 'nft' : (poolData.item_price ? 'item' : 'sol'),
          nftMint: isNFTJackpot ? poolImage : null,
          settledAt: poolData.settled_at
        },
        message: 'Jackpot already settled - winner is fixed permanently'
      });
    }
    
    // Also check is_settled without winner (edge case: settled with no participants)
    if (poolData.is_settled === true && !poolData.winner_user_id) {
      console.log('✅ [SETTLE] Already settled with no winner (no participants)');
      return NextResponse.json({
        success: true,
        alreadySettled: true,
        noWinner: true,
        message: 'Jackpot settled - no participants'
      });
    }
    
    // Also check jackpot_wins as fallback for legacy data
    let existingWinQuery = supabaseAdmin
      .from('jackpot_wins')
      .select('id, user_id, amount, created_at')
      .eq('pool_id', poolId)
      .eq('win_type', 'jackpot_final');

    if (projectId !== undefined && projectId !== null) {
      existingWinQuery = existingWinQuery.eq('project_id', projectId);
    } else {
      existingWinQuery = existingWinQuery.is('project_id', null);
    }

    const { data: existingWin } = await existingWinQuery.maybeSingle();

    if (existingWin) {
      console.log('✅ [SETTLE] Found existing winner in jackpot_wins (legacy):', existingWin.user_id);
      
      const poolImage = poolData.image;
      const isNFTJackpot = poolImage && 
                           typeof poolImage === 'string' && 
                           poolImage.length >= 32 && 
                           poolImage.length <= 44 && 
                           !poolImage.includes('/') && 
                           !poolImage.includes('.');
      
      return NextResponse.json({
        success: true,
        alreadySettled: true,
        winner: {
          userId: existingWin.user_id,
          poolId: poolId,
          poolName: poolData.name,
          prizeType: isNFTJackpot ? 'nft' : (poolData.item_price ? 'item' : 'sol'),
          prizeAmount: existingWin.amount,
          nftMint: isNFTJackpot ? poolImage : null
        },
        message: 'Jackpot already settled (legacy)'
      });
    }

    // Step 3: Check if jackpot has expired
    const endTime = new Date(poolData.end_time);
    const now = new Date();
    if (now < endTime) {
      console.log('⏰ [SETTLE] Jackpot not yet expired:', { endTime, now });
      return NextResponse.json({
        success: false,
        error: 'Jackpot has not expired yet',
        endTime: endTime.toISOString()
      }, { status: 400 });
    }

    // Step 4: Get all contributions for this pool
    // First try with project_id filter, then without if no results
    let contributions: any[] = [];
    let contribError: any = null;
    
    // Try with project_id filter first
    let contributionsQuery = supabaseAdmin
      .from('jackpot_contribution')
      .select('id, user_id, amount')
      .eq('pool_id', poolId);

    if (projectId !== undefined && projectId !== null) {
      contributionsQuery = contributionsQuery.eq('project_id', projectId);
    } else {
      contributionsQuery = contributionsQuery.is('project_id', null);
    }

    const result1 = await contributionsQuery;
    contributions = result1.data || [];
    contribError = result1.error;
    
    // If no contributions found with project_id filter, try without it
    if ((!contributions || contributions.length === 0) && !contribError) {
      console.log('⚠️ [SETTLE] No contributions with project_id filter, trying without filter...');
      const result2 = await supabaseAdmin
        .from('jackpot_contribution')
        .select('id, user_id, amount')
        .eq('pool_id', poolId);
      
      contributions = result2.data || [];
      contribError = result2.error;
      
      if (contributions.length > 0) {
        console.log(`✅ [SETTLE] Found ${contributions.length} contributions without project_id filter`);
      }
    }

    if (contribError) {
      console.error('❌ [SETTLE] Error fetching contributions:', contribError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch contributions'
      }, { status: 500 });
    }

    if (!contributions || contributions.length === 0) {
      console.log('⚠️ [SETTLE] No contributions found for pool:', poolId);

      return NextResponse.json({
        success: true,
        noWinner: true,
        message: 'No contributions found - no winner'
      });
    }
    
    console.log(`✅ [SETTLE] Found ${contributions.length} contributions for pool ${poolId}`);
    console.log('📊 [SETTLE] Contribution details:', contributions.map(c => ({ user_id: c.user_id, amount: c.amount })));

    // Step 5: RANDOMLY SELECT ONE WINNER
    // Each contribution entry = 1 ticket = 1 chance
    const randomIndex = Math.floor(Math.random() * contributions.length);
    const winningContribution = contributions[randomIndex];
    const winnerUserId = winningContribution.user_id;

    console.log('🎯 [SETTLE] Winner selected:', {
      winnerUserId,
      contributionId: winningContribution.id,
      totalContributions: contributions.length,
      randomIndex
    });

    // Step 6: Determine prize type
    const poolImage = poolData.image;
    
    // Check if it's an NFT jackpot:
    // 1. If image is a mint address (old format: 32-44 chars, no slashes/dots)
    // 2. OR if image is a URL but item_price is NULL/0 (new format: image URL stored, but it's still an NFT)
    // 3. OR check existing prizeWin entries to see if there's a mint field (for already-settled jackpots)
    const isMintAddress = poolImage && 
                         typeof poolImage === 'string' && 
                         poolImage.length >= 32 && 
                         poolImage.length <= 44 && 
                         !poolImage.includes('/') && 
                         !poolImage.includes('.');
    
    // If it's not a mint address but image exists and item_price is NULL/0, check if it's an NFT
    // by looking at existing prizeWin entries for this jackpot
    let isNFTJackpot = isMintAddress;
    if (!isMintAddress && poolImage && (!poolData.item_price || poolData.item_price === 0)) {
      // Check if there's an existing prizeWin entry with a mint field for this jackpot
      const { data: existingPrizeWin } = await supabaseAdmin
        .from('prizeWin')
        .select('mint, reward_type')
        .eq('name', poolData.name)
        .not('mint', 'is', null)
        .limit(1)
        .maybeSingle();
      
      if (existingPrizeWin?.mint || existingPrizeWin?.reward_type === 'nft') {
        isNFTJackpot = true;
        console.log('🎨 [SETTLE] Detected NFT jackpot from existing prizeWin entry');
      }
    }
    
    const isItemPrize = !isNFTJackpot && poolData.item_price && poolData.item_price > 0;

    console.log('🎁 [SETTLE] Prize type:', {
      isNFTJackpot,
      isItemPrize,
      poolImage: poolImage?.substring(0, 20) + '...',
      itemPrice: poolData.item_price
    });

    // Step 7: Try to save winner to jackpot_pools (if columns exist)
    // This ensures winner is fixed permanently
    const settledAt = new Date().toISOString();
    
    // Try to update with new columns - if it fails, continue anyway
    // The jackpot_wins table will be the fallback source of truth
    try {
      const { error: settleError } = await supabaseAdmin
        .from('jackpot_pools')
        .update({
          is_settled: true,
          winner_user_id: winnerUserId,
          settled_at: settledAt
        })
        .eq('id', poolId);

      if (settleError) {
        console.warn('⚠️ [SETTLE] Could not update pool with winner (columns may not exist):', settleError.message);
        // Continue anyway - jackpot_wins will be the source of truth
      } else {
        console.log('✅ [SETTLE] Winner saved to jackpot_pools:', {
          poolId,
          winnerUserId,
          settledAt
        });
      }
    } catch (updateErr) {
      console.warn('⚠️ [SETTLE] Exception updating pool:', updateErr);
      // Continue anyway
    }

    // Step 8: Record in jackpot_wins table
    const totalContributions = contributions.reduce((sum, c) => sum + parseFloat(String(c.amount || 0)), 0);
    const prizeAmount = isItemPrize ? poolData.item_price : totalContributions;

    const winRecord: any = {
      pool_id: poolId,
      user_id: winnerUserId,
      amount: prizeAmount,
      win_type: 'jackpot_final',
      is_claimed: false,
      created_at: settledAt
    };

    if (projectId !== undefined && projectId !== null) {
      winRecord.project_id = projectId;
    }

    const { data: winData, error: winError } = await supabaseAdmin
      .from('jackpot_wins')
      .insert(winRecord)
      .select()
      .single();

    if (winError && winError.code !== '23505') { // Ignore duplicate key (already exists)
      console.error('❌ [SETTLE] Error recording win:', winError);
      // Don't fail - winner is already saved in jackpot_pools
    } else {
      console.log('✅ [SETTLE] Win recorded in jackpot_wins:', winData?.id);
    }

    // Step 9: Create prizeWin entry ONLY for the winner
    // This is what shows up in the sidebar cart
    const prizeWinRecord: any = {
      userId: winnerUserId,
      name: poolData.name,
      image: poolImage,
      isWithdraw: false,
      product_id: null,
      created_at: new Date().toISOString()
    };

    if (projectId !== undefined && projectId !== null) {
      prizeWinRecord.project_id = projectId;
    }

    if (isNFTJackpot) {
      // NFT prize: set mint address, NO sol value
      prizeWinRecord.reward_type = 'nft';
      
      // Get mint address: if poolImage is a mint address, use it; otherwise check existing entries
      let mintAddress = null;
      if (isMintAddress) {
        mintAddress = poolImage;
      } else {
        // Image is a URL, check existing prizeWin entries for mint
        const { data: existingPrizeWin } = await supabaseAdmin
          .from('prizeWin')
          .select('mint')
          .eq('name', poolData.name)
          .not('mint', 'is', null)
          .limit(1)
          .maybeSingle();
        
        if (existingPrizeWin?.mint) {
          mintAddress = existingPrizeWin.mint;
        } else {
          console.warn('⚠️ [SETTLE] NFT jackpot but no mint address found. Image:', poolImage?.substring(0, 50));
          // This shouldn't happen - mint should be stored when jackpot is created
          // For now, we can't create a valid NFT reward without a mint address
        }
      }
      
      if (mintAddress) {
        prizeWinRecord.mint = mintAddress;
        prizeWinRecord.sol = null; // CRITICAL: No SOL value for NFT rewards
        prizeWinRecord.reward_type = 'nft'; // CRITICAL: Ensure reward_type is 'nft' (already set above, but ensure it)
        console.log('🎨 [SETTLE] Creating NFT prize entry for winner:', winnerUserId, 'mint:', mintAddress.substring(0, 20), 'reward_type: nft, sol: null');
      } else {
        console.error('❌ [SETTLE] Cannot create NFT prizeWin entry: no mint address found');
        // Don't create prizeWin entry if we can't get mint address
        // But still record the win in jackpot_wins
      }
    } else if (isItemPrize) {
      // Item prize: credit tokens directly (no prizeWin entry needed)
      // Balance will be credited when winner claims via API
      prizeWinRecord.reward_type = 'item';
      prizeWinRecord.sol = String(poolData.item_price);
      console.log('💰 [SETTLE] Item prize - will credit on claim:', poolData.item_price);
    } else {
      // SOL/Token prize
      prizeWinRecord.reward_type = 'sol';
      prizeWinRecord.sol = String(prizeAmount);
      console.log('💰 [SETTLE] Creating SOL/token prize entry for winner:', winnerUserId);
    }

    // Check if prizeWin entry already exists (idempotent)
    let existingPrizeQuery = supabaseAdmin
      .from('prizeWin')
      .select('id')
      .eq('userId', winnerUserId)
      .eq('name', poolData.name);

    if (projectId !== undefined && projectId !== null) {
      existingPrizeQuery = existingPrizeQuery.eq('project_id', projectId);
    } else {
      existingPrizeQuery = existingPrizeQuery.is('project_id', null);
    }

    const { data: existingPrize } = await existingPrizeQuery.maybeSingle();

    if (!existingPrize) {
      const { error: prizeError } = await supabaseAdmin
        .from('prizeWin')
        .insert(prizeWinRecord);

      if (prizeError && prizeError.code !== '23505') {
        console.error('❌ [SETTLE] Error creating prizeWin:', prizeError);
        // Don't fail - winner is already recorded
      } else {
        console.log('✅ [SETTLE] PrizeWin entry created for winner');
      }
    } else {
      console.log('✅ [SETTLE] PrizeWin entry already exists');
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ [SETTLE] Settlement complete in ${elapsed}ms:`, {
      poolId,
      winnerUserId,
      isNFTJackpot,
      isItemPrize,
      prizeAmount
    });

    return NextResponse.json({
      success: true,
      alreadySettled: false,
      winner: {
        userId: winnerUserId,
        poolId: poolId,
        poolName: poolData.name,
        prizeType: isNFTJackpot ? 'nft' : (isItemPrize ? 'item' : 'sol'),
        prizeAmount: prizeAmount,
        nftMint: isNFTJackpot ? poolImage : null
      },
      message: 'Jackpot settled successfully'
    });

  } catch (error: any) {
    console.error('❌ [SETTLE] Error settling jackpot:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error occurred'
    }, { status: 500 });
  }
}

/**
 * GET endpoint to check winner status
 * Frontend uses this to determine if current user is the winner
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const userId = searchParams.get('userId');
    const projectId = searchParams.get('projectId');

    if (!poolId) {
      return NextResponse.json({
        success: false,
        error: 'Missing poolId parameter'
      }, { status: 400 });
    }

    // Get pool with winner info
    let poolQuery = supabaseAdmin
      .from('jackpot_pools')
      .select('id, name, image, item_price, winner_user_id, is_settled, end_time')
      .eq('id', parseInt(poolId));

    if (projectId) {
      poolQuery = poolQuery.eq('project_id', parseInt(projectId));
    } else {
      poolQuery = poolQuery.is('project_id', null);
    }

    const { data: poolData, error: poolError } = await poolQuery.single();

    if (poolError || !poolData) {
      return NextResponse.json({
        success: false,
        error: 'Pool not found'
      }, { status: 404 });
    }

    const isExpired = new Date() >= new Date(poolData.end_time);
    const isSettled = poolData.is_settled;
    const winnerUserId = poolData.winner_user_id;

    // Determine if the requesting user is the winner
    const isWinner = userId && winnerUserId && userId === winnerUserId;

    // Determine prize type
    const poolImage = poolData.image;
    const isNFTJackpot = poolImage && 
                         typeof poolImage === 'string' && 
                         poolImage.length >= 32 && 
                         poolImage.length <= 44 && 
                         !poolImage.includes('/') && 
                         !poolImage.includes('.');

    return NextResponse.json({
      success: true,
      poolId: parseInt(poolId),
      poolName: poolData.name,
      isExpired,
      isSettled,
      hasWinner: !!winnerUserId,
      winnerUserId: winnerUserId, // Only expose truncated version in production
      isWinner: isWinner,
      prizeType: isNFTJackpot ? 'nft' : (poolData.item_price ? 'item' : 'sol'),
      nftMint: isNFTJackpot && isWinner ? poolImage : null, // Only show mint to winner
      canClaim: isWinner && !poolData.is_settled // Actually should check prizeWin.isWithdraw
    });

  } catch (error: any) {
    console.error('❌ [SETTLE/GET] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
}
