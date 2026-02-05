import { useState, useEffect } from 'react';
import { useJackpotPools } from '../hooks/useJackpotPools';
import { useWalletNFTs } from '../hooks/useWalletNFTs';
import { useAdminWallet } from '../hooks/useAdminWallet';
import { fetchNFTMetadata } from '../utils/fetchNFTMetadata';
import { convertIPFSToHTTP } from '../utils/ipfs';

function JackpotSettings() {
  const { jackpots, loading, error, addJackpot, updateJackpot, deleteJackpot, getUsedNFTMints, getLootboxNFTMints, getCartNFTMints, checkNFTExists } = useJackpotPools();
  const [showModal, setShowModal] = useState(false);
  const [editingJackpot, setEditingJackpot] = useState(null);
  
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
    image: null,
    nftMintAddress: null,
    itemPrice: 0
  };
  const [formData, setFormData] = useState(initialFormState);
  const [selectedNFT, setSelectedNFT] = useState(null);
  const [depositType, setDepositType] = useState('image'); // 'image' or 'nft'
  const [usedNFTMints, setUsedNFTMints] = useState([]); // Track NFTs already used in jackpots
  const [lootboxNFTMints, setLootboxNFTMints] = useState([]); // Track NFTs already used in lootboxes
  const [cartNFTMints, setCartNFTMints] = useState([]); // Track NFTs in user carts (won but not claimed)
  const [jackpotNFTImages, setJackpotNFTImages] = useState({}); // Cache NFT images: { mintAddress: imageUrl }
  
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jackpots]); // Only depend on jackpots, not the functions (they're stable from the hook)

  // Fetch NFT images for jackpots that have NFT mint addresses
  useEffect(() => {
    const fetchNFTImages = async () => {
      // Preserve existing cache
      const imageCache = { ...jackpotNFTImages };
      let hasChanges = false;
      
      for (const jackpot of jackpots) {
        if (jackpot.image) {
          // Check if it's an NFT mint address (not a file path)
          const isNFTMint = typeof jackpot.image === 'string' && 
                           jackpot.image.length >= 32 && 
                           jackpot.image.length <= 44 && 
                           !jackpot.image.includes('/') &&
                           !jackpot.image.includes('.');
          
          // Only fetch if not already cached
          if (isNFTMint && !imageCache[jackpot.image]) {
            // First, try to find the NFT in walletNFTs (from Helius - already has image)
            const walletNFT = walletNFTs.find((nft) => nft.mint === jackpot.image);
            
            if (walletNFT && walletNFT.image) {
              // Use image from walletNFTs (already converted from IPFS by useWalletNFTs)
              const convertedImage = convertIPFSToHTTP(walletNFT.image) || walletNFT.image;
              imageCache[jackpot.image] = convertedImage;
              hasChanges = true;
            } else if (!nftsLoading) {
              // Only fetch metadata if walletNFTs has finished loading (to avoid duplicate fetches)
              // Fallback to fetching metadata
              try {
                const metadata = await fetchNFTMetadata(jackpot.image);
                if (metadata && metadata.image) {
                  // Convert IPFS URLs to HTTP gateway URLs
                  const convertedImage = convertIPFSToHTTP(metadata.image) || metadata.image;
                  imageCache[jackpot.image] = convertedImage;
                  hasChanges = true;
                }
              } catch (error) {
                console.error('Error fetching NFT image for', jackpot.image, error);
              }
            }
          } else if (!isNFTMint && jackpot.image) {
            // It's already an image URL, convert IPFS if needed
            const convertedImage = convertIPFSToHTTP(jackpot.image) || jackpot.image;
            if (convertedImage && (convertedImage.startsWith('http://') || convertedImage.startsWith('https://'))) {
              // Store it with a key based on jackpot ID for reference
              const cacheKey = `url_${jackpot.id}`;
              if (!imageCache[cacheKey]) {
                imageCache[cacheKey] = convertedImage;
                hasChanges = true;
              }
            }
          }
        }
      }
      
      // Only update state if there are actual changes
      if (hasChanges) {
        setJackpotNFTImages(imageCache);
      }
    };
    
    if (jackpots.length > 0) {
      fetchNFTImages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jackpots, nftsLoading]); // Only depend on jackpots and loading state, not walletNFTs array

  // Helper function to get image URL for a jackpot
  const getJackpotImageUrl = (jackpot) => {
    if (!jackpot.image) return null;
    
    // Check if it's already a valid HTTP URL (image URL stored directly in database)
    if (typeof jackpot.image === 'string' && 
        (jackpot.image.startsWith('http://') || jackpot.image.startsWith('https://'))) {
      // It's already an image URL, convert IPFS if needed and use it directly
      return convertIPFSToHTTP(jackpot.image) || jackpot.image;
    }
    
    // Check if it's an NFT mint address
    const isNFTMint = typeof jackpot.image === 'string' && 
                     jackpot.image.length >= 32 && 
                     jackpot.image.length <= 44 && 
                     !jackpot.image.includes('/') &&
                     !jackpot.image.includes('.');
    
    if (isNFTMint) {
      // First, check if we have it in walletNFTs (faster, already has image)
      const walletNFT = walletNFTs.find((nft) => nft.mint === jackpot.image);
      if (walletNFT && walletNFT.image) {
        return convertIPFSToHTTP(walletNFT.image) || walletNFT.image;
      }
      
      // Then check cache
      const cachedImage = jackpotNFTImages[jackpot.image];
      if (cachedImage) {
        const finalUrl = convertIPFSToHTTP(cachedImage) || cachedImage;
        // Validate URL
        if (finalUrl && (finalUrl.startsWith('http://') || finalUrl.startsWith('https://'))) {
          return finalUrl;
        }
      }
      
      // Return null if not cached yet - will show placeholder
      return null;
    }
    
    // For regular images (Supabase storage paths), construct the full URL
    const imagePath = `https://zkltmkbmzxvfovsgotpt.supabase.co/storage/v1/object/public/apes-bucket/${jackpot.image}`;
    return convertIPFSToHTTP(imagePath) || imagePath;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setFormData(prev => ({ ...prev, image: file }));
  };
  
  // Convert ISO datetime to local datetime-local format
  const formatDateTimeLocal = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    // Get local date components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Convert datetime-local value to ISO string for database
  const convertToISO = (datetimeLocal) => {
    if (!datetimeLocal) return null;
    // datetime-local returns format: "YYYY-MM-DDTHH:mm" in local time
    // Parse the date components
    const [datePart, timePart] = datetimeLocal.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    
    // Create a Date object in local timezone
    // Note: month is 0-indexed in JavaScript Date constructor
    // This creates a date in the user's local timezone
    const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    
    // The Date object stores time internally as UTC milliseconds since epoch
    // When we create it with local components, JavaScript automatically converts it
    // So localDate.getTime() already gives us the correct UTC milliseconds
    // We just need to return it as ISO string
    return localDate.toISOString();
  };

  const resetAndShowModal = async (jackpot = null) => {
    // Refresh wallet NFTs to get current state (in case NFTs were transferred)
    if (refetchWalletNFTs) {
      await refetchWalletNFTs();
    }
    
    // Refresh used NFT mints when opening modal
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
      // Convert end_time from ISO to local datetime format for editing
      const formDataWithLocalTime = {
        ...jackpot,
        endTime: jackpot.endTime ? formatDateTimeLocal(jackpot.endTime) : '',
        itemPrice: jackpot.itemPrice || 0
      };
      setFormData(formDataWithLocalTime);
      // If editing a jackpot with an NFT, set it as selected
      // Wait for walletNFTs to load if needed
      if (jackpot.image && typeof jackpot.image === 'string' && 
          jackpot.image.length >= 32 && jackpot.image.length <= 44 && 
          !jackpot.image.includes('/') && !jackpot.image.includes('.')) {
        // It's an NFT mint address, find it in wallet NFTs
        // Use a timeout to wait for walletNFTs to load
        setTimeout(() => {
          const matchingNFT = walletNFTs.find(nft => nft.mint === jackpot.image);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate NFT selection if NFT deposit type
    if (depositType === 'nft') {
      if (!selectedNFT) {
        alert('Please select an NFT from your wallet');
        return;
      }

      // Check if NFT is already used in another jackpot
      const isUsedInJackpot = usedNFTMints.includes(selectedNFT.mint);
      if (isUsedInJackpot) {
        // Allow if editing the same jackpot that already has this NFT
        const currentJackpotImage = editingJackpot?.image;
        if (!editingJackpot || currentJackpotImage !== selectedNFT.mint) {
          alert('This NFT is already added to another jackpot. Please select a different NFT.');
          return;
        }
      }

      // Check if NFT is already used in a lootbox
      const isUsedInLootbox = lootboxNFTMints.includes(selectedNFT.mint);
      if (isUsedInLootbox) {
        alert('This NFT is already added to a lootbox. Please select a different NFT.');
        return;
      }

      // Check if NFT is in a user's cart (won but not yet claimed)
      const isInCart = cartNFTMints.includes(selectedNFT.mint);
      if (isInCart) {
        alert('This NFT is currently in a user\'s cart (won but not yet claimed). It cannot be added to a jackpot until the user claims it.');
        return;
      }

      // Double-check with database before submitting
      try {
        const excludeJackpotId = editingJackpot ? editingJackpot.id : null;
        const exists = await checkNFTExists(selectedNFT.mint, excludeJackpotId);
        if (exists) {
          alert('This NFT is already added to another jackpot. Please select a different NFT.');
          return;
        }
        
        // Double-check cart status (only NFT rewards, not SOL)
        const { supabase } = await import('../lib/supabase');
        const { data: cartData, error: cartError } = await supabase
          .from('prizeWin')
          .select('id, userId, isWithdraw, reward_type')
          .eq('mint', selectedNFT.mint)
          .eq('isWithdraw', false) // Check if in cart (not claimed)
          .eq('reward_type', 'nft') // Only check NFT rewards (not SOL rewards)
          .limit(1);
        
        if (!cartError && cartData && cartData.length > 0) {
          alert('This NFT is currently in a user\'s cart (won but not yet claimed). It cannot be added to a jackpot until the user claims it.');
          return;
        }
      } catch (error) {
        console.error('Error checking NFT:', error);
        // Continue with submission if check fails
      }

      // Auto-fill name, title, and image from NFT metadata
      formData.name = selectedNFT.name;
      formData.title = selectedNFT.name;
      formData.nftMintAddress = selectedNFT.mint;
      // Store the actual image URL (already converted from IPFS by useWalletNFTs) instead of mint address
      // This ensures new jackpots have direct image URLs in the database
      formData.image = selectedNFT.image && (selectedNFT.image.startsWith('http://') || selectedNFT.image.startsWith('https://'))
        ? selectedNFT.image 
        : selectedNFT.mint; // Fallback to mint if image URL is invalid
    } else {
      // Form validation for image upload mode
      if (!formData.name.trim()) {
        alert('Please enter a jackpot name');
        return;
      }
    }

    if (!formData.description.trim()) {
      alert('Please enter a description');
      return;
    }
    if (!formData.price || formData.price <= 0) {
      alert('Please enter a valid ticket price');
      return;
    }
    if (!formData.maxTickets || formData.maxTickets <= 0) {
      alert('Please enter a valid maximum tickets number');
      return;
    }
    
    try {
      // Convert endTime from local datetime to ISO format before saving
      const formDataToSave = {
        ...formData,
        endTime: formData.endTime ? convertToISO(formData.endTime) : null
      };

      // Capture NFT image before clearing selectedNFT
      const nftImageToCache = depositType === 'nft' && formData.image && selectedNFT?.image 
        ? selectedNFT.image 
        : null;
      const nftMintToCache = depositType === 'nft' && selectedNFT?.mint 
        ? selectedNFT.mint 
        : null;
      
      if (editingJackpot) {
        await updateJackpot(editingJackpot.id, formDataToSave);
      } else {
        await addJackpot(formDataToSave);
      }
      setShowModal(false);
      setFormData(initialFormState);
      setEditingJackpot(null);
      setSelectedNFT(null);
      setDepositType('image');
      
      // If we added an NFT jackpot, cache the image immediately
      if (nftMintToCache && nftImageToCache) {
        const convertedImage = convertIPFSToHTTP(nftImageToCache) || nftImageToCache;
        if (convertedImage && (convertedImage.startsWith('http://') || convertedImage.startsWith('https://'))) {
          setJackpotNFTImages(prev => ({
            ...prev,
            [nftMintToCache]: convertedImage
          }));
        }
      }
      
      // Refresh used NFT mints after adding/updating
      const [usedMints, lootboxMints] = await Promise.all([
        getUsedNFTMints(),
        getLootboxNFTMints()
      ]);
      setUsedNFTMints(usedMints);
      setLootboxNFTMints(lootboxMints);
      // Refresh admin wallet to ensure we have latest data
      await refreshAdminWallet();
    } catch (error) {
      console.error('Error saving jackpot:', error);
      alert(error.message || 'Error saving jackpot. Please try again.');
    }
  };

  const handleDelete = async (jackpotId) => {
    if (window.confirm('Are you sure you want to delete this jackpot?')) {
      try {
        await deleteJackpot(jackpotId);
      } catch (error) {
        console.error('Error deleting jackpot:', error);
        alert('Error deleting jackpot. Please try again.');
      }
    }
  };

  return (
    <div className="p-6">
      {/* Header Section */}
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

      {/* Jackpots Table */}
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
                  <td colSpan="7" className="px-6 py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                    <p className="text-gray-500 mt-2">Loading jackpots...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center">
                    <p className="text-red-500">Error loading jackpots: {error}</p>
                  </td>
                </tr>
              ) : jackpots.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center">
                    <p className="text-gray-500">No jackpots found. Add your first jackpot!</p>
                  </td>
                </tr>
              ) : (
                jackpots.map((jackpot) => (
                  <tr key={jackpot.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                          {(() => {
                            const imageUrl = getJackpotImageUrl(jackpot);
                            const isNFTMint = jackpot.image && typeof jackpot.image === 'string' && 
                                             jackpot.image.length >= 32 && 
                                             jackpot.image.length <= 44 && 
                                             !jackpot.image.includes('/') &&
                                             !jackpot.image.includes('.');
                            
                            if (imageUrl) {
                              return (
                                <img 
                                  src={imageUrl}
                                  alt={jackpot.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none'
                                    e.target.nextSibling.style.display = 'flex'
                                  }}
                                />
                              );
                            }
                            
                            if (isNFTMint) {
                              // NFT image is loading or failed to load
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800">{editingJackpot ? 'Edit Jackpot' : 'Add New Jackpot'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Deposit Type Toggle */}
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
                <textarea name="description" value={formData.description} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500" rows="3" required />
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
                    Winner Prize Amount (OGX) *
                  </label>
                  <input 
                    type="number" 
                    name="itemPrice" 
                    value={formData.itemPrice} 
                    onChange={handleInputChange} 
                    className="w-full px-4 py-2 border border-orange-300 rounded-lg focus:outline-none focus:border-orange-500 bg-white" 
                    placeholder="e.g., 100"
                    min="0"
                    step="0.01"
                    required
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    <strong>This is the reward amount the winner will receive.</strong> When a user wins this jackpot, they will get this amount credited to their balance in OGX.
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
              
              {/* Image Upload or NFT Selection */}
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
                      <>
                          <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
                            {walletNFTs
                              .filter((nft) => {
                                // Filter out NFTs that are in user carts - they shouldn't be shown at all
                                // because they're promised to users who won them
                                const isInCart = cartNFTMints.includes(nft.mint);
                                return !isInCart; // Only show NFTs that are NOT in user carts
                              })
                              .map((nft) => {
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
                                  {/* Badge for NFTs used in lootboxes */}
                                  {isUsedInLootbox && (
                                    <div className="absolute top-1 right-1 bg-orange-500 text-white text-xs px-2 py-1 rounded-full z-10">
                                      In Lootbox
                                    </div>
                                  )}
                                  {/* Badge for NFTs used in other jackpots */}
                                  {isUsedInJackpot && !isCurrentJackpotNFT && !isUsedInLootbox && (
                                    <div className="absolute top-1 right-1 bg-red-500 text-white text-xs px-2 py-1 rounded-full z-10">
                                      Used
                                    </div>
                                  )}
                                  {/* Badge for current jackpot NFT */}
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
                              {lootboxNFTMints.includes(selectedNFT.mint) && (
                                <p className="text-xs text-orange-600 mt-1 font-medium">⚠️ This NFT is already used in a lootbox and cannot be selected</p>
                              )}
                              {usedNFTMints.includes(selectedNFT.mint) && editingJackpot && editingJackpot.image !== selectedNFT.mint && !lootboxNFTMints.includes(selectedNFT.mint) && (
                                <p className="text-xs text-red-600 mt-1">⚠️ This NFT is already used in another jackpot</p>
                              )}
                            </div>
                          )}
                          {(walletNFTs.filter(nft => {
                            const isUsedInJackpot = usedNFTMints.includes(nft.mint) && (!editingJackpot || editingJackpot.image !== nft.mint);
                            const isUsedInLootbox = lootboxNFTMints.includes(nft.mint);
                            const isInCart = cartNFTMints.includes(nft.mint);
                            return isUsedInJackpot || isUsedInLootbox || isInCart;
                          }).length > 0) && (
                            <div className="mt-2 text-xs space-y-1">
                              {walletNFTs.filter(nft => cartNFTMints.includes(nft.mint)).length > 0 && (
                                <p className="text-yellow-600">🛒 {walletNFTs.filter(nft => cartNFTMints.includes(nft.mint)).length} NFT(s) are in user carts (won but not claimed) and are hidden from selection</p>
                              )}
                              {walletNFTs.filter(nft => lootboxNFTMints.includes(nft.mint) && !cartNFTMints.includes(nft.mint)).length > 0 && (
                                <p className="text-orange-600">ℹ️ {walletNFTs.filter(nft => lootboxNFTMints.includes(nft.mint) && !cartNFTMints.includes(nft.mint)).length} NFT(s) are already used in lootboxes and cannot be selected</p>
                              )}
                              {walletNFTs.filter(nft => usedNFTMints.includes(nft.mint) && (!editingJackpot || editingJackpot.image !== nft.mint) && !lootboxNFTMints.includes(nft.mint) && !cartNFTMints.includes(nft.mint)).length > 0 && (
                                <p className="text-red-600">ℹ️ {walletNFTs.filter(nft => usedNFTMints.includes(nft.mint) && (!editingJackpot || editingJackpot.image !== nft.mint) && !lootboxNFTMints.includes(nft.mint) && !cartNFTMints.includes(nft.mint)).length} NFT(s) are already used in other jackpots and cannot be selected</p>
                              )}
                            </div>
                          )}
                          {walletNFTs.filter(nft => !cartNFTMints.includes(nft.mint)).length === 0 && walletNFTs.length > 0 && (
                            <p className="text-yellow-600 text-sm mt-2">⚠️ All NFTs in your wallet are currently in user carts (won but not claimed) and are hidden from selection.</p>
                          )}
                          {walletNFTs.length === 0 && !nftsLoading && (
                            <p className="text-gray-500 text-sm mt-2">No NFTs found in admin wallet. Make sure the wallet address is correct and the wallet has NFTs.</p>
                          )}
                          {adminWalletAddress && (
                            <div className="mt-2 text-xs text-gray-500">
                              <p> Wallet: {adminWalletAddress.substring(0, 8)}...{adminWalletAddress.substring(adminWalletAddress.length - 8)}</p>
                            </div>
                          )}
                        </>
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

export default JackpotSettings; 