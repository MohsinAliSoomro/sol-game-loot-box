'use client';

import { useState, useEffect } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import FeeManagement from '@/components/FeeManagement';
import TokenManagement from '@/components/TokenManagement';
import { useWallet } from '@solana/wallet-adapter-react';

import ClientProjectManagement from '@/components/ClientProjectManagement';
import BackendProjectManagement from '@/components/BackendProjectManagement';
import BackendLogin from '@/components/BackendLogin';
import { authAPI } from '@/lib/backend-api';

type Tab = 'fees' | 'tokens' | 'projects' | 'whitelabel';

export default function Home() {
  const { publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState<Tab>('fees');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (authAPI.isAuthenticated()) {
        setIsAuthenticated(true);
      }
      setCheckingAuth(false);
    };
    checkAuth();
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  // Show login if not authenticated
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <BackendLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Master Dashboard</h1>
            <p className="text-slate-300">SOL Fee Management & Token Operations</p>
          </div>
          <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !rounded-lg" />
        </div>

        {/* Main Content */}
        {publicKey ? (
          <div className="space-y-6">
            {/* Tabs */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-2 flex space-x-2">
              <button
                onClick={() => setActiveTab('fees')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'fees'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                Fee Management
              </button>
              <button
                onClick={() => setActiveTab('tokens')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'tokens'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                Token Management
              </button>
              <button
                onClick={() => setActiveTab('projects')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'projects'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                Solana Projects
              </button>
              <button
                onClick={() => setActiveTab('whitelabel')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'whitelabel'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                Whitelabel Projects
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'fees' && <FeeManagement />}
            {activeTab === 'tokens' && <TokenManagement />}
            {activeTab === 'projects' && <ClientProjectManagement />}
            {activeTab === 'whitelabel' && <BackendProjectManagement />}
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center">
            <p className="text-white text-lg">Please connect your wallet to access the dashboard</p>
          </div>
        )}
      </div>
    </div>
  );
}
