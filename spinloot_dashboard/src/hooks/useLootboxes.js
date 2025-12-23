import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const useLootboxes = () => {
  const [lootboxes, setLootboxes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchLootboxes = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch lootboxes from products table
      // MAIN PROJECT ONLY: Filter for products where project_id IS NULL (legacy main project data)
      // This isolates the main project from sub-projects
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .is('project_id', null) // Only show main project products (no project_id)
        .order('created_at', { ascending: false })

      if (productsError) {
        throw productsError
      }

      // Get unique lootboxes by grouping products
      // Since products table contains lootboxes, we need to group them
      // For now, we'll treat each product as a separate lootbox
      // If you have a way to group products into lootboxes, update this logic
      const lootboxData = products?.map((product, index) => {
        // Fetch rewards count from token_reward_percentages for this product/lootbox
        return {
          id: product.id,
          type: 'lootbox',
          name: product.name || `Lootbox #${product.id}`,
          price: parseFloat(product.price) || 0,
          percent: product.percentage || 0,
          image: product.image || null,
          rarity: product.rarity || 'Common',
          description: product.description || '',
          rewardCount: 0 // Will be updated separately if needed
        }
      }) || []

      // Fetch reward counts for each lootbox from token_reward_percentages
      // Note: Rewards are stored in token_reward_percentages table linked to products
      try {
        const { data: rewards, error: rewardsError } = await supabase
          .from('token_reward_percentages')
          .select('product_id')
        
        if (!rewardsError && rewards) {
          // Count rewards per product/lootbox
          const rewardCounts = rewards.reduce((acc, reward) => {
            const productId = reward.product_id
            acc[productId] = (acc[productId] || 0) + 1
            return acc
          }, {})
          
          // Update reward counts for each lootbox
          lootboxData.forEach(lootbox => {
            lootbox.rewardCount = rewardCounts[lootbox.id] || 0
          })
        }
      } catch (err) {
        // If token_reward_percentages doesn't have product_id column or table doesn't exist,
        // just leave rewardCount as 0
        console.log('Could not fetch reward counts:', err)
      }

      setLootboxes(lootboxData)

    } catch (error) {
      console.error('Error fetching lootboxes:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const addLootbox = async (lootboxData) => {
    try {
      let imageUrl = null

      // Handle image upload if provided
      if (lootboxData.image) {
        const fileExt = lootboxData.image.name.split('.').pop()
        const fileName = `${Date.now()}.${fileExt}`
        const filePath = `products/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('apes-bucket')
          .upload(filePath, lootboxData.image)

        if (uploadError) {
          console.error('Error uploading image:', uploadError)
          // Continue without image if upload fails
        } else {
          imageUrl = filePath
        }
      }

      // Insert into products table (products = lootboxes)
      const { data, error } = await supabase
        .from('products')
        .insert([
          {
            name: lootboxData.name,
            price: lootboxData.price?.toString() || '0',
            percentage: parseInt(lootboxData.percent) || 0,
            image: imageUrl,
            rarity: lootboxData.rarity || 'Common',
            description: lootboxData.description || ''
          }
        ])
        .select()

      if (error) throw error

      const newLootbox = {
        id: data[0].id,
        type: 'lootbox',
        name: data[0].name,
        price: parseFloat(data[0].price) || 0,
        percent: data[0].percentage || 0,
        image: data[0].image,
        rarity: data[0].rarity || 'Common',
        description: data[0].description || '',
        rewardCount: 0
      }

      setLootboxes(prev => [newLootbox, ...prev])
      return newLootbox

    } catch (error) {
      console.error('Error adding lootbox:', error)
      throw error
    }
  }

  const updateLootbox = async (lootboxId, lootboxData) => {
    try {
      let imageUrl = lootboxData.image

      // Handle image upload if a new image is provided
      if (lootboxData.image && lootboxData.image instanceof File) {
        const fileExt = lootboxData.image.name.split('.').pop()
        const fileName = `${Date.now()}.${fileExt}`
        const filePath = `products/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('apes-bucket')
          .upload(filePath, lootboxData.image)

        if (uploadError) {
          console.error('Error uploading image:', uploadError)
          imageUrl = null
        } else {
          imageUrl = filePath
        }
      }

      const updateData = {
        name: lootboxData.name,
        price: lootboxData.price?.toString() || '0',
        percentage: parseInt(lootboxData.percent) || 0,
        rarity: lootboxData.rarity || 'Common',
        description: lootboxData.description || ''
      }

      // Only update image if we have a new one
      if (imageUrl !== null && lootboxData.image instanceof File) {
        updateData.image = imageUrl
      }

      const { data, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', lootboxId)
        .select()

      if (error) throw error

      // Update the lootbox in local state
      setLootboxes(prev => prev.map(lootbox => 
        lootbox.id === lootboxId 
          ? { 
              ...lootbox, 
              name: data[0].name,
              price: parseFloat(data[0].price) || 0,
              percent: data[0].percentage || 0,
              image: data[0].image,
              rarity: data[0].rarity || 'Common',
              description: data[0].description || ''
            }
          : lootbox
      ))

      return data[0]

    } catch (error) {
      console.error('Error updating lootbox:', error)
      throw error
    }
  }

  const deleteLootbox = async (lootboxId) => {
    try {
      // Delete from products table
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', lootboxId)

      if (error) throw error

      // Remove from local state
      setLootboxes(prev => prev.filter(lootbox => lootbox.id !== lootboxId))

    } catch (error) {
      console.error('Error deleting lootbox:', error)
      throw error
    }
  }

  useEffect(() => {
    fetchLootboxes()
  }, [])

  return {
    lootboxes,
    loading,
    error,
    addLootbox,
    updateLootbox,
    deleteLootbox,
    refetch: fetchLootboxes
  }
}
