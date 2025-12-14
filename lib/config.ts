// Configuration file for the SpinLoot application
export const CONFIG = {
  // Solana Program Configuration
  PROGRAM_ID: "BkwbgssSuWQS46MtNRcq5RCnUgYq1H1LJpKhCGUtdGaH",
  NETWORK: "devnet" as const,
  
  // Token Configuration
  TOKENS: {
    OGX: "B1hLCUwikAg3EsibPo3UJ9skVtFsqzdt8M8MeEBMQGBn", // OGX token mint (devnet)
    SOL: "So11111111111111111111111111111111111111112", // SOL mint
    USDC: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // USDC token mint (devnet test token)
    TOKEN4: "2npUomWXcWXjUfqGrtgRQCvjUSPiwx5CpyusES4pw2eg", // Token 4 mint (devnet)
  },
  
  // Token Information (name, symbol, decimals, coingeckoId for price fetching)
  // To add a new token, just add it here with its mint address and info
  TOKEN_INFO: {
    OGX: { name: "OGX", symbol: "OGX", decimals: 6, exchangeRate: 1, coingeckoId: null },
    SOL: { name: "Solana", symbol: "SOL", decimals: 9, exchangeRate: 1000, coingeckoId: "solana" },
    USDC: { name: "USD Coin", symbol: "USDC", decimals: 6, exchangeRate: 1000, coingeckoId: "usd-coin" },
    TOKEN4: { name: "Token 4", symbol: "TK4", decimals: 6, exchangeRate: 1000, coingeckoId: null },
  },
  
  // List of tokens available for deposit/withdraw (excluding OGX)
  // Add new tokens here to make them available in the UI
  AVAILABLE_TOKENS: ["SOL", "USDC", "TOKEN4"],
  
  // Base Exchange Rate (Fixed)
  // All other rates are calculated dynamically based on market prices
  BASE_EXCHANGE_RATE: {
    SOL_TO_OGX: 1000, // 1 SOL = 1000 OGX (BASE RATE - FIXED)
  },

  // Exchange Rates (Dynamic - calculated from market prices)
  // These are now calculated dynamically using price-service.ts
  // Formula: (Token USD Price / SOL USD Price) * SOL_TO_OGX_RATE
  EXCHANGE_RATES: {
    SOL_TO_OGX: 1000, // 1 SOL = 1000 OGX (fixed base rate)
    OGX_TO_SOL: 0.001, // 1 OGX = 0.001 SOL
    USDC_TO_OGX: 5.55, // 1 USDC = 5.55 OGX (example: if SOL = $180, USDC = $1)
    OGX_TO_USDC: 0.18, // 1 OGX = 0.18 USDC (example)
    TOKEN4_TO_OGX: 5.55, // 1 TOKEN4 = 5.55 OGX (example: if TOKEN4 = $1, SOL = $180)
    OGX_TO_TOKEN4: 0.18, // 1 OGX = 0.18 TOKEN4 (example)
  },
  
  // Platform Configuration
  PLATFORM_WALLET: "CRt41RoAZ4R9M7QHx5vyKB2Jee3NvDSmhoSak8GfMwtY", // Platform wallet for SOL deposits
  FEE_WALLET: "5BbDF3fuNjUvvCvzDz26ULPXUPH6ZwEw6NK9xLjQbgyr", // Fee wallet for collecting SOL fees (same as platform wallet for now)
  OGX_WITHDRAWAL_WALLET: "5arqJxyZFKf4UCCL9JXa1nf79J4kkxzAXNu2icRfnBB6", // Wallet for SOL transfers when users withdraw OGX
  
  // Transaction Configuration
  TRANSACTION_CONFIG: {
    CONFIRMATION_TIMEOUT: 60000, // 60 seconds
    MAX_RETRIES: 3,
  },
  
  // UI Configuration
  UI: {
    DECIMAL_PLACES: 4,
    MIN_DEPOSIT_AMOUNT: 0.001,
    MAX_DEPOSIT_AMOUNT: 1000,
  }
};

// Helper functions
export const formatAmount = (amount: number, decimals: number = CONFIG.UI.DECIMAL_PLACES): string => {
  return amount.toFixed(decimals);
};

export const convertSOLToOGX = (solAmount: number): number => {
  return solAmount * CONFIG.EXCHANGE_RATES.SOL_TO_OGX;
};

export const convertOGXToSOL = (ogxAmount: number): number => {
  return ogxAmount * CONFIG.EXCHANGE_RATES.OGX_TO_SOL;
};

export const convertUSDCToOGX = (usdcAmount: number): number => {
  return usdcAmount * CONFIG.EXCHANGE_RATES.USDC_TO_OGX;
};

export const convertOGXToUSDC = (ogxAmount: number): number => {
  return ogxAmount * CONFIG.EXCHANGE_RATES.OGX_TO_USDC;
};

export const convertToken4ToOGX = (tokenAmount: number): number => {
  return tokenAmount * CONFIG.EXCHANGE_RATES.TOKEN4_TO_OGX;
};

export const convertOGXToToken4 = (ogxAmount: number): number => {
  return ogxAmount * CONFIG.EXCHANGE_RATES.OGX_TO_TOKEN4;
};

// Generic conversion function (uses static rates from config)
// For dynamic rates based on real-time prices, use convertTokenToOGXDynamic from price-service.ts
export const convertTokenToOGX = (tokenAmount: number, tokenSymbol: string): number => {
  const rates: { [key: string]: number } = {
    SOL: CONFIG.EXCHANGE_RATES.SOL_TO_OGX,
    USDC: CONFIG.EXCHANGE_RATES.USDC_TO_OGX,
    TOKEN4: CONFIG.EXCHANGE_RATES.TOKEN4_TO_OGX,
    OGX: 1,
  };
  return tokenAmount * (rates[tokenSymbol] || CONFIG.EXCHANGE_RATES.SOL_TO_OGX);
};

export const convertOGXToToken = (ogxAmount: number, tokenSymbol: string): number => {
  const rates: { [key: string]: number } = {
    SOL: CONFIG.EXCHANGE_RATES.OGX_TO_SOL,
    USDC: CONFIG.EXCHANGE_RATES.OGX_TO_USDC,
    TOKEN4: CONFIG.EXCHANGE_RATES.OGX_TO_TOKEN4,
    OGX: 1,
  };
  return ogxAmount * (rates[tokenSymbol] || CONFIG.EXCHANGE_RATES.OGX_TO_SOL);
};

export const validateAmount = (amount: number): boolean => {
  return amount >= CONFIG.UI.MIN_DEPOSIT_AMOUNT && amount <= CONFIG.UI.MAX_DEPOSIT_AMOUNT;
};
