#!/usr/bin/env node

/**
 * Test DepositedNFTs Component Logic
 * 
 * This script tests the same logic used in the DepositedNFTs component
 */

const { Connection, PublicKey } = require('@solana/web3.js');
const { Metaplex } = require('@metaplex-foundation/js');

// Configuration
const PROGRAM_ID = 'BkwbgssSuWQS46MtNRcq5RCnUgYq1H1LJpKhCGUtdGaH';
const CONNECTION_URL = 'https://api.devnet.solana.com';

// The 3 NFTs we found earlier
const DEPOSITED_NFTS = [
  '9Q6avpx1GgWaruA1dQanAaSwgHY3JYZW291CdhyBYv9U',
  'BYtWBudErDvFkB74AoRt5Jp5W7t564bEqYRDbWQZfpL7',
  'DDvdwe6vEciZ9qDcVMjQKyCEGKEPViXzHFaTzYMXkQhP'
];

async function getDepositedNFTs() {
  try {
    console.log("🔍 Querying vault for deposited NFTs...");
    
    const connection = new Connection(CONNECTION_URL, 'confirmed');
    const programId = new PublicKey(PROGRAM_ID);
    
    // Get all accounts owned by the program (no filters to avoid encoding issues)
    const allAccounts = await connection.getProgramAccounts(programId);
    
    console.log(`📊 Found ${allAccounts.length} total program accounts`);

    const depositedMints = [];
    
    // Filter for UserNft accounts manually
    const correctDiscriminator = [118, 117, 125, 216, 67, 180, 173, 226];

    // Parse each account to find UserNft accounts
    for (const account of allAccounts) {
      const accountData = account.account.data;
      
      if (accountData.length >= 73) { // UserNft accounts are 73 bytes
        const discriminator = Array.from(accountData.slice(0, 8));
        
        // Check if this is a UserNft account
        if (correctDiscriminator.every((byte, index) => discriminator[index] === byte)) {
          try {
            // Parse the account data
            // UserNft structure: discriminator(8) + mint(32) + user(32) + hasNft(1)
            const mintBytes = accountData.slice(8, 40);
            const hasNftByte = accountData.slice(72, 73);
            
            const mint = new PublicKey(mintBytes);
            const hasNft = hasNftByte[0] === 1;
            
            if (hasNft) {
              depositedMints.push(mint.toString());
              console.log(`✅ Found deposited NFT: ${mint.toString()}`);
            }
            
          } catch (error) {
            console.warn(`⚠️ Error parsing UserNft account: ${error}`);
          }
        }
      }
    }

    console.log(`🎨 Total deposited NFTs: ${depositedMints.length}`);
    
    if (depositedMints.length === 0) {
      console.log("📦 No NFTs currently deposited in vault");
    }
    
    return depositedMints;
    
  } catch (error) {
    console.error("❌ Error querying vault for NFTs:", error);
    return [];
  }
}

async function fetchMultipleNFTMetadata(mintAddresses) {
  console.log("🎨 Fetching metadata for", mintAddresses.length, "NFTs");
  
  const metaplex = Metaplex.make(new Connection(CONNECTION_URL, 'confirmed'));
  
  const promises = mintAddresses.map(async (mint) => {
    try {
      console.log("🔍 Fetching NFT metadata for:", mint);
      
      const mintPubkey = new PublicKey(mint);
      const nft = await metaplex.nfts().findByMint({ mintAddress: mintPubkey });
      
      if (!nft) {
        console.warn("❌ NFT not found for mint:", mint);
        return null;
      }
      
      const metadata = {
        name: nft.name,
        image: nft.json?.image || "/default-nft.png",
        description: nft.json?.description || "",
        mint: mint,
        symbol: nft.symbol || "NFT",
        attributes: nft.json?.attributes || []
      };
      
      console.log("✅ NFT metadata fetched:", metadata);
      return metadata;
      
    } catch (error) {
      console.error("❌ Error fetching NFT metadata:", error);
      return null;
    }
  });
  
  const results = await Promise.all(promises);
  
  // Filter out null results
  const validNFTs = results.filter(nft => nft !== null);
  
  console.log(`✅ Successfully fetched ${validNFTs.length}/${mintAddresses.length} NFTs`);
  return validNFTs;
}

async function testDepositedNFTsComponent() {
  console.log('🎨 TESTING DEPOSITED NFTS COMPONENT LOGIC...\n');
  
  try {
    // Step 1: Get deposited NFTs (same as DepositedNFTs component)
    const mintAddresses = await getDepositedNFTs();
    console.log("📍 Mint addresses:", mintAddresses);
    
    if (mintAddresses.length === 0) {
      console.log("❌ No NFTs found - component would show 'No NFTs Deposited Yet'");
      return;
    }
    
    // Step 2: Fetch metadata for all NFTs (same as DepositedNFTs component)
    const nftMetadata = await fetchMultipleNFTMetadata(mintAddresses);
    console.log("✅ Loaded NFT metadata:", nftMetadata);
    
    // Step 3: Display what the component would show
    console.log('\n🎯 WHAT THE COMPONENT WOULD DISPLAY:');
    console.log(`📦 ${nftMetadata.length} NFTs deposited in vault`);
    
    nftMetadata.forEach((nft, index) => {
      console.log(`\n🎨 NFT #${index + 1}:`);
      console.log(`   📝 Name: ${nft.name}`);
      console.log(`   🖼️  Image: ${nft.image}`);
      console.log(`   📄 Description: ${nft.description}`);
      console.log(`   🏷️  Symbol: ${nft.symbol}`);
      console.log(`   🎯 Attributes: ${nft.attributes.length} found`);
    });
    
    console.log('\n✨ The DepositedNFTs component should work correctly!');
    console.log('   - It will show the NFT names and images');
    console.log('   - Each NFT will be displayed in a card format');
    console.log('   - Users can see what NFTs are available for wheel rewards');
    
  } catch (error) {
    console.error('❌ Error testing component:', error);
  }
}

testDepositedNFTsComponent();
