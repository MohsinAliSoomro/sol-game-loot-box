/**
 * Price Service - Fetches real-time token prices and calculates exchange rates
 * Uses CoinGecko API for price data
 */

// Cache for prices (5 minutes cache)
interface PriceCache {
  prices: { [tokenSymbol: string]: number };
  timestamp: number;
}

const PRICE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let priceCache: PriceCache | null = null;

// CoinGecko token IDs - dynamically loaded from config
// This will be populated from CONFIG.TOKEN_INFO
let COINGECKO_IDS: { [key: string]: string } = {
  SOL: "solana",
  USDC: "usd-coin",
};

// Default fallback prices (USD) - can be updated from database
let FALLBACK_PRICES: { [key: string]: number } = {
  SOL: 180, // Default SOL price
  USDC: 1, // USDC is always $1
  TOKEN4: 1, // Default price for TOKEN4 (update based on actual token)
};

/**
 * Initialize CoinGecko IDs from config or database
 * This allows adding new tokens dynamically
 * Supports both main website tokens and project-specific tokens
 */
export async function initializePriceService(config?: any, projectId?: number) {
  try {
    // For sub-projects, load project tokens first
    if (projectId) {
      try {
        const { fetchOnChainTokens } = await import("@/service/projectTokenService");
        const projectTokens = await fetchOnChainTokens(projectId);
        
        if (projectTokens.length > 0) {
          projectTokens.forEach(token => {
            if (token.coingecko_id) {
              COINGECKO_IDS[token.symbol] = token.coingecko_id;
            }
            // Update fallback prices from project tokens
            if (token.fallback_price) {
              FALLBACK_PRICES[token.symbol] = token.fallback_price;
            }
          });
          console.log("✅ Price service initialized with project tokens:", projectTokens.map(t => t.symbol));
        }
      } catch (error) {
        console.warn("Could not load project tokens:", error);
      }
    }
    
    // Also try to load from main website tokens table
    try {
      const { fetchTokensFromDatabase } = await import("@/service/tokenService");
      const dbTokens = await fetchTokensFromDatabase();
      
      if (dbTokens.length > 0) {
        dbTokens.forEach(token => {
          if (token.coingecko_id) {
            COINGECKO_IDS[token.key] = token.coingecko_id;
          }
          // Also update fallback prices
          FALLBACK_PRICES[token.key] = token.fallback_price || 1;
        });
        console.log("✅ Price service initialized with main website tokens:", Object.keys(COINGECKO_IDS));
      }
    } catch (error) {
      console.warn("Could not load tokens from database, using config:", error);
    }
  } catch (error) {
    console.warn("Error initializing price service:", error);
  }
  
  // Fallback to config
  if (config?.TOKEN_INFO) {
    Object.entries(config.TOKEN_INFO).forEach(([key, info]: [string, any]) => {
      if (info.coingeckoId && !COINGECKO_IDS[key]) {
        COINGECKO_IDS[key] = info.coingeckoId;
      }
      if (info.fallbackPrice && !FALLBACK_PRICES[key]) {
        FALLBACK_PRICES[key] = info.fallbackPrice;
      }
    });
    console.log("✅ Price service initialized with tokens from config:", Object.keys(COINGECKO_IDS));
  }
  
  // Always ensure SOL is available
  if (!COINGECKO_IDS.SOL) {
    COINGECKO_IDS.SOL = "solana";
  }
  if (!FALLBACK_PRICES.SOL) {
    FALLBACK_PRICES.SOL = 180;
  }
}

/**
 * Fetch token price from CoinGecko API
 */
async function fetchTokenPriceFromCoinGecko(tokenSymbol: string): Promise<number | null> {
  try {
    const coinId = COINGECKO_IDS[tokenSymbol];
    if (!coinId) {
      console.warn(`No CoinGecko ID found for ${tokenSymbol}, using fallback price`);
      return FALLBACK_PRICES[tokenSymbol] || null;
    }

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
    );

    if (!response.ok) {
      console.error(`Failed to fetch price for ${tokenSymbol}: ${response.statusText}`);
      return FALLBACK_PRICES[tokenSymbol] || null;
    }

    const data = await response.json();
    const price = data[coinId]?.usd;

    if (!price) {
      console.warn(`Price not found for ${tokenSymbol}, using fallback`);
      return FALLBACK_PRICES[tokenSymbol] || null;
    }

    return price;
  } catch (error) {
    console.error(`Error fetching price for ${tokenSymbol}:`, error);
    return FALLBACK_PRICES[tokenSymbol] || null;
  }
}

/**
 * Fetch all token prices
 * Now supports any token from config
 */
