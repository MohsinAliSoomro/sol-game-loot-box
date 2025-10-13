// Configuration file for the SpinLoot application
export const CONFIG = {
  // Solana Program Configuration
  PROGRAM_ID: "BkwbgssSuWQS46MtNRcq5RCnUgYq1H1LJpKhCGUtdGaH",
  NETWORK: "devnet" as const,
  
  // Token Configuration
  TOKENS: {
    OGX: "B1hLCUwikAg3EsibPo3UJ9skVtFsqzdt8M8MeEBMQGBn", // OGX token mint (devnet)
    SOL: "So11111111111111111111111111111111111111112", // SOL mint
  },
  
  // Exchange Rates
  EXCHANGE_RATES: {
    SOL_TO_OGX: 1000, // 1 SOL = 1000 OGX
    OGX_TO_SOL: 0.001, // 1 OGX = 0.001 SOL
  },
  
  // Platform Configuration
  PLATFORM_WALLET: "CRt41RoAZ4R9M7QHx5vyKB2Jee3NvDSmhoSak8GfMwtY", // Platform wallet for SOL deposits
  
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

export const validateAmount = (amount: number): boolean => {
  return amount >= CONFIG.UI.MIN_DEPOSIT_AMOUNT && amount <= CONFIG.UI.MAX_DEPOSIT_AMOUNT;
};
