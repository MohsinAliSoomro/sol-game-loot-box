// Solana Configuration
// Add your actual Solana program vault wallet addresses here

export const SOLANA_CONFIG = {
  // Mainnet RPC URL (using Helius for better reliability)
  RPC_URL: 'https://mainnet.helius-rpc.com/?api-key=5a1a852c-3ed9-40ee-bca8-dda4550c3ce8',
  
  // Alternative public mainnet RPC:
  // RPC_URL: 'https://api.mainnet-beta.solana.com',
  
  // Your Solana program vault wallet addresses
  VAULT_WALLETS: [
    // Your actual vault wallet address on devnet
    '7Rmpi4dDYFWBVRstRt7XuYoY9hLJ1VcVnHvaqWt7kpHU',
    // Remove the test wallet if you only want your vault balance
    // '11111111111111111111111111111112',
  ],
  
  // Token mint addresses (if you need to check specific token balances)
  TOKEN_MINTS: {
    SOL: 'So11111111111111111111111111111111111111112', // Wrapped SOL
    OGX: 'B1hLCUwikAg3EsibPo3UJ9skVtFsqzdt8M8MeEBMQGBn', // OGX token mint
    // Add other token mints as needed
  },
  
  // Refresh interval for balance updates (in milliseconds)
  REFRESH_INTERVAL: 30000, // 30 seconds
}

// Helper function to get vault wallet addresses
export const getVaultWallets = () => {
  return SOLANA_CONFIG.VAULT_WALLETS.filter(address => 
    address && address.length > 0 // Filter out empty addresses
  )
}

// Helper function to validate configuration
export const validateSolanaConfig = () => {
  const wallets = getVaultWallets()
  
  if (wallets.length === 0) {
    console.warn('No vault wallet addresses configured. Please add your actual wallet addresses in src/lib/solanaConfig.js')
    return false
  }
  
  console.log('Solana configuration validated:', {
    rpcUrl: SOLANA_CONFIG.RPC_URL,
    vaultWallets: wallets,
    network: SOLANA_CONFIG.RPC_URL.includes('devnet') ? 'devnet' : 'mainnet'
  })
  
  return true
}