async function fetchAllPrices(tokenSymbols?: string[]): Promise<{ [tokenSymbol: string]: number }> {
  const prices: { [tokenSymbol: string]: number } = {};
  
  // If no token symbols provided, fetch all known tokens
  const tokensToFetch = tokenSymbols || Object.keys(COINGECKO_IDS).concat(Object.keys(FALLBACK_PRICES));
  const uniqueTokens = [...new Set(tokensToFetch)];

  // Fetch SOL price first (required for all calculations)
  if (uniqueTokens.includes("SOL")) {
    const solPrice = await fetchTokenPriceFromCoinGecko("SOL");
    prices.SOL = solPrice || FALLBACK_PRICES.SOL;
  }

  // Fetch prices for all other tokens in parallel
  const pricePromises = uniqueTokens
    .filter(token => token !== "SOL")
    .map(async (tokenSymbol) => {
      const price = await fetchTokenPriceFromCoinGecko(tokenSymbol);
      return { tokenSymbol, price: price || FALLBACK_PRICES[tokenSymbol] || 0 };
    });

  const priceResults = await Promise.all(pricePromises);
  priceResults.forEach(({ tokenSymbol, price }) => {
    prices[tokenSymbol] = price;
  });

  return prices;
}

/**
 * Get cached prices or fetch new ones
 */
async function getTokenPrices(): Promise<{ [tokenSymbol: string]: number }> {
  const now = Date.now();

  // Check if cache is valid
  if (priceCache && now - priceCache.timestamp < PRICE_CACHE_DURATION) {
    console.log("✅ Using cached prices");
    return priceCache.prices;
  }

  // Fetch new prices
  console.log("🔄 Fetching new token prices...");
  const prices = await fetchAllPrices();
  
  // Update cache
  priceCache = {
    prices,
    timestamp: now,
  };

  console.log("📊 Token prices:", prices);
  return prices;
}

/**
 * Get SOL price in USD
 */
export async function getSOLPrice(): Promise<number> {
  const prices = await getTokenPrices();
  return prices.SOL || FALLBACK_PRICES.SOL;
}

/**
 * Get token price in USD
 */
export async function getTokenPrice(tokenSymbol: string): Promise<number> {
  const prices = await getTokenPrices();
  return prices[tokenSymbol] || FALLBACK_PRICES[tokenSymbol] || 0;
}

/**
 * Calculate exchange rate from token to OGX
 * Formula: (Token USD Price / SOL USD Price) * SOL_TO_OGX_RATE
 * 
 * @param tokenSymbol - Token symbol (SOL, USDC, TOKEN4, etc.)
 * @param solToOGXRate - Base rate: 1 SOL = X OGX (default: 1000)
 * @returns Exchange rate: 1 Token = X OGX
 */
export async function calculateTokenToOGXRate(
  tokenSymbol: string,
  solToOGXRate: number = 1000
): Promise<number> {
  try {
    // OGX always has rate of 1
    if (tokenSymbol === "OGX") {
      return 1;
    }

    // Get prices
    const solPrice = await getSOLPrice();
    const tokenPrice = await getTokenPrice(tokenSymbol);

    if (!solPrice || solPrice === 0) {
      console.error("SOL price is 0 or undefined, using fallback rate");
      return solToOGXRate; // Fallback to SOL rate
    }

    if (!tokenPrice || tokenPrice === 0) {
      console.warn(`Token price for ${tokenSymbol} is 0, using fallback rate`);
      return solToOGXRate; // Fallback to SOL rate
    }

    // Calculate rate: (Token USD Price / SOL USD Price) * SOL_TO_OGX_RATE
    const rate = (tokenPrice / solPrice) * solToOGXRate;
    
    console.log(`📊 Exchange rate for ${tokenSymbol}:`);
    console.log(`   SOL Price: $${solPrice}`);
    console.log(`   ${tokenSymbol} Price: $${tokenPrice}`);
    console.log(`   Rate: 1 ${tokenSymbol} = ${rate.toFixed(4)} OGX`);

    return rate;
  } catch (error) {
    console.error(`Error calculating exchange rate for ${tokenSymbol}:`, error);
    // Fallback to SOL rate
    return solToOGXRate;
  }
}

/**
 * Calculate exchange rate from OGX to token
 * Formula: SOL_TO_OGX_RATE / Token_TO_OGX_RATE
 */
export async function calculateOGXToTokenRate(
  tokenSymbol: string,
  solToOGXRate: number = 1000
): Promise<number> {
  try {
    if (tokenSymbol === "OGX") {
      return 1;
    }

    const tokenToOGXRate = await calculateTokenToOGXRate(tokenSymbol, solToOGXRate);
    return 1 / tokenToOGXRate;
  } catch (error) {
    console.error(`Error calculating OGX to ${tokenSymbol} rate:`, error);
    return 1 / solToOGXRate; // Fallback
  }
}

/**
 * Get all exchange rates
 * Now supports dynamic tokens from database
 */
