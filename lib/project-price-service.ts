/**
 * Project Price Service - Calculate exchange rates for project tokens
 * Replaces OGX-specific calculations with project token calculations
 */

import { getSOLPrice, getTokenPrice } from './price-service';

/**
 * Calculate exchange rate from token to project token
 * Formula: (Token USD Price / SOL USD Price) * SOL_TO_PROJECT_TOKEN_RATE
 * 
 * @param tokenSymbol - Token symbol (SOL, USDC, etc.)
 * @param projectTokenSymbol - Project's default token symbol
 * @param solToProjectTokenRate - Base rate: 1 SOL = X Project Token (default: 1000)
 * @returns Exchange rate: 1 Token = X Project Token
 */
export async function calculateTokenToProjectTokenRate(
  tokenSymbol: string,
  projectTokenSymbol: string,
  solToProjectTokenRate: number = 1000
): Promise<number> {
  try {
    // If depositing project token itself, rate is 1
    if (tokenSymbol === projectTokenSymbol) {
      return 1;
    }

    // Get prices
    const solPrice = await getSOLPrice();
    const tokenPrice = await getTokenPrice(tokenSymbol);

    if (!solPrice || solPrice === 0) {
      console.error("SOL price is 0 or undefined, using fallback rate");
      return solToProjectTokenRate; // Fallback to SOL rate
    }

    if (!tokenPrice || tokenPrice === 0) {
      console.warn(`Token price for ${tokenSymbol} is 0, using fallback rate`);
      return solToProjectTokenRate; // Fallback to SOL rate
    }

    // Calculate rate: (Token USD Price / SOL USD Price) * SOL_TO_PROJECT_TOKEN_RATE
    const rate = (tokenPrice / solPrice) * solToProjectTokenRate;
    
    console.log(`📊 Exchange rate for ${tokenSymbol} to ${projectTokenSymbol}:`);
    console.log(`   SOL Price: $${solPrice}`);
    console.log(`   ${tokenSymbol} Price: $${tokenPrice}`);
    console.log(`   Rate: 1 ${tokenSymbol} = ${rate.toFixed(4)} ${projectTokenSymbol}`);

    return rate;
  } catch (error) {
    console.error(`Error calculating exchange rate for ${tokenSymbol}:`, error);
    // Fallback to SOL rate
    return solToProjectTokenRate;
  }
}

/**
 * Calculate exchange rate from project token to token (inverse of deposit rate)
 * Formula: 1 / Token_TO_PROJECT_TOKEN_RATE
 * 
 * Example:
 * - Deposit: 1 EURC = 0.56 MLT (tokenToProjectTokenRate = 0.56)
 * - Withdraw: 1 MLT = 1 / 0.56 = 1.79 EURC
 * 
 * @param tokenSymbol - Token symbol (SOL, USDC, EURC, etc.)
 * @param projectTokenSymbol - Project's default token symbol
 * @param solToProjectTokenRate - Base rate: 1 SOL = X Project Token (default: 1000)
 * @returns Exchange rate: 1 Project Token = X Token
 */
export async function calculateProjectTokenToTokenRate(
  tokenSymbol: string,
  projectTokenSymbol: string,
  solToProjectTokenRate: number = 1000
): Promise<number> {
  // Get the deposit rate (Token → Project Token)
  const tokenToProjectTokenRate = await calculateTokenToProjectTokenRate(
    tokenSymbol,
    projectTokenSymbol,
    solToProjectTokenRate
  );
  
  if (tokenToProjectTokenRate === 0) {
    console.error(`Cannot calculate withdraw rate: tokenToProjectTokenRate is 0`);
    return 0;
  }
  
  // Inverse: If 1 Token = X Project Token, then 1 Project Token = 1/X Token
  const withdrawRate = 1 / tokenToProjectTokenRate;
  
  console.log(`📊 Withdraw exchange rate for ${projectTokenSymbol} to ${tokenSymbol}:`);
  console.log(`   Deposit rate: 1 ${tokenSymbol} = ${tokenToProjectTokenRate.toFixed(4)} ${projectTokenSymbol}`);
  console.log(`   Withdraw rate: 1 ${projectTokenSymbol} = ${withdrawRate.toFixed(4)} ${tokenSymbol}`);
  
  return withdrawRate;
}

