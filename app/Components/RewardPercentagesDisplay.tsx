"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "@/service/supabase";

interface RewardPercentage {
  name: string;
  percentage: number;
  type: 'token' | 'nft';
  price: string;
}

/**
 * Reward Percentages Display Component
 * 
 * This component shows the current reward percentages on the wheel
 * without interfering with the existing wheel logic
 */
export default function RewardPercentagesDisplay() {
  const [tokenRewards, setTokenRewards] = useState<RewardPercentage[]>([]);
  const [nftRewards, setNftRewards] = useState<RewardPercentage[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPercentage, setTotalPercentage] = useState(0);

  useEffect(() => {
    loadRewardPercentages();
  }, []);

  const loadRewardPercentages = async () => {
    try {
      setLoading(true);
      
      // Load token rewards
      const { data: tokenData, error: tokenError } = await supabase
        .from('token_reward_percentages')
        .select('*')
        .eq('is_active', true)
        .order('reward_price');

      if (tokenError) {
        console.error('Error loading token rewards:', tokenError);
      } else {
        const tokens = (tokenData || []).map(reward => ({
          name: reward.reward_name,
          percentage: reward.percentage,
          type: 'token' as const,
          price: reward.reward_price
        }));
        setTokenRewards(tokens);
      }

      // Load NFT rewards
      const { data: nftData, error: nftError } = await supabase
        .from('nft_reward_percentages')
        .select('*')
        .eq('is_active', true);

      if (nftError) {
        console.error('Error loading NFT rewards:', nftError);
      } else {
        const nfts = (nftData || []).map(reward => ({
          name: reward.reward_name,
          percentage: reward.percentage,
          type: 'nft' as const,
          price: reward.reward_price
        }));
        setNftRewards(nfts);
      }

      // Calculate total percentage
      const allRewards = [...(tokenData || []), ...(nftData || [])];
      const total = allRewards.reduce((sum, reward) => sum + reward.percentage, 0);
      setTotalPercentage(total);

    } catch (error) {
      console.error('Error loading reward percentages:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mb-6 p-4 bg-white/20 rounded-lg mx-4">
        <div className="text-center text-white">Loading reward percentages...</div>
      </div>
    );
  }

  const allRewards = [...tokenRewards, ...nftRewards];

  return (
    <div className="mb-6 p-4 bg-white/20 rounded-lg mx-4">
      <h3 className="text-lg font-bold text-white mb-3 text-center">🎯 Reward Probabilities</h3>
      
      {/* Token Rewards */}
      {tokenRewards.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-white/80 mb-2">💰 Token Rewards</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {tokenRewards.map((reward, index) => (
              <div key={index} className="bg-white/10 rounded p-2 text-center">
                <div className="text-xs text-white/80">{reward.name}</div>
                <div className="text-sm font-bold text-white">{reward.percentage.toFixed(1)}%</div>
                <div className="text-xs text-white/60">{reward.price} OGX</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NFT Rewards */}
      {nftRewards.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-white/80 mb-2">🎨 NFT Rewards</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {nftRewards.map((reward, index) => (
              <div key={index} className="bg-white/10 rounded p-2 text-center">
                <div className="text-xs text-white/80">{reward.name}</div>
                <div className="text-sm font-bold text-white">{reward.percentage.toFixed(1)}%</div>
                <div className="text-xs text-white/60">{reward.price} NFT</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Total Percentage */}
      <div className="text-center mt-3 pt-3 border-t border-white/20">
        <div className="text-sm text-white/80">Total Probability</div>
        <div className={`text-lg font-bold ${totalPercentage === 100 ? 'text-green-300' : 'text-yellow-300'}`}>
          {totalPercentage.toFixed(1)}%
        </div>
        {totalPercentage !== 100 && (
          <div className="text-xs text-yellow-300 mt-1">
            ⚠️ Should be 100%
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <div className="text-center mt-3">
        <button
          onClick={loadRewardPercentages}
          className="px-3 py-1 bg-white/20 text-white rounded text-xs hover:bg-white/30 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>
    </div>
  );
}
