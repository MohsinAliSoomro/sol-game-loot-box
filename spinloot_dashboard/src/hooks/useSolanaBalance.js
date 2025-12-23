import { useState, useEffect } from 'react'
import {  getOGXTokenBalance } from '../lib/solana'
import { getVaultWallets, validateSolanaConfig, SOLANA_CONFIG } from '../lib/solanaConfig'

export const useSolanaVaultBalance = () => {
  const [vaultBalance, setVaultBalance] = useState({
    totalBalance: 0,
    individualBalances: {},
    loading: true,
    error: null,
    lastUpdated: null
  })

  const fetchVaultBalance = async () => {
    try {
      console.log('🔄 Fetching vault balance...')
      setVaultBalance(prev => ({ ...prev, loading: true, error: null }))

      // Validate configuration
      if (!validateSolanaConfig()) {
        throw new Error('No vault wallet addresses configured')
      }

      const vaultWallets = getVaultWallets()
      console.log('📋 Vault wallets:', vaultWallets)
      
      if (vaultWallets.length === 0) {
        throw new Error('No valid vault wallet addresses found')
      }

      // Fetch OGX token balances instead of SOL
      console.log('💰 Fetching OGX token balances...')
      const ogxMint = SOLANA_CONFIG.TOKEN_MINTS.OGX
      console.log('🪙 OGX mint:', ogxMint)
      
      const individualBalances = {}
      let totalBalance = 0
      
      for (const wallet of vaultWallets) {
        try {
          const ogxBalance = await getOGXTokenBalance(wallet, ogxMint)
          individualBalances[wallet] = {
            balance: ogxBalance,
            error: null
          }
          totalBalance += ogxBalance
        } catch (error) {
          console.error(`Error fetching OGX balance for ${wallet}:`, error)
          individualBalances[wallet] = {
            balance: 0,
            error: error.message
          }
        }
      }
      
      console.log('📊 Individual OGX balances:', individualBalances)
      console.log('✅ Total vault OGX balance:', totalBalance, 'OGX')

      setVaultBalance({
        totalBalance,
        individualBalances,
        loading: false,
        error: null,
        lastUpdated: new Date()
      })

    } catch (error) {
      console.error('❌ Error fetching vault balance:', error)
      setVaultBalance(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }))
    }
  }

  useEffect(() => {
    fetchVaultBalance()
    
    // Set up auto-refresh
    const interval = setInterval(fetchVaultBalance, 30000) // Refresh every 30 seconds
    
    return () => clearInterval(interval)
  }, [])

  return {
    ...vaultBalance,
    refetch: fetchVaultBalance
  }
}

export const useSolanaWalletBalance = (walletAddress) => {
  const [balance, setBalance] = useState({
    balance: 0,
    loading: true,
    error: null,
    lastUpdated: null
  })

  const fetchBalance = async () => {
    if (!walletAddress) {
      setBalance(prev => ({ ...prev, loading: false, error: 'No wallet address provided' }))
      return
    }

    try {
      setBalance(prev => ({ ...prev, loading: true, error: null }))

      const { getWalletBalance } = await import('../lib/solana')
      const walletBalance = await getWalletBalance(walletAddress)

      setBalance({
        balance: walletBalance,
        loading: false,
        error: null,
        lastUpdated: new Date()
      })

    } catch (error) {
      console.error('Error fetching wallet balance:', error)
      setBalance(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }))
    }
  }

  useEffect(() => {
    fetchBalance()
    
    // Set up auto-refresh
    const interval = setInterval(fetchBalance, 30000) // Refresh every 30 seconds
    
    return () => clearInterval(interval)
  }, [walletAddress, fetchBalance])

  return {
    ...balance,
    refetch: fetchBalance
  }
}

