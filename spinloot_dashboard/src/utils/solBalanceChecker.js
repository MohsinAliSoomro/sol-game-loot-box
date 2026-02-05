// SOL Balance Checker - Check platform wallet SOL balance and fee collection
// This shows where user deposits actually go

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

// Platform wallet where all SOL deposits go
const PLATFORM_WALLET = 'CRt41RoAZ4R9M7QHx5vyKB2Jee3NvDSmhoSak8GfMwtY'

// Fee wallet where collected fees are stored
const FEE_WALLET = '5BbDF3fuNjUvvCvzDz26ULPXUPH6ZwEw6NK9xLjQbgyr'

// Fee vault addresses (from the vault program)
const FEE_VAULT_AUTHORITY = 'FeeVaultAuthority' // This would be derived from PDA
const FEE_VAULT_ATA = 'FeeVaultATA' // This would be the actual fee vault ATA

/**
 * Get platform wallet SOL balance
 */
export const getPlatformSOLBalance = async () => {
  try {
    console.log('🔍 Checking platform SOL balance...')
    
    // Create connection to Solana mainnet
    const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=5a1a852c-3ed9-40ee-bca8-dda4550c3ce8', 'confirmed')
    
    // Get platform wallet public key
    const platformWallet = new PublicKey(PLATFORM_WALLET)
    
    console.log('📍 Platform wallet:', platformWallet.toBase58())
    
    // Get SOL balance
    const balance = await connection.getBalance(platformWallet)
    const solBalance = balance / LAMPORTS_PER_SOL
    
    console.log('💰 Platform SOL balance:', solBalance.toFixed(6), 'SOL')
    console.log('💰 Raw balance (lamports):', balance)
    
    return {
      wallet: PLATFORM_WALLET,
      balance: solBalance,
      rawBalance: balance,
      formattedBalance: `${solBalance.toFixed(6)} SOL`,
      success: true
    }
    
  } catch (error) {
    console.error('❌ Error checking platform SOL balance:', error)
    return {
      wallet: PLATFORM_WALLET,
      balance: 0,
      rawBalance: 0,
      formattedBalance: '0 SOL',
      error: error.message,
      success: false
    }
  }
}

/**
 * Get fee collection information from SOL fee wallet only
 */
export const getFeeCollection = async () => {
  try {
    console.log('🔍 Checking fee collection from SOL fee wallet...')
    
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed')
    
    // Check SOL fee wallet balance (where fees are collected)
    const feeWallet = new PublicKey(FEE_WALLET)
    const solBalance = await connection.getBalance(feeWallet)
    const solFeeBalance = solBalance / LAMPORTS_PER_SOL
    
    console.log('💰 SOL Fee wallet balance:', solFeeBalance, 'SOL')
    console.log('📍 Fee wallet address:', feeWallet.toString())
    
    return {
      totalFeesCollected: solFeeBalance,
      solFeeBalance: solFeeBalance,
      feeWallet: feeWallet.toString(),
      lastFeeCollection: null,
      success: true,
      note: `Total collected fees: ${solFeeBalance.toFixed(6)} SOL`
    }
    
  } catch (error) {
    console.error('❌ Error checking fee collection:', error)
    return {
      totalFeesCollected: 0,
      solFeeBalance: 0,
      feeWallet: null,
      lastFeeCollection: null,
      error: error.message,
      success: false
    }
  }
}

/**
 * Get comprehensive platform financial status
 */
export const getPlatformFinancialStatus = async () => {
  try {
    console.log('📊 Getting comprehensive platform financial status...')
    
    const [solBalance, feeCollection] = await Promise.all([
      getPlatformSOLBalance(),
      getFeeCollection()
    ])
    
    const status = {
      platformWallet: {
        address: PLATFORM_WALLET,
        solBalance: solBalance.balance,
        formattedBalance: solBalance.formattedBalance,
        success: solBalance.success
      },
      feeCollection: {
        totalFees: feeCollection.totalFeesCollected,
        feeVaultBalance: feeCollection.feeVaultBalance,
        lastCollection: feeCollection.lastFeeCollection,
        success: feeCollection.success
      },
      summary: {
        totalSOLHeld: solBalance.balance,
        totalFeesCollected: feeCollection.totalFeesCollected,
        netSOLAvailable: solBalance.balance - feeCollection.totalFeesCollected,
        lastUpdated: new Date().toISOString()
      }
    }
    
    console.log('📈 Platform Financial Status:', status)
    
    return status
    
  } catch (error) {
    console.error('❌ Error getting platform financial status:', error)
    return {
      platformWallet: {
        address: PLATFORM_WALLET,
        solBalance: 0,
        formattedBalance: '0 SOL',
        success: false,
        error: error.message
      },
      feeCollection: {
        totalFees: 0,
        feeVaultBalance: 0,
        lastCollection: null,
        success: false,
        error: error.message
      },
      summary: {
        totalSOLHeld: 0,
        totalFeesCollected: 0,
        netSOLAvailable: 0,
        lastUpdated: new Date().toISOString(),
        error: error.message
      }
    }
  }
}

// Make functions available globally for testing
if (typeof window !== 'undefined') {
  window.getPlatformSOLBalance = getPlatformSOLBalance
  window.getFeeCollection = getFeeCollection
  window.getPlatformFinancialStatus = getPlatformFinancialStatus
  
  console.log('🚀 SOL Balance Checker loaded!')
  console.log('Available functions:')
  console.log('- getPlatformSOLBalance() - Check platform wallet SOL balance')
  console.log('- getFeeCollection() - Check fee collection status')
  console.log('- getPlatformFinancialStatus() - Get comprehensive financial status')
}
