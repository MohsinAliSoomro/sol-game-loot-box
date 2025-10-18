const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with the service role key
const supabase = createClient(
  'https://zkltmkbmzxvfovsgotpt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprbHRta2Jtenh2Zm92c2dvdHB0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMDg2OTcyMiwiZXhwIjoyMDM2NDQ1NzIyfQ.2u0qOi88laimVCRNKJtEIY9z18ZAe7XRlN4EePlG0DE'
);

async function cleanPrizeWinTable() {
  try {
    console.log("🧹 Cleaning up prizeWin table...");
    
    // Get all NFT records that are not withdrawn (in cart)
    const { data: inCartNFTs, error: fetchError } = await supabase
      .from('prizeWin')
      .select('*')
      .eq('reward_type', 'nft')
      .eq('isWithdraw', false)
      .not('mint', 'is', null);
    
    if (fetchError) {
      console.error("❌ Error fetching in-cart NFTs:", fetchError);
      return;
    }
    
    console.log(`📦 Found ${inCartNFTs?.length || 0} NFTs in cart`);
    
    if (inCartNFTs && inCartNFTs.length > 0) {
      console.log("\n🗑️ Cleaning up old NFT records...");
      
      // Mark all these NFTs as withdrawn (cleared from cart)
      const { error: updateError } = await supabase
        .from('prizeWin')
        .update({ isWithdraw: true })
        .eq('reward_type', 'nft')
        .eq('isWithdraw', false)
        .not('mint', 'is', null);
      
      if (updateError) {
        console.error("❌ Error cleaning up NFT records:", updateError);
        return;
      }
      
      console.log(`✅ Cleaned up ${inCartNFTs.length} NFT records`);
      console.log("🎯 All NFTs are now marked as withdrawn (cleared from carts)");
    } else {
      console.log("✅ No NFTs in cart to clean up");
    }
    
    // Verify the cleanup
    const { data: remainingInCart, error: verifyError } = await supabase
      .from('prizeWin')
      .select('*')
      .eq('reward_type', 'nft')
      .eq('isWithdraw', false)
      .not('mint', 'is', null);
    
    if (verifyError) {
      console.error("❌ Error verifying cleanup:", verifyError);
      return;
    }
    
    console.log(`\n📊 Verification: ${remainingInCart?.length || 0} NFTs still in cart`);
    
    if (remainingInCart && remainingInCart.length === 0) {
      console.log("✅ Cleanup successful! No NFTs are in cart anymore.");
      console.log("🎯 Your NFT should now appear on the wheel after refresh.");
    } else {
      console.log("⚠️ Some NFTs are still in cart. Manual cleanup may be needed.");
    }
    
  } catch (error) {
    console.error("❌ Error cleaning up prizeWin table:", error);
  }
}

cleanPrizeWinTable();
