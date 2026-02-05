// Fee Collection Monitor - Check if fees are being collected
// This tool monitors the fee vault and shows real-time fee collection status

import { Connection, PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'

// System Configuration
const PROGRAM_ID = 'BkwbgssSuWQS46MtNRcq5RCnUgYq1H1LJpKhCGUtdGaH'
const OGX_MINT = 'B1hLCUwikAg3EsibPo3UJ9skVtFsqzdt8M8MeEBMQGBn'
const FEE_VAULT_AUTHORITY = 'HJe9iyUbL9iyW266r8qG1W2ivamYGkkZsCQBgAS9i6qM'
const FEE_VAULT_ATA = 'AZ5WBb5jSAHyKPeBGJX3pr7AHHLDY8f61rMpMpAmecNm'

/**
 * Check current fee collection status
 */
export const checkFeeCollectionStatus = async () => {
  try {
    console.log('🔍 Checking fee collection status...')
    
    const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=5a1a852c-3ed9-40ee-bca8-dda4550c3ce8', 'confirmed')
    
    // Check if fee vault ATA exists
    const accountInfo = await connection.getAccountInfo(new PublicKey(FEE_VAULT_ATA))
    
    if (!accountInfo) {
      return {
        status: 'NO_VAULT',
        message: 'Fee vault ATA does not exist yet',
        balance: 0,
        balanceSOL: 0,
        success: false
      }
    }
    
    // Parse token balance
    const data = accountInfo.data
    if (data.length < 72) {
      throw new Error('Invalid token account data')
    }
    
    // Extract amount (8 bytes starting at offset 64)
    let amount = 0
    for (let i = 0; i < 8; i++) {
      amount += data[64 + i] * Math.pow(256, i)
    }
    
    const feeBalance = Number(amount)
    const feeBalanceSOL = feeBalance / 1000 // Convert OGX to SOL
    
    const status = feeBalance > 0 ? 'FEES_COLLECTED' : 'NO_FEES'
    
    return {
      status,
      message: feeBalance > 0 
        ? `Fees are being collected! ${feeBalance} OGX tokens (${feeBalanceSOL} SOL)`
        : 'No fees collected yet - fee vault is empty',
      balance: feeBalance,
      balanceSOL: feeBalanceSOL,
      feeVaultATA: FEE_VAULT_ATA,
      success: true
    }
    
  } catch (error) {
    console.error('❌ Error checking fee collection:', error)
    return {
      status: 'ERROR',
      message: `Error: ${error.message}`,
      balance: 0,
      balanceSOL: 0,
      success: false
    }
  }
}

/**
 * Monitor fee collection with real-time updates
 */
export const monitorFeeCollection = async (intervalSeconds = 30) => {
  console.log(`🔄 Starting fee collection monitoring (every ${intervalSeconds}s)...`)
  
  const checkAndLog = async () => {
    const result = await checkFeeCollectionStatus()
    
    const timestamp = new Date().toLocaleTimeString()
    
    switch (result.status) {
      case 'FEES_COLLECTED':
        console.log(`✅ [${timestamp}] FEES COLLECTED: ${result.balance} OGX (${result.balanceSOL} SOL)`)
        break
      case 'NO_FEES':
        console.log(`⏳ [${timestamp}] No fees yet - vault empty`)
        break
      case 'NO_VAULT':
        console.log(`❌ [${timestamp}] Fee vault not created yet`)
        break
      case 'ERROR':
        console.log(`❌ [${timestamp}] Error: ${result.message}`)
        break
    }
    
    return result
  }
  
  // Initial check
  await checkAndLog()
  
  // Set up interval
  const interval = setInterval(checkAndLog, intervalSeconds * 1000)
  
  // Return function to stop monitoring
  return () => {
    clearInterval(interval)
    console.log('🛑 Fee collection monitoring stopped')
  }
}

/**
 * Get detailed fee collection report
 */
export const getFeeCollectionReport = async () => {
  try {
    console.log('📊 Generating fee collection report...')
    
    const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=5a1a852c-3ed9-40ee-bca8-dda4550c3ce8', 'confirmed')
    
    // Check fee vault
    const feeStatus = await checkFeeCollectionStatus()
    
    // Check platform SOL balance for comparison
    const platformWallet = 'CRt41RoAZ4R9M7QHx5vyKB2Jee3NvDSmhoSak8GfMwtY'
    const platformBalance = await connection.getBalance(new PublicKey(platformWallet))
    const platformSOL = platformBalance / 1000000000 // Convert lamports to SOL
    
    // Check fee config
    const [feeConfigPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('fee_config'), new PublicKey(OGX_MINT).toBuffer()],
      new PublicKey(PROGRAM_ID)
    )
    
    const feeConfigInfo = await connection.getAccountInfo(feeConfigPDA)
    
    const report = {
      timestamp: new Date().toISOString(),
      feeCollection: feeStatus,
      platformSOL: {
        balance: platformSOL,
        wallet: platformWallet
      },
      feeConfig: {
        exists: !!feeConfigInfo,
        address: feeConfigPDA.toString()
      },
      summary: {
        feesCollected: feeStatus.balance > 0,
        platformHasSOL: platformSOL > 0,
        feeSystemReady: feeConfigInfo !== null
      }
    }
    
    console.log('📋 Fee Collection Report:')
    console.log('='.repeat(50))
    console.log(`Fee Vault Balance: ${feeStatus.balance} OGX (${feeStatus.balanceSOL} SOL)`)
    console.log(`Platform SOL Balance: ${platformSOL.toFixed(6)} SOL`)
    console.log(`Fee Config Exists: ${!!feeConfigInfo}`)
    console.log(`Fees Being Collected: ${feeStatus.balance > 0 ? 'YES' : 'NO'}`)
    console.log(`Platform Has SOL: ${platformSOL > 0 ? 'YES' : 'NO'}`)
    console.log(`Fee System Ready: ${feeConfigInfo !== null ? 'YES' : 'NO'}`)
    console.log('='.repeat(50))
    
    return report
    
  } catch (error) {
    console.error('❌ Error generating report:', error)
    return {
      timestamp: new Date().toISOString(),
      error: error.message,
      success: false
    }
  }
}

// Make functions available globally
if (typeof window !== 'undefined') {
  window.checkFeeCollectionStatus = checkFeeCollectionStatus
  window.monitorFeeCollection = monitorFeeCollection
  window.getFeeCollectionReport = getFeeCollectionReport
  
  console.log('🚀 Fee Collection Monitor loaded!')
  console.log('Available functions:')
  console.log('- checkFeeCollectionStatus() - Check current fee status')
  console.log('- monitorFeeCollection(30) - Monitor fees every 30 seconds')
  console.log('- getFeeCollectionReport() - Get detailed report')
}

// Export functions for use in other modules
export { checkFeeCollectionStatus, monitorFeeCollection, getFeeCollectionReport }
