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
      const isNFTMint = typeof image === 'string' && 
                       image.length >= 32 && 
                       image.length <= 44 && 
                       !image.includes('/') &&
                       !image.includes('.');

      console.log('🖼️ JackpotImage - Checking image:', {
        image,
        isNFTMint,
        length: image?.length,
        hasSlash: image?.includes('/'),
        hasDot: image?.includes('.')
      });

      if (isNFTMint) {
        // It's an NFT mint address, fetch metadata
        try {
          setLoading(true);
          console.log('🔍 Fetching NFT metadata for mint:', image);
          const metadata = await fetchNFTMetadata(image);
          console.log('📦 NFT metadata received:', metadata);
          if (metadata && metadata.image) {
            // Convert IPFS URLs to HTTP gateway URLs if needed
            let finalImageUrl = metadata.image;
            if (finalImageUrl.startsWith('ipfs://')) {
              finalImageUrl = finalImageUrl.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
            } else if (finalImageUrl.startsWith('ipfs/')) {
              finalImageUrl = finalImageUrl.replace('ipfs/', 'https://gateway.pinata.cloud/ipfs/');
            } else if (finalImageUrl.startsWith('Qm') && finalImageUrl.length === 46 && !finalImageUrl.includes('/')) {
              // If it's just a CID (Qm...), prepend gateway URL
              finalImageUrl = `https://gateway.pinata.cloud/ipfs/${finalImageUrl}`;
            }
            setImageUrl(finalImageUrl);
            setError(false);
          } else {
            // NFT metadata not found or no image
            console.warn('⚠️ NFT metadata missing image:', metadata);
            setImageUrl(null); // No placeholder for NFTs - only show real images
            setError(true);
          }
        } catch (err) {
          console.error('❌ Error fetching NFT metadata:', err);
          setImageUrl(null); // No placeholder for NFTs - only show real images
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

  // For NFTs, don't use fallback - only show real images
  const finalSrc = isNFTMint ? (imageUrl || null) : (imageUrl || fallbackSrc);
  
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
        setError(true);
        // For NFTs, don't fallback - hide the image
        if (isNFTMint) {
          e.currentTarget.style.display = 'none';
        } else if (imageUrl !== fallbackSrc && fallbackSrc) {
          setImageUrl(fallbackSrc);
        }
      }}
    />
  );
}

