# Solana Vault Balance Configuration Guide

## Overview
Your dashboard now fetches the real Solana program vault wallet balance instead of showing 0. This guide will help you configure your actual wallet addresses.

## Setup Steps

### 1. Configure Your Vault Wallet Addresses

Edit the file `src/lib/solanaConfig.js` and replace the placeholder addresses with your actual Solana program vault wallet addresses:

```javascript
export const SOLANA_CONFIG = {
  RPC_URL: 'https://api.mainnet-beta.solana.com',
  
  VAULT_WALLETS: [
    // Replace these with your actual vault wallet addresses
    'YourActualVaultWalletAddress1',
    'YourActualVaultWalletAddress2',
    'YourActualVaultWalletAddress3',
  ],
  
  // ... rest of config
}
```

### 2. RPC Endpoint Configuration

Choose the appropriate RPC endpoint for your environment:

- **Mainnet (Production)**: `https://api.mainnet-beta.solana.com`
- **Devnet (Testing)**: `https://api.devnet.solana.com`
- **Testnet**: `https://api.testnet.solana.com`

For better performance, consider using a dedicated RPC provider like:
- Alchemy: `https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY`
- QuickNode: `https://your-endpoint.solana-mainnet.quiknode.pro/YOUR_API_KEY/`
- Helius: `https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY`

### 3. Finding Your Vault Wallet Addresses

Your Solana program vault wallet addresses are typically:
- The program's associated token accounts
- The main treasury wallet
- Any wallets that hold the platform's funds

You can find these addresses in:
- Your Solana program's configuration
- Your backend/blockchain code
- Solana Explorer by searching your program ID

### 4. Testing the Configuration

After updating the addresses, you can test the configuration by:

1. Opening the browser console
2. Checking for any error messages
3. Verifying the balance updates in the dashboard

### 5. Error Handling

The system includes comprehensive error handling:
- Invalid wallet addresses will show an error
- Network issues will be displayed to the user
- Missing configuration will show a warning

## Features

### Real-time Balance Updates
- Balance refreshes every 30 seconds automatically
- Manual refresh available
- Shows individual wallet balances in console logs

### Multiple Wallet Support
- Supports multiple vault wallets
- Calculates total balance across all wallets
- Individual wallet error handling

### Error States
- Configuration errors
- Network connection errors
- Invalid wallet address errors

## Troubleshooting

### Common Issues

1. **"No vault wallet addresses configured"**
   - Add your actual wallet addresses to `solanaConfig.js`

2. **"Failed to fetch wallet balance"**
   - Check if wallet addresses are valid
   - Verify RPC endpoint is working
   - Check network connection

3. **Balance showing 0**
   - Verify wallet addresses are correct
   - Check if wallets actually have SOL
   - Ensure you're using the right network (mainnet/devnet)

### Debug Information

Check the browser console for detailed error messages and debug information about:
- Wallet address validation
- RPC connection status
- Balance fetch results
- Individual wallet balances

## Security Notes

- Never commit real wallet addresses to public repositories
- Use environment variables for sensitive configuration
- Consider using read-only wallet addresses for display purposes
- Implement proper access controls for admin functions

## Next Steps

1. Update `src/lib/solanaConfig.js` with your actual wallet addresses
2. Test the configuration
3. Monitor the dashboard for real-time balance updates
4. Consider implementing additional Solana features like transaction history

