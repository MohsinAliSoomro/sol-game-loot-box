"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/service/supabase';
import { useProject } from '@/lib/project-context';

export const useProjectRewards = (lootboxId: string | number | null) => {
  const { getProjectId, currentProject } = useProject();
  const projectId = getProjectId();
  
  const [rewards, setRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRewards = useCallback(async () => {
    const activeProjectId = currentProject?.id || projectId;
    if (!lootboxId || !activeProjectId) {
      console.log(`[REWARDS] No lootboxId or active project ID, clearing data`);
      setRewards([]);
      setLoading(false);
      return;
    }

    console.log(`[REWARDS] Fetching rewards for lootbox ${lootboxId}, project ID: ${activeProjectId}`);

    try {
      setLoading(true);
      setError(null);

      // Fetch token/item/SOL rewards - filtered by product_id (lootbox ID)
      // Note: token_reward_percentages table doesn't have project_id column
      const { data: tokenRows, error: tokenErr } = await supabase
        .from('token_reward_percentages')
        .select('*')
        .eq('product_id', lootboxId)
        .order('reward_price', { ascending: true });

      if (tokenErr) throw tokenErr;

      // Fetch NFT rewards - filtered by product_id (lootbox ID)
      // Note: nft_reward_percentages table may not have project_id column
      const { data: nftRows, error: nftErr } = await supabase
        .from('nft_reward_percentages')
        .select('*')
        .eq('product_id', lootboxId)
        .order('created_at', { ascending: false });

      if (nftErr) throw nftErr;

      // Transform token/item/SOL rewards
      const tokenRewards = (tokenRows || []).map(reward => {
        const isSolReward = reward.reward_name && reward.reward_name.toLowerCase().includes('sol');
        let rewardType = 'token';
        if (isSolReward) {
          rewardType = 'sol';
        } else if (reward.collection && reward.token_id) {
          rewardType = 'nft';
        } else if (reward.reward_name && !isSolReward) {
          rewardType = 'item';
        }
        
        return {
          id: reward.id,
          rewardType: rewardType,
          name: reward.reward_name || 'Reward',
          type: rewardType,
          value: reward.reward_price || '',
          collection: reward.collection || '',
          tokenId: reward.token_id || '',
          tokenSymbol: reward.token_symbol || 'OGX',
          tokenAmount: reward.reward_price || '',
          solAmount: isSolReward ? reward.reward_price : '',
          chance: reward.percentage || 0,
          image: isSolReward 
            ? 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
            : (reward.reward_image || null),
          created_at: reward.created_at
        };
      });

      // Transform NFT rewards
      const nftRewards = (nftRows || []).map(r => ({
        id: r.id,
        rewardType: 'nft',
        name: r.reward_name || r.mint_address,
        type: 'nft',
        value: '',
        tokenAmount: '',
        tokenSymbol: '',
        collection: '',
        tokenId: '',
        mintAddress: r.mint_address,
        chance: r.percentage || 0,
        image: r.reward_image || null, // Use reward_image from database if available
        created_at: r.created_at
      }));

      setRewards([...(nftRewards || []), ...(tokenRewards || [])]);

    } catch (error: any) {
      console.error('Error fetching rewards:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [lootboxId, currentProject?.id, projectId]);

  const addReward = async (rewardData: any) => {
    const activeProjectId = currentProject?.id || projectId;
    if (!activeProjectId) {
      throw new Error('No project ID');
    }
    console.log(`[REWARDS] Adding reward for lootbox ${lootboxId}, project ID: ${activeProjectId}`);

    try {
      // Handle NFT rewards
      if (rewardData.rewardType === 'nft') {
        const insert = {
          product_id: lootboxId,
          reward_name: rewardData.name || rewardData.mintAddress,
          reward_price: '0',
          reward_image: rewardData.nftImage || null,
          mint_address: rewardData.mintAddress,
          percentage: parseFloat(rewardData.chance) || 0,
          is_active: true,
          project_id: activeProjectId
        };

        const { data, error } = await supabase
          .from('nft_reward_percentages')
          .insert([insert])
          .select();

        if (error) throw error;

        const newReward = {
          id: data[0].id,
          rewardType: 'nft',
          name: data[0].mint_address,
          type: 'nft',
          mintAddress: data[0].mint_address,
          chance: data[0].percentage || 0,
          image: null,
          created_at: data[0].created_at
        };
        setRewards(prev => [newReward, ...prev]);
        return newReward;
      }

      // Handle SOL rewards
      if (rewardData.rewardType === 'sol') {
        const solAmount = rewardData.solAmount || rewardData.value;
        const insertData = {
          product_id: lootboxId,
          reward_name: `${solAmount} SOL`,
          reward_price: solAmount.toString(),
          percentage: parseFloat(rewardData.chance) || 0,
          reward_image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
          is_active: true,
          project_id: activeProjectId
        };

        const { data, error: insertError } = await supabase
          .from('token_reward_percentages')
          .insert([insertData])
          .select();

        if (insertError) throw insertError;

        const newReward = {
          id: data[0].id,
          rewardType: 'sol',
          name: data[0].reward_name,
          type: 'sol',
          value: data[0].reward_price,
          tokenAmount: data[0].reward_price,
          solAmount: data[0].reward_price,
          chance: data[0].percentage || 0,
          image: data[0].reward_image,
          created_at: data[0].created_at
        };

        setRewards(prev => [newReward, ...prev]);
        return newReward;
      }

      // Handle other rewards (item/token)
      const insertData: any = {
        product_id: lootboxId,
        reward_name: rewardData.name,
        reward_price: rewardData.rewardType === 'token' ? rewardData.tokenAmount : rewardData.value,
        percentage: parseFloat(rewardData.chance) || 0,
        reward_image: null,
        is_active: true,
        project_id: projectId
      };

      // If this is an on-chain token item, store mint in existing columns.
      // Some schemas use `collection`, others `mint_address` – set both for compatibility.
      if (rewardData.rewardType === 'item' && rewardData.isOnChain && rewardData.tokenMintAddress) {
        insertData.collection = rewardData.tokenMintAddress; // legacy mint column
        insertData.mint_address = rewardData.tokenMintAddress; // explicit mint column
        insertData.token_symbol = rewardData.tokenSymbol || 'Token';
        // Use tokenAmount as reward_price if provided
        if (rewardData.tokenAmount) {
          insertData.reward_price = rewardData.tokenAmount;
        }
      }

      // Handle image upload if provided.
      // For on-chain token items we ALSO allow custom image upload (admin's image takes priority).
      if (rewardData.image) {
        const fileExt = rewardData.image.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `rewards/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('apes-bucket')
          .upload(filePath, rewardData.image);

        if (!uploadError) {
          insertData.reward_image = filePath;
        }
      }

      const { data, error: insertError } = await supabase
        .from('token_reward_percentages')
        .insert([insertData])
        .select();

      if (insertError) throw insertError;

      const isSolReward = data[0].reward_name && data[0].reward_name.toLowerCase().includes('sol');
      const isNFT = data[0].collection && data[0].token_id;
      let rewardType = 'token';
      if (isSolReward) {
        rewardType = 'sol';
      } else if (isNFT) {
        rewardType = 'nft';
      } else if (data[0].reward_name && !isSolReward) {
        rewardType = 'item';
      }
      
      const newReward = {
        id: data[0].id,
        rewardType: rewardType,
        name: data[0].reward_name,
        type: rewardType,
        value: data[0].reward_price,
        collection: data[0].collection || '',
        tokenId: data[0].token_id || '',
        tokenSymbol: data[0].token_symbol || 'OGX',
        tokenAmount: data[0].reward_price,
        solAmount: isSolReward ? data[0].reward_price : '',
        chance: data[0].percentage || 0,
        image: isSolReward 
          ? 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
          : (data[0].reward_image || null),
        created_at: data[0].created_at
      };

      setRewards(prev => [newReward, ...prev]);
      return newReward;

    } catch (error: any) {
      console.error('Error adding reward:', error);
      throw error;
    }
  };

  const updateReward = async (rewardId: number, rewardData: any) => {
    const activeProjectId = currentProject?.id || projectId;
    if (!activeProjectId) {
      throw new Error('No project ID');
    }
    console.log(`[REWARDS] Updating reward ${rewardId} for lootbox ${lootboxId}, project ID: ${activeProjectId}`);

    try {
      // Handle SOL rewards
      if (rewardData.rewardType === 'sol') {
        const solAmount = rewardData.solAmount || rewardData.value;
        const updateData = {
          reward_name: `${solAmount} SOL`,
          reward_price: solAmount.toString(),
          percentage: parseFloat(rewardData.chance) || 0,
          reward_image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
        };

        const { data, error: updateError } = await supabase
          .from('token_reward_percentages')
          .update(updateData)
          .eq('id', rewardId)
          .eq('project_id', activeProjectId)
          .select();

        if (updateError) throw updateError;

        setRewards(prev => prev.map(reward => 
          reward.id === rewardId 
            ? { 
                ...reward, 
                rewardType: 'sol',
                name: data[0].reward_name,
                value: data[0].reward_price,
                tokenAmount: data[0].reward_price,
                solAmount: data[0].reward_price,
                chance: data[0].percentage || 0,
                image: data[0].reward_image
              }
            : reward
        ));

        return data[0];
      }

      // Handle other rewards
      const updateData: any = {
        reward_name: rewardData.name,
        reward_price: rewardData.rewardType === 'token' ? rewardData.tokenAmount : rewardData.value,
        percentage: parseFloat(rewardData.chance) || 0
      };

      // Handle image upload if a new image is provided
      if (rewardData.image && rewardData.image instanceof File) {
        const fileExt = rewardData.image.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `rewards/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('apes-bucket')
          .upload(filePath, rewardData.image);

        if (!uploadError) {
          updateData.reward_image = filePath;
        }
      }

      const { data, error: updateError } = await supabase
        .from('token_reward_percentages')
        .update(updateData)
        .eq('id', rewardId)
        .eq('project_id', activeProjectId)
        .select();

      if (updateError) throw updateError;

      const isSolReward = data[0].reward_name && data[0].reward_name.toLowerCase().includes('sol');
      const isNFT = data[0].collection && data[0].token_id;
      let rewardType = 'token';
      if (isSolReward) {
        rewardType = 'sol';
      } else if (isNFT) {
        rewardType = 'nft';
      } else if (data[0].reward_name && !isSolReward) {
        rewardType = 'item';
      }
      
      setRewards(prev => prev.map(reward => 
        reward.id === rewardId 
          ? { 
              ...reward, 
              rewardType: rewardType,
              name: data[0].reward_name,
              value: data[0].reward_price,
              tokenAmount: data[0].reward_price,
              solAmount: isSolReward ? data[0].reward_price : '',
              chance: data[0].percentage || 0,
              image: isSolReward
                ? 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
                : data[0].reward_image,
              collection: data[0].collection || '',
              tokenId: data[0].token_id || ''
            }
          : reward
      ));

      return data[0];

    } catch (error: any) {
      console.error('Error updating reward:', error);
      throw error;
    }
  };

  const deleteReward = async (rewardId: number) => {
    const activeProjectId = currentProject?.id || projectId;
    if (!activeProjectId) {
      throw new Error('No project ID');
    }
    console.log(`[REWARDS] Deleting reward ${rewardId} for lootbox ${lootboxId}, project ID: ${activeProjectId}`);

    try {
      // Try deleting from both tables (one will succeed)
      const { error: tokenError } = await supabase
        .from('token_reward_percentages')
        .delete()
        .eq('id', rewardId)
        .eq('project_id', activeProjectId);

      if (tokenError) {
        // Try NFT table
        const { error: nftError } = await supabase
          .from('nft_reward_percentages')
          .delete()
          .eq('id', rewardId)
          .eq('project_id', activeProjectId);

        if (nftError) throw nftError;
      }

      setRewards(prev => prev.filter(reward => reward.id !== rewardId));

    } catch (error: any) {
      console.error('Error deleting reward:', error);
      throw error;
    }
  };

  useEffect(() => {
    // Clear data immediately when project or lootbox changes
    if (!lootboxId || !projectId || !currentProject) {
      console.log(`[REWARDS] No lootboxId, projectId, or currentProject, clearing data`);
      setRewards([]);
      setLoading(false);
      return;
    }
    
    // Double-check: Ensure we're using the correct project ID
    if (currentProject.id !== projectId) {
      console.warn(`[REWARDS] Project ID mismatch! currentProject.id=${currentProject.id}, projectId=${projectId}`);
      setRewards([]);
      setLoading(false);
      return;
    }
    
    console.log(`[REWARDS] Fetching rewards for lootbox ${lootboxId}, project: ${projectId} (${currentProject.slug})`);
    // Fetch rewards for the current project and lootbox
    fetchRewards();
  }, [lootboxId, projectId, currentProject?.id, currentProject?.slug, fetchRewards]);

  return {
    rewards,
    loading,
    error,
    addReward,
    updateReward,
    deleteReward,
    refetch: fetchRewards
  };
};

