import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const useJackpotPools = () => {
  const [jackpots, setJackpots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchJackpots = async () => {
    try {
      setLoading(true)
      setError(null)

      // MAIN PROJECT ONLY: Filter for jackpots where project_id IS NULL (legacy main project data)
      // This isolates the main project from sub-projects
      const { data, error: fetchError } = await supabase
        .from('jackpot_pools')
        .select('*')
        .is('project_id', null) // Only show main project jackpots (no project_id)
        .order('id', { ascending: true })

      if (fetchError) {
        throw fetchError
      }

      // Transform the data to match the expected format
      const transformedJackpots = data?.map(jackpot => ({
        id: jackpot.id,
        name: jackpot.name,
        title: jackpot.name, // Use name as title
        description: jackpot.description,
        timer: jackpot.end_time ? new Date(jackpot.end_time).toLocaleString() : 'No end time',
        ticketSold: 0, // This would need to be calculated from ticket sales
        price: jackpot.ticket_price || 0,
        currentAmount: jackpot.current_amount || 0,
        maxTickets: jackpot.max_tickets || 0,
        endTime: jackpot.end_time,
        isActive: jackpot.is_active,
        image: jackpot.image,
        itemPrice: jackpot.item_price || 0,
        createdAt: jackpot.created_at,
        updatedAt: jackpot.updated_at
      })) || []

      setJackpots(transformedJackpots)

    } catch (error) {
      console.error('Error fetching jackpots:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const addJackpot = async (jackpotData) => {
    try {
      let imageUrl = null

      // Handle image upload if provided
      if (jackpotData.image) {
        // Check if it's a File object (image upload) or string (NFT mint address or image URL)
        if (typeof jackpotData.image === 'string') {
          // Check if it's already a valid HTTP URL (new format - image URL stored directly)
          const isImageUrl = jackpotData.image.startsWith('http://') || jackpotData.image.startsWith('https://')
          
          if (isImageUrl) {
            // It's already an image URL, use it directly
            imageUrl = jackpotData.image
          } else {
            // It's an NFT mint address, check if it's already used
            const isNFT = jackpotData.image.length >= 32 && 
                         jackpotData.image.length <= 44 && 
                         !jackpotData.image.includes('/') &&
                         !jackpotData.image.includes('.')
            
            if (isNFT) {
              // Check if this NFT is already used in another jackpot
              const exists = await checkNFTExists(jackpotData.image)
              if (exists) {
                throw new Error('This NFT is already added to another jackpot. Please select a different NFT.')
              }
              
              // Check if this NFT is already used in a lootbox
              const { data: lootboxData, error: lootboxError } = await supabase
                .from('nft_reward_percentages')
                .select('id, product_id')
                .eq('mint_address', jackpotData.image)
                .limit(1)
              
              if (!lootboxError && lootboxData && lootboxData.length > 0) {
                throw new Error('This NFT is already added to a lootbox. Please select a different NFT.')
              }
              
              // Check if this NFT is in a user's cart (prizeWin with isWithdraw: false and reward_type: 'nft')
              // NFTs in cart are won by users but not yet claimed - they shouldn't be reused in jackpots
              const { data: cartData, error: cartError } = await supabase
                .from('prizeWin')
                .select('id, userId, isWithdraw, reward_type')
                .eq('mint', jackpotData.image)
                .eq('isWithdraw', false) // Block if in user's cart (won but not claimed)
                .eq('reward_type', 'nft') // Only check NFT rewards (not SOL rewards)
                .limit(1)
              
              if (!cartError && cartData && cartData.length > 0) {
                throw new Error('This NFT is currently in a user\'s cart (won but not yet claimed). It cannot be added to a jackpot until the user claims it.')
              }
            }
            
            // Use mint address (old format) or image URL (new format)
            imageUrl = jackpotData.image
          }
        } else if (jackpotData.image.name) {
          // It's a file upload
          const fileExt = jackpotData.image.name.split('.').pop()
          const fileName = `${Date.now()}.${fileExt}`
          const filePath = `jackpots/${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('apes-bucket')
            .upload(filePath, jackpotData.image)

          if (uploadError) {
            console.error('Error uploading image:', uploadError)
            // Continue without image if upload fails
          } else {
            imageUrl = filePath
          }
        }
      }

      const { data, error } = await supabase
        .from('jackpot_pools')
        .insert([
          {
            name: jackpotData.name,
            description: jackpotData.description,
            current_amount: 0,
            ticket_price: jackpotData.price || 0,
            max_tickets: jackpotData.maxTickets || 1000,
            end_time: jackpotData.endTime || null,
            is_active: jackpotData.isActive !== false,
            image: imageUrl,
            item_price: jackpotData.itemPrice || 0
          }
        ])
        .select()

      if (error) {
        console.error('Database error:', error)
        if (error.code === '23505') {
          throw new Error('A jackpot with this ID already exists. Please refresh the page and try again.')
        }
        throw error
      }

      const newJackpot = {
        id: data[0].id,
        name: data[0].name,
        title: data[0].name,
        description: data[0].description,
        timer: data[0].end_time ? new Date(data[0].end_time).toLocaleString() : 'No end time',
        ticketSold: 0,
        price: data[0].ticket_price || 0,
        currentAmount: 0,
        maxTickets: data[0].max_tickets || 0,
        endTime: data[0].end_time,
        isActive: data[0].is_active,
        image: data[0].image,
        itemPrice: data[0].item_price || 0,
        createdAt: data[0].created_at,
        updatedAt: data[0].updated_at
      }

      setJackpots(prev => [newJackpot, ...prev])
      return newJackpot

    } catch (error) {
      console.error('Error adding jackpot:', error)
      throw error
    }
  }

  const updateJackpot = async (jackpotId, jackpotData) => {
    try {
      let imageUrl = jackpotData.image

      // Handle image upload if a new image is provided
      if (jackpotData.image) {
        if (typeof jackpotData.image === 'string') {
          // Check if it's an NFT mint address
          const isNFT = jackpotData.image.length >= 32 && 
                       jackpotData.image.length <= 44 && 
                       !jackpotData.image.includes('/') &&
                       !jackpotData.image.includes('.')
          
          if (isNFT) {
            // Get current jackpot's image from database to exclude it from duplicate check
            const { data: currentJackpotData } = await supabase
              .from('jackpot_pools')
              .select('image')
              .eq('id', jackpotId)
              .single()
            
            const currentImage = currentJackpotData?.image
            
            // Only check for duplicates if the NFT is different from the current one
            if (jackpotData.image !== currentImage) {
              // Check if this NFT exists in any OTHER jackpot (excluding current one)
              const { data: existingJackpots, error: checkError } = await supabase
                .from('jackpot_pools')
                .select('id')
                .eq('image', jackpotData.image)
                .neq('id', jackpotId)
              
              if (checkError) {
                console.error('Error checking NFT existence:', checkError)
              } else if (existingJackpots && existingJackpots.length > 0) {
                throw new Error('This NFT is already added to another jackpot. Please select a different NFT.')
              }
              
              // Check if this NFT is already used in a lootbox
              const { data: lootboxData, error: lootboxError } = await supabase
                .from('nft_reward_percentages')
                .select('id, product_id')
                .eq('mint_address', jackpotData.image)
                .limit(1)
              
              if (!lootboxError && lootboxData && lootboxData.length > 0) {
                throw new Error('This NFT is already added to a lootbox. Please select a different NFT.')
              }
              
              // Check if this NFT is in a user's cart (prizeWin with isWithdraw: false and reward_type: 'nft')
              // NFTs in cart are won by users but not yet claimed - they shouldn't be reused in jackpots
              const { data: cartData, error: cartError } = await supabase
                .from('prizeWin')
                .select('id, userId, isWithdraw, reward_type')
                .eq('mint', jackpotData.image)
                .eq('isWithdraw', false) // Block if in user's cart (won but not claimed)
                .eq('reward_type', 'nft') // Only check NFT rewards (not SOL rewards)
                .limit(1)
              
              if (!cartError && cartData && cartData.length > 0) {
                throw new Error('This NFT is currently in a user\'s cart (won but not yet claimed). It cannot be added to a jackpot until the user claims it.')
              }
            }
          }
          
          // It's an NFT mint address or existing image path, use as-is
          imageUrl = jackpotData.image
        } else if (jackpotData.image instanceof File) {
          // It's a new file upload
          const fileExt = jackpotData.image.name.split('.').pop()
          const fileName = `${Date.now()}.${fileExt}`
          const filePath = `jackpots/${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('apes-bucket')
            .upload(filePath, jackpotData.image)

          if (uploadError) {
            console.error('Error uploading image:', uploadError)
            // Continue without updating image if upload fails
            imageUrl = null
          } else {
            imageUrl = filePath
          }
        }
      }

      const updateData = {
        name: jackpotData.name,
        description: jackpotData.description,
        ticket_price: jackpotData.price || 0,
        max_tickets: jackpotData.maxTickets || 1000,
        end_time: jackpotData.endTime || null,
        is_active: jackpotData.isActive !== false,
        item_price: jackpotData.itemPrice || 0
      }

      // Only update image if we have a new one
      if (imageUrl !== null) {
        updateData.image = imageUrl
      }

      const { data, error } = await supabase
        .from('jackpot_pools')
        .update(updateData)
        .eq('id', jackpotId)
        .select()

      if (error) throw error

      setJackpots(prev => prev.map(jackpot => 
        jackpot.id === jackpotId 
          ? { 
              ...jackpot, 
              name: data[0].name,
              title: data[0].name,
              description: data[0].description,
              price: data[0].ticket_price || 0,
              maxTickets: data[0].max_tickets || 0,
              endTime: data[0].end_time,
              isActive: data[0].is_active,
              image: data[0].image,
              itemPrice: data[0].item_price || 0,
              timer: data[0].end_time ? new Date(data[0].end_time).toLocaleString() : 'No end time'
            }
          : jackpot
      ))

      return data[0]

    } catch (error) {
      console.error('Error updating jackpot:', error)
      throw error
    }
  }

  const deleteJackpot = async (jackpotId) => {
    try {
      const { error } = await supabase
        .from('jackpot_pools')
        .delete()
        .eq('id', jackpotId)

      if (error) throw error

      setJackpots(prev => prev.filter(jackpot => jackpot.id !== jackpotId))

    } catch (error) {
      console.error('Error deleting jackpot:', error)
      throw error
    }
  }

  // Check if an NFT mint address is already used in any jackpot
  // excludeJackpotId: optional ID to exclude from the check (useful when updating)
  const checkNFTExists = async (nftMintAddress, excludeJackpotId = null) => {
    try {
      if (!nftMintAddress) return false

      // Fetch all jackpots and check if any have this NFT mint address in the image field
      let query = supabase
        .from('jackpot_pools')
        .select('id, name, image')
        .eq('image', nftMintAddress)
      
      // Exclude a specific jackpot ID if provided (for update scenarios)
      if (excludeJackpotId) {
        query = query.neq('id', excludeJackpotId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error checking NFT existence:', error)
        return false
      }

      return data && data.length > 0
    } catch (error) {
      console.error('Error in checkNFTExists:', error)
      return false
    }
  }

  // Get all NFT mint addresses currently used in jackpots
  const getUsedNFTMints = async () => {
    try {
      const { data, error } = await supabase
        .from('jackpot_pools')
        .select('image')

      if (error) {
        console.error('Error fetching used NFT mints:', error)
        return []
      }

      // Filter to only NFT mint addresses (Solana addresses are ~44 chars and don't contain "/")
      // File paths typically contain "/" like "jackpots/xxx.jpg"
      const usedMints = (data || [])
        .map(jackpot => jackpot.image)
        .filter(image => {
          // Check if it's likely an NFT mint address (not a file path)
          return image && 
                 typeof image === 'string' && 
                 image.length >= 32 && 
                 image.length <= 44 && 
                 !image.includes('/') &&
                 !image.includes('.') // File paths have extensions like .jpg, .png
        })

      return usedMints
    } catch (error) {
      console.error('Error in getUsedNFTMints:', error)
      return []
    }
  }

  // Get all NFT mint addresses currently used in lootboxes (nft_reward_percentages table)
  const getLootboxNFTMints = async () => {
    try {
      const { data, error } = await supabase
        .from('nft_reward_percentages')
        .select('mint_address, product_id')

      if (error) {
        console.error('Error fetching lootbox NFT mints:', error)
        return []
      }

      // Extract unique mint addresses
      const usedMints = (data || [])
        .map(reward => reward.mint_address)
        .filter(Boolean) // Remove null/undefined values
        .filter((mint, index, self) => self.indexOf(mint) === index) // Get unique values

      return usedMints
    } catch (error) {
      console.error('Error in getLootboxNFTMints:', error)
      return []
    }
  }

  // Get all NFT mint addresses currently in user carts (prizeWin table with isWithdraw: false)
  // These NFTs are won by users but not yet claimed, so they should not be available for jackpots
  // Even though they're still in admin wallet, they're promised to users who won them
  const getCartNFTMints = async () => {
    try {
      const { data, error } = await supabase
        .from('prizeWin')
        .select('mint, isWithdraw, reward_type')
        .eq('isWithdraw', false) // Get NFTs in user carts (not yet claimed)
        .eq('reward_type', 'nft') // ONLY get NFT rewards (not SOL or other types)
        .not('mint', 'is', null) // Only get entries with mint addresses

      if (error) {
        console.error('Error fetching cart NFT mints:', error)
        return []
      }

      // Extract unique mint addresses that are in carts (not withdrawn)
      const cartMints = (data || [])
        .map(prize => prize.mint)
        .filter(Boolean) // Remove null/undefined values
        .filter((mint, index, self) => self.indexOf(mint) === index) // Get unique values

      console.log('📦 NFTs in user carts (not available for jackpots):', cartMints.length, cartMints)
      return cartMints
    } catch (error) {
      console.error('Error in getCartNFTMints:', error)
      return []
    }
  }

  useEffect(() => {
    fetchJackpots()
  }, [])

  return {
    jackpots,
    loading,
    error,
    addJackpot,
    updateJackpot,
    deleteJackpot,
    checkNFTExists,
    getUsedNFTMints,
    getLootboxNFTMints,
    getCartNFTMints,
    refetch: fetchJackpots
  }
}
