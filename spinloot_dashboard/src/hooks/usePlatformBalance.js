import { useState, useEffect } from 'react'
import { getPlatformSOLBalance, getFeeCollection, getPlatformFinancialStatus } from '../utils/solBalanceChecker'

/**
 * Hook to get platform SOL balance (where deposits go)
 */
export const usePlatformSOLBalance = () => {
  const [balance, setBalance] = useState({
    solBalance: 0,
    formattedBalance: '0 SOL',
    wallet: '',
    loading: true,
    error: null,
    lastUpdated: null
  })

  const fetchSOLBalance = async () => {
    try {
      setBalance(prev => ({ ...prev, loading: true, error: null }))
      
      const result = await getPlatformSOLBalance()
      
      setBalance({
        solBalance: result.balance,
        formattedBalance: result.formattedBalance,
        wallet: result.wallet,
        loading: false,
        error: result.error || null,
        lastUpdated: new Date().toISOString()
      })
      
    } catch (error) {
      console.error('Error fetching SOL balance:', error)
      setBalance(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }))
    }
  }

  useEffect(() => {
    fetchSOLBalance()
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchSOLBalance, 30000)
    
    return () => clearInterval(interval)
  }, [])

  return {
    ...balance,
    refresh: fetchSOLBalance
  }
}

/**
 * Hook to get fee collection information
 */
export const useFeeCollection = () => {
  const [fees, setFees] = useState({
    totalFees: 0,
    solFeeBalance: 0,
    feeWallet: null,
    lastCollection: null,
    loading: true,
    error: null,
    lastUpdated: null,
    note: null
  })

  const fetchFeeCollection = async () => {
    try {
      setFees(prev => ({ ...prev, loading: true, error: null }))
      
      console.log('🔍 Fetching fee collection...')
      const result = await getFeeCollection()
      console.log('📊 Fee collection result:', result)
      
      setFees({
        totalFees: result.totalFeesCollected,
        solFeeBalance: result.solFeeBalance,
        feeWallet: result.feeWallet,
        lastCollection: result.lastFeeCollection,
        loading: false,
        error: result.error || null,
        lastUpdated: new Date().toISOString(),
        note: result.note
      })
      
      console.log('✅ Fee collection updated:', {
        totalFees: result.totalFeesCollected,
        solFeeBalance: result.solFeeBalance,
        feeWallet: result.feeWallet
      })
      
    } catch (error) {
      console.error('❌ Error fetching fee collection:', error)
      setFees(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }))
    }
  }

  useEffect(() => {
    fetchFeeCollection()
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchFeeCollection, 60000)
    
    return () => clearInterval(interval)
  }, [])

  return {
    ...fees,
    refresh: fetchFeeCollection
  }
}

/**
 * Hook to get comprehensive platform financial status
 */
export const usePlatformFinancialStatus = () => {
  const [status, setStatus] = useState({
    platformWallet: {
      address: '',
      solBalance: 0,
      formattedBalance: '0 SOL',
      success: false
    },
    feeCollection: {
      totalFees: 0,
      feeVaultBalance: 0,
      lastCollection: null,
      success: false
    },
    summary: {
      totalSOLHeld: 0,
      totalFeesCollected: 0,
      netSOLAvailable: 0,
      lastUpdated: null
    },
    loading: true,
    error: null
  })

  const fetchFinancialStatus = async () => {
    try {
      setStatus(prev => ({ ...prev, loading: true, error: null }))
      
      const result = await getPlatformFinancialStatus()
      
      setStatus({
        ...result,
        loading: false,
        error: null
      })
      
    } catch (error) {
      console.error('Error fetching financial status:', error)
      setStatus(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }))
    }
  }

  useEffect(() => {
    fetchFinancialStatus()
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchFinancialStatus, 30000)
    
    return () => clearInterval(interval)
  }, [])

  return {
    ...status,
    refresh: fetchFinancialStatus
  }
}
