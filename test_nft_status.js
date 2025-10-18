const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key'
);

async function testNFTStatus() {
  try {
    console.log("🔍 Testing NFT status in database...");
    
    // Check all NFT rewards in database
    const { data: allNFTs, error: allError } = await supabase
      .from('nft_reward_percentages')
      .select('*')
      .not('mint_address', 'is', null);
    
    if (allError) {
      console.error("❌ Error fetching all NFTs:", allError);
      return;
    }
    
    console.log(`📊 Total NFTs in database: ${allNFTs?.length || 0}`);
    
    if (allNFTs && allNFTs.length > 0) {
      console.log("\n📋 All NFTs in database:");
      allNFTs.forEach((nft, index) => {
        console.log(`   ${index + 1}. ${nft.reward_name} (${nft.mint_address?.slice(0, 8)}...) - Active: ${nft.is_active}, Percentage: ${nft.percentage}%`);
      });
    }
    
    // Check active NFTs
    const { data: activeNFTs, error: activeError } = await supabase
      .from('nft_reward_percentages')
      .select('*')
      .eq('is_active', true)
      .not('mint_address', 'is', null);
    
    if (activeError) {
      console.error("❌ Error fetching active NFTs:", activeError);
      return;
    }
    
    console.log(`\n🎯 Active NFTs: ${activeNFTs?.length || 0}`);
    
    if (activeNFTs && activeNFTs.length > 0) {
      console.log("🎨 Active NFT rewards:");
      activeNFTs.forEach((nft, index) => {
        console.log(`   ${index + 1}. ${nft.reward_name} (${nft.mint_address?.slice(0, 8)}...) - ${nft.percentage}%`);
      });
    }
    
    // Check won NFTs (in sidebar cart)
    const { data: wonNFTs, error: wonError } = await supabase
      .from('prizeWin')
      .select('mint, name, userId, created_at')
      .eq('reward_type', 'nft')
      .eq('isWithdraw', false)
      .not('mint', 'is', null);
    
    if (wonError) {
      console.error("❌ Error fetching won NFTs:", wonError);
      return;
    }
    
    console.log(`\n🏆 Won NFTs (in sidebar cart): ${wonNFTs?.length || 0}`);
    
    if (wonNFTs && wonNFTs.length > 0) {
      console.log("🎨 Won NFT rewards:");
      wonNFTs.forEach((nft, index) => {
        console.log(`   ${index + 1}. ${nft.name} (${nft.mint?.slice(0, 8)}...) - User: ${nft.userId?.slice(0, 8)}...`);
      });
    }
    
    // Check if there's a mismatch
    const activeMints = new Set((activeNFTs || []).map(nft => nft.mint_address));
    const wonMints = new Set((wonNFTs || []).map(nft => nft.mint));
    
    console.log(`\n🔍 Analysis:`);
    console.log(`   Active NFTs: ${activeMints.size}`);
    console.log(`   Won NFTs: ${wonMints.size}`);
    
    // Check for conflicts
    const conflicts = [...activeMints].filter(mint => wonMints.has(mint));
    if (conflicts.length > 0) {
      console.log(`   ⚠️ CONFLICT: ${conflicts.length} NFTs are both active AND won!`);
      conflicts.forEach(mint => {
        console.log(`      - ${mint.slice(0, 8)}...`);
      });
    } else {
      console.log(`   ✅ No conflicts - all active NFTs are not won`);
    }
    
  } catch (error) {
    console.error("❌ Error testing NFT status:", error);
  }
}

testNFTStatus();
