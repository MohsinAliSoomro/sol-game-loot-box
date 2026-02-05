import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useRewards } from '../hooks/useRewards'
import { useWalletNFTs } from '../hooks/useWalletNFTs'
import { useAdminWallet } from '../hooks/useAdminWallet'
import { useJackpotPools } from '../hooks/useJackpotPools'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

function LootboxRewards() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  // A simple fallback if lootbox state is lost on page refresh
  const lootboxName = location.state?.lootbox?.name || `Lootbox #${id}`;

  // Fetch rewards for this specific lootbox (product_id = id)
  const { rewards, loading, error, addReward, updateReward, deleteReward } = useRewards(id)
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  
  // State for the modal form
  const [selectedRewardType, setSelectedRewardType] = useState('item'); 
  const [formData, setFormData] = useState({});
  const [selectedNFT, setSelectedNFT] = useState(null);
  const [solBalance, setSolBalance] = useState(0);
  const [solBalanceLoading, setSolBalanceLoading] = useState(false);
  const [selectedSOLAmount, setSelectedSOLAmount] = useState(null);
  const [customSOLAmount, setCustomSOLAmount] = useState('');
  const [jackpotNFTMints, setJackpotNFTMints] = useState([]); // Track NFTs used in jackpots
  const [isOnChainToken, setIsOnChainToken] = useState(false); // Toggle for on-chain token items
  
  // Get admin wallet address from database
  const { adminWalletAddress, loading: adminWalletLoading, error: adminWalletError, refreshAdminWallet } = useAdminWallet();
  
  // Get jackpot pools hook to access getUsedNFTMints function
  const { getUsedNFTMints } = useJackpotPools();
  
  // Fetch NFTs from admin wallet
  const { nfts: walletNFTs, loading: nftsLoading } = useWalletNFTs(adminWalletAddress);

  // Fetch jackpot NFT mints when component mounts or admin wallet changes
  useEffect(() => {
    const fetchJackpotNFTs = async () => {
      try {
        const usedMints = await getUsedNFTMints();
        setJackpotNFTMints(usedMints);
      } catch (error) {
        console.error('Error fetching jackpot NFT mints:', error);
      }
    };
    
    if (adminWalletAddress) {
      fetchJackpotNFTs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminWalletAddress]);

  // Predefined SOL reward amounts
  const SOL_REWARD_OPTIONS = [0.01, 0.05, 0.08, 0.1, 0.2];

  // Fetch SOL balance when wallet is set
  useEffect(() => {
    const fetchSOLBalance = async () => {
      if (!adminWalletAddress) return;
      
      try {
        setSolBalanceLoading(true);
        const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=5a1a852c-3ed9-40ee-bca8-dda4550c3ce8', 'confirmed');
        const publicKey = new PublicKey(adminWalletAddress);
        const balance = await connection.getBalance(publicKey);
        setSolBalance(balance / LAMPORTS_PER_SOL);
      } catch (err) {
        console.error('Error fetching SOL balance:', err);
        setSolBalance(0);
      } finally {
        setSolBalanceLoading(false);
      }
    };

    fetchSOLBalance();
  }, [adminWalletAddress]);

  const resetAndShowModal = (reward = null) => {
    if (reward) {
      setEditingReward(reward);
      setSelectedRewardType(reward.rewardType);
      // For SOL rewards, extract amount from name if solAmount is not set
      if (reward.rewardType === 'sol' && !reward.solAmount && reward.name) {
        const solMatch = reward.name.match(/^(\d+\.?\d*)\s*SOL$/i);
        if (solMatch) {
          reward.solAmount = solMatch[1];
        }
      }
      // Check if SOL amount is a custom value (not in predefined options)
      if (reward.rewardType === 'sol' && reward.solAmount) {
        const solAmountNum = parseFloat(reward.solAmount);
        if (SOL_REWARD_OPTIONS.includes(solAmountNum)) {
          setSelectedSOLAmount(solAmountNum);
          setCustomSOLAmount('');
        } else {
          setSelectedSOLAmount(null);
          setCustomSOLAmount(reward.solAmount);
        }
      } else {
        setSelectedSOLAmount(null);
        setCustomSOLAmount('');
      }
      // Check if item is an on-chain token
      if (reward.rewardType === 'item' && reward.isOnChain) {
        setIsOnChainToken(true);
      } else {
        setIsOnChainToken(false);
      }
      setFormData(reward);
    } else {
      setEditingReward(null);
      setSelectedRewardType('item');
      setFormData({
        rewardType: 'item',
        name: '',
        value: '',
        collection: '',
        tokenId: '',
        tokenSymbol: '',
        tokenAmount: '',
        solAmount: '',
        chance: '',
        image: null,
        tokenMintAddress: '',
        isOnChain: false
      });
      setSelectedSOLAmount(null);
      setCustomSOLAmount('');
      setIsOnChainToken(false);
    }
    setShowAddModal(true);
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setFormData(prev => ({ ...prev, image: file }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rewards.length >= 15 && !editingReward) {
      alert('Maximum 15 rewards allowed per lootbox');
      return;
    }

    try {
      // For SOL rewards, ensure name is properly formatted
      const submissionData = { ...formData, rewardType: selectedRewardType };
      
      if (selectedRewardType === 'sol') {
        // Validate SOL amount is selected or entered
        if (!selectedSOLAmount && !customSOLAmount) {
          alert('Please select a SOL amount or enter a custom amount');
          return;
        }
        
        // Use custom amount if entered, otherwise use selected amount
        const finalAmount = customSOLAmount || (selectedSOLAmount ? selectedSOLAmount.toString() : '');
        const finalAmountNum = parseFloat(finalAmount);
        
        // Validate amount
        if (isNaN(finalAmountNum) || finalAmountNum <= 0) {
          alert('Please enter a valid SOL amount greater than 0');
          return;
        }
        
        if (finalAmountNum > solBalance) {
          alert(`Amount (${finalAmountNum} SOL) exceeds wallet balance (${solBalance.toFixed(4)} SOL)`);
          return;
        }
        
        // Set solAmount and name
        submissionData.solAmount = finalAmount;
        submissionData.name = `${finalAmount} SOL`;
      }

      // For on-chain token items, validate mint address and amount
      if (selectedRewardType === 'item' && isOnChainToken) {
        if (!submissionData.tokenMintAddress || submissionData.tokenMintAddress.trim() === '') {
          alert('Please enter a valid token mint address');
          return;
        }
        
        // Basic validation for Solana address format (32-44 characters, base58)
        const mintAddress = submissionData.tokenMintAddress.trim();
        if (mintAddress.length < 32 || mintAddress.length > 44) {
          alert('Invalid token mint address. Please enter a valid Solana address.');
          return;
        }
        
        if (!submissionData.tokenAmount || parseFloat(submissionData.tokenAmount) <= 0) {
          alert('Please enter a valid token amount greater than 0');
          return;
        }
        
        // Set isOnChain flag
        submissionData.isOnChain = true;
        submissionData.tokenMintAddress = mintAddress;
        
        // Auto-set name if not provided
        if (!submissionData.name || submissionData.name.trim() === '') {
          const symbol = submissionData.tokenSymbol || 'Token';
          submissionData.name = `${submissionData.tokenAmount} ${symbol}`;
        }
      } else if (selectedRewardType === 'item' && !isOnChainToken) {
        // Off-chain item - clear on-chain fields
        submissionData.isOnChain = false;
        submissionData.tokenMintAddress = '';
      }

      // For NFT rewards, validate that mint address is selected
      if (selectedRewardType === 'nft') {
        if (!submissionData.mintAddress) {
          alert('Please select an NFT from your wallet');
          return;
        }

        // Check if NFT is already used in a jackpot
        if (jackpotNFTMints.includes(submissionData.mintAddress)) {
          alert('This NFT is already added to a jackpot. Please select a different NFT.');
          return;
        }

        // Double-check with database before submitting
        try {
          const { supabase } = await import('../lib/supabase');
          const { data: jackpotData, error: jackpotError } = await supabase
            .from('jackpot_pools')
            .select('id, name')
            .eq('image', submissionData.mintAddress)
            .limit(1);
          
          if (!jackpotError && jackpotData && jackpotData.length > 0) {
            alert('This NFT is already added to a jackpot. Please select a different NFT.');
            return;
          }
        } catch (error) {
          console.error('Error checking jackpot NFT:', error);
          // Continue with submission if check fails
        }
      }

      if (editingReward) {
        await updateReward(editingReward.id, submissionData);
      } else {
        await addReward(submissionData);
      }
      setShowAddModal(false);
      setSelectedNFT(null); // Reset NFT selection
    } catch (error) {
      console.error('Error saving reward:', error);
      alert('Error saving reward. Please try again.');
    }
  };

  const handleDelete = async (rewardId) => {
    if (window.confirm('Are you sure you want to delete this reward?')) {
      try {
        await deleteReward(rewardId);
      } catch (error) {
        console.error('Error deleting reward:', error);
        alert('Error deleting reward. Please try again.');
      }
    }
  };

  return (
    <div className="p-6">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center space-x-3">
            <button onClick={() => navigate('/settings')} className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-800">{lootboxName} Rewards</h1>
              <p className="text-gray-600 mt-1">Manage rewards for this lootbox</p>
            </div>
          </div>
        </div>
        <button 
          onClick={() => resetAndShowModal()}
          className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center space-x-2"
          disabled={rewards.length >= 15}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          <span>Add Reward</span>
        </button>
      </div>

      {/* Rewards Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reward</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chance</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                    <p className="text-gray-500 mt-2">Loading rewards...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center">
                    <p className="text-red-500">Error loading rewards: {error}</p>
                  </td>
                </tr>
              ) : rewards.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center">
                    <p className="text-gray-500">No rewards found. Add your first reward!</p>
                  </td>
                </tr>
              ) : (
                rewards.map((reward) => (
                  <tr key={reward.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                          {reward.image ? (
                            <img 
                              src={`https://zkltmkbmzxvfovsgotpt.supabase.co/storage/v1/object/public/apes-bucket/${reward.image}`}
                              alt={reward.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none'
                                e.target.nextSibling.style.display = 'flex'
                              }}
                            />
                          ) : null}
                          <span className="text-gray-500 text-xs" style={{ display: reward.image ? 'none' : 'flex' }}>IMG</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{reward.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        reward.rewardType === 'item' && reward.isOnChain ? 'bg-cyan-100 text-cyan-800' :
                        reward.rewardType === 'item' ? 'bg-orange-100 text-orange-800' : 
                        reward.rewardType === 'nft' ? 'bg-purple-100 text-purple-800' : 
                        reward.rewardType === 'sol' ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {reward.rewardType === 'item' && reward.isOnChain ? 'TOKEN' : reward.rewardType.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {reward.rewardType === 'item' && reward.isOnChain && (
                        <div>
                          <span>{reward.tokenAmount} {reward.tokenSymbol || 'Tokens'}</span>
                          <span className="block text-xs text-gray-400 truncate max-w-[150px]" title={reward.tokenMintAddress}>
                            {reward.tokenMintAddress?.substring(0, 8)}...
                          </span>
                        </div>
                      )}
                      {reward.rewardType === 'item' && !reward.isOnChain && reward.value}
                      {reward.rewardType === 'nft' && `${reward.collection} #${reward.tokenId}`}
                      {reward.rewardType === 'token' && `${reward.tokenAmount} ${reward.tokenSymbol}`}
                      {reward.rewardType === 'sol' && `${reward.tokenAmount || reward.value} SOL`}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{reward.chance}%</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-3">
                        <button onClick={() => resetAndShowModal(reward)} className="text-gray-400 hover:text-gray-500" title="Edit">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handleDelete(reward.id)} className="text-gray-400 hover:text-red-500" title="Delete">
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
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800">{editingReward ? 'Edit Reward' : 'Add New Reward'}</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex space-x-4 border-b pb-4">
                <button type="button" onClick={() => setSelectedRewardType('item')} className={`flex-1 py-2 px-4 rounded-lg border ${selectedRewardType === 'item' ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Item</button>
                <button type="button" onClick={() => setSelectedRewardType('nft')} className={`flex-1 py-2 px-4 rounded-lg border ${selectedRewardType === 'nft' ? 'border-purple-500 bg-purple-50 text-purple-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>NFT</button>
                <button type="button" onClick={() => setSelectedRewardType('sol')} className={`flex-1 py-2 px-4 rounded-lg border ${selectedRewardType === 'sol' ? 'border-green-500 bg-green-50 text-green-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>SOL</button>
              </div>

              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                {selectedRewardType === 'sol' ? (
                  <input 
                    type="text" 
                    name="name" 
                    value={`${formData.solAmount || ''} SOL`} 
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500 bg-gray-100" 
                    readOnly 
                    disabled
                  />
                ) : (
                  <input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500" required />
                )}
              </div>

              {selectedRewardType === 'item' && (
                <>
                  {/* On-chain / Off-chain Toggle */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-700">On-chain Token</p>
                      <p className="text-xs text-gray-500">Enable to send SPL tokens (like OGX) directly to user's wallet</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOnChainToken(!isOnChainToken);
                        setFormData(prev => ({ ...prev, isOnChain: !isOnChainToken, tokenMintAddress: '', tokenAmount: '' }));
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isOnChainToken ? 'bg-orange-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isOnChainToken ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {isOnChainToken ? (
                    <>
                      {/* Token Mint Address */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Token Mint Address</label>
                        <input 
                          type="text" 
                          name="tokenMintAddress" 
                          value={formData.tokenMintAddress || ''} 
                          onChange={handleInputChange} 
                          placeholder="e.g., 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500 font-mono text-sm" 
                          required 
                        />
                        <p className="text-xs text-gray-500 mt-1">Enter the SPL token mint address (e.g., OGX token)</p>
                      </div>

                      {/* Token Amount */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Token Amount</label>
                        <input 
                          type="number" 
                          name="tokenAmount" 
                          value={formData.tokenAmount || ''} 
                          onChange={handleInputChange} 
                          placeholder="e.g., 100"
                          step="any"
                          min="0"
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500" 
                          required 
                        />
                        <p className="text-xs text-gray-500 mt-1">Amount of tokens to send to the winner</p>
                      </div>

                      {/* Token Symbol (optional) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Token Symbol (Optional)</label>
                        <input 
                          type="text" 
                          name="tokenSymbol" 
                          value={formData.tokenSymbol || ''} 
                          onChange={handleInputChange} 
                          placeholder="e.g., OGX"
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500" 
                        />
                        <p className="text-xs text-gray-500 mt-1">Display symbol for the token</p>
                      </div>

                      <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                        <p className="font-medium mb-1">ℹ️ On-chain Token Info:</p>
                        <p>• Tokens will be transferred from admin wallet to winner's wallet</p>
                        <p>• Make sure admin wallet has enough token balance</p>
                        <p>• Token will be sent automatically when user wins</p>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Off-chain Value */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                        <input type="text" name="value" value={formData.value || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500" required />
                        <p className="text-xs text-gray-500 mt-1">Description or value of the off-chain item</p>
                      </div>
                    </>
                  )}
                </>
              )}

              {selectedRewardType === 'nft' && (
                <>
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
                      <p className="text-gray-600">No NFTs found in wallet.</p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select NFT from Wallet</label>
                      <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
                        {walletNFTs.filter(nft => {
                          // Filter out NFTs that are already added as rewards in this lootbox
                          const isInCurrentLootbox = rewards.some(r => r.mintAddress === nft.mint);
                          // Filter out NFTs that are used in jackpots
                          const isInJackpot = jackpotNFTMints.includes(nft.mint);
                          return !isInCurrentLootbox && !isInJackpot;
                        }).length === 0 ? (
                          <div className="col-span-3 text-center py-6">
                            <p className="text-gray-600">All available NFTs have already been added as rewards or are used in jackpots.</p>
                          </div>
                        ) : walletNFTs.filter(nft => {
                          // Filter out NFTs that are already added as rewards in this lootbox
                          const isInCurrentLootbox = rewards.some(r => r.mintAddress === nft.mint);
                          // Filter out NFTs that are used in jackpots
                          const isInJackpot = jackpotNFTMints.includes(nft.mint);
                          return !isInCurrentLootbox && !isInJackpot;
                        }).map((nft) => (
                          <div
                            key={nft.mint}
                            onClick={() => {
                              setSelectedNFT(nft);
                              setFormData(prev => ({ 
                                ...prev, 
                                mintAddress: nft.mint, 
                                name: nft.name,
                                nftImage: nft.image 
                              }));
                            }}
                            className={`cursor-pointer border-2 rounded-lg p-2 transition-all ${
                              selectedNFT?.mint === nft.mint
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 hover:border-purple-300'
                            }`}
                          >
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
                        ))}
                      </div>
                      {selectedNFT && (
                        <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                          <p className="text-sm font-medium text-gray-700">Selected: {selectedNFT.name}</p>
                          <p className="text-xs text-gray-500 break-all">{selectedNFT.mint}</p>
                          {jackpotNFTMints.includes(selectedNFT.mint) && (
                            <p className="text-xs text-orange-600 mt-1 font-medium">⚠️ This NFT is already used in a jackpot and cannot be selected</p>
                          )}
                        </div>
                      )}
                      {(walletNFTs.filter(nft => {
                        const isInCurrentLootbox = rewards.some(r => r.mintAddress === nft.mint);
                        const isInJackpot = jackpotNFTMints.includes(nft.mint);
                        return isInCurrentLootbox || isInJackpot;
                      }).length > 0) && (
                        <div className="mt-2 text-xs text-gray-500 space-y-1">
                          {walletNFTs.filter(nft => jackpotNFTMints.includes(nft.mint)).length > 0 && (
                            <p>ℹ️ {walletNFTs.filter(nft => jackpotNFTMints.includes(nft.mint)).length} NFT(s) are already used in jackpots and cannot be selected</p>
                          )}
                          {walletNFTs.filter(nft => rewards.some(r => r.mintAddress === nft.mint) && !jackpotNFTMints.includes(nft.mint)).length > 0 && (
                            <p>ℹ️ {walletNFTs.filter(nft => rewards.some(r => r.mintAddress === nft.mint) && !jackpotNFTMints.includes(nft.mint)).length} NFT(s) are already added to this lootbox</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {selectedRewardType === 'sol' && (
                <>
                  {adminWalletLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
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
                  ) : solBalanceLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
                      <p className="text-gray-500 mt-2">Checking SOL balance...</p>
                    </div>
                  ) : solBalance < 0.01 ? (
                    <div className="bg-red-50 p-4 rounded-lg text-center">
                      <p className="text-red-600 font-medium">❌ Insufficient SOL Balance</p>
                      <p className="text-sm text-gray-600 mt-1">Your wallet has {solBalance.toFixed(4)} SOL. Minimum 0.01 SOL required.</p>
                    </div>
                  ) : (
                    <div>
                      <div className="bg-green-50 p-3 rounded-lg mb-4">
                        <p className="text-sm font-medium text-gray-700">
                          💰 Wallet Balance: <span className="text-green-600">{solBalance.toFixed(4)} SOL</span>
                        </p>
                      </div>
                      
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select SOL Reward Amount</label>
                      <div className="grid grid-cols-5 gap-2 mb-4">
                        {SOL_REWARD_OPTIONS.map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            disabled={solBalance < amount}
                            onClick={() => {
                              setSelectedSOLAmount(amount);
                              setCustomSOLAmount('');
                              setFormData(prev => ({ 
                                ...prev, 
                                solAmount: amount.toString(), 
                                name: `${amount} SOL` 
                              }));
                            }}
                            className={`py-3 px-2 rounded-lg border-2 transition-all text-sm font-medium ${
                              selectedSOLAmount === amount && !customSOLAmount
                                ? 'border-green-500 bg-green-50 text-green-700'
                                : solBalance < amount
                                ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'border-gray-200 hover:border-green-300 text-gray-700'
                            }`}
                          >
                            {amount} SOL
                          </button>
                        ))}
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Or Enter Custom Amount</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            max={solBalance}
                            value={customSOLAmount}
                            onChange={(e) => {
                              const value = e.target.value;
                              setCustomSOLAmount(value);
                              if (value && !isNaN(parseFloat(value)) && parseFloat(value) > 0) {
                                const numValue = parseFloat(value);
                                if (numValue <= solBalance) {
                                  setSelectedSOLAmount(null);
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    solAmount: value, 
                                    name: `${value} SOL` 
                                  }));
                                }
                              }
                            }}
                            placeholder="e.g., 0.000001"
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-green-500 "
                          />
                          <span className="text-sm text-gray-600 font-medium">SOL</span>
                        </div>
                        {customSOLAmount && parseFloat(customSOLAmount) > solBalance && (
                          <p className="text-xs text-red-600 mt-1">Amount exceeds wallet balance ({solBalance.toFixed(4)} SOL)</p>
                        )}
                        {customSOLAmount && parseFloat(customSOLAmount) <= 0 && (
                          <p className="text-xs text-red-600 mt-1">Amount must be greater than 0</p>
                        )}
                      </div>

                      {(selectedSOLAmount || (customSOLAmount && parseFloat(customSOLAmount) > 0 && parseFloat(customSOLAmount) <= solBalance)) && (
                        <div className="">
                          {/* <p className="text-sm font-medium text-gray-700">✅ Selected: {customSOLAmount ? `${customSOLAmount} SOL` : `${selectedSOLAmount} SOL`}</p>
                          <p className="text-xs text-gray-500 mt-1">This amount will be deposited to the vault and deducted from your wallet.</p> */}
                        </div>
                      )}

                     
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chance (%)</label>
                <input type="number" name="chance" value={formData.chance || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500" required min="0" max="100" />
              </div>


              {selectedRewardType === 'item' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
                  <input type="file" onChange={handleImageChange} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500" accept="image/*" />
                </div>
              )}
              {selectedRewardType === 'sol' && (
                <div className="">
                  {/* <p className="font-medium mb-1">🖼️ Image:</p>
                  <p>• SOL rewards automatically use the official Solana logo</p>
                  <p>• No image upload needed for SOL rewards</p> */}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">{editingReward ? 'Save Changes' : 'Add Reward'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default LootboxRewards; 