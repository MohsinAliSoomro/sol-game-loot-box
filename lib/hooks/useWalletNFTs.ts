"use client";

import { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';

export const useWalletNFTs = (walletAddress: string | null) => {
  const [nfts, setNfts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWalletNFTs = async () => {
    if (!walletAddress) {
      setNfts([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const connection = new Connection(RPC_ENDPOINT, 'confirmed');
      const owner = new PublicKey(walletAddress);

      // Get all token accounts owned by the wallet
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
        programId: TOKEN_PROGRAM_ID
      });

      const nftCandidates: string[] = [];

      for (const { account } of tokenAccounts.value) {
        const parsedInfo = account.data.parsed.info;
        const mintAddress = parsedInfo.mint;
        const amount = parsedInfo.tokenAmount.uiAmount;

        // NFTs have decimals = 0 and amount = 1
        if (parsedInfo.tokenAmount.decimals === 0 && amount === 1) {
          nftCandidates.push(mintAddress);
        }
      }

      // Fetch metadata for each NFT
      const nftMetadata = await Promise.all(
        nftCandidates.map(async (mint) => {
          try {
            // Derive metadata PDA
            const metadataPDA = await getMetadataPDA(mint);
            const accountInfo = await connection.getAccountInfo(new PublicKey(metadataPDA));

            if (!accountInfo) {
              return {
                mint,
                name: mint.substring(0, 8) + '...',
                image: null,
                uri: null
              };
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
                console.warn('Failed to fetch off-chain metadata for', mint);
              }
            }

            return {
              mint,
              name: metadata.name || offChainData?.name || mint.substring(0, 8) + '...',
              image: offChainData?.image || null,
              uri: metadata.uri,
              symbol: metadata.symbol || '',
              collection: offChainData?.collection?.name || '',
              attributes: offChainData?.attributes || []
            };
          } catch (err) {
            console.error('Error fetching metadata for', mint, err);
            return {
              mint,
              name: mint.substring(0, 8) + '...',
              image: null,
              uri: null
            };
          }
        })
      );

      setNfts(nftMetadata.filter(nft => nft !== null));
    } catch (err: any) {
      console.error('Error fetching wallet NFTs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletNFTs();
  }, [walletAddress]);

  return {
    nfts,
    loading,
    error,
    refetch: fetchWalletNFTs
  };
};

// Helper: Derive Metaplex metadata PDA
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

// Helper: Parse on-chain metadata (simplified)
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

