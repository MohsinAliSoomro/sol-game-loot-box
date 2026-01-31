
import { NextRequest, NextResponse } from 'next/server';
import { supabase as appSupabase } from '@/service/supabase';

// NOTE: Use the app's configured Supabase client.
// The previous implementation required NEXT_PUBLIC_* env vars at runtime,
// which can be missing in some server environments and caused 500s.

/**
 * API endpoint to manage NFT status in the wheel
 * 
 * GET: Get available NFTs (not won by anyone)
 * POST: Mark NFT as won (remove from wheel)
 * DELETE: Mark NFT as available (add back to wheel)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = appSupabase;
    console.log("🔍 Getting available NFTs from backend...");
    
    // Get project_id from query parameters (optional)
    const { searchParams } = new URL(request.url);
    const projectIdParam = searchParams.get('project_id');
    const projectId = projectIdParam ? parseInt(projectIdParam) : null;
    
    console.log(`📦 Project context: ${projectId ? `Sub-project ${projectId}` : 'Main project (NULL)'}`);
    
    // Get all NFTs that are deposited in vault
    const { getDepositedNFTs } = await import("@/lib/nft-metadata");
    const depositedMints = await getDepositedNFTs();
    
    console.log(`📍 Deposited NFTs: ${depositedMints.length}`);
    
    if (depositedMints.length === 0) {
      return NextResponse.json({ 
        success: true, 
        availableNFTs: [],
        message: "No NFTs deposited in vault" 
      });
    }
    
    // Get NFTs that are already won (in sidebar carts)
    // Filter by project_id: NULL for main project, specific ID for sub-projects
    let wonNFTsQuery = supabase
      .from('prizeWin')
      .select('mint')
      .eq('reward_type', 'nft')
      .eq('isWithdraw', false) // In cart but not yet claimed
      .not('mint', 'is', null);
    
    if (projectId) {
      // Sub-project: filter by specific project_id
      wonNFTsQuery = wonNFTsQuery.eq('project_id', projectId);
    } else {
      // Main project: only show NFTs from main project (project_id IS NULL)
      wonNFTsQuery = wonNFTsQuery.is('project_id', null);
    }
    
    const { data: wonNFTs } = await wonNFTsQuery;
    
    const wonMints = new Set((wonNFTs || []).map(w => w.mint));
    console.log(`📋 Won NFTs: ${wonMints.size}`);
    
    // Filter out won NFTs
    const availableMints = depositedMints.filter(mint => !wonMints.has(mint));
    console.log(`🎯 Available NFTs: ${availableMints.length}/${depositedMints.length}`);
    
    // Update database to reflect current status
    if (availableMints.length > 0) {
      // Activate available NFTs
      const percentagePerNFT = 50 / availableMints.length;
      
      for (const mint of availableMints) {
        await supabase
          .from('nft_reward_percentages')
          .update({ 
            is_active: true,
            percentage: percentagePerNFT
          })
          .eq('mint_address', mint);
      }
      
      // Deactivate won NFTs
      for (const mint of Array.from(wonMints)) {
        await supabase
          .from('nft_reward_percentages')
          .update({ 
            is_active: false,
            percentage: 0
          })
          .eq('mint_address', mint);
      }
    } else {
      // All NFTs are won - deactivate all
      await supabase
        .from('nft_reward_percentages')
        .update({ 
          is_active: false,
          percentage: 0
        })
        .not('mint_address', 'is', null);
    }
    
    return NextResponse.json({ 
      success: true, 
      availableNFTs: availableMints,
      totalDeposited: depositedMints.length,
      wonNFTs: Array.from(wonMints)
    });
    
  } catch (error) {
    console.error("❌ Error getting NFT status:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Failed to get NFT status" 
    }, { status: 500 });
  }
}

/**
 * Mark NFT as won (remove from wheel)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = appSupabase;
    const { mint, userId } = await request.json();
    
    if (!mint || !userId) {
      return NextResponse.json({ 
        success: false, 
        error: "Missing mint or userId" 
      }, { status: 400 });
    }
    
    console.log(`🎯 Marking NFT as won: ${mint} by user: ${userId}`);
    
    // Mark NFT as inactive in database
    const { error } = await supabase
      .from('nft_reward_percentages')
      .update({ 
        is_active: false,
        percentage: 0
      })
      .eq('mint_address', mint);
    
    if (error) {
      console.error("❌ Error marking NFT as inactive:", error);
      return NextResponse.json({ 
        success: false, 
        error: "Failed to mark NFT as won" 
      }, { status: 500 });
    }
    
    console.log(`✅ NFT marked as won: ${mint}`);
    
    return NextResponse.json({ 
      success: true, 
      message: `NFT ${mint} marked as won` 
    });
    
  } catch (error) {
    console.error("❌ Error marking NFT as won:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Failed to mark NFT as won" 
    }, { status: 500 });
  }
}

/**
 * Mark NFT as available (add back to wheel)
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = appSupabase;
    const { mint } = await request.json();
    
    if (!mint) {
      return NextResponse.json({ 
        success: false, 
        error: "Missing mint" 
      }, { status: 400 });
    }
    
    console.log(`🔄 Marking NFT as available: ${mint}`);
    
    // Check if NFT is still in vault
    const { getDepositedNFTs } = await import("@/lib/nft-metadata");
    const depositedMints = await getDepositedNFTs();
    
    if (!depositedMints.includes(mint)) {
      return NextResponse.json({ 
        success: false, 
        error: "NFT not in vault" 
      }, { status: 400 });
    }
    
    // Get current available NFTs to calculate percentage
    const { data: availableNFTs } = await supabase
      .from('nft_reward_percentages')
      .select('mint_address')
      .eq('is_active', true)
      .not('mint_address', 'is', null);
    
    const availableCount = (availableNFTs?.length || 0) + 1; // +1 for the NFT we're adding
    const percentagePerNFT = 50 / availableCount;
    
    // Mark NFT as active
    const { error } = await supabase
      .from('nft_reward_percentages')
      .update({ 
        is_active: true,
        percentage: percentagePerNFT
      })
      .eq('mint_address', mint);
    
    if (error) {
      console.error("❌ Error marking NFT as active:", error);
      return NextResponse.json({ 
        success: false, 
        error: "Failed to mark NFT as available" 
      }, { status: 500 });
    }
    
    console.log(`✅ NFT marked as available: ${mint} (${percentagePerNFT}%)`);
    
    return NextResponse.json({ 
      success: true, 
      message: `NFT ${mint} marked as available` 
    });
    
  } catch (error) {
    console.error("❌ Error marking NFT as available:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Failed to mark NFT as available" 
    }, { status: 500 });
  }
}
