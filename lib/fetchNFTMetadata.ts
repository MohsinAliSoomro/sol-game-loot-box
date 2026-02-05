import { Connection, PublicKey } from '@solana/web3.js';

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://mainnet.helius-rpc.com/?api-key=5a1a852c-3ed9-40ee-bca8-dda4550c3ce8';

/**
 * Fetch NFT metadata from mint address
 * @param mintAddress - The NFT mint address
 * @returns NFT metadata or null
 */
export const fetchNFTMetadata = async (mintAddress: string): Promise<{image: string | null; name: string; description?: string; symbol?: string} | null> => {
  if (!mintAddress) return null;

  try {
    const connection = new Connection(RPC_ENDPOINT, 'confirmed');
    
    // Derive metadata PDA
    const metadataPDA = await getMetadataPDA(mintAddress);
    const accountInfo = await connection.getAccountInfo(new PublicKey(metadataPDA));

    if (!accountInfo) {
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
        // If it's just a CID (Qm...), prepend gateway URL
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
    }

    return {
      image: imageUrl,
      name: metadata.name || offChainData?.name || mintAddress.substring(0, 8) + '...',
      description: offChainData?.description || '',
      symbol: metadata.symbol || ''
    };
  } catch (err) {
    console.error('Error fetching NFT metadata:', err);
    return null;
  }
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

