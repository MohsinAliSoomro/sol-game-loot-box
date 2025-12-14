/**
 * Token Service - Fetches token configurations from Supabase database
 * This allows admins to add/edit tokens dynamically from the dashboard
 */

import { supabase } from "./supabase";
import { PublicKey } from "@solana/web3.js";

export interface TokenConfig {
  id: string;
  key: string;
  name: string;
  symbol: string;
  mint_address: string;
  decimals: number;
  coingecko_id: string | null;
  fallback_price: number;
  is_active: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface TokenInfo {
  key: string;
  name: string;
  symbol: string;
  decimals: number;
  exchangeRate: number;
  coingeckoId: string | null;
  mint: PublicKey;
}

/**
 * Fetch all active tokens from database
 */
export async function fetchTokensFromDatabase(): Promise<TokenConfig[]> {
  try {
    const { data, error } = await supabase
      .from("tokens")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching tokens from database:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Failed to fetch tokens from database:", error);
    // Return empty array on error - fallback to config tokens
    return [];
  }
}

/**
 * Convert database token config to TokenInfo format
 */
export function convertTokenToTokenInfo(token: TokenConfig): TokenInfo {
  return {
    key: token.key,
    name: token.name,
    symbol: token.symbol,
    decimals: token.decimals,
    exchangeRate: 1000, // Default, will be calculated dynamically
    coingeckoId: token.coingecko_id,
    mint: new PublicKey(token.mint_address),
  };
}

/**
 * Get all available tokens for deposit/withdraw
 * First tries database, falls back to config if database fails
 */
export async function getAvailableTokens(): Promise<TokenInfo[]> {
  try {
    const dbTokens = await fetchTokensFromDatabase();
    
    if (dbTokens.length > 0) {
      console.log(`✅ Loaded ${dbTokens.length} tokens from database`);
      return dbTokens.map(convertTokenToTokenInfo);
    }
    
    // Fallback to config if database is empty or fails
    console.warn("⚠️ No tokens in database, falling back to config");
    return getConfigTokens();
  } catch (error) {
    console.error("Error loading tokens, falling back to config:", error);
    return getConfigTokens();
  }
}

/**
 * Fallback: Get tokens from config file
 */
function getConfigTokens(): TokenInfo[] {
  // Import config dynamically to avoid circular dependencies
  const CONFIG = require("@/lib/config").CONFIG;
  
  return CONFIG.AVAILABLE_TOKENS.map((tokenKey: string) => {
    const tokenInfo = CONFIG.TOKEN_INFO[tokenKey as keyof typeof CONFIG.TOKEN_INFO];
    const tokenMint = CONFIG.TOKENS[tokenKey as keyof typeof CONFIG.TOKENS];
    return {
      key: tokenKey,
      mint: new PublicKey(tokenMint),
      ...tokenInfo,
    };
  });
}

/**
 * Get token by key
 */
export async function getTokenByKey(key: string): Promise<TokenInfo | null> {
  try {
    const tokens = await getAvailableTokens();
    return tokens.find(t => t.key === key) || null;
  } catch (error) {
    console.error(`Error fetching token ${key}:`, error);
    return null;
  }
}