export async function getAllExchangeRates(solToOGXRate: number = 1000, tokenKeys?: string[]): Promise<{
  SOL_TO_OGX: number;
  OGX_TO_SOL: number;
  USDC_TO_OGX: number;
  OGX_TO_USDC: number;
  TOKEN4_TO_OGX: number;
  OGX_TO_TOKEN4: number;
  [key: string]: number;
}> {
  // Default tokens if none provided
  const tokensToFetch = tokenKeys || ["SOL", "USDC", "TOKEN4"];
  
  // Calculate rates for all tokens in parallel
  const ratePromises = tokensToFetch.map(async (tokenKey) => {
    if (tokenKey === "SOL") {
      return { key: tokenKey, rate: solToOGXRate };
    }
    const rate = await calculateTokenToOGXRate(tokenKey, solToOGXRate);
    return { key: tokenKey, rate };
  });

  const rates = await Promise.all(ratePromises);
  
  // Build result object
  const result: { [key: string]: number } = {};
  rates.forEach(({ key, rate }) => {
    result[`${key}_TO_OGX`] = rate;
    result[`OGX_TO_${key}`] = 1 / rate;
  });

  // Ensure backward compatibility with existing structure
  return {
    SOL_TO_OGX: result.SOL_TO_OGX || solToOGXRate,
    OGX_TO_SOL: result.OGX_TO_SOL || (1 / solToOGXRate),
    USDC_TO_OGX: result.USDC_TO_OGX || result.USDC_TO_OGX || 5.55,
    OGX_TO_USDC: result.OGX_TO_USDC || (1 / (result.USDC_TO_OGX || 5.55)),
    TOKEN4_TO_OGX: result.TOKEN4_TO_OGX || result.TOKEN4_TO_OGX || 5.55,
    OGX_TO_TOKEN4: result.OGX_TO_TOKEN4 || (1 / (result.TOKEN4_TO_OGX || 5.55)),
    ...result, // Include all dynamic rates
  };
}

/**
 * Convert token amount to OGX using dynamic rates
 */
export async function convertTokenToOGXDynamic(
  tokenAmount: number,
  tokenSymbol: string,
  solToOGXRate: number = 1000
): Promise<number> {
  const rate = await calculateTokenToOGXRate(tokenSymbol, solToOGXRate);
  return tokenAmount * rate;
}

/**
 * Convert OGX amount to token using dynamic rates
 */
export async function convertOGXToTokenDynamic(
  ogxAmount: number,
  tokenSymbol: string,
  solToOGXRate: number = 1000
): Promise<number> {
  const rate = await calculateOGXToTokenRate(tokenSymbol, solToOGXRate);
  return ogxAmount * rate;
}

/**
 * Calculate fee amount for a token based on SOL fee
 * Formula: Fee in Token = (SOL Fee Amount * SOL Price) / Token Price
 * 
 * @param tokenSymbol - Token symbol (SOL, USDC, TOKEN4, etc.)
 * @param solFeeAmount - SOL fee amount (default: 0.001 SOL)
 * @returns Fee amount in the specified token
 */
export async function calculateTokenFee(
  tokenSymbol: string,
  solFeeAmount: number = 0.001
): Promise<number> {
  try {
    // SOL fee is already in SOL, so return as-is
    if (tokenSymbol === "SOL") {
      return solFeeAmount;
    }

    // Get prices
    const solPrice = await getSOLPrice();
    const tokenPrice = await getTokenPrice(tokenSymbol);

    if (!solPrice || solPrice === 0) {
      console.error("SOL price is 0 or undefined, using fallback");
      return solFeeAmount; // Fallback to SOL fee
    }

    if (!tokenPrice || tokenPrice === 0) {
      console.warn(`Token price for ${tokenSymbol} is 0, using fallback`);
      return solFeeAmount; // Fallback to SOL fee
    }

    // Calculate fee: (SOL Fee Amount * SOL Price) / Token Price
    // This gives us the equivalent fee in the token's currency
    const feeInUSD = solFeeAmount * solPrice;
    const tokenFee = feeInUSD / tokenPrice;
    
    console.log(`💰 Fee calculation for ${tokenSymbol}:`);
    console.log(`   SOL Fee: ${solFeeAmount} SOL`);
    console.log(`   SOL Price: $${solPrice}`);
    console.log(`   Token Price: $${tokenPrice}`);
    console.log(`   Fee in USD: $${feeInUSD.toFixed(6)}`);
    console.log(`   Fee in ${tokenSymbol}: ${tokenFee.toFixed(6)}`);

    return tokenFee;
  } catch (error) {
    console.error(`Error calculating fee for ${tokenSymbol}:`, error);
    // Fallback to SOL fee
    return solFeeAmount;
  }
}

/**
 * Get fee amount for all tokens
 */
export async function getAllTokenFees(solFeeAmount: number = 0.001): Promise<{
  SOL: number;
  USDC: number;
  TOKEN4: number;
  [key: string]: number;
}> {
  const [solFee, usdcFee, token4Fee] = await Promise.all([
    Promise.resolve(solFeeAmount), // SOL fee is fixed
    calculateTokenFee("USDC", solFeeAmount),
    calculateTokenFee("TOKEN4", solFeeAmount),
  ]);

  return {
    SOL: solFee,
    USDC: usdcFee,
    TOKEN4: token4Fee,
  };
}

