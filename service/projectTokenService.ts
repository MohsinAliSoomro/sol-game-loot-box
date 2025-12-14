/**
 * Project Token Service - Fetches project-specific token configurations
 * Each project has its own tokens, not global tokens
 */

import { supabase } from "./supabase";
import { PublicKey } from "@solana/web3.js";

export interface ProjectTokenConfig {
  id: number;
  project_id: number;
  name: string;
  symbol: string;
  mint_address: string;
  decimals: number;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
  coingecko_id?: string | null;
  fallback_price?: number;
  exchange_rate_to_sol?: number;
  token_type?: 'offchain' | 'onchain';
}

export interface ProjectTokenInfo {
  key: string;
  name: string;
  symbol: string;
  decimals: number;
  exchangeRate: number;
  coingeckoId: string | null;
  mint: PublicKey;
  is_default: boolean;
}

/**
 * Fetch all active tokens for a project
 */
export async function fetchProjectTokens(projectId: number): Promise<ProjectTokenConfig[]> {
  try {
    const { data, error } = await supabase
      .from("project_tokens")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching project tokens from database:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Failed to fetch project tokens from database:", error);
    return [];
  }
}

/**
 * Fetch only on-chain payment tokens for a project (excludes off-chain token)
 */
export async function fetchOnChainTokens(projectId: number): Promise<ProjectTokenConfig[]> {
  try {
    // First try with token_type filter (if column exists)
    let query = supabase
      .from("project_tokens")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    // Try to filter by token_type if column exists
    // If column doesn't exist, this will fail gracefully and we'll filter manually
    try {
      const { data, error } = await query.eq("token_type", "onchain");
      
      if (error) {
        // If token_type column doesn't exist, fall back to filtering by is_default
        console.warn("⚠️ token_type column may not exist, falling back to is_default filter:", error.message);
        const { data: allTokens, error: allError } = await supabase
          .from("project_tokens")
          .select("*")
          .eq("project_id", projectId)
          .eq("is_active", true)
          .order("display_order", { ascending: true });
        
        if (allError) {
          console.error("Error fetching all tokens:", allError);
          return [];
        }
        
        // Filter out default tokens (off-chain) manually
        const onChainTokens = (allTokens || []).filter(token => !token.is_default);
        console.log(`✅ Loaded ${onChainTokens.length} on-chain tokens (fallback method)`);
        return onChainTokens;
      }

      console.log(`✅ Loaded ${(data || []).length} on-chain tokens from database`);
      return data || [];
    } catch (typeError: any) {
      // If token_type filter fails, use fallback
      console.warn("⚠️ token_type filter failed, using fallback:", typeError.message);
      const { data: allTokens, error: allError } = await supabase
        .from("project_tokens")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      
      if (allError) {
        console.error("Error fetching all tokens:", allError);
        return [];
      }
      
      // Filter out default tokens (off-chain) manually
      const onChainTokens = (allTokens || []).filter(token => !token.is_default);
      console.log(`✅ Loaded ${onChainTokens.length} on-chain tokens (fallback method)`);
      return onChainTokens;
    }
  } catch (error) {
    console.error("Failed to fetch on-chain tokens from database:", error);
    return [];
  }
}

/**
 * Get default token for a project
 */
export async function getProjectDefaultToken(projectId: number): Promise<ProjectTokenConfig | null> {
  try {
    const { data, error } = await supabase
      .from("project_tokens")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_default", true)
      .eq("is_active", true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No token found
        return null;
      }
      throw error;
    }

    return data || null;
  } catch (error) {
    console.error("Failed to fetch project default token:", error);
    return null;
  }
}

/**
 * Convert project token config to TokenInfo format
 */
export function convertProjectTokenToTokenInfo(token: ProjectTokenConfig): ProjectTokenInfo {
  return {
    key: token.symbol, // Use symbol as key
    name: token.name,
    symbol: token.symbol,
    decimals: token.decimals,
    exchangeRate: token.exchange_rate_to_sol ? token.exchange_rate_to_sol * 1000 : 1000, // Default rate
    coingeckoId: token.coingecko_id || null,
    mint: new PublicKey(token.mint_address),
    is_default: token.is_default,
  };
}

/**
 * Get all available tokens for a project
 * SOL is always included as the native token (first option)
 * Only includes on-chain payment tokens (excludes off-chain project token)
 */
export async function getProjectAvailableTokens(projectId: number): Promise<ProjectTokenInfo[]> {
  try {
    // Only fetch on-chain tokens (payment tokens), not the off-chain project token
    const onChainTokens = await fetchOnChainTokens(projectId);
    
    // SOL is always available as native token (for buying project tokens)
    const SOL_TOKEN: ProjectTokenInfo = {
      key: "SOL",
      name: "Solana",
      symbol: "SOL",
      decimals: 9,
      exchangeRate: 1000, // Default: 1 SOL = 1000 project tokens
      coingeckoId: "solana",
      mint: new PublicKey("So11111111111111111111111111111111111111112"), // SOL mint
      is_default: false, // SOL is not the default project token, it's the payment token
    };
    
    // Convert on-chain tokens to TokenInfo format
    const onChainTokenInfos = onChainTokens.map(convertProjectTokenToTokenInfo);
    
    // Always include SOL as the first option, then other on-chain tokens
    const allTokens = [SOL_TOKEN, ...onChainTokenInfos];
    
    if (onChainTokens.length > 0) {
      console.log(`✅ Loaded SOL + ${onChainTokens.length} on-chain payment tokens from database`);
    } else {
      console.log(`✅ Loaded SOL (no additional on-chain tokens configured yet)`);
    }
    
    return allTokens;
  } catch (error) {
    console.error("Error loading project tokens:", error);
    // Return at least SOL even if there's an error
    return [{
      key: "SOL",
      name: "Solana",
      symbol: "SOL",
      decimals: 9,
      exchangeRate: 1000,
      coingeckoId: "solana",
      mint: new PublicKey("So11111111111111111111111111111111111111112"),
      is_default: false,
    }];
  }
}

/**
 * Get project default token info
 */
export async function getProjectDefaultTokenInfo(projectId: number): Promise<ProjectTokenInfo | null> {
  try {
    const token = await getProjectDefaultToken(projectId);
    if (token) {
      return convertProjectTokenToTokenInfo(token);
    }
    return null;
  } catch (error) {
    console.error("Error loading project default token:", error);
    return null;
  }
}

