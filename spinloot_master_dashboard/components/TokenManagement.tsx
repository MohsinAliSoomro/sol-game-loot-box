'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { initTokenFeeConfig, checkTokenFeeConfigExists, getTokenFeeConfig } from '@/lib/token-fee-utils';

interface Token {
  id: string;
  key: string;
  name: string;
  symbol: string;
  mint_address: string;
  decimals: number;
  coingecko_id: string | null;
  fallback_price: number;
  is_active: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export default function TokenManagement() {
  const { publicKey, sendTransaction, wallet, connected } = useWallet();
  const { connection } = useConnection();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingToken, setEditingToken] = useState<Token | null>(null);
  const [initializingFeeConfig, setInitializingFeeConfig] = useState<string | null>(null);
  const [feeConfigStatus, setFeeConfigStatus] = useState<{ [key: string]: { exists: boolean; fee: number | null } }>({});
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    symbol: '',
    mint_address: '',
    decimals: 6,
    coingecko_id: '',
    fallback_price: 1,
    is_active: true,
    display_order: 0
  });

  useEffect(() => {
    fetchTokens();
  }, []);

  useEffect(() => {
    if (publicKey && tokens.length > 0) {
      checkFeeConfigs();
    }
  }, [publicKey, tokens]);

  const checkFeeConfigs = async () => {
    if (!publicKey) return;
    
    const status: { [key: string]: { exists: boolean; fee: number | null } } = {};
    for (const token of tokens) {
      try {
        const mint = new PublicKey(token.mint_address);
        const exists = await checkTokenFeeConfigExists(connection, mint);
        let fee = null;
        if (exists) {
          fee = await getTokenFeeConfig(connection, mint, token.decimals);
        }
        status[token.id] = { exists, fee };
      } catch (error) {
        console.error(`Error checking fee config for token ${token.symbol}:`, error);
        status[token.id] = { exists: false, fee: null };
      }
    }
    setFeeConfigStatus(status);
  };

  const handleInitializeFeeConfig = async (token: Token) => {
    if (!publicKey || !sendTransaction || !connected) {
      alert('Please connect your wallet first');
      return;
    }

    if (!wallet) {
      alert('Wallet not found. Please connect your wallet.');
      return;
    }

    if (!confirm(`Initialize fee config for ${token.symbol}? This will allow withdrawals using the program's withdrawTokens instruction.\n\nYour wallet will prompt you to sign the transaction.`)) {
      return;
    }

    try {
      setInitializingFeeConfig(token.id);
      const mint = new PublicKey(token.mint_address);
      
      // Calculate fee amount: 0.001 SOL equivalent in token units
      // Assuming 1 SOL = $100, and token price from fallback_price
      // Fee in SOL = 0.001 SOL
      // Fee in token = (0.001 * SOL_price) / token_price
      // For simplicity, we'll use a fixed fee equivalent to 0.001 SOL in USD terms
      // 0.001 SOL ≈ $0.1 (if SOL = $100)
      // Fee in token = 0.1 / token_price
      const solPriceUSD = 100; // Approximate SOL price
      const tokenPriceUSD = token.fallback_price || 1;
      const feeAmountUSD = 0.001 * solPriceUSD; // $0.1
      const feeAmountInToken = feeAmountUSD / tokenPriceUSD;
      
      // Convert to token units
      const feeAmountInUnits = BigInt(Math.floor(feeAmountInToken * Math.pow(10, token.decimals)));

      console.log('=== Initializing Fee Config ===');
      console.log('Token:', token.symbol);
      console.log('Mint:', mint.toString());
      console.log('Fee amount (token units):', feeAmountInUnits.toString());
      console.log('Fee amount (human readable):', feeAmountInToken);
      console.log('Owner (fee payer):', publicKey.toString());
      console.log('Wallet:', wallet.adapter.name);
      console.log('Connected:', connected);

      // Create transaction
      console.log('Creating transaction...');
      const transaction = await initTokenFeeConfig(
        connection,
        publicKey,
        mint,
        feeAmountInUnits,
        token.decimals
      );

      console.log('Transaction created:');
      console.log('- Instructions:', transaction.instructions.length);
      console.log('- Fee payer:', transaction.feePayer?.toString());
      console.log('- Recent blockhash:', transaction.recentBlockhash?.toString().substring(0, 16) + '...');

      // Verify transaction is valid
      if (!transaction.feePayer) {
        throw new Error('Transaction fee payer is not set');
      }

      if (!transaction.recentBlockhash) {
        throw new Error('Transaction blockhash is not set');
      }

      if (transaction.instructions.length === 0) {
        throw new Error('Transaction has no instructions');
      }

      // Simulate transaction first to catch errors
      try {
        console.log('Simulating transaction...');
        const simulation = await connection.simulateTransaction(transaction, undefined, false);
        
        if (simulation.value.err) {
          console.error('Transaction simulation failed:', simulation.value.err);
          throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }
        
        console.log('Transaction simulation successful');
        console.log('- Compute units:', simulation.value.unitsConsumed);
      } catch (simError: any) {
        console.error('Simulation error:', simError);
        // Don't throw here, some wallets don't support simulation
        console.warn('Continuing despite simulation error...');
      }

      // Send transaction - this will automatically prompt the wallet to sign
      console.log('Sending transaction to wallet for signing...');
      console.log('⚠️ Please check your wallet popup to approve the transaction');
      
      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: false, // Run preflight to catch errors
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });

      console.log('Transaction sent!');
      console.log('Signature:', signature);
      console.log('Waiting for confirmation...');

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: transaction.recentBlockhash!,
        lastValidBlockHeight: (await connection.getBlockHeight('finalized')) + 150,
      }, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log('✅ Transaction confirmed!');
      alert(`Fee config initialized successfully for ${token.symbol}!\n\nTransaction: ${signature}\n\nView on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=mainnet-beta`);
      await checkFeeConfigs();
    } catch (error: any) {
      console.error('❌ Error initializing fee config:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      // Check for specific error types
      if (errorMessage.includes('User rejected')) {
        errorMessage = 'Transaction was rejected. Please try again and approve the transaction in your wallet.';
      } else if (errorMessage.includes('insufficient funds')) {
        errorMessage = 'Insufficient SOL balance. Please add SOL to your wallet for transaction fees.';
      } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      }

      alert(`Failed to initialize fee config: ${errorMessage}\n\nTroubleshooting:\n1. Make sure your wallet is connected and unlocked\n2. You have enough SOL for transaction fees (≈0.001 SOL)\n3. You approve the transaction when your wallet prompts you\n4. Your wallet popup is not blocked by your browser\n\nError details: ${errorMessage}`);
    } finally {
      setInitializingFeeConfig(null);
    }
  };

  const fetchTokens = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tokens')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setTokens(data || []);
    } catch (error: any) {
      console.error('Error fetching tokens:', error);
      alert('Failed to fetch tokens: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) || 0 : value)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingToken) {
        // Update existing token
        const { error } = await supabase
          .from('tokens')
          .update(formData)
          .eq('id', editingToken.id);

        if (error) throw error;
        alert('Token updated successfully!');
      } else {
        // Insert new token
        const { error } = await supabase
          .from('tokens')
          .insert([formData]);

        if (error) throw error;
        alert('Token added successfully!');
      }

      setShowAddModal(false);
      setEditingToken(null);
      resetForm();
      fetchTokens();
    } catch (error: any) {
      console.error('Error saving token:', error);
      alert('Failed to save token: ' + error.message);
    }
  };

  const handleEdit = (token: Token) => {
    setEditingToken(token);
    setFormData({
      key: token.key,
      name: token.name,
      symbol: token.symbol,
      mint_address: token.mint_address,
      decimals: token.decimals,
      coingecko_id: token.coingecko_id || '',
      fallback_price: token.fallback_price || 1,
      is_active: token.is_active,
      display_order: token.display_order || 0
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this token? This will remove it from deposit/withdraw options.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tokens')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Token deleted successfully!');
      fetchTokens();
    } catch (error: any) {
      console.error('Error deleting token:', error);
      alert('Failed to delete token: ' + error.message);
    }
  };

  const handleToggleActive = async (token: Token) => {
    try {
      const { error } = await supabase
        .from('tokens')
        .update({ is_active: !token.is_active })
        .eq('id', token.id);

      if (error) throw error;
      fetchTokens();
    } catch (error: any) {
      console.error('Error toggling token status:', error);
      alert('Failed to update token status: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      key: '',
      name: '',
      symbol: '',
      mint_address: '',
      decimals: 6,
      coingecko_id: '',
      fallback_price: 1,
      is_active: true,
      display_order: 0
    });
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingToken(null);
    resetForm();
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Token Management</h2>
          <p className="text-slate-300 text-sm">Add, edit, and manage tokens for deposit and withdrawal</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + Add New Token
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-white">Loading tokens...</div>
      ) : (
        <div className="bg-white/5 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Key
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Symbol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Mint Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Decimals
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    CoinGecko ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Fee Config
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white/5 divide-y divide-white/10">
                {tokens.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-4 text-center text-slate-300">
                      No tokens found. Add your first token to get started.
                    </td>
                  </tr>
                ) : (
                  tokens.map((token) => {
                    const feeStatus = feeConfigStatus[token.id];
                    const feeConfigExists = feeStatus?.exists || false;
                    
                    return (
                      <tr key={token.id} className={!token.is_active ? 'opacity-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                          {token.key}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                          {token.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                          {token.symbol}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-300">
                          <span className="font-mono text-xs">{token.mint_address}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                          {token.decimals}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                          {token.coingecko_id || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleActive(token)}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                              token.is_active
                                ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                                : 'bg-gray-500/20 text-gray-300 hover:bg-gray-500/30'
                            }`}
                          >
                            {token.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                          {token.display_order}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {feeConfigExists ? (
                            <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs">
                              Initialized
                              {feeStatus?.fee !== null && (
                                <span className="ml-1">({feeStatus.fee.toFixed(4)} {token.symbol})</span>
                              )}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleInitializeFeeConfig(token)}
                              disabled={initializingFeeConfig === token.id || !publicKey}
                              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                initializingFeeConfig === token.id || !publicKey
                                  ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                                  : 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30'
                              }`}
                            >
                              {initializingFeeConfig === token.id ? 'Initializing...' : 'Initialize'}
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleEdit(token)}
                            className="text-purple-400 hover:text-purple-300 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(token.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 text-white">
              {editingToken ? 'Edit Token' : 'Add New Token'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Token Key (Unique Identifier) *
                </label>
                <input
                  type="text"
                  name="key"
                  value={formData.key}
                  onChange={handleInputChange}
                  required
                  disabled={!!editingToken}
                  className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  placeholder="e.g., USDC, TOKEN4"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {editingToken ? 'Key cannot be changed after creation' : 'Must be unique and uppercase'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Display Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., USD Coin"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Symbol *
                </label>
                <input
                  type="text"
                  name="symbol"
                  value={formData.symbol}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., USDC"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Mint Address (Solana) *
                </label>
                <input
                  type="text"
                  name="mint_address"
                  value={formData.mint_address}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                  placeholder="e.g., 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Decimals *
                  </label>
                  <input
                    type="number"
                    name="decimals"
                    value={formData.decimals}
                    onChange={handleInputChange}
                    required
                    min="0"
                    max="18"
                    className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    name="display_order"
                    value={formData.display_order}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  CoinGecko ID (Optional)
                </label>
                <input
                  type="text"
                  name="coingecko_id"
                  value={formData.coingecko_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., usd-coin, solana"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Leave empty if token is not on CoinGecko. Fallback price will be used.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Fallback Price (USD)
                </label>
                <input
                  type="number"
                  name="fallback_price"
                  value={formData.fallback_price}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Used when CoinGecko price is unavailable
                </p>
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    className="rounded border-slate-600 text-purple-600 focus:ring-purple-500 bg-slate-700"
                  />
                  <span className="text-sm font-medium text-slate-300">Active (Available for deposit/withdraw)</span>
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-slate-600 rounded-md text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                >
                  {editingToken ? 'Update Token' : 'Add Token'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

