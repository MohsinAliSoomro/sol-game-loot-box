import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Keypair } from '@solana/web3.js'

/**
 * Hook to fetch admin wallet address from database
 * Retrieves the admin private key from website_settings table
 * and converts it to a public key (wallet address)
 */
export const useAdminWallet = () => {
  const [adminWalletAddress, setAdminWalletAddress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchAdminWallet = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch admin private key from database
        const { data, error: fetchError } = await supabase
          .from('website_settings')
          .select('value')
          .eq('key', 'admin_private_key')
          .single()

        if (fetchError && fetchError.code !== 'PGRST116') {
          // PGRST116 = no rows returned (not an error, just no key set yet)
          console.error('Error fetching admin key:', fetchError)
          setError(fetchError.message)
          setAdminWalletAddress(null)
          setLoading(false)
          return
        }

        if (!data || !data.value) {
          // No admin key set in database
          console.warn('No admin private key found in database')
          setAdminWalletAddress(null)
          setLoading(false)
          return
        }

        // Convert private key to public key (wallet address)
        try {
          const bs58 = (await import('bs58')).default
          const privateKeyBytes = bs58.decode(data.value.trim())
          const keypair = Keypair.fromSecretKey(privateKeyBytes)
          const walletAddress = keypair.publicKey.toString()
          setAdminWalletAddress(walletAddress)
          console.log('✅ Admin wallet address loaded from database:', walletAddress)
        } catch (decodeError) {
          console.error('Error decoding private key:', decodeError)
          setError('Invalid private key format in database')
          setAdminWalletAddress(null)
        }
      } catch (err) {
        console.error('Error in fetchAdminWallet:', err)
        setError(err.message)
        setAdminWalletAddress(null)
      } finally {
        setLoading(false)
      }
    }

    fetchAdminWallet()
  }, [])

  // Function to manually refresh the admin wallet
  const refreshAdminWallet = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('website_settings')
        .select('value')
        .eq('key', 'admin_private_key')
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching admin key:', fetchError)
        setError(fetchError.message)
        setAdminWalletAddress(null)
        return
      }

      if (!data || !data.value) {
        setAdminWalletAddress(null)
        return
      }

      const bs58 = (await import('bs58')).default
      const privateKeyBytes = bs58.decode(data.value.trim())
      const keypair = Keypair.fromSecretKey(privateKeyBytes)
      const walletAddress = keypair.publicKey.toString()
      setAdminWalletAddress(walletAddress)
    } catch (err) {
      console.error('Error refreshing admin wallet:', err)
      setError(err.message)
      setAdminWalletAddress(null)
    } finally {
      setLoading(false)
    }
  }

  return {
    adminWalletAddress,
    loading,
    error,
    refreshAdminWallet
  }
}

