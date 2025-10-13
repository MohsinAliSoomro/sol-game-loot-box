"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "@/service/supabase";

interface TokenReward {
  id: number;
  reward_name: string;
  reward_image: string;
  reward_price: string;
  percentage: number;
  is_active: boolean;
}

/**
 * Token Reward Percentages Admin
 * 
 * This component allows admins to manage token reward percentages only
 * NFT rewards are handled automatically when NFTs are deposited
 */
export default function TokenRewardPercentagesAdmin() {
  const [rewards, setRewards] = useState<TokenReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPercentage, setEditPercentage] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [totalPercentage, setTotalPercentage] = useState(0);

  useEffect(() => {
    loadRewards();
  }, []);

  const loadRewards = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('token_reward_percentages')
        .select('*')
        .eq('is_active', true)
        .order('reward_price');

      if (error) {
        console.error('Error loading token rewards:', error);
        return;
      }

      setRewards(data || []);
      calculateTotalPercentage(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalPercentage = (rewardsList: TokenReward[]) => {
    const total = rewardsList.reduce((sum, reward) => sum + reward.percentage, 0);
    setTotalPercentage(total);
  };

  const startEdit = (reward: TokenReward) => {
    setEditingId(reward.id);
    setEditPercentage(reward.percentage);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPercentage(0);
  };

  const savePercentage = async (rewardId: number) => {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('token_reward_percentages')
        .update({ 
          percentage: editPercentage,
          updated_at: new Date().toISOString()
        })
        .eq('id', rewardId);

      if (error) {
        console.error('Error updating percentage:', error);
        alert('Error updating percentage: ' + error.message);
        return;
      }

      await loadRewards();
      setEditingId(null);
      setEditPercentage(0);
      
      console.log(`✅ Updated token reward ${rewardId} percentage to ${editPercentage}%`);
    } catch (error) {
      console.error('Error saving percentage:', error);
      alert('Error saving percentage');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">Loading token rewards...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">💰 Token Reward Percentages</h2>
        <p className="text-gray-600">Manage token reward percentages. NFT rewards are handled automatically when deposited.</p>
      </div>

      {/* Total Percentage Display */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-blue-800">Total Token Percentage:</span>
          <span className={`text-2xl font-bold ${totalPercentage === 100 ? 'text-green-600' : 'text-red-600'}`}>
            {totalPercentage.toFixed(2)}%
          </span>
        </div>
        {totalPercentage !== 100 && (
          <p className="text-sm text-red-600 mt-2">
            ⚠️ Total should be 100%. Current difference: {(100 - totalPercentage).toFixed(2)}%
          </p>
        )}
      </div>

      {/* Token Rewards List */}
      <div className="space-y-4">
        {rewards.map((reward) => (
          <div
            key={reward.id}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">💰</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">{reward.reward_name}</h3>
                <p className="text-sm text-gray-600">{reward.reward_price} OGX</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {editingId === reward.id ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={editPercentage}
                    onChange={(e) => setEditPercentage(parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                  />
                  <span className="text-gray-600">%</span>
                  <button
                    onClick={() => savePercentage(reward.id)}
                    disabled={saving}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : '✅'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    ❌
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-orange-600">
                      {reward.percentage.toFixed(2)}%
                    </div>
                    <div className="text-sm text-gray-500">
                      {((reward.percentage / totalPercentage) * 100).toFixed(1)}% of total
                    </div>
                  </div>
                  <button
                    onClick={() => startEdit(reward)}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    ✏️ Edit
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <h3 className="font-semibold text-yellow-800 mb-2">📋 Instructions:</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Click &quot;Edit&quot; to change a token reward&apos;s percentage</li>
          <li>• Total token percentage should equal 100%</li>
          <li>• NFT rewards are added automatically when NFTs are deposited</li>
          <li>• Higher percentages = more likely to win that reward</li>
          <li>• Changes take effect immediately on the wheel</li>
        </ul>
      </div>
    </div>
  );
}
