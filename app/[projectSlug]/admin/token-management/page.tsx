"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/service/supabase';
import { useProject } from '@/lib/project-context';

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL

interface ProjectToken {
  id: number;
  project_id: number;
  name: string;
  symbol: string;
  mint_address: string;
  decimals: number;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
  coingecko_id?: string;
  fallback_price?: number;
  exchange_rate_to_sol?: number;
  token_type?: 'offchain' | 'onchain';
  created_at: string;
  updated_at: string;
}

type TabType = 'offchain' | 'onchain';

export default function TokenManagement() {
  const { getProjectId, currentProject } = useProject();
  const projectId = getProjectId();
  const [activeTab, setActiveTab] = useState<TabType>('offchain');
  const [offchainToken, setOffchainToken] = useState<ProjectToken | null>(null);
  const [onchainTokens, setOnchainTokens] = useState<ProjectToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tokenLimit, setTokenLimit] = useState<number | null>(null);
  
  // Form state for offchain token
  const [showOffchainForm, setShowOffchainForm] = useState(false);
  const [offchainFormData, setOffchainFormData] = useState({
    name: '',
    symbol: ''
  });

  // Form state for onchain tokens
  const [showOnchainForm, setShowOnchainForm] = useState(false);
  const [editingOnchainToken, setEditingOnchainToken] = useState<ProjectToken | null>(null);
  const [onchainFormData, setOnchainFormData] = useState({
    name: '',
    symbol: '',
    mint_address: '',
    decimals: 6,
    is_active: true,
    display_order: 0,
    coingecko_id: '',
    fallback_price: 1
  });

  useEffect(() => {
    if (projectId) {
      fetchTokens();
    }
  }, [projectId]);

  const getAuthToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`project_${projectId}_token`) || '';
    }
    return '';
  };

  const fetchTokens = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();

      // Fetch offchain token
      const offchainResponse = await fetch(`${BACKEND_API_URL}/api/projects/${projectId}/tokens?token_type=offchain`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const offchainData = await offchainResponse.json();
      console.log('Offchain API Response:', offchainData);
      if (offchainResponse.ok && offchainData.data && offchainData.data.length > 0) {
        setOffchainToken(offchainData.data[0]);
        // Set token limit from response if available
        if (offchainData.token_limit !== undefined) {
          console.log('Setting token limit from offchain:', offchainData.token_limit);
          setTokenLimit(offchainData.token_limit);
        }
      } else {
        setOffchainToken(null);
      }

      // Fetch onchain tokens
      const onchainResponse = await fetch(`${BACKEND_API_URL}/api/projects/${projectId}/tokens?token_type=onchain`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const onchainData = await onchainResponse.json();
      console.log('Onchain API Response:', onchainData);
      if (onchainResponse.ok) {
        setOnchainTokens(onchainData.data || []);
        // Set token limit from response if available (in case offchain token doesn't exist)
        if (onchainData.token_limit !== undefined && tokenLimit === null) {
          console.log('Setting token limit from onchain:', onchainData.token_limit);
          setTokenLimit(onchainData.token_limit);
        }
      } else {
        setOnchainTokens([]);
      }
    } catch (error: any) {
      console.error('Error fetching tokens:', error);
      setError(error.message || 'Failed to fetch tokens');
    } finally {
      setLoading(false);
    }
  };

  // Validate Solana mint address format
  const isValidSolanaAddress = (address: string): boolean => {
    if (!address || address.length < 32 || address.length > 44) {
      return false;
    }
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    return base58Regex.test(address);
  };

  // Offchain token handlers
  const handleCreateOffchainToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    setError(null);
    setSuccess(null);

    if (!offchainFormData.name || !offchainFormData.symbol) {
      setError('Token name and symbol are required');
      return;
    }

    try {
      const token = getAuthToken();
      const response = await fetch(`${BACKEND_API_URL}/api/projects/${projectId}/tokens`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: offchainFormData.name.trim(),
          symbol: offchainFormData.symbol.toUpperCase().trim(),
          token_type: 'offchain',
          mint_address: 'OFFCHAIN',
          decimals: 6,
          is_default: true,
          is_active: true
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create off-chain token');
      }

      setSuccess('Off-chain token created successfully!');
      setShowOffchainForm(false);
      setOffchainFormData({ name: '', symbol: '' });
      fetchTokens();
    } catch (error: any) {
      console.error('Error creating off-chain token:', error);
      setError(error.message || 'Failed to create off-chain token');
    }
  };

  const handleUpdateOffchainToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !offchainToken) return;

    setError(null);
    setSuccess(null);

    if (!offchainFormData.name || !offchainFormData.symbol) {
      setError('Token name and symbol are required');
      return;
    }

    try {
      const token = getAuthToken();
      const response = await fetch(`${BACKEND_API_URL}/api/projects/${projectId}/tokens/${offchainToken.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: offchainFormData.name.trim(),
          symbol: offchainFormData.symbol.toUpperCase().trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update off-chain token');
      }

      setSuccess('Off-chain token updated successfully!');
      setShowOffchainForm(false);
      fetchTokens();
    } catch (error: any) {
      console.error('Error updating off-chain token:', error);
      setError(error.message || 'Failed to update off-chain token');
    }
  };

  const startEditOffchain = () => {
    if (offchainToken) {
      setOffchainFormData({
        name: offchainToken.name,
        symbol: offchainToken.symbol
      });
      setShowOffchainForm(true);
    }
  };

  // Onchain token handlers
  const handleAddOnchainToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    setError(null);
    setSuccess(null);

    // Check token limit before adding (only count on-chain tokens)
    if (tokenLimit !== null) {
      const currentOnchainTokenCount = onchainTokens.length;
      if (currentOnchainTokenCount >= tokenLimit) {
        setError(`On-chain token limit reached. This project has a maximum of ${tokenLimit} on-chain token(s). Current count: ${currentOnchainTokenCount}. Please delete an existing on-chain token before adding a new one.`);
        return;
      }
    }

    if (!isValidSolanaAddress(onchainFormData.mint_address)) {
      setError('Invalid mint address. Please enter a valid Solana mint address (32-44 characters, Base58 encoded).');
      return;
    }

    try {
      const token = getAuthToken();
      const response = await fetch(`${BACKEND_API_URL}/api/projects/${projectId}/tokens`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...onchainFormData,
          token_type: 'onchain',
          decimals: parseInt(onchainFormData.decimals.toString()),
          display_order: parseInt(onchainFormData.display_order.toString()) || 0,
          fallback_price: parseFloat(onchainFormData.fallback_price.toString()) || 1,
          coingecko_id: onchainFormData.coingecko_id || null,
          is_default: false
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create on-chain token');
      }

      setSuccess('On-chain token created successfully!');
      setShowOnchainForm(false);
      resetOnchainForm();
      fetchTokens();
    } catch (error: any) {
      console.error('Error creating on-chain token:', error);
      setError(error.message || 'Failed to create on-chain token');
    }
  };

  const handleUpdateOnchainToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !editingOnchainToken) return;

    setError(null);
    setSuccess(null);

    if (!isValidSolanaAddress(onchainFormData.mint_address)) {
      setError('Invalid mint address. Please enter a valid Solana mint address (32-44 characters, Base58 encoded).');
      return;
    }

    try {
      const token = getAuthToken();
      const response = await fetch(`${BACKEND_API_URL}/api/projects/${projectId}/tokens/${editingOnchainToken.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...onchainFormData,
          decimals: parseInt(onchainFormData.decimals.toString()),
          display_order: parseInt(onchainFormData.display_order.toString()) || 0,
          fallback_price: parseFloat(onchainFormData.fallback_price.toString()) || 1,
          coingecko_id: onchainFormData.coingecko_id || null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update on-chain token');
      }

      setSuccess('On-chain token updated successfully!');
      setEditingOnchainToken(null);
      resetOnchainForm();
      fetchTokens();
    } catch (error: any) {
      console.error('Error updating on-chain token:', error);
      setError(error.message || 'Failed to update on-chain token');
    }
  };

  const handleDeleteOnchainToken = async (tokenId: number) => {
    if (!projectId) return;
    if (!confirm('Are you sure you want to delete this on-chain token? This action cannot be undone.')) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const token = getAuthToken();
      const response = await fetch(`${BACKEND_API_URL}/api/projects/${projectId}/tokens/${tokenId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete on-chain token');
      }

      setSuccess('On-chain token deleted successfully!');
      fetchTokens();
    } catch (error: any) {
      console.error('Error deleting on-chain token:', error);
      setError(error.message || 'Failed to delete on-chain token');
    }
  };

  const startEditOnchain = (token: ProjectToken) => {
    setEditingOnchainToken(token);
    setOnchainFormData({
      name: token.name,
      symbol: token.symbol,
      mint_address: token.mint_address,
      decimals: token.decimals,
      is_active: token.is_active,
      display_order: token.display_order,
      coingecko_id: token.coingecko_id || '',
      fallback_price: token.fallback_price || 1
    });
    setShowOnchainForm(true);
  };

  const resetOnchainForm = () => {
    setOnchainFormData({
      name: '',
      symbol: '',
      mint_address: '',
      decimals: 6,
      is_active: true,
      display_order: 0,
      coingecko_id: '',
      fallback_price: 1
    });
    setEditingOnchainToken(null);
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">No project selected. Please select a project first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Token Management</h1>
          <p className="text-sm text-gray-500 mt-1">
          Manage tokens for <strong>{currentProject?.name || 'this project'}</strong>
        </p>
        {tokenLimit !== null && (
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>On-Chain Token Limit:</strong> {onchainTokens.length} / {tokenLimit} on-chain tokens used
              {onchainTokens.length >= tokenLimit && (
                <span className="ml-2 text-red-600 font-semibold">(Limit Reached)</span>
              )}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('offchain')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'offchain'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Off-Chain Token
          </button>
          <button
            onClick={() => setActiveTab('onchain')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'onchain'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            On-Chain Tokens
          </button>
        </nav>
      </div>

      {/* Off-Chain Token Tab */}
      {activeTab === 'offchain' && (
        <div>
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Off-Chain Token:</strong> This is your project&apos;s native token. Users receive this token when they deposit. You can only have one off-chain token per project. You can edit its name and symbol.
            </p>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading...</p>
            </div>
          ) : offchainToken ? (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Current Off-Chain Token</h2>
                  <p className="text-sm text-gray-500 mt-1">This is your project&apos;s native token</p>
                </div>
                <button
                  onClick={startEditOffchain}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Edit Token
                </button>
              </div>

              {!showOffchainForm ? (
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Token Name:</span>
                    <p className="text-lg font-semibold text-gray-900">{offchainToken.name}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Token Symbol:</span>
                    <p className="text-lg font-semibold text-gray-900">{offchainToken.symbol}</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleUpdateOffchainToken} className="space-y-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Token Name *</label>
                    <input
                      type="text"
                      required
                      value={offchainFormData.name}
                      onChange={(e) => setOffchainFormData({ ...offchainFormData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-gray-800 !text-white placeholder:text-gray-400"
                      style={{ color: 'white' }}
                      placeholder="e.g., Project Token"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Token Symbol *</label>
                    <input
                      type="text"
                      required
                      value={offchainFormData.symbol}
                      onChange={(e) => setOffchainFormData({ ...offchainFormData, symbol: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-gray-800 !text-white placeholder:text-gray-400"
                      style={{ color: 'white' }}
                      placeholder="e.g., TOKEN, MLT"
                      maxLength={10}
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                    >
                      Update Token
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowOffchainForm(false);
                        setOffchainFormData({ name: '', symbol: '' });
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Create Off-Chain Token</h2>
              <p className="text-sm text-gray-500 mb-4">Create your project&apos;s native token. This is the token users will receive when they deposit.</p>
              <form onSubmit={handleCreateOffchainToken} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Token Name *</label>
                  <input
                    type="text"
                    required
                    value={offchainFormData.name}
                    onChange={(e) => setOffchainFormData({ ...offchainFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-gray-800 !text-white placeholder:text-gray-400"
                    style={{ color: 'white' }}
                    placeholder="e.g., Project Token"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Token Symbol *</label>
                  <input
                    type="text"
                    required
                    value={offchainFormData.symbol}
                    onChange={(e) => setOffchainFormData({ ...offchainFormData, symbol: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-gray-800 !text-white placeholder:text-gray-400"
                    style={{ color: 'white' }}
                    placeholder="e.g., TOKEN, MLT"
                    maxLength={10}
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Create Token
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* On-Chain Tokens Tab */}
      {activeTab === 'onchain' && (
        <div>
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">
              <strong>On-Chain Tokens:</strong> These are payment tokens (like SOL, USDC) that users can use to buy your project&apos;s off-chain token. SOL is always available by default. You can add additional payment tokens here.
            </p>
          </div>

          {!showOnchainForm && (
            <div className="mb-4">
              <button
                onClick={() => {
                  // Check token limit before showing form (only count on-chain tokens)
                  if (tokenLimit !== null) {
                    const currentOnchainTokenCount = onchainTokens.length;
                    if (currentOnchainTokenCount >= tokenLimit) {
                      setError(`On-chain token limit reached. This project has a maximum of ${tokenLimit} on-chain token(s). Current count: ${currentOnchainTokenCount}. Please delete an existing on-chain token before adding a new one.`);
                      return;
                    }
                  }
                  resetOnchainForm();
                  setShowOnchainForm(true);
                }}
                disabled={tokenLimit !== null && onchainTokens.length >= tokenLimit}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                + Add On-Chain Token
              </button>
            </div>
          )}

          {showOnchainForm && (
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
                {editingOnchainToken ? 'Edit On-Chain Token' : 'Add New On-Chain Token'}
          </h2>
              <form onSubmit={editingOnchainToken ? handleUpdateOnchainToken : handleAddOnchainToken} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Token Name *</label>
                <input
                  type="text"
                  required
                      value={onchainFormData.name}
                      onChange={(e) => setOnchainFormData({ ...onchainFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-gray-800 !text-white placeholder:text-gray-400"
                  style={{ color: 'white' }}
                      placeholder="e.g., USD Coin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Symbol *</label>
                <input
                  type="text"
                  required
                      value={onchainFormData.symbol}
                      onChange={(e) => setOnchainFormData({ ...onchainFormData, symbol: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-gray-800 !text-white placeholder:text-gray-400"
                  style={{ color: 'white' }}
                      placeholder="e.g., USDC"
                  maxLength={10}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mint Address * 
                  <span className="text-xs text-gray-500 font-normal ml-2">(Solana Token Mint Address)</span>
                </label>
                <input
                  type="text"
                  required
                      value={onchainFormData.mint_address}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                        setOnchainFormData({ ...onchainFormData, mint_address: value });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-sm bg-gray-800 !text-white placeholder:text-gray-400"
                  style={{ color: 'white' }}
                      placeholder="Enter 32-44 character Solana mint address"
                      disabled={!!editingOnchainToken}
                />
                    <p className="text-xs text-gray-500 mt-1">
                    💡 The mint address is the unique identifier for your token on Solana blockchain.
                  </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Decimals *</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="18"
                      value={onchainFormData.decimals}
                      onChange={(e) => setOnchainFormData({ ...onchainFormData, decimals: parseInt(e.target.value) || 6 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-gray-800 !text-white placeholder:text-gray-400"
                  style={{ color: 'white' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                <input
                  type="number"
                      value={onchainFormData.display_order}
                      onChange={(e) => setOnchainFormData({ ...onchainFormData, display_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-gray-800 !text-white placeholder:text-gray-400"
                  style={{ color: 'white' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CoinGecko ID (optional)</label>
                <input
                  type="text"
                      value={onchainFormData.coingecko_id}
                      onChange={(e) => setOnchainFormData({ ...onchainFormData, coingecko_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-gray-800 !text-white placeholder:text-gray-400"
                  style={{ color: 'white' }}
                      placeholder="e.g., usd-coin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fallback Price (USD)</label>
                <input
                  type="number"
                  step="0.01"
                      value={onchainFormData.fallback_price}
                      onChange={(e) => setOnchainFormData({ ...onchainFormData, fallback_price: parseFloat(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-gray-800 !text-white placeholder:text-gray-400"
                  style={{ color: 'white' }}
                />
              </div>
            </div>
                <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                      checked={onchainFormData.is_active}
                      onChange={(e) => setOnchainFormData({ ...onchainFormData, is_active: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                    {editingOnchainToken ? 'Update Token' : 'Add Token'}
              </button>
              <button
                type="button"
                    onClick={() => {
                      setShowOnchainForm(false);
                      resetOnchainForm();
                    }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
          <p className="text-gray-500 mt-2">Loading tokens...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
              {/* SOL is always available */}
              <div className="p-4 bg-gray-50 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">SOL (Solana)</p>
                    <p className="text-sm text-gray-500">Native token - Always available by default</p>
                  </div>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                    Default Payment Token
                  </span>
                </div>
              </div>

              {onchainTokens.length === 0 ? (
            <div className="p-8 text-center">
                  <p className="text-gray-500 mb-4">No additional on-chain tokens found. SOL is always available.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Mint Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Decimals</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                      {onchainTokens.map((token) => (
                    <tr key={token.id} className={!token.is_active ? 'opacity-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {token.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="font-bold">{token.symbol}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 min-w-[200px]">
                        <span className="font-mono text-xs break-all">{token.mint_address}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {token.decimals}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          token.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {token.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                              onClick={() => startEditOnchain(token)}
                          className="text-orange-600 hover:text-orange-900"
                        >
                          Edit
                        </button>
                          <button
                              onClick={() => handleDeleteOnchainToken(token.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
