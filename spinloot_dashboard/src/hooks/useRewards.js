import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const useRewards = (lootboxId) => {
  const [rewards, setRewards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchRewards = async () => {
    if (!lootboxId) {
      setRewards([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Fetch token/item/SOL rewards
      const { data: tokenRows, error: tokenErr } = await supabase
        .from('token_reward_percentages')
        .select('*')
        .eq('product_id', lootboxId)
        .order('reward_price', { ascending: true })

      if (tokenErr) throw tokenErr

      // Fetch NFT rewards (stored separately)
      const { data: nftRows, error: nftErr } = await supabase
        .from('nft_reward_percentages')
        .select('*')
        .eq('product_id', lootboxId)
        .order('created_at', { ascending: false })

      if (nftErr) throw nftErr

      // Transform token/item/SOL rewards
      const tokenRewards = (tokenRows || []).map(reward => {
        // Detect if this is a SOL reward (reward_name contains "SOL")
        const isSolReward = reward.reward_name && reward.reward_name.toLowerCase().includes('sol')
        // Detect reward type based on reward_name and other fields
        let rewardType = 'token' // default
        if (isSolReward) {
          rewardType = 'sol'
        } else if (reward.collection && reward.token_id) {
          rewardType = 'nft'
        } else if (reward.reward_name && !isSolReward) {
          rewardType = 'item'
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
        }
      })

      // Transform NFT rewards (only mint_address and percentage)
      const nftRewards = (nftRows || []).map(r => ({
        id: r.id,
        rewardType: 'nft',
        name: r.mint_address, // display mint; UI can truncate
        type: 'nft',
        value: '',
        tokenAmount: '',
        tokenSymbol: '',
        collection: '',
        tokenId: '',
        mintAddress: r.mint_address,
        chance: r.percentage || 0,
        image: null,
        created_at: r.created_at
      }))

      setRewards([...(nftRewards || []), ...(tokenRewards || [])])

    } catch (error) {
      console.error('Error fetching rewards:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const addReward = async (rewardData) => {
    try {
      // Handle NFT rewards using nft_reward_percentages with only mint_address and percentage
      if (rewardData.rewardType === 'nft') {
          // Check if this NFT is already used in a jackpot
        const { data: jackpotData, error: jackpotError } = await supabase
          .from('jackpot_pools')
          .select('id, name')
          .eq('image', rewardData.mintAddress)
          .limit(1)
        
        if (!jackpotError && jackpotData && jackpotData.length > 0) {
          throw new Error('This NFT is already added to a jackpot. Please select a different NFT.')
        }

        const insert = {
          product_id: lootboxId,
          reward_name: rewardData.name || rewardData.mintAddress, // Use NFT name or fallback to mint
          reward_price: '0', // NFTs don't have a price, set to 0
          reward_image: rewardData.nftImage || null, // Store NFT image URL from metadata
          mint_address: rewardData.mintAddress,
          percentage: parseFloat(rewardData.chance) || 0,
          is_active: true
        }

        const { data, error } = await supabase
          .from('nft_reward_percentages')
          .insert([insert])
          .select()

        if (error) throw error

        const newReward = {
          id: data[0].id,
          rewardType: 'nft',
          name: data[0].mint_address,
          type: 'nft',
          mintAddress: data[0].mint_address,
          chance: data[0].percentage || 0,
          image: null,
          created_at: data[0].created_at
        }
        setRewards(prev => [newReward, ...prev])
        return newReward
      }

      // Handle SOL rewards specially
      if (rewardData.rewardType === 'sol') {
        const solAmount = rewardData.solAmount || rewardData.value
        const insertData = {
          product_id: lootboxId,
          reward_name: `${solAmount} SOL`, // Format: "0.5 SOL"
          reward_price: solAmount.toString(), // SOL amount
          percentage: parseFloat(rewardData.chance) || 0,
          reward_image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png', // Default Solana logo
          is_active: true
        }

        const { data, error: insertError } = await supabase
          .from('token_reward_percentages')
          .insert([insertData])
          .select()

        if (insertError) throw insertError

        // Transform and add to local state
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
        }

        setRewards(prev => [newReward, ...prev])
        return newReward
      }

      // Insert into token_reward_percentages table (for non-SOL rewards)
      const insertData = {
        product_id: lootboxId, // Link to the specific lootbox
        reward_name: rewardData.name,
        reward_price: rewardData.rewardType === 'token' ? rewardData.tokenAmount : rewardData.value,
        percentage: parseFloat(rewardData.chance) || 0,
        reward_image: null, // Will be updated after image upload (unless on-chain token item)
        is_active: true
      }

      // Non-NFT path keeps previous behavior

      // If this is an on-chain token ITEM, store mint + symbol using existing columns.
      // Some schemas use `collection`, others `mint_address` – set both for compatibility.
      if (rewardData.rewardType === 'item' && rewardData.isOnChain && rewardData.tokenMintAddress) {
        insertData.collection = rewardData.tokenMintAddress // legacy mint column
        insertData.mint_address = rewardData.tokenMintAddress // explicit mint column
        insertData.token_symbol = rewardData.tokenSymbol || 'Token'
        // Ensure amount is stored in reward_price
        if (rewardData.tokenAmount) {
          insertData.reward_price = rewardData.tokenAmount
        }
      }

      // Handle image upload if provided.
      // For on-chain token items we ALSO allow custom image upload (admin's image takes priority).
      if (rewardData.image) {
        const fileExt = rewardData.image.name.split('.').pop()
        const fileName = `${Date.now()}.${fileExt}`
        const filePath = `rewards/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('apes-bucket')
          .upload(filePath, rewardData.image)

        if (!uploadError) {
          insertData.reward_image = filePath
        }
      }

      const { data, error: insertError } = await supabase
        .from('token_reward_percentages')
        .insert([insertData])
        .select()

      if (insertError) throw insertError

      // Transform and add to local state
      const isSolReward = data[0].reward_name && data[0].reward_name.toLowerCase().includes('sol')
      const isNFT = data[0].collection && data[0].token_id
      let rewardType = 'token' // default
      if (isSolReward) {
        rewardType = 'sol'
      } else if (isNFT) {
        rewardType = 'nft'
      } else if (data[0].reward_name && !isSolReward) {
        rewardType = 'item'
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
      }

      setRewards(prev => [newReward, ...prev])
      return newReward

    } catch (error) {
      console.error('Error adding reward:', error)
      throw error
    }
  }

  const updateReward = async (rewardId, rewardData) => {
    try {
      // Handle SOL rewards specially
      if (rewardData.rewardType === 'sol') {
        const solAmount = rewardData.solAmount || rewardData.value
        const updateData = {
          reward_name: `${solAmount} SOL`,
          reward_price: solAmount.toString(),
          percentage: parseFloat(rewardData.chance) || 0,
          reward_image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
        }

        const { data, error: updateError } = await supabase
          .from('token_reward_percentages')
          .update(updateData)
          .eq('id', rewardId)
          .select()

        if (updateError) throw updateError

        // Update in local state
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
        ))

        return data[0]
      }

      // Handle non-SOL rewards
      const updateData = {
        reward_name: rewardData.name,
        reward_price: rewardData.rewardType === 'token' ? rewardData.tokenAmount : rewardData.value,
        percentage: parseFloat(rewardData.chance) || 0
      }

      // Handle NFT type
      if (rewardData.rewardType === 'nft') {
        updateData.collection = rewardData.collection
        updateData.token_id = rewardData.tokenId
      }

      // Handle image upload if a new image is provided
      if (rewardData.image && rewardData.image instanceof File) {
        const fileExt = rewardData.image.name.split('.').pop()
        const fileName = `${Date.now()}.${fileExt}`
        const filePath = `rewards/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('apes-bucket')
          .upload(filePath, rewardData.image)

        if (!uploadError) {
          updateData.reward_image = filePath
        }
      }

      const { data, error: updateError } = await supabase
        .from('token_reward_percentages')
        .update(updateData)
        .eq('id', rewardId)
        .select()

      if (updateError) throw updateError

      // Update in local state
      const isSolReward = data[0].reward_name && data[0].reward_name.toLowerCase().includes('sol')
      const isNFT = data[0].collection && data[0].token_id
      let rewardType = 'token' // default
      if (isSolReward) {
        rewardType = 'sol'
      } else if (isNFT) {
        rewardType = 'nft'
      } else if (data[0].reward_name && !isSolReward) {
        rewardType = 'item'
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
      ))

      return data[0]

    } catch (error) {
      console.error('Error updating reward:', error)
      throw error
    }
  }

  const deleteReward = async (rewardId) => {
    try {
      const { error } = await supabase
        .from('token_reward_percentages')
        .delete()
        .eq('id', rewardId)

      if (error) throw error

      // Remove from local state
      setRewards(prev => prev.filter(reward => reward.id !== rewardId))

    } catch (error) {
      console.error('Error deleting reward:', error)
      throw error
    }
  }

  useEffect(() => {
    fetchRewards()
  }, [lootboxId])

  return {
    rewards,
    loading,
    error,
    addReward,
    updateReward,
    deleteReward,
    refetch: fetchRewards
  }
}

