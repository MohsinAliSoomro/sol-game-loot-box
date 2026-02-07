'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { 
  initSolFeeConfig,
  setSolFeeAmount,
  checkSolFeeConfigExists,
  collectFees, 
  getFeeConfig, 
  getFeeVaultBalance 
} from '@/lib/solana-fee-utils';

const PROGRAM_ID = new PublicKey('BkwbgssSuWQS46MtNRcq5RCnUgYq1H1LJpKhCGUtdGaH');

// SOL mint address
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

/**
 * Format SOL amount to show appropriate decimal places
 * For very small amounts, shows more decimals
 */
function formatSolAmount(lamports: number): string {
  const solAmount = lamports / 1e9;
  
  // For amounts >= 0.0001, show 4 decimals
  if (solAmount >= 0.0001) {
    return solAmount.toFixed(4);
  }
  
  // For amounts < 0.0001, show up to 7 decimals, removing trailing zeros
  const formatted = solAmount.toFixed(7);
  return formatted.replace(/\.?0+$/, '') || '0';
}

export default function FeeManagement() {
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [selectedMint] = useState<string>(SOL_MINT.toBase58());
  const [feeAmount, setFeeAmountInput] = useState<string>('');
  const [currentFee, setCurrentFee] = useState<number | null>(null);
  const [vaultBalance, setVaultBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (publicKey && selectedMint) {
      loadFeeData();
    }
  }, [publicKey, selectedMint]);

  const loadFeeData = async () => {
    if (!publicKey) return;
    
    try {
      setLoading(true);
      const mint = new PublicKey(selectedMint);
      
      // Load current fee
      const fee = await getFeeConfig(connection, mint, PROGRAM_ID);
      console.log('Fee loaded (lamports):', fee);
      console.log('Fee loaded (SOL):', fee / 1e9);
      setCurrentFee(fee);

      // Load vault balance
      const balance = await getFeeVaultBalance(connection, mint, PROGRAM_ID);
      console.log('Vault balance loaded (lamports):', balance);
      setVaultBalance(balance);

      setError(null);
    } catch (err: any) {
      console.error('Error loading fee data:', err);
      setError(err.message || 'Failed to load fee data');
    } finally {
      setLoading(false);
    }
  };

  const handleSetFee = async () => {
    if (!publicKey || !sendTransaction || !feeAmount) {
      setError('Please connect wallet and enter fee amount');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const mint = new PublicKey(selectedMint);
      const feeAmountNum = parseFloat(feeAmount);
      
      if (isNaN(feeAmountNum) || feeAmountNum < 0) {
        throw new Error('Invalid fee amount');
      }

      // Convert to lamports (SOL has 9 decimals)
      const decimals = 9;
      const feeAmountLamports = BigInt(Math.floor(feeAmountNum * Math.pow(10, decimals)));

      // Check if SOL fee config exists
      const feeConfigExists = await checkSolFeeConfigExists(connection, PROGRAM_ID);
      
      let transaction: Transaction;
      
      if (!feeConfigExists) {
        // Initialize SOL fee config if it doesn't exist
        transaction = await initSolFeeConfig(
          connection,
          publicKey,
          mint,
          feeAmountLamports,
          PROGRAM_ID
        );
      } else {
        // Update existing SOL fee config
        transaction = await setSolFeeAmount(
          connection,
          publicKey,
          mint,
          feeAmountLamports,
          PROGRAM_ID
        );
      }

      // Skip preflight to avoid simulation errors in Phantom
      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: true,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
      
      // Wait for confirmation with longer timeout and check for errors
      let confirmation;
      try {
        confirmation = await Promise.race([
          connection.confirmTransaction(signature, 'confirmed'),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Confirmation timeout')), 60000) // 60 second timeout
          )
        ]) as any;
      } catch (err: any) {
        // If timeout, check transaction status manually
        if (err.message === 'Confirmation timeout') {
          const status = await connection.getSignatureStatus(signature);
          if (status.value?.err) {
            throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
          } else if (status.value && !status.value.err) {
            // Transaction succeeded but confirmation timed out
            console.log('Transaction succeeded but confirmation timed out');
            confirmation = status;
          } else {
            throw new Error(`Transaction was not confirmed. Check signature: ${signature}`);
          }
        } else {
          throw err;
        }
      }
      
      // Check if transaction actually succeeded
      if (confirmation.value?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      setSuccess(`Fee amount set successfully! Transaction: ${signature}`);
      setFeeAmountInput('');
      await loadFeeData();
    } catch (err: any) {
      console.error('Error setting fee:', err);
      setError(err.message || 'Failed to set fee amount');
    } finally {
      setLoading(false);
    }
  };

  const handleCollectFees = async () => {
    if (!publicKey || !sendTransaction) {
      setError('Please connect wallet');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const mint = new PublicKey(selectedMint);
      
      // Get owner's token account for destination
      const destinationATA = await getAssociatedTokenAddress(
        mint,
        publicKey,
        false,
        TOKEN_PROGRAM_ID
      );

      const transaction = await collectFees(
        connection,
        publicKey,
        mint,
        destinationATA,
        PROGRAM_ID
      );

      // Skip preflight to avoid simulation errors in Phantom
      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: true,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
      
      await connection.confirmTransaction(signature, 'confirmed');

      setSuccess(`Fees collected successfully! Transaction: ${signature}`);
      await loadFeeData();
    } catch (err: any) {
      console.error('Error collecting fees:', err);
      setError(err.message || 'Failed to collect fees');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Current Fee & Vault Balance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Current Fee Amount</h3>
          {loading ? (
            <p className="text-slate-300">Loading...</p>
          ) : currentFee !== null ? (
            currentFee > 0 ? (
              <p className="text-3xl font-bold text-purple-400">
                {formatSolAmount(currentFee)} SOL
              </p>
            ) : (
              <p className="text-slate-300">Not set (0 SOL)</p>
            )
          ) : (
            <p className="text-slate-300">Not set</p>
          )}
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Fee Vault Balance</h3>
          {loading ? (
            <p className="text-slate-300">Loading...</p>
          ) : vaultBalance !== null && vaultBalance > 0 ? (
            <p className="text-3xl font-bold text-green-400">
              {formatSolAmount(vaultBalance)} SOL
            </p>
          ) : (
            <p className="text-slate-300">No balance</p>
          )}
        </div>
      </div>

      {/* Set Fee Amount */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Set Fee Amount</h2>
        <div className="flex gap-4">
          <input
            type="number"
            value={feeAmount}
            onChange={(e) => setFeeAmountInput(e.target.value)}
            placeholder="Enter fee amount in SOL"
            className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={handleSetFee}
            disabled={loading || !feeAmount}
            className="px-8 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {loading ? 'Setting...' : 'Set Fee'}
          </button>
        </div>
      </div>

      {/* Collect Fees */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Collect Fees</h2>
        <p className="text-slate-300 mb-4">
          Transfer all collected fees from the fee vault to your wallet
        </p>
        <button
          onClick={handleCollectFees}
          disabled={loading || !vaultBalance || vaultBalance === 0}
          className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          {loading ? 'Collecting...' : 'Collect Fees'}
        </button>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-xl p-4">
          <p className="text-red-200">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-500/20 border border-green-500 rounded-xl p-4">
          <p className="text-green-200">{success}</p>
        </div>
      )}
    </div>
  );
}


