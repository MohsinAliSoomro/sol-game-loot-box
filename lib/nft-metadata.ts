/**
 * NFT Metadata Fetcher
 * 
 * This utility fetches NFT metadata (name, image, etc.) from Solana token addresses
 */

import { Connection, PublicKey } from "@solana/web3.js";

// Lazy load Metaplex to avoid build-time dependency issues with @irys/sdk
let metaplexInstance: any = null;
const getMetaplex = async () => {
  if (!metaplexInstance) {
    try {
      const { Metaplex } = await import("@metaplex-foundation/js");
      const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://mainnet.helius-rpc.com/?api-key=5a1a852c-3ed9-40ee-bca8-dda4550c3ce8");
      metaplexInstance = Metaplex.make(connection);
    } catch (error) {
      console.error("Failed to load Metaplex:", error);
      throw error;
    }
  }
  return metaplexInstance;
};

/**
 * Helper: Derive Metaplex metadata PDA
 */
async function getMetadataPDA(mintAddress: string): Promise<string> {
  const METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
  const seeds = [
    Buffer.from('metadata'),
    new PublicKey(METADATA_PROGRAM_ID).toBuffer(),
    new PublicKey(mintAddress).toBuffer()
  ];
  
  const [pda] = await PublicKey.findProgramAddress(seeds, new PublicKey(METADATA_PROGRAM_ID));
  return pda.toBase58();
}

/**
 * Helper: Parse on-chain metadata (simplified)
 */
function parseMetadata(data: Buffer): { name: string; symbol: string; uri: string } {
  try {
    // Skip first byte (key = 4 for Metadata account)
    let offset = 1;
    
    // Read update authority (32 bytes)
    offset += 32;
    
    // Read mint (32 bytes)
    offset += 32;
    
    // Read name (string with 4-byte length prefix)
    const nameLen = data.readUInt32LE(offset);
    offset += 4;
    const name = data.slice(offset, offset + nameLen).toString('utf8').replace(/\0/g, '').trim();
    offset += nameLen;
    
    // Read symbol (string with 4-byte length prefix)
    const symbolLen = data.readUInt32LE(offset);
    offset += 4;
    const symbol = data.slice(offset, offset + symbolLen).toString('utf8').replace(/\0/g, '').trim();
    offset += symbolLen;
    
    // Read URI (string with 4-byte length prefix)
    const uriLen = data.readUInt32LE(offset);
    offset += 4;
    const uri = data.slice(offset, offset + uriLen).toString('utf8').replace(/\0/g, '').trim();
    
    return { name, symbol, uri };
  } catch (err) {
    console.error('Error parsing metadata:', err);
    return { name: '', symbol: '', uri: '' };
  }
}

/**
 * Fallback method using manual parsing (no Metaplex dependency)
 */
async function fetchNFTMetadataFallback(mintAddress: string) {
  try {
    console.log("🔄 Using fallback method (manual parsing) for:", mintAddress);
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://mainnet.helius-rpc.com/?api-key=5a1a852c-3ed9-40ee-bca8-dda4550c3ce8";
    console.log("🌐 Fallback using RPC:", rpcUrl);
    const connection = new Connection(rpcUrl, 'confirmed');
    
    // Derive metadata PDA
    const metadataPDA = await getMetadataPDA(mintAddress);
    const accountInfo = await connection.getAccountInfo(new PublicKey(metadataPDA));

    if (!accountInfo) {
      console.warn("❌ Metadata account not found for mint:", mintAddress);
      return null;
    }

    // Parse on-chain metadata
    const metadata = parseMetadata(accountInfo.data);
    
    // Fetch off-chain metadata if URI exists
    let offChainData = null;
    if (metadata.uri) {
      try {
        const response = await fetch(metadata.uri);
        if (response.ok) {
          offChainData = await response.json();
        }
      } catch (err) {
        console.warn('Failed to fetch off-chain metadata for', mintAddress);
      }
    }

    // Convert IPFS URLs to HTTP gateway URLs
    let imageUrl = offChainData?.image || null;
    if (imageUrl && typeof imageUrl === 'string') {
      // Handle IPFS URLs
      if (imageUrl.startsWith('ipfs://')) {
        imageUrl = imageUrl.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
      } else if (imageUrl.startsWith('ipfs/')) {
        imageUrl = imageUrl.replace('ipfs/', 'https://gateway.pinata.cloud/ipfs/');
      } else if (imageUrl.startsWith('Qm') && imageUrl.length === 46 && !imageUrl.includes('/') && !imageUrl.includes('http')) {
        imageUrl = `https://gateway.pinata.cloud/ipfs/${imageUrl}`;
      }
    }

    return {
      name: metadata.name || offChainData?.name || mintAddress.substring(0, 8) + '...',
      image: imageUrl,
      description: offChainData?.description || "",
      mint: mintAddress,
      symbol: metadata.symbol || "NFT",
      attributes: offChainData?.attributes || []
    };
  } catch (error) {
    console.error("❌ Error in fallback method:", error);
    return null;
  }
}

