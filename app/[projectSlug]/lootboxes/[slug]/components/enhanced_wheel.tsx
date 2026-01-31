// Enhanced Wheel Component with Real NFT Reward Claiming
// This integrates with the vault program's claim_reward functionality

import React, { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet, useAnchorWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';
import idl from '@/idl/vault.json';

// Program constants
const PROGRAM_ID = new PublicKey('BkwbgssSuWQS46MtNRcq5RCnUgYq1H1LJpKhCGUtdGaH');
const MINT_ADDRESS = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

interface WheelItem {
  id: string;
  name: string;
  color: string;
  textColor: string;
  percentage: number;
  price: string;
  rewardType: 'nft' | 'ogx';
  rewardId: number;
  mintAddress?: string;
}

interface WheelSpinnerProps {
  data: WheelItem[];
  item: any;
  user: any;
  setUser: (user: any) => void;
}

const WheelSpinner = ({ data, item, user, setUser }: WheelSpinnerProps) => {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const wallet = useAnchorWallet();
  
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<WheelItem | null>(null);
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  const [isFreeSpin, setIsFreeSpin] = useState(false);
  const [shuffledData, setShuffledData] = useState<WheelItem[]>([]);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimedRewards, setClaimedRewards] = useState<Set<string>>(new Set());
  const [availableRewards, setAvailableRewards] = useState<WheelItem[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(false);

  const segmentCount = shuffledData.length;
  const segmentAngle = 360 / segmentCount;

  // Initialize Anchor program
  const getProgram = () => {
    if (!wallet) return null;
    
    const provider = new anchor.AnchorProvider(
      connection,
      wallet,
      { 
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
        skipPreflight: false
      }
    );

    anchor.setProvider(provider);
    return new anchor.Program(idl as anchor.Idl, provider);
  };

  // Fetch available rewards from the program
  const fetchAvailableRewards = useCallback(async () => {
    if (!publicKey || !wallet) return;

    setLoadingRewards(true);
    try {
      const program = getProgram();
      if (!program) return;

      // Get all reward entries
      const rewardEntries = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: Buffer.from([163, 52, 200, 231, 140, 3, 69, 186]).toString('base64'), // RewardEntry discriminator
            },
          },
        ],
      });

      const rewards: WheelItem[] = [];

      for (const entry of rewardEntries) {
        const accountData = entry.account.data;
        
        if (accountData.length === 122) { // RewardEntry size
          try {
            const rewardIdBytes = accountData.slice(8, 16);
            const rewardTypeByte = accountData.slice(16, 17);
            const mintBytes = accountData.slice(17, 49);
            const amountBytes = accountData.slice(49, 57);
            const claimedByte = accountData.slice(57, 58);
            
            const rewardId = Buffer.from(rewardIdBytes).readBigUInt64LE();
            const rewardType = rewardTypeByte[0];
            const mint = new PublicKey(mintBytes);
            const amount = Buffer.from(amountBytes).readBigUInt64LE();
            const claimed = claimedByte[0] === 1;
            
            if (!claimed) {
              const reward: WheelItem = {
                id: rewardId.toString(),
                name: rewardType === 0 ? `NFT #${rewardId}` : `${Number(amount) / 1000000} OGX`,
                color: rewardType === 0 ? '#FF6B6B' : '#4ECDC4',
                textColor: '#FFFFFF',
                percentage: 100 / rewardEntries.length, // Equal probability
                price: rewardType === 0 ? '1 NFT' : `${Number(amount) / 1000000} OGX`,
                rewardType: rewardType === 0 ? 'nft' : 'ogx',
                rewardId: Number(rewardId),
                mintAddress: mint.toString()
              };
              
              rewards.push(reward);
            }
          } catch (error) {
            console.error('Error parsing reward entry:', error);
          }
        }
      }

      setAvailableRewards(rewards);
      console.log(`✅ Loaded ${rewards.length} available rewards`);
      
    } catch (error) {
      console.error('Error fetching rewards:', error);
    } finally {
      setLoadingRewards(false);
    }
  }, [publicKey, wallet, connection]);

  useEffect(() => {
    fetchAvailableRewards();
  }, [fetchAvailableRewards]);

  useEffect(() => {
    // Use available rewards instead of static data
    if (availableRewards.length > 0) {
      const shuffled = [...availableRewards].sort(() => Math.random() - 0.5);
      setShuffledData(shuffled);
    } else {
      // Fallback to original data
      const shuffled = [...data].sort(() => Math.random() - 0.5);
      setShuffledData(shuffled);
    }
  }, [data, availableRewards]);

  // Real reward claiming function using the vault program
  const claimReward = useCallback(async (reward: WheelItem) => {
    if (isClaiming || !publicKey || !wallet) return;

    setIsClaiming(true);
    
    try {
      const program = getProgram();
      if (!program) {
        throw new Error('Failed to initialize program');
      }

      console.log(`🎁 Claiming reward: ${reward.name} (ID: ${reward.rewardId})`);

      // Get required accounts
      const mint = new PublicKey(reward.mintAddress!);
      
      // Get reward pool PDA
      const [rewardPoolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('reward_pool')],
        PROGRAM_ID
      );

      // Get reward entry PDA
      const [rewardEntryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('reward_entry'), Buffer.from(reward.rewardId.toString())],
        PROGRAM_ID
      );

      // Get user ATA
      const userAta = await getAssociatedTokenAddress(mint, publicKey);

      // Get reward pool authority
      const [rewardPoolAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from('reward_pool'), mint.toBuffer()],
        PROGRAM_ID
      );

      // Get reward vault ATA
      const rewardVaultAta = await getAssociatedTokenAddress(
        mint,
        rewardPoolAuthority,
        true
      );

      // Call claim_reward instruction
      const tx = await program.methods
        .claimReward(new anchor.BN(reward.rewardId))
        .accounts({
          user: publicKey,
          mint: mint,
          rewardPool: rewardPoolPda,
          rewardEntry: rewardEntryPda,
          userAta: userAta,
          rewardPoolAuthority: rewardPoolAuthority,
          rewardVaultAta: rewardVaultAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc({
          skipPreflight: false,
          commitment: 'confirmed',
          maxRetries: 3
        });

      console.log(`✅ Reward claimed successfully! Transaction: ${tx}`);

      // Mark as claimed
      setClaimedRewards(prev => new Set([...prev, reward.id]));
      
      // Show success message
      alert(`🎉 Reward Claimed!\n\nYou won ${reward.name}!\n\nTransaction: ${tx}\n\nThe ${reward.rewardType === 'nft' ? 'NFT' : 'OGX tokens'} has been transferred to your wallet!`);

      // Refresh available rewards
      await fetchAvailableRewards();

    } catch (error) {
      console.error('Error claiming reward:', error);
      
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        if (error.message.includes('RewardAlreadyClaimed')) {
          errorMessage = 'This reward has already been claimed.';
        } else if (error.message.includes('InvalidRewardId')) {
          errorMessage = 'Invalid reward ID.';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for transaction fees.';
        } else {
          errorMessage = error.message;
        }
      }
      
      alert(`❌ Error claiming reward: ${errorMessage}`);
    } finally {
      setIsClaiming(false);
    }
  }, [isClaiming, publicKey, wallet, connection, fetchAvailableRewards]);

  const getRandomReward = () => {
    if (shuffledData.length === 0) return null;
    
    const totalProbability = shuffledData.reduce((sum, item) => sum + item.percentage, 0);
    let random = Math.random() * totalProbability;
    
    for (const item of shuffledData) {
      random -= item.percentage;
      if (random <= 0) {
        return item;
      }
    }
    
    return shuffledData[0];
  };

  const spinWheel = () => {
    if (isSpinning) return;
    
    const selectedReward = getRandomReward();
    if (!selectedReward) return;
    
    setIsSpinning(true);
    setWinner(selectedReward);
    
    // Calculate rotation
    const randomRotation = Math.random() * 360;
    const finalRotation = rotation + 1800 + randomRotation; // 5 full rotations + random
    
    setRotation(finalRotation);
    
    // Show winner after animation
    setTimeout(() => {
      setIsSpinning(false);
      setShowWinnerDialog(true);
    }, 3000);
  };

  const closeWinnerDialog = () => {
    setShowWinnerDialog(false);
    setWinner(null);
  };

  if (loadingRewards) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading available rewards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wheel-container">
      {/* Wheel */}
      <div className="wheel-wrapper">
        <div 
          className="wheel"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: isSpinning ? 'transform 3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none'
          }}
        >
          {shuffledData.map((item, index) => (
            <div
              key={index}
              className="wheel-segment"
              style={{
                transform: `rotate(${index * segmentAngle}deg)`,
                backgroundColor: item.color,
                color: item.textColor
              }}
            >
              <div className="segment-content">
                <div className="segment-text">{item.name}</div>
                <div className="segment-price">{item.price}</div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Spin Button */}
        <button
          onClick={spinWheel}
          disabled={isSpinning || shuffledData.length === 0}
          className="spin-button"
        >
          {isSpinning ? 'Spinning...' : 'SPIN WHEEL'}
        </button>
      </div>

      {/* Winner Dialog */}
      {showWinnerDialog && winner && (
        <div className="winner-dialog-overlay">
          <div className="winner-dialog">
            <div className="winner-content">
              <h2 className="winner-title">🎉 Congratulations!</h2>
              <div className="winner-reward">
                <div className="reward-name">{winner.name}</div>
                <div className="reward-price">{winner.price}</div>
                <div className="reward-type">
                  {winner.rewardType === 'nft' ? '🎨 NFT Reward' : '💰 OGX Reward'}
                </div>
              </div>
              
              <div className="winner-actions">
                <button
                  onClick={() => claimReward(winner)}
                  disabled={isClaiming || claimedRewards.has(winner.id)}
                  className="claim-button"
                >
                  {isClaiming ? 'Claiming...' : 
                   claimedRewards.has(winner.id) ? 'Already Claimed' : 
                   'Claim Reward'}
                </button>
                
                <button
                  onClick={closeWinnerDialog}
                  className="close-button"
                >
                  Close
                </button>
              </div>
              
              {claimedRewards.has(winner.id) && (
                <div className="claimed-notice">
                  ✅ This reward has been claimed!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Available Rewards Info */}
      <div className="rewards-info">
        <h3>Available Rewards ({availableRewards.length})</h3>
        <div className="rewards-list">
          {availableRewards.map((reward, index) => (
            <div key={index} className="reward-item">
              <span className="reward-name">{reward.name}</span>
              <span className="reward-type">{reward.rewardType.toUpperCase()}</span>
              {claimedRewards.has(reward.id) && (
                <span className="claimed-badge">CLAIMED</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WheelSpinner;
