import { useState, useEffect } from 'react'
import { PublicKey } from '@solana/web3.js'
import { convertIPFSToHTTP } from '../utils/ipfs'

const HELIUS_API_KEY = '5a1a852c-3ed9-40ee-bca8-dda4550c3ce8'

export const useWalletNFTs = (walletAddress) => {
  const [nfts, setNfts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchWalletNFTs = async () => {
    if (!walletAddress) {
      setNfts([])
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Validate wallet address
      let publicKey
      try {
        publicKey = new PublicKey(walletAddress)
      } catch (err) {
        console.error('Invalid wallet address:', walletAddress)
        setError('Invalid wallet address')
        setNfts([])
        return
      }

      console.log('🔍 Fetching NFTs from Helius DAS API for wallet:', walletAddress)

      // Use Helius DAS (Digital Asset Standard) API - JSON-RPC format
      // This is the correct way to fetch NFTs on mainnet
      const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
      
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'nft-fetch',
          method: 'getAssetsByOwner',
          params: {
            ownerAddress: publicKey.toBase58(),
            page: 1, // Page must be >= 1
            limit: 1000, // Maximum items per page
            displayOptions: {
              showFungible: false, // Only NFTs, not tokens
              showNativeBalance: false,
              showInscription: true,
            },
          },
        }),
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Helius API error:', response.status, response.statusText)
        console.error('❌ Error details:', errorText)
        throw new Error(`Helius API error: ${response.status} ${response.statusText}`)
      }

      const jsonResponse = await response.json()
      console.log('📦 Helius API response:', jsonResponse)
      
      // Check for JSON-RPC errors
      if (jsonResponse.error) {
        console.error('❌ Helius JSON-RPC error:', jsonResponse.error)
        throw new Error(`Helius API error: ${jsonResponse.error.message || 'Unknown error'}`)
      }
      
      // Extract the result array from JSON-RPC response
      const result = jsonResponse.result
      if (!result) {
        console.warn('⚠️ No result in response')
        setNfts([])
        return
      }
      
      // The result contains an 'items' array
      const nftsArray = result.items || []
      
      if (!Array.isArray(nftsArray) || nftsArray.length === 0) {
        console.warn('⚠️ No NFTs found in wallet. Total items:', result.total || 0)
        setNfts([])
        return
      }
      
      console.log('📊 Processing', nftsArray.length, 'NFTs out of', result.total || nftsArray.length, 'total items...')

      // Log interface types for debugging
      const interfaceTypes = new Set()
      nftsArray.forEach((nft) => {
        if (nft.interface) interfaceTypes.add(nft.interface)
        if (nft.compression?.compressed) interfaceTypes.add('COMPRESSED')
      })
      console.log('🔍 Found interface types:', Array.from(interfaceTypes))

      // Transform Helius DAS API NFT data to our format
      const nftMetadata = nftsArray
        .filter((nft) => {
          // Only include NFTs (not fungible tokens)
          // DAS API returns both NFTs and tokens, filter for NFTs only
          // Include regular NFTs and compressed NFTs (cNFTs)
          const isRegularNFT = nft.interface === 'V1_NFT' || nft.interface === 'V1_PRINT' || nft.interface === 'V1_NFT_EDITION'
          const isCompressedNFT = nft.compression?.compressed === true
          
          // Also check if it has NFT-like properties (id, content, etc.) even if interface is different
          const hasNFTProperties = nft.id && (nft.content || nft.metadata)
          const isFungible = nft.interface?.includes('FUNGIBLE') || nft.interface === 'V1_FUNGIBLE'
          
          const shouldInclude = isRegularNFT || isCompressedNFT || (hasNFTProperties && !isFungible)
          
          if (!shouldInclude && nft.id) {
            console.log(`⚠️ Filtered out item:`, {
              id: nft.id?.substring(0, 8) + '...',
              interface: nft.interface,
              compressed: nft.compression?.compressed,
              name: nft.content?.metadata?.name || nft.name
            })
          }
          
          return shouldInclude
        })
        .map((nft) => {
          // Helius DAS API format: { id, content: { metadata, files }, grouping, etc. }
          const mint = nft.id || nft.mint
          const content = nft.content || {}
          const metadata = content.metadata || {}
          const files = content.files || []
          
          // Get image from various possible locations
          let image = null
          if (files && files.length > 0) {
            // Prioritize cdn_uri over uri for better performance
            image = files[0].cdn_uri || files[0].uri || files[0].image
          }
          if (!image && content.links) {
            image = content.links.image || content.links.thumbnail
          }
          if (!image) {
            image = nft.image || content.uri || metadata.image
          }
          
          // Convert IPFS URLs to HTTP gateway URLs
          if (image) {
            image = convertIPFSToHTTP(image) || image
          }
          
          // Get collection name from grouping
          let collection = ''
          if (nft.grouping && nft.grouping.length > 0) {
            const collectionGroup = nft.grouping.find((g) => g.group_key === 'collection')
            if (collectionGroup) {
              collection = collectionGroup.group_value || ''
            }
          }
          if (!collection && metadata.collection) {
            collection = metadata.collection.name || metadata.collection
          }
          
          return {
            mint: mint,
            name: metadata.name || nft.name || mint.substring(0, 8) + '...',
            image: image || null,
            uri: content.uri || metadata.uri || null,
            symbol: metadata.symbol || '',
            collection: collection,
            attributes: metadata.attributes || []
          }
        })
        .filter((nft) => nft && nft.mint) // Filter out invalid entries

      console.log(`✅ Found ${nftMetadata.length} NFTs for wallet ${walletAddress}`)
      setNfts(nftMetadata)
    } catch (err) {
      console.error('Error fetching wallet NFTs:', err)
      setError(err.message || 'Failed to fetch NFTs')
      setNfts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWalletNFTs()
  }, [walletAddress])

  return {
    nfts,
    loading,
    error,
    refetch: fetchWalletNFTs
  }
}