/**
 * Fetch NFT metadata from mint address
 * @param mintAddress - The token mint address
 * @returns Promise with NFT metadata or null if not found
 */
export const fetchNFTMetadata = async (mintAddress: string) => {
  try {
    console.log("🔍 Fetching NFT metadata for:", mintAddress);
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://mainnet.helius-rpc.com/?api-key=5a1a852c-3ed9-40ee-bca8-dda4550c3ce8";
    console.log("🌐 Using RPC:", rpcUrl);
    
    // Validate mint address
    try {
      new PublicKey(mintAddress);
    } catch (e) {
      console.error("❌ Invalid mint address:", mintAddress);
      throw new Error(`Invalid mint address: ${mintAddress}`);
    }
    
    // Try Metaplex first
    try {
      console.log("🔄 Attempting Metaplex fetch...");
      const metaplex = await getMetaplex();
      const mint = new PublicKey(mintAddress);
      
      // Add timeout wrapper
      const fetchPromise = metaplex.nfts().findByMint({ mintAddress: mint });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Metaplex fetch timeout')), 15000)
      );
      
      const nft = await Promise.race([fetchPromise, timeoutPromise]) as any;
      
      if (!nft) {
        console.warn("❌ NFT not found for mint:", mintAddress);
        // Try fallback method
        return await fetchNFTMetadataFallback(mintAddress);
      }
      
      console.log("📦 NFT found via Metaplex:", {
        name: nft.name,
        symbol: nft.symbol,
        uri: nft.uri,
        hasJson: !!nft.json,
        imageUrl: nft.json?.image
      });
      
      // Convert IPFS URLs to HTTP gateway URLs
      let imageUrl = nft.json?.image || null;
      if (imageUrl && typeof imageUrl === 'string') {
        console.log("🖼️ Original image URL:", imageUrl);
        
        // Handle IPFS URLs (ipfs://... or ipfs/...)
        if (imageUrl.startsWith('ipfs://')) {
          const cid = imageUrl.replace('ipfs://', '').replace(/^\/+/, '');
          imageUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
          console.log("🔄 Converted ipfs:// to:", imageUrl);
        } else if (imageUrl.startsWith('ipfs/')) {
          const cid = imageUrl.replace('ipfs/', '').replace(/^\/+/, '');
          imageUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
          console.log("🔄 Converted ipfs/ to:", imageUrl);
        } else if (imageUrl.startsWith('Qm') && imageUrl.length === 46 && !imageUrl.includes('/') && !imageUrl.includes('http')) {
          imageUrl = `https://gateway.pinata.cloud/ipfs/${imageUrl}`;
          console.log("🔄 Converted CID to:", imageUrl);
        } else if (!imageUrl.startsWith('http')) {
          // If it's a relative path or just a CID, try to extract it
          const cidMatch = imageUrl.match(/(Qm[a-zA-Z0-9]{44})/);
          if (cidMatch) {
            imageUrl = `https://gateway.pinata.cloud/ipfs/${cidMatch[1]}`;
            console.log("🔄 Extracted and converted CID to:", imageUrl);
          }
        }
        
        console.log("✅ Final image URL:", imageUrl);
      } else {
        console.warn("⚠️ Image URL is not a string or missing:", imageUrl);
        // Try to get image from URI if json.image is missing
        if (nft.uri) {
          try {
            console.log("🔄 Attempting to fetch image from URI:", nft.uri);
            const uriResponse = await fetch(nft.uri);
            if (uriResponse.ok) {
              const uriData = await uriResponse.json();
              if (uriData.image) {
                imageUrl = uriData.image;
                console.log("✅ Found image in URI data:", imageUrl);
                // Convert IPFS if needed
                if (imageUrl.startsWith('ipfs://')) {
                  const cid = imageUrl.replace('ipfs://', '').replace(/^\/+/, '');
                  imageUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
                }
              }
            }
          } catch (uriError) {
            console.warn("⚠️ Failed to fetch from URI:", uriError);
          }
        }
      }
      
      const metadata = {
        name: nft.name,
        image: imageUrl,
        description: nft.json?.description || "",
        mint: mintAddress,
        symbol: nft.symbol || "NFT",
        attributes: nft.json?.attributes || []
      };
      
      if (!metadata.image) {
        console.error("❌ No image found in NFT metadata");
        throw new Error("No image found in NFT metadata");
      }
      
      console.log("✅ NFT metadata fetched via Metaplex:", metadata);
      return metadata;
    } catch (metaplexError: any) {
      console.warn("⚠️ Metaplex method failed, trying fallback:", metaplexError?.message);
      // If Metaplex fails, use fallback method
      return await fetchNFTMetadataFallback(mintAddress);
    }
    
  } catch (error: any) {
    console.error("❌ Error fetching NFT metadata:", error);
    console.error("❌ Error stack:", error?.stack);
    // Last resort: try fallback
    try {
      return await fetchNFTMetadataFallback(mintAddress);
    } catch (fallbackError) {
      console.error("❌ Fallback also failed:", fallbackError);
      throw error; // Re-throw original error
    }
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
    
    // Remove duplicates based on mint address
    const uniqueNFTs = validNFTs.filter((nft, index, self) => 
      index === self.findIndex(t => t.mint === nft.mint)
    );
    
    console.log(`🔄 Removed duplicates: ${validNFTs.length} → ${uniqueNFTs.length} NFTs`);
    return uniqueNFTs;
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
    const CONNECTION_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=5a1a852c-3ed9-40ee-bca8-dda4550c3ce8';
    
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
              // Double-check: verify the vault ATA actually has NFTs
              try {
                const [vaultAuthority] = PublicKey.findProgramAddressSync(
                  [Buffer.from('vault'), mint.toBuffer()],
                  PROGRAM_ID
                );
                
                const { getAssociatedTokenAddressSync } = await import('@solana/spl-token');
                const vaultATA = getAssociatedTokenAddressSync(mint, vaultAuthority, true);
                
                // Check if vault ATA exists and has NFTs
                const vaultAccountInfo = await connection.getAccountInfo(vaultATA);
                let vaultHasNFTs = false;
                
                if (vaultAccountInfo) {
                  const amount = vaultAccountInfo.data.readBigUInt64LE(64);
                  vaultHasNFTs = amount > BigInt(0);
                }
                
                if (vaultHasNFTs && vaultAccountInfo) {
                  depositedMints.push(mint.toString());
                  console.log(`✅ Found deposited NFT: ${mint.toString()} (vault has ${vaultAccountInfo.data.readBigUInt64LE(64)} NFTs)`);
                } else {
                  console.log(`⚠️ UserNft says deposited but vault ATA is empty: ${mint.toString()}`);
                }
              } catch (vaultError) {
                console.warn(`⚠️ Error checking vault for ${mint.toString()}: ${vaultError}`);
                // If we can't check vault, trust the UserNft account
                depositedMints.push(mint.toString());
                console.log(`✅ Found deposited NFT (vault check failed): ${mint.toString()}`);
              }
            }
            
          } catch (error) {
            console.warn(`⚠️ Error parsing UserNft account: ${error}`);
          }
        }
      }
    }

    // Remove duplicate mint addresses
    const uniqueMints = [...new Set(depositedMints)];
    
    console.log(`🎨 Total deposited NFTs: ${depositedMints.length} (${uniqueMints.length} unique)`);
    if (depositedMints.length !== uniqueMints.length) {
      console.log(`🔄 Removed ${depositedMints.length - uniqueMints.length} duplicate mint addresses`);
    }
    
    if (uniqueMints.length === 0) {
      console.log("📦 No NFTs currently deposited in vault");
    }
    
    return uniqueMints;
    
  } catch (error) {
    console.error("❌ Error querying vault for NFTs:", error);
    
    // Fallback: return empty array if query fails
    console.log("🔄 Falling back to empty array");
    return [];
  }
};
