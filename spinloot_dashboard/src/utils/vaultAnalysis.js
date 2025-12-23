// Comprehensive Vault Analysis Tool
// This shows all vaults in the Spinloot system and their purposes

import { PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'

// System Configuration
const PROGRAM_ID = 'BkwbgssSuWQS46MtNRcq5RCnUgYq1H1LJpKhCGUtdGaH'
const OGX_MINT = 'B1hLCUwikAg3EsibPo3UJ9skVtFsqzdt8M8MeEBMQGBn'
const PLATFORM_WALLET = 'CRt41RoAZ4R9M7QHx5vyKB2Jee3NvDSmhoSak8GfMwtY'

/**
 * Derive all vault addresses in the system
 */
export const getAllVaultAddresses = async () => {
  try {
    console.log('🔍 Analyzing all vaults in the Spinloot system...')
    console.log('Program ID:', PROGRAM_ID)
    console.log('OGX Mint:', OGX_MINT)
    console.log('Platform Wallet:', PLATFORM_WALLET)
    console.log('='.repeat(60))

    const vaults = {}

    // 1. MAIN VAULT AUTHORITY (PDA)
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), new PublicKey(OGX_MINT).toBuffer()],
      new PublicKey(PROGRAM_ID)
    )
    vaults.mainVaultAuthority = {
      address: vaultAuthority.toString(),
      purpose: 'Main vault authority PDA - controls the main token vault',
      type: 'PDA Authority',
      seeds: ['vault', OGX_MINT]
    }

    // 2. MAIN VAULT ATA (Associated Token Account)
    const vaultATA = await getAssociatedTokenAddress(
      new PublicKey(OGX_MINT),
      vaultAuthority,
      true // allowOwnerOffCurve for PDA
    )
    vaults.mainVaultATA = {
      address: vaultATA.toString(),
      purpose: 'Main vault token account - holds OGX tokens deposited by users',
      type: 'Token Account',
      authority: vaultAuthority.toString()
    }

    // 3. FEE VAULT AUTHORITY (PDA)
    const [feeVaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('fee_vault'), new PublicKey(OGX_MINT).toBuffer()],
      new PublicKey(PROGRAM_ID)
    )
    vaults.feeVaultAuthority = {
      address: feeVaultAuthority.toString(),
      purpose: 'Fee vault authority PDA - controls the fee collection vault',
      type: 'PDA Authority',
      seeds: ['fee_vault', OGX_MINT]
    }

    // 4. FEE VAULT ATA (Associated Token Account)
    const feeVaultATA = await getAssociatedTokenAddress(
      new PublicKey(OGX_MINT),
      feeVaultAuthority,
      true // allowOwnerOffCurve for PDA
    )
    vaults.feeVaultATA = {
      address: feeVaultATA.toString(),
      purpose: 'Fee vault token account - collects transaction fees',
      type: 'Token Account',
      authority: feeVaultAuthority.toString()
    }

    // 5. FEE CONFIG PDA
    const [feeConfigPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('fee_config'), new PublicKey(OGX_MINT).toBuffer()],
      new PublicKey(PROGRAM_ID)
    )
    vaults.feeConfig = {
      address: feeConfigPDA.toString(),
      purpose: 'Fee configuration PDA - stores fee settings and owner info',
      type: 'Configuration Account',
      seeds: ['fee_config', OGX_MINT]
    }

    // 6. EXCHANGE CONFIG PDA
    const [exchangeConfigPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('exchange_config')],
      new PublicKey(PROGRAM_ID)
    )
    vaults.exchangeConfig = {
      address: exchangeConfigPDA.toString(),
      purpose: 'Exchange configuration PDA - stores SOL/OGX exchange rates',
      type: 'Configuration Account',
      seeds: ['exchange_config']
    }

    // 7. PLATFORM WALLET (External)
    vaults.platformWallet = {
      address: PLATFORM_WALLET,
      purpose: 'Platform wallet - receives SOL deposits from users',
      type: 'External Wallet',
      note: 'This is where user SOL deposits go (not a PDA)'
    }

    // 8. USER BALANCE PDAs (Per User)
    vaults.userBalancePDA = {
      address: 'Per-user PDA',
      purpose: 'User balance PDA - tracks individual user OGX balances',
      type: 'Per-User Account',
      seeds: ['user_balance', 'USER_PUBKEY', OGX_MINT],
      note: 'Each user has their own PDA for balance tracking'
    }

    return vaults

  } catch (error) {
    console.error('❌ Error analyzing vaults:', error)
    throw error
  }
}

/**
 * Display comprehensive vault information
 */
export const displayVaultAnalysis = async () => {
  try {
    const vaults = await getAllVaultAddresses()
    
    console.log('\n🏦 COMPREHENSIVE VAULT ANALYSIS')
    console.log('='.repeat(60))
    
    Object.entries(vaults).forEach(([name, vault]) => {
      console.log(`\n📦 ${name.toUpperCase()}`)
      console.log(`   Address: ${vault.address}`)
      console.log(`   Purpose: ${vault.purpose}`)
      console.log(`   Type: ${vault.type}`)
      if (vault.seeds) {
        console.log(`   Seeds: [${vault.seeds.join(', ')}]`)
      }
      if (vault.authority) {
        console.log(`   Authority: ${vault.authority}`)
      }
      if (vault.note) {
        console.log(`   Note: ${vault.note}`)
      }
    })

    console.log('\n📊 VAULT SUMMARY')
    console.log('='.repeat(60))
    console.log('Total Vaults: 8 different types')
    console.log('PDA Authorities: 4')
    console.log('Token Accounts: 2')
    console.log('Configuration Accounts: 2')
    console.log('External Wallets: 1')
    console.log('Per-User Accounts: Unlimited (one per user)')

    console.log('\n💰 FUND FLOW')
    console.log('='.repeat(60))
    console.log('1. User deposits SOL → Platform Wallet')
    console.log('2. User gets OGX tokens → Database balance')
    console.log('3. OGX deposits → Main Vault ATA')
    console.log('4. Transaction fees → Fee Vault ATA')
    console.log('5. User balances tracked → User Balance PDAs')

    return vaults

  } catch (error) {
    console.error('❌ Error displaying vault analysis:', error)
    return null
  }
}

// Make functions available globally
if (typeof window !== 'undefined') {
  window.getAllVaultAddresses = getAllVaultAddresses
  window.displayVaultAnalysis = displayVaultAnalysis
  
  console.log('🚀 Vault Analysis Tool loaded!')
  console.log('Available functions:')
  console.log('- getAllVaultAddresses() - Get all vault addresses')
  console.log('- displayVaultAnalysis() - Show comprehensive vault analysis')
}

// Export functions for use in other modules
export { getAllVaultAddresses, displayVaultAnalysis }
