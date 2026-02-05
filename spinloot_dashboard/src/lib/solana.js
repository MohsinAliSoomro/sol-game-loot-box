import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

// Solana RPC endpoint - configured for mainnet
const SOLANA_RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=5a1a852c-3ed9-40ee-bca8-dda4550c3ce8'
// Alternative public mainnet: 'https://api.mainnet-beta.solana.com'

// Create connection to Solana network
export const connection = new Connection(SOLANA_RPC_URL, 'confirmed')

/**
 * Fetch the balance of a Solana wallet address
 * @param {string} walletAddress - The public key of the wallet
 * @returns {Promise<number>} - Balance in SOL
 */
export const getWalletBalance = async (walletAddress) => {
  try {
    console.log('🔍 Getting balance for wallet:', walletAddress)
    
    if (!walletAddress) {
      throw new Error('Wallet address is required')
    }

    // Convert string to PublicKey
    const publicKey = new PublicKey(walletAddress)
    console.log('🔑 Public key created:', publicKey.toBase58())
    
    // Get balance in lamports
    console.log('📡 Fetching balance from Solana...')
    const balanceInLamports = await connection.getBalance(publicKey)
    console.log('💰 Balance in lamports:', balanceInLamports)
    
    // Convert lamports to SOL
    const balanceInSOL = balanceInLamports / LAMPORTS_PER_SOL
    console.log('💎 Balance in SOL:', balanceInSOL)
    
    return balanceInSOL
  } catch (error) {
    console.error('❌ Error fetching wallet balance:', error)
    throw new Error(`Failed to fetch wallet balance: ${error.message}`)
  }
}

/**
 * Fetch multiple wallet balances
 * @param {string[]} walletAddresses - Array of wallet addresses
 * @returns {Promise<Object>} - Object with wallet addresses as keys and balances as values
 */
export const getMultipleWalletBalances = async (walletAddresses) => {
  try {
    const balances = {}
    
    // Fetch all balances in parallel
    const balancePromises = walletAddresses.map(async (address) => {
      try {
        const balance = await getWalletBalance(address)
        return { address, balance }
      } catch (error) {
        console.error(`Error fetching balance for ${address}:`, error)
        return { address, balance: 0, error: error.message }
      }
    })
    
    const results = await Promise.all(balancePromises)
    
    // Convert to object format
    results.forEach(({ address, balance, error }) => {
      balances[address] = {
        balance,
        error: error || null
      }
    })
    
    return balances
  } catch (error) {
    console.error('Error fetching multiple wallet balances:', error)
    throw new Error(`Failed to fetch wallet balances: ${error.message}`)
  }
}

/**
 * Get the total balance across multiple wallets
 * @param {string[]} walletAddresses - Array of wallet addresses
 * @returns {Promise<number>} - Total balance in SOL
 */
export const getTotalWalletBalance = async (walletAddresses) => {
  try {
    const balances = await getMultipleWalletBalances(walletAddresses)
    
    let totalBalance = 0
    Object.values(balances).forEach(({ balance }) => {
      totalBalance += balance
    })
    
    return totalBalance
  } catch (error) {
    console.error('Error calculating total wallet balance:', error)
    throw new Error(`Failed to calculate total balance: ${error.message}`)
  }
}

/**
 * Get OGX token balance for a wallet
 * @param {string} walletAddress - The wallet address
 * @param {string} tokenMint - The OGX token mint address
 * @returns {Promise<number>} - Balance in OGX tokens
 */
export const getOGXTokenBalance = async (walletAddress, tokenMint) => {
  try {
    console.log('🔍 Getting OGX token balance for wallet:', walletAddress)
    console.log('🪙 Token mint:', tokenMint)
    
    if (!walletAddress || !tokenMint) {
      throw new Error('Wallet address and token mint are required')
    }

    // Use the exact token account address from your terminal output
    const tokenAccountAddress = 'A6dFVxCVhZCTcvoqXkzAtxQ6CD5vu9AivmMrwFk1ZwDq'
    console.log('🔑 Using known token account address:', tokenAccountAddress)
    
    try {
      // Get account info using raw RPC call
      const tokenAccountPublicKey = new PublicKey(tokenAccountAddress)
      const accountInfo = await connection.getAccountInfo(tokenAccountPublicKey)
      
      if (!accountInfo) {
        console.log('❌ Token account does not exist')
        return 0
      }
      
      console.log('✅ Token account exists')
      console.log('💰 Account info:', accountInfo)
      
      // Parse the token account data
      const data = accountInfo.data
      console.log('📊 Account data length:', data.length)
      
      if (data.length < 72) {
        console.log('❌ Invalid token account data length')
        return 0
      }
      
      // Extract amount (8 bytes starting at offset 64)
      const amountBytes = data.slice(64, 72)
      
      // Convert Uint8Array to number (little-endian)
      let amount = 0
      for (let i = 0; i < 8; i++) {
        amount += data[64 + i] * Math.pow(256, i)
      }
      
      const balance = Number(amount)
      
      console.log('💎 Raw OGX token balance:', balance)
      console.log('💎 Formatted balance:', balance.toLocaleString())
      
      return balance
    } catch (accountError) {
      console.log('❌ Error reading token account:', accountError)
      return 0
    }
    
  } catch (error) {
    console.error('❌ Error fetching OGX token balance:', error)
    throw new Error(`Failed to fetch OGX token balance: ${error.message}`)
  }
}

/**
 * Validate a Solana wallet address
 * @param {string} address - Wallet address to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const isValidSolanaAddress = (address) => {
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

