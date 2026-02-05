"use client";

import { useState, useEffect } from 'react';
import { useProjectJackpotPools } from '@/lib/hooks/useProjectJackpotPools';
import { useWalletNFTs } from '@/lib/hooks/useWalletNFTs';
import { useAdminWallet } from '@/lib/hooks/useAdminWallet';
import { fetchNFTMetadata } from '@/lib/fetchNFTMetadata';
import { supabase } from '@/service/supabase';
import { useProject } from '@/lib/project-context';
import { convertIPFSToHTTP } from '@/lib/utils/ipfs';

export default function JackpotSettings() {
  const { getProjectId, getProjectTokenSymbol } = useProject();
  const tokenSymbol = getProjectTokenSymbol();
  const projectId = getProjectId();
  const { jackpots, loading, error, addJackpot, updateJackpot, deleteJackpot, getUsedNFTMints, getLootboxNFTMints, getCartNFTMints, checkNFTExists } = useProjectJackpotPools();
  const [showModal, setShowModal] = useState(false);
  const [editingJackpot, setEditingJackpot] = useState<any>(null);
  
  const initialFormState = { 
    name: '', 
    title: '', 
    description: '', 
    timer: '', 
    ticketSold: 0, 
    price: '', 
    maxTickets: 1000,
    endTime: '',
    isActive: true,
    image: null as File | string | null,
    nftMintAddress: null,
    itemPrice: '' // Price in tokens for item rewards
  };
  const [formData, setFormData] = useState(initialFormState);
  const [selectedNFT, setSelectedNFT] = useState<any>(null);
  const [depositType, setDepositType] = useState<'image' | 'nft'>('image');
  const [usedNFTMints, setUsedNFTMints] = useState<string[]>([]);
  const [lootboxNFTMints, setLootboxNFTMints] = useState<string[]>([]);
  const [cartNFTMints, setCartNFTMints] = useState<string[]>([]);
  const [jackpotNFTImages, setJackpotNFTImages] = useState<Record<string, string>>({});
  
  // Get admin wallet address from database
  const { adminWalletAddress, loading: adminWalletLoading, error: adminWalletError, refreshAdminWallet } = useAdminWallet();
  
  // Fetch NFTs from admin wallet
  const { nfts: walletNFTs, loading: nftsLoading, refetch: refetchWalletNFTs } = useWalletNFTs(adminWalletAddress);

  // Fetch used NFT mints when jackpots change or component mounts
  useEffect(() => {
    const fetchUsedNFTs = async () => {
      try {
        const [usedMints, lootboxMints, cartMints] = await Promise.all([
          getUsedNFTMints(),
          getLootboxNFTMints(),
          getCartNFTMints()
        ]);
        setUsedNFTMints(usedMints);
        setLootboxNFTMints(lootboxMints);
        setCartNFTMints(cartMints);
      } catch (error) {
        console.error('Error fetching used NFT mints:', error);
      }
    };
    
    fetchUsedNFTs();
  }, [jackpots, getUsedNFTMints, getLootboxNFTMints, getCartNFTMints]);

  // Fetch NFT images for jackpots that have NFT mint addresses
  useEffect(() => {
    const fetchNFTImages = async () => {
      const imageCache: Record<string, string> = { ...jackpotNFTImages }; // Preserve existing cache
      
      console.log('🔄 Fetching NFT images for', jackpots.length, 'jackpots. Wallet NFTs:', walletNFTs.length);
      
      for (const jackpot of jackpots) {
        if (jackpot.image) {
          const isNFTMint = typeof jackpot.image === 'string' && 
                           jackpot.image.length >= 32 && 
                           jackpot.image.length <= 44 && 
                           !jackpot.image.includes('/') &&
                           !jackpot.image.includes('.');
          
          if (isNFTMint) {
            // Only fetch if not already cached
            if (!imageCache[jackpot.image]) {
              // First, try to find the NFT in wallet NFTs (they already have images from Helius)
              console.log('🔍 Looking for NFT in wallet:', jackpot.image);
              console.log('📊 Wallet NFTs count:', walletNFTs.length);
              if (walletNFTs.length > 0) {
                console.log('📋 Wallet NFT mints:', walletNFTs.map((nft: any) => nft.mint).slice(0, 5));
              }
              
              const walletNFT = walletNFTs.find((nft: any) => nft.mint === jackpot.image);
              
              if (walletNFT) {
                console.log('📦 Found wallet NFT:', {
                  mint: walletNFT.mint,
                  name: walletNFT.name,
                  hasImage: !!walletNFT.image,
                  imageValue: walletNFT.image
                });
                
                if (walletNFT.image) {
                  // Use the image from wallet NFT (already converted from Helius)
                  // The image from Helius should already be a valid HTTP URL, but convert IPFS just in case
                  let finalImage = walletNFT.image;
                  
                  // Only convert if it's an IPFS URL, otherwise use as-is (Helius already provides HTTP URLs)
                  if (finalImage && !finalImage.startsWith('http://') && !finalImage.startsWith('https://')) {
                    finalImage = convertIPFSToHTTP(finalImage) || finalImage;
                  }
                  
                  console.log('🖼️ Wallet NFT image (original):', walletNFT.image);
                  console.log('🖼️ Wallet NFT image (final):', finalImage);
                  
                  if (finalImage && (finalImage.startsWith('http://') || finalImage.startsWith('https://'))) {
                    imageCache[jackpot.image] = finalImage;
                    console.log('✅ Cached wallet NFT image for', jackpot.image, ':', finalImage);
                  } else {
                    console.warn('⚠️ Invalid wallet NFT image URL:', finalImage);
                    console.warn('⚠️ Original image value:', walletNFT.image);
                  }
                } else {
                  console.warn('⚠️ Wallet NFT found but has no image property');
                  console.warn('⚠️ Wallet NFT object:', JSON.stringify(walletNFT, null, 2));
                }
              } else {
                console.log('⚠️ NFT not found in wallet NFTs, will fetch from metadata');
                // Fall back to fetching metadata
                try {
                  console.log('🖼️ Fetching NFT image for jackpot:', jackpot.image);
              const metadata = await fetchNFTMetadata(jackpot.image);
                  console.log('📦 Metadata received for', jackpot.image, ':', {
                    hasMetadata: !!metadata,
                    hasImage: !!(metadata?.image),
                    imageValue: metadata?.image,
                    name: metadata?.name
                  });
                  
              if (metadata && metadata.image) {
                    // Convert IPFS URLs to HTTP gateway URLs
                    const convertedImage = convertIPFSToHTTP(metadata.image) || metadata.image;
                    
                    // Validate the converted image URL
                    if (convertedImage && (convertedImage.startsWith('http://') || convertedImage.startsWith('https://'))) {
                      imageCache[jackpot.image] = convertedImage;
                      console.log('✅ Cached NFT image for', jackpot.image, ':', convertedImage);
                    } else {
                      console.warn('⚠️ Invalid image URL after conversion:', convertedImage, 'for mint:', jackpot.image);
              }
                  } else {
                    console.warn('⚠️ No image found in metadata for:', jackpot.image);
                    console.warn('⚠️ Full metadata object:', JSON.stringify(metadata, null, 2));
                  }
                } catch (error: any) {
                  console.error('❌ Error fetching NFT image for', jackpot.image, error);
                  console.error('❌ Error details:', error?.message, error?.stack);
            }
          }
            } else {
              console.log('✅ Using cached image for', jackpot.image, ':', imageCache[jackpot.image]);
            }
          }
        }
      }
      
      console.log('📊 Final image cache:', Object.keys(imageCache).length, 'images');
      setJackpotNFTImages(imageCache);
    };
    
    if (jackpots.length > 0) {
      fetchNFTImages();
    }
  }, [jackpots, walletNFTs]);

  const getJackpotImageUrl = (jackpot: any) => {
    if (!jackpot.image) return null;
    
    // Check if it's already a valid HTTP URL (image URL stored directly)
    if (typeof jackpot.image === 'string' && 
        (jackpot.image.startsWith('http://') || jackpot.image.startsWith('https://'))) {
      // It's already an image URL, use it directly
      return convertIPFSToHTTP(jackpot.image) || jackpot.image;
    }
    
    // Check if it's an NFT mint address
    const isNFTMint = typeof jackpot.image === 'string' && 
                     jackpot.image.length >= 32 && 
                     jackpot.image.length <= 44 && 
                     !jackpot.image.includes('/') &&
                     !jackpot.image.includes('.');
    
    if (isNFTMint) {
      const cachedImage = jackpotNFTImages[jackpot.image];
      // Convert IPFS URLs if needed (as a safety measure)
      if (cachedImage) {
        const finalUrl = convertIPFSToHTTP(cachedImage) || cachedImage;
        // Validate URL
        if (finalUrl && (finalUrl.startsWith('http://') || finalUrl.startsWith('https://'))) {
          return finalUrl;
    }
        console.warn('⚠️ Invalid cached image URL for', jackpot.image, ':', finalUrl);
      }
      // Return null if not cached yet - will show placeholder
      return null;
    }
    
    // For regular images (Supabase storage paths), construct the full URL
    const imagePath = `https://zkltmkbmzxvfovsgotpt.supabase.co/storage/v1/object/public/apes-bucket/${jackpot.image}`;
    return convertIPFSToHTTP(imagePath) || imagePath;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData(prev => ({ ...prev, image: file }));
  };
  
  const formatDateTimeLocal = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const convertToISO = (datetimeLocal: string) => {
    if (!datetimeLocal) return null;
    const [datePart, timePart] = datetimeLocal.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    return localDate.toISOString();
  };

  const resetAndShowModal = async (jackpot: any = null) => {
    if (refetchWalletNFTs) {
      await refetchWalletNFTs();
    }
    
    try {
      const [usedMints, lootboxMints, cartMints] = await Promise.all([
        getUsedNFTMints(),
        getLootboxNFTMints(),
        getCartNFTMints()
      ]);
      setUsedNFTMints(usedMints);
      setLootboxNFTMints(lootboxMints);
      setCartNFTMints(cartMints);
    } catch (error) {
      console.error('Error fetching used NFT mints:', error);
    }
    
    if (jackpot) {
      setEditingJackpot(jackpot);
      const formDataWithLocalTime = {
        ...jackpot,
        endTime: jackpot.endTime ? formatDateTimeLocal(jackpot.endTime) : '',
        itemPrice: jackpot.itemPrice || '' // Load item_price when editing
      };
      setFormData(formDataWithLocalTime);
      if (jackpot.image && typeof jackpot.image === 'string' && 
          jackpot.image.length >= 32 && jackpot.image.length <= 44 && 
          !jackpot.image.includes('/') && !jackpot.image.includes('.')) {
        setTimeout(() => {
          const matchingNFT = walletNFTs.find((nft: any) => nft.mint === jackpot.image);
          if (matchingNFT) {
            setSelectedNFT(matchingNFT);
            setDepositType('nft');
          }
        }, 500);
      }
    } else {
      setEditingJackpot(null);
      setFormData(initialFormState);
      setSelectedNFT(null);
      setDepositType('image');
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (depositType === 'nft') {
      if (!selectedNFT) {
        alert('Please select an NFT from your wallet');
        return;
      }

      const isUsedInJackpot = usedNFTMints.includes(selectedNFT.mint);
      if (isUsedInJackpot) {
        const currentJackpotImage = editingJackpot?.image;
        if (!editingJackpot || currentJackpotImage !== selectedNFT.mint) {
          alert('This NFT is already added to another jackpot. Please select a different NFT.');
          return;
        }
      }

      if (lootboxNFTMints.includes(selectedNFT.mint)) {
        alert('This NFT is already added to a lootbox. Please select a different NFT.');
        return;
      }

      if (cartNFTMints.includes(selectedNFT.mint)) {
        alert('This NFT is currently in a user\'s cart (won but not yet claimed). It cannot be added to a jackpot until the user claims it.');
        return;
      }

      try {
        const excludeJackpotId = editingJackpot ? editingJackpot.id : null;
        const exists = await checkNFTExists(selectedNFT.mint, excludeJackpotId);
        if (exists) {
          alert('This NFT is already added to another jackpot. Please select a different NFT.');
          return;
        }
        
        // Double-check cart status with project_id
        if (projectId) {
          const { data: cartData, error: cartError } = await supabase
            .from('prizeWin')
            .select('id, userId, isWithdraw, reward_type')
            .eq('mint', selectedNFT.mint)
            .eq('isWithdraw', false)
            .eq('reward_type', 'nft')
            .eq('project_id', projectId)
            .limit(1);
          
          if (!cartError && cartData && cartData.length > 0) {
            alert('This NFT is currently in a user\'s cart (won but not yet claimed). It cannot be added to a jackpot until the user claims it.');
            return;
          }
        }
      } catch (error) {
        console.error('Error checking NFT:', error);
      }

      formData.name = selectedNFT.name;
      formData.title = selectedNFT.name;
      formData.nftMintAddress = selectedNFT.mint;
      // Store the actual image URL instead of mint address
      // The image URL is already converted from IPFS by useWalletNFTs
      if (selectedNFT.image) {
        let imageUrl = selectedNFT.image;
        // Ensure it's a valid HTTP URL
        if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
          imageUrl = convertIPFSToHTTP(imageUrl) || imageUrl;
        }
        formData.image = imageUrl.startsWith('http://') || imageUrl.startsWith('https://') 
          ? imageUrl 
          : selectedNFT.mint; // Fallback to mint if URL is invalid
      } else {
        formData.image = selectedNFT.mint; // Fallback to mint if no image
      }
    } else {
      if (!formData.name.trim()) {
        alert('Please enter a jackpot name');
        return;
      }
    }

    if (!formData.description.trim()) {
      alert('Please enter a description');
      return;
    }
    if (!formData.price || Number(formData.price) <= 0) {
      alert('Please enter a valid ticket price');
      return;
    }
    if (!formData.maxTickets || formData.maxTickets <= 0) {
      alert('Please enter a valid maximum tickets number');
      return;
    }
    
    try {
      const formDataToSave = {
        ...formData,
        endTime: formData.endTime ? convertToISO(formData.endTime) : null
      };

      if (editingJackpot) {
        await updateJackpot(editingJackpot.id, formDataToSave);
      } else {
        await addJackpot(formDataToSave);
      }
      // Capture NFT image before clearing selectedNFT
      const nftImageToCache = depositType === 'nft' && formData.image && selectedNFT?.image 
        ? selectedNFT.image 
        : null;
      const nftMintToCache = depositType === 'nft' && formData.image 
        ? formData.image 
        : null;
      
      setShowModal(false);
      setFormData(initialFormState);
      setEditingJackpot(null);
      setSelectedNFT(null);
      setDepositType('image');
      const [usedMints, lootboxMints] = await Promise.all([
        getUsedNFTMints(),
        getLootboxNFTMints()
      ]);
      setUsedNFTMints(usedMints);
      setLootboxNFTMints(lootboxMints);
      await refreshAdminWallet();
      
      // If we added an NFT jackpot, use the selected NFT's image immediately
      if (nftMintToCache && nftImageToCache) {
        const isNFTMint = typeof nftMintToCache === 'string' && 
                         nftMintToCache.length >= 32 && 
                         nftMintToCache.length <= 44 && 
                         !nftMintToCache.includes('/') &&
                         !nftMintToCache.includes('.');
        
        if (isNFTMint) {
          console.log('💾 Caching image for newly added NFT jackpot:', {
            mint: nftMintToCache,
            originalImage: nftImageToCache
          });
          
          // Use the image from the selected NFT (already has image from Helius)
          let finalImage = nftImageToCache;
          
          // Only convert if it's an IPFS URL, otherwise use as-is (Helius already provides HTTP URLs)
          if (finalImage && !finalImage.startsWith('http://') && !finalImage.startsWith('https://')) {
            finalImage = convertIPFSToHTTP(finalImage) || finalImage;
          }
          
          console.log('🖼️ Final image URL for new jackpot:', finalImage);
          
          if (finalImage && (finalImage.startsWith('http://') || finalImage.startsWith('https://'))) {
            setJackpotNFTImages(prev => {
              const updated = {
                ...prev,
                [nftMintToCache]: finalImage
              };
              console.log('✅ Updated image cache. New cache keys:', Object.keys(updated));
              return updated;
            });
            console.log('✅ Cached new NFT image from selected NFT:', finalImage);
          } else {
            console.warn('⚠️ Invalid image URL for new jackpot:', finalImage);
            // Fall back to fetching metadata
            try {
              console.log('🖼️ Fetching image for newly added NFT jackpot:', nftMintToCache);
              const metadata = await fetchNFTMetadata(nftMintToCache);
              
              if (metadata && metadata.image) {
                const fallbackImage = convertIPFSToHTTP(metadata.image) || metadata.image;
                if (fallbackImage && (fallbackImage.startsWith('http://') || fallbackImage.startsWith('https://'))) {
                  setJackpotNFTImages(prev => ({
                    ...prev,
                    [nftMintToCache]: fallbackImage
                  }));
                  console.log('✅ Cached new NFT image from metadata:', fallbackImage);
                }
              }
            } catch (error: any) {
              console.error('❌ Error fetching image for new NFT jackpot:', error);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error saving jackpot:', error);
      alert(error.message || 'Error saving jackpot. Please try again.');
    }
  };

  const handleDelete = async (jackpotId: number) => {
    if (window.confirm('Are you sure you want to delete this jackpot?')) {
      try {
        await deleteJackpot(jackpotId);
      } catch (error: any) {
        console.error('Error deleting jackpot:', error);
        alert('Error deleting jackpot. Please try again.');
      }
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Jackpot Settings</h1>
          <p className="text-gray-600 mt-1">Manage your jackpots</p>
        </div>
        <button 
          onClick={() => resetAndShowModal()}
          className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          <span>Add Jackpot</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jackpot</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Amount</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket Price</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max Tickets</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Time</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                    <p className="text-gray-500 mt-2">Loading jackpots...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">
                    <p className="text-red-500">Error loading jackpots: {error}</p>
                  </td>
                </tr>
              ) : jackpots.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">
                    <p className="text-gray-500">No jackpots found. Add your first jackpot!</p>
                  </td>
                </tr>
              ) : (
                jackpots.map((jackpot) => (
                  <tr key={jackpot.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden relative">
                          {(() => {
                            const imageUrl = getJackpotImageUrl(jackpot);
                            const isNFTMint = jackpot.image && typeof jackpot.image === 'string' && 
                                             jackpot.image.length >= 32 && 
                                             jackpot.image.length <= 44 && 
                                             !jackpot.image.includes('/') &&
                                             !jackpot.image.includes('.');
                            
                            // Debug logging
                            if (isNFTMint) {
                              const walletNFT = walletNFTs.find((nft: any) => nft.mint === jackpot.image);
                              console.log('🖼️ Admin Panel - Jackpot NFT Image Debug:', {
                                mint: jackpot.image,
                                jackpotName: jackpot.name,
                                walletNFTsCount: walletNFTs.length,
                                walletNFTFound: !!walletNFT,
                                walletNFTImage: walletNFT?.image,
                                cachedImage: jackpotNFTImages[jackpot.image],
                                imageUrl,
                                hasImage: !!imageUrl,
                                imageUrlValue: imageUrl
                              });
                              
                              // If we have a cached image but imageUrl is null, there's a mismatch
                              if (jackpotNFTImages[jackpot.image] && !imageUrl) {
                                console.error('❌ CACHE MISMATCH: Image is cached but getJackpotImageUrl returned null!');
                                console.error('❌ Cached value:', jackpotNFTImages[jackpot.image]);
                              }
                            }
                            
                            if (imageUrl && imageUrl.trim() !== '') {
                              // Validate URL before rendering
                              const isValidUrl = imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('/');
                              
                              if (isValidUrl) {
                              return (
                                  <>
                                <img 
                                  src={imageUrl}
                                      alt={jackpot.name || 'NFT'}
                                  className="w-full h-full object-cover"
                                      loading="lazy"
                                  onError={(e) => {
                                        console.error('❌ Image failed to load:', imageUrl);
                                        console.error('❌ Mint address:', jackpot.image);
                                        console.error('❌ Jackpot name:', jackpot.name);
                                        const imgElement = e.target as HTMLImageElement;
                                        imgElement.style.display = 'none';
                                        const placeholder = imgElement.parentElement?.querySelector('.nft-placeholder') as HTMLElement;
                                        if (placeholder) {
                                          placeholder.style.display = 'flex';
                                        }
                                      }}
                                      onLoad={() => {
                                        console.log('✅ Image loaded successfully:', imageUrl);
                                  }}
                                />
                                    {isNFTMint && (
                                      <div className="nft-placeholder w-full h-full flex items-center justify-center bg-purple-100 absolute inset-0" style={{ display: 'none' }}>
                                        <span className="text-purple-600 text-xs">NFT</span>
                                      </div>
                                    )}
                                  </>
                                );
                              } else {
                                console.warn('⚠️ Invalid image URL format:', imageUrl);
                              }
                            }
                            
                            if (isNFTMint) {
                              // If it's an NFT but no image URL yet, show loading state
                              return (
                                <div className="w-full h-full flex items-center justify-center bg-purple-100">
                                  <span className="text-purple-600 text-xs">NFT</span>
                                </div>
                              );
                            }
                            
                            return (
                              <span className="text-gray-500 text-xs">IMG</span>
                            );
                          })()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{jackpot.name}</p>
                          <p className="text-xs text-gray-500">{jackpot.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">${jackpot.currentAmount}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">${jackpot.price}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{jackpot.maxTickets}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{jackpot.timer}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${jackpot.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {jackpot.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-3">
                        <button onClick={() => resetAndShowModal(jackpot)} className="text-gray-400 hover:text-gray-500" title="Edit">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handleDelete(jackpot.id)} className="text-gray-400 hover:text-red-500" title="Delete">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800">{editingJackpot ? 'Edit Jackpot' : 'Add New Jackpot'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex space-x-4 border-b pb-4">
                <button 
                  type="button" 
                  onClick={() => setDepositType('image')} 
                  className={`flex-1 py-2 px-4 rounded-lg border ${depositType === 'image' ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  Add Item
                </button>
                <button 
                  type="button" 
                  onClick={() => setDepositType('nft')} 
                  className={`flex-1 py-2 px-4 rounded-lg border ${depositType === 'nft' ? 'border-purple-500 bg-purple-50 text-purple-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  Select NFT Prize
                </button>
              </div>

              {depositType === 'image' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input type="text" name="title" value={formData.title} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500" required />
                  </div>
                </>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500" rows={3} required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Price</label>
                  <input type="number" name="price" value={formData.price} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500" required />
                  <p className="text-xs text-gray-500 mt-1">Price users pay to buy a ticket</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Tickets</label>
                  <input type="number" name="maxTickets" value={formData.maxTickets} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500" required />
                </div>
              </div>
              
              {depositType === 'image' && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Winner Prize Amount ({tokenSymbol}/Tokens) *
                  </label>
                  <input 
                    type="number" 
                    name="itemPrice" 
                    value={formData.itemPrice} 
                    onChange={handleInputChange} 
                    className="w-full px-4 py-2 border border-orange-300 rounded-lg focus:outline-none focus:border-orange-500 " 
                    placeholder="e.g., 100"
                    min="0"
                    step="0.01"
                    required
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    <strong>This is the reward amount the winner will receive.</strong> When a user wins this jackpot, they will get this amount credited to their balance in {tokenSymbol} tokens.
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input type="datetime-local" name="endTime" value={formData.endTime} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500" />
              </div>
              
              <div>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" name="isActive" checked={formData.isActive} onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))} className="rounded border-gray-300" />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
              </div>
              
              {depositType === 'image' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item Image</label>
                  <input type="file" onChange={handleImageChange} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500" accept="image/*" />
                </div>
              ) : (
                <div>
                  {adminWalletLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                      <p className="text-gray-500 mt-2">Loading admin wallet from database...</p>
                    </div>
                  ) : adminWalletError ? (
                    <div className="bg-red-50 p-4 rounded-lg">
                      <p className="text-sm text-red-700 mb-2">Error loading admin wallet: {adminWalletError}</p>
                      <button
                        onClick={refreshAdminWallet}
                        className="text-sm text-red-600 underline hover:text-red-800"
                      >
                        Retry
                      </button>
                    </div>
                  ) : !adminWalletAddress ? (
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-700 mb-2">⚠️ No admin wallet found in database.</p>
                      <p className="text-xs text-gray-600 mb-2">Please set the admin private key in Website Settings first.</p>
                      <button
                        onClick={refreshAdminWallet}
                        className="text-sm text-orange-600 underline hover:text-orange-800"
                      >
                        Refresh
                      </button>
                    </div>
                  ) : nftsLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                      <p className="text-gray-500 mt-2">Loading NFTs from wallet...</p>
                    </div>
                  ) : walletNFTs.length === 0 ? (
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                      <p className="text-gray-600">❌ No NFTs available in your wallet.</p>
                      <p className="text-sm text-gray-500 mt-1">Please add NFTs to your wallet first.</p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select NFT Prize from Wallet</label>
                      <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
                        {walletNFTs
                          .filter((nft: any) => !cartNFTMints.includes(nft.mint))
                          .map((nft: any) => {
                            const isUsedInJackpot = usedNFTMints.includes(nft.mint);
                            const isUsedInLootbox = lootboxNFTMints.includes(nft.mint);
                            const isCurrentJackpotNFT = editingJackpot && editingJackpot.image === nft.mint;
                            const canSelect = (!isUsedInJackpot || isCurrentJackpotNFT) && !isUsedInLootbox;

                            return (
                              <div
                                key={nft.mint}
                                onClick={() => {
                                  if (canSelect) {
                                    setSelectedNFT(nft);
                                    setFormData(prev => ({ ...prev, nftMintAddress: nft.mint }));
                                  }
                                }}
                                className={`relative border-2 rounded-lg p-2 transition-all ${
                                  !canSelect
                                    ? 'cursor-not-allowed opacity-50 border-gray-200 bg-gray-100'
                                    : selectedNFT?.mint === nft.mint
                                    ? 'cursor-pointer border-purple-500 bg-purple-50'
                                    : 'cursor-pointer border-gray-200 hover:border-purple-300'
                                }`}
                                title={!canSelect ? (isUsedInLootbox ? 'This NFT is already used in a lootbox' : 'This NFT is already used in another jackpot') : ''}
                              >
                                {isUsedInLootbox && (
                                  <div className="absolute top-1 right-1 bg-orange-500 text-white text-xs px-2 py-1 rounded-full z-10">
                                    In Lootbox
                                  </div>
                                )}
                                {isUsedInJackpot && !isCurrentJackpotNFT && !isUsedInLootbox && (
                                  <div className="absolute top-1 right-1 bg-red-500 text-white text-xs px-2 py-1 rounded-full z-10">
                                    Used
                                  </div>
                                )}
                                {isCurrentJackpotNFT && (
                                  <div className="absolute top-1 right-1 bg-green-500 text-white text-xs px-2 py-1 rounded-full z-10">
                                    Current
                                  </div>
                                )}
                                <div className="w-full aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2">
                                  {nft.image ? (
                                    <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                                <p className="text-xs font-medium text-gray-900 truncate">{nft.name}</p>
                                <p className="text-xs text-gray-500 truncate">{nft.mint.substring(0, 8)}...</p>
                              </div>
                            );
                          })}
                      </div>
                      {selectedNFT && (
                        <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                          <p className="text-sm font-medium text-gray-700">✅ Selected: {selectedNFT.name}</p>
                          <p className="text-xs text-gray-500 break-all">{selectedNFT.mint}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">{editingJackpot ? 'Save Changes' : 'Add Jackpot'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

