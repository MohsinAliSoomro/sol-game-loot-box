"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { fetchNFTMetadata } from "@/lib/nft-metadata";

interface JackpotImageProps {
  image: string | null;
  name?: string;
  width?: number;
  height?: number;
  className?: string;
  fallbackSrc?: string;
}

/**
 * Component to display jackpot image
 * Handles both regular image files and NFT mint addresses
 */
export default function JackpotImage({ 
  image, 
  name = "Jackpot", 
  width = 200, 
  height = 200,
  className = "",
  fallbackSrc = "/coin.png"
}: JackpotImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      if (!image) {
        setImageUrl(fallbackSrc);
        setLoading(false);
        return;
      }

      // Check if it's an NFT mint address (not a file path)
      // Solana addresses are base58 encoded, typically 32-44 characters
      // They don't contain slashes, dots, or colons (unless it's a URL)
      const isNFTMint = typeof image === 'string' && 
                       image.length >= 32 && 
                       image.length <= 44 && 
                       !image.includes('/') &&
                       !image.includes('.') &&
                       !image.includes(':') &&
                       !image.startsWith('http') &&
                       !image.startsWith('data:') &&
                       /^[A-Za-z0-9]+$/.test(image); // Base58 characters only

      console.log('🖼️ JackpotImage - Checking image:', {
        image,
        isNFTMint,
        length: image?.length,
        hasSlash: image?.includes('/'),
        hasDot: image?.includes('.')
      });

      if (isNFTMint) {
        // It's an NFT mint address, fetch metadata
        // Retry logic for better reliability
        const fetchWithRetry = async (retries = 3): Promise<any> => {
          for (let i = 0; i < retries; i++) {
            try {
              console.log(`🔍 Fetching NFT metadata for mint (attempt ${i + 1}/${retries}):`, image);
              
              // Increased timeout to 20 seconds for NFT metadata
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('NFT metadata fetch timeout')), 20000)
              );
              
              const metadata = await Promise.race([
                fetchNFTMetadata(image),
                timeoutPromise
              ]) as any;
              
              return metadata;
            } catch (err: any) {
              console.warn(`⚠️ Attempt ${i + 1} failed:`, err?.message);
              if (i === retries - 1) throw err;
              // Wait before retry (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
          }
        };
        
        try {
          setLoading(true);
          setError(false);
          
          const metadata = await fetchWithRetry(3);
          console.log('📦 NFT metadata received:', metadata);
          
          if (metadata && metadata.image) {
            // Convert IPFS URLs to HTTP gateway URLs if needed
            let finalImageUrl = metadata.image;
            console.log('🖼️ Original image URL from metadata:', finalImageUrl);
            
            if (finalImageUrl.startsWith('ipfs://')) {
              finalImageUrl = finalImageUrl.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
              console.log('🔄 Converted ipfs:// to:', finalImageUrl);
            } else if (finalImageUrl.startsWith('ipfs/')) {
              finalImageUrl = finalImageUrl.replace('ipfs/', 'https://gateway.pinata.cloud/ipfs/');
              console.log('🔄 Converted ipfs/ to:', finalImageUrl);
            } else if (finalImageUrl.startsWith('Qm') && finalImageUrl.length === 46 && !finalImageUrl.includes('/') && !finalImageUrl.includes('http')) {
              // If it's just a CID (Qm...), prepend gateway URL
              finalImageUrl = `https://gateway.pinata.cloud/ipfs/${finalImageUrl}`;
              console.log('🔄 Converted CID to:', finalImageUrl);
            }
            
            // Try multiple IPFS gateways for better reliability
            if (finalImageUrl.includes('ipfs') || finalImageUrl.startsWith('Qm')) {
              // Extract CID from URL
              const cidMatch = finalImageUrl.match(/(Qm[a-zA-Z0-9]{44})/);
              if (cidMatch) {
                const cid = cidMatch[1];
                // Try primary gateway first
                finalImageUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
                console.log('✅ Using IPFS gateway:', finalImageUrl);
              }
            }
            
            console.log('✅ Final image URL:', finalImageUrl);
            setImageUrl(finalImageUrl);
            setError(false);
          } else {
            // NFT metadata not found or no image
            console.error('❌ NFT metadata missing image. Metadata:', metadata);
            console.error('❌ Mint address:', image);
            // For NFTs, don't use fallback - show error state
            setImageUrl(null);
            setError(true);
          }
        } catch (err: any) {
          console.error('❌ Error fetching NFT metadata after retries:', err);
          console.error('❌ Error details:', {
            message: err?.message,
            stack: err?.stack,
            mint: image
          });
          
          // For NFTs, don't use fallback - show error state so user knows it failed
          setImageUrl(null);
          setError(true);
        } finally {
          setLoading(false);
        }
      } else {
        // It's a file path
        // Check if it's a full URL or a relative path
        if (image.startsWith('http://') || image.startsWith('https://')) {
          setImageUrl(image);
        } else if (image.startsWith('/')) {
          setImageUrl(image);
        } else {
          // It's a Supabase storage path
          setImageUrl(`https://zkltmkbmzxvfovsgotpt.supabase.co/storage/v1/object/public/apes-bucket/${image}`);
        }
        setLoading(false);
      }
    };

    loadImage();
  }, [image, fallbackSrc]);

  if (loading) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`} style={{ width, height }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // Use unoptimized for IPFS and external URLs to avoid Next.js optimization issues
  const isExternalUrl = imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'));
  const isIPFS = imageUrl && (imageUrl.includes('ipfs') || imageUrl.includes('gateway.pinata.cloud') || imageUrl.includes('ipfs.io'));
  
  // Don't render image if no URL (for NFTs without images)
  if (!imageUrl && !fallbackSrc) {
    return null;
  }

  // Check if it's an NFT mint (no fallback for NFTs)
  const isNFTMint = typeof image === 'string' && 
                   image && image.length >= 32 && 
                   image.length <= 44 && 
                   !image.includes('/') &&
                   !image.includes('.');

  // For NFTs, ONLY use the fetched imageUrl - no fallback
  // This ensures we show the real NFT image or nothing (not a placeholder)
  const finalSrc = isNFTMint 
    ? imageUrl  // Only show real NFT image, no fallback
    : (imageUrl || fallbackSrc);
  
  // For NFTs, show loading state while fetching, or error if failed
  if (isNFTMint) {
    if (loading) {
      return (
        <div className={`bg-gray-100 flex items-center justify-center ${className}`} style={{ width, height }}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      );
    }
    
    if (error || !finalSrc) {
      // Show error state for NFTs - don't use fallback
      return (
        <div className={`bg-gray-200 flex flex-col items-center justify-center ${className}`} style={{ width, height }}>
          <span className="text-gray-400 text-xs mb-1">NFT Image</span>
          <span className="text-gray-300 text-xs">Loading...</span>
        </div>
      );
    }
  }
  
  if (!finalSrc && !isNFTMint) {
    // Only show placeholder for non-NFT images
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`} style={{ width, height }}>
        <span className="text-gray-400 text-sm">No Image</span>
      </div>
    );
  }

  if (!finalSrc) {
    return null;
  }

  return (
    <Image
      src={finalSrc}
      alt={name}
      width={width}
      height={height}
      className={className}
      unoptimized={!!(isExternalUrl || isIPFS)} // Disable optimization for external/IPFS images
      onError={(e) => {
        console.error('❌ Jackpot image failed to load:', imageUrl);
        console.error('❌ Error details:', e);
        console.error('❌ Is NFT mint:', isNFTMint);
        
        setError(true);
        
        // For NFTs, try alternative IPFS gateways
        if (isNFTMint && imageUrl) {
          const cidMatch = imageUrl.match(/(Qm[a-zA-Z0-9]{44})/);
          if (cidMatch) {
            const cid = cidMatch[1];
            const alternativeGateways = [
              'https://ipfs.io/ipfs/',
              'https://cloudflare-ipfs.com/ipfs/',
              'https://dweb.link/ipfs/',
              'https://gateway.ipfs.io/ipfs/'
            ];
            
            // Try next gateway
            const currentGateway = imageUrl.match(/https?:\/\/([^\/]+)/)?.[0];
            const currentIndex = alternativeGateways.findIndex(gw => imageUrl.includes(gw.replace('https://', '').split('/')[0]));
            const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % alternativeGateways.length : 0;
            const nextGateway = alternativeGateways[nextIndex];
            const newUrl = `${nextGateway}${cid}`;
            
            console.log(`🔄 Trying alternative IPFS gateway: ${newUrl}`);
            setImageUrl(newUrl);
            return; // Don't hide, try alternative gateway
          }
        }
        
        // For non-NFTs, try fallback image
        if (!isNFTMint && imageUrl !== fallbackSrc && fallbackSrc) {
          console.log('🔄 Attempting to use fallback image:', fallbackSrc);
          setImageUrl(fallbackSrc);
        } else {
          // If no fallback or NFT, hide the image
          e.currentTarget.style.display = 'none';
        }
      }}
    />
  );
}

