/**
 * NFT Metadata Fetcher
 * 
 * This utility fetches NFT metadata (name, image, etc.) from Solana token addresses
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { Metaplex } from "@metaplex-foundation/js";

// Initialize connection and Metaplex
const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com");
const metaplex = Metaplex.make(connection);

/**
 * Fetch NFT metadata from mint address
 * @param mintAddress - The token mint address
 * @returns Promise with NFT metadata or null if not found
 */
export const fetchNFTMetadata = async (mintAddress: string) => {
  try {
    console.log("🔍 Fetching NFT metadata for:", mintAddress);
    
    const mint = new PublicKey(mintAddress);
    const nft = await metaplex.nfts().findByMint({ mintAddress: mint });
    
    if (!nft) {
      console.warn("❌ NFT not found for mint:", mintAddress);
      return null;
    }
    
    const metadata = {
      name: nft.name,
      image: nft.json?.image || "/default-nft.png",
      description: nft.json?.description || "",
      mint: mintAddress,
      symbol: nft.symbol || "NFT",
      attributes: nft.json?.attributes || []
    };
    
    console.log("✅ NFT metadata fetched:", metadata);
    return metadata;
    
  } catch (error) {
    console.error("❌ Error fetching NFT metadata:", error);
    return null;
  }
};

/**
 * Fetch multiple NFT metadata from mint addresses
 * @param mintAddresses - Array of token mint addresses
 * @returns Promise with array of NFT metadata
 */
export const fetchMultipleNFTMetadata = async (mintAddresses: string[]) => {
  console.log("🎨 Fetching metadata for", mintAddresses.length, "NFTs");
  
  const promises = mintAddresses.map(mint => fetchNFTMetadata(mint));
  const results = await Promise.all(promises);
  
  // Filter out null results
  const validNFTs = results.filter(nft => nft !== null);
  
  console.log(`✅ Successfully fetched ${validNFTs.length}/${mintAddresses.length} NFTs`);
  return validNFTs;
};

/**
 * Get deposited NFTs from vault by querying the Solana program
 * @returns Array of mint addresses of deposited NFTs
 */
export const getDepositedNFTs = async (): Promise<string[]> => {
  try {
    console.log("🔍 Querying vault for deposited NFTs...");
    
    // Import Solana dependencies
    const { Connection, PublicKey } = await import("@solana/web3.js");
    
    // Configuration
    const PROGRAM_ID = new PublicKey('BkwbgssSuWQS46MtNRcq5RCnUgYq1H1LJpKhCGUtdGaH');
    const CONNECTION_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    
    const connection = new Connection(CONNECTION_URL, 'confirmed');
    
    // Get all accounts owned by the program (no filters to avoid encoding issues)
    const allAccounts = await connection.getProgramAccounts(PROGRAM_ID);
    
    console.log(`📊 Found ${allAccounts.length} total program accounts`);

    const depositedMints: string[] = [];
    
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
    
    // Fallback: return empty array if query fails
    console.log("🔄 Falling back to empty array");
    return [];
  }
};
