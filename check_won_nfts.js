const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key'
);

async function checkWonNFTs() {
  try {
    console.log("🔍 Checking won NFTs in prizeWin table...");
    
    // Get all NFT wins (not yet claimed)
    const { data: wonNFTs, error } = await supabase
      .from('prizeWin')
      .select('*')
      .eq('reward_type', 'nft')
      .eq('isWithdraw', false) // In cart but not yet claimed
      .not('mint', 'is', null)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("❌ Error fetching won NFTs:", error);
      return;
    }
    
    console.log(`📊 Total won NFTs: ${wonNFTs?.length || 0}`);
    
    if (wonNFTs && wonNFTs.length > 0) {
      console.log("\n🏆 Won NFTs (in sidebar cart):");
      wonNFTs.forEach((nft, index) => {
        console.log(`\n   ${index + 1}. NFT Details:`);
        console.log(`      Name: ${nft.name}`);
        console.log(`      Mint: ${nft.mint}`);
        console.log(`      User ID: ${nft.userId}`);
        console.log(`      Created: ${nft.created_at}`);
        console.log(`      Claimed: ${nft.isWithdraw ? 'Yes' : 'No'}`);
        console.log(`      Reward Type: ${nft.reward_type}`);
      });
    } else {
      console.log("📦 No NFTs currently won (in sidebar cart)");
    }
    
    // Also check all NFT wins (including claimed ones)
    const { data: allNFTWins, error: allError } = await supabase
      .from('prizeWin')
      .select('*')
      .eq('reward_type', 'nft')
      .not('mint', 'is', null)
      .order('created_at', { ascending: false });
    
    if (allError) {
      console.error("❌ Error fetching all NFT wins:", allError);
      return;
    }
    
    console.log(`\n📈 Total NFT wins (including claimed): ${allNFTWins?.length || 0}`);
    
    if (allNFTWins && allNFTWins.length > 0) {
      console.log("\n🎯 All NFT wins (claimed and unclaimed):");
      allNFTWins.forEach((nft, index) => {
        console.log(`\n   ${index + 1}. ${nft.name}`);
        console.log(`      Mint: ${nft.mint?.slice(0, 20)}...`);
        console.log(`      User: ${nft.userId?.slice(0, 8)}...`);
        console.log(`      Status: ${nft.isWithdraw ? 'CLAIMED' : 'IN CART'}`);
        console.log(`      Date: ${nft.created_at}`);
      });
    }
    
  } catch (error) {
    console.error("❌ Error checking won NFTs:", error);
  }
}

checkWonNFTs();
