import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const useProducts = () => {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchProducts = async () => {
    try {
      setLoading(true)
      setError(null)

      // MAIN PROJECT ONLY: Filter for products where project_id IS NULL (legacy main project data)
      // This isolates the main project from sub-projects
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .is('project_id', null) // Only show main project products (no project_id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        throw fetchError
      }

      // Transform products data to match the rewards format
      const transformedProducts = data?.map(product => ({
        id: product.id,
        rewardType: 'item', // Default to item type
        name: product.name || `Product ${product.id}`, // Use name or fallback
        type: 'item',
        value: product.price || '0', // Use price if available
        chance: product.percentage || '10', // Use percentage column for chance
        rarity: 'Common', // Default rarity
        image: product.image || null, // Use image if available
        created_at: product.created_at
      })) || []

      setProducts(transformedProducts)

    } catch (error) {
      console.error('Error fetching products:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const addProduct = async (productData) => {
    try {
      let imageUrl = null

      // Handle image upload if provided
      if (productData.image) {
        const fileExt = productData.image.name.split('.').pop()
        const fileName = `${Date.now()}.${fileExt}`
        const filePath = `products/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('apes-bucket')
          .upload(filePath, productData.image)

        if (uploadError) {
          console.error('Error uploading image:', uploadError)
          // Continue without image if upload fails
        } else {
          imageUrl = filePath
        }
      }

      const { data, error } = await supabase
        .from('products')
        .insert([
          {
            name: productData.name,
            price: productData.value,
            percentage: parseInt(productData.chance) || 10,
            image: imageUrl
          }
        ])
        .select()

      if (error) throw error

      // Add the new product to local state
      const newProduct = {
        id: data[0].id,
        rewardType: productData.rewardType || 'item',
        name: data[0].name,
        type: productData.type || 'item',
        value: data[0].price,
        chance: data[0].percentage || '10',
        rarity: productData.rarity || 'Common',
        image: data[0].image,
        created_at: data[0].created_at
      }

      setProducts(prev => [newProduct, ...prev])
      return newProduct

    } catch (error) {
      console.error('Error adding product:', error)
      throw error
    }
  }

  const updateProduct = async (productId, productData) => {
    try {
      let imageUrl = productData.image

      // Handle image upload if a new image is provided
      if (productData.image && productData.image instanceof File) {
        const fileExt = productData.image.name.split('.').pop()
        const fileName = `${Date.now()}.${fileExt}`
        const filePath = `products/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('apes-bucket')
          .upload(filePath, productData.image)

        if (uploadError) {
          console.error('Error uploading image:', uploadError)
          // Continue without updating image if upload fails
          imageUrl = null
        } else {
          imageUrl = filePath
        }
      }

      const updateData = {
        name: productData.name,
        price: productData.value,
        percentage: parseInt(productData.chance) || 10
      }

      // Only update image if we have a new one
      if (imageUrl !== null) {
        updateData.image = imageUrl
      }

      const { data, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId)
        .select()

      if (error) throw error

      // Update the product in local state
      setProducts(prev => prev.map(product => 
        product.id === productId 
          ? { 
              ...product, 
              name: data[0].name, 
              value: data[0].price,
              chance: data[0].percentage || '10',
              image: data[0].image
            }
          : product
      ))

      return data[0]

    } catch (error) {
      console.error('Error updating product:', error)
      throw error
    }
  }

  const deleteProduct = async (productId) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)

      if (error) throw error

      // Remove the product from local state
      setProducts(prev => prev.filter(product => product.id !== productId))

    } catch (error) {
      console.error('Error deleting product:', error)
      throw error
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  return {
    products,
    loading,
    error,
    addProduct,
    updateProduct,
    deleteProduct,
    refetch: fetchProducts
  }
}
