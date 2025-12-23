-- Tokens Management Schema for Supabase
-- This schema creates a table to store token configurations for deposit/withdraw

-- Table: tokens
-- Stores token information for deposit and withdrawal
CREATE TABLE IF NOT EXISTS tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL, -- Token key (e.g., "USDC", "TOKEN4")
  name TEXT NOT NULL, -- Display name (e.g., "USD Coin")
  symbol TEXT NOT NULL, -- Token symbol (e.g., "USDC")
  mint_address TEXT NOT NULL UNIQUE, -- Solana token mint address
  decimals INTEGER NOT NULL DEFAULT 6, -- Token decimals
  coingecko_id TEXT, -- CoinGecko ID for price fetching (nullable)
  fallback_price DECIMAL DEFAULT 1, -- Fallback USD price if CoinGecko unavailable
  is_active BOOLEAN DEFAULT true, -- Whether token is active for deposit/withdraw
  display_order INTEGER DEFAULT 0, -- Order in dropdown (lower = first)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_tokens_active ON tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_tokens_display_order ON tokens(display_order);
CREATE INDEX IF NOT EXISTS idx_tokens_key ON tokens(key);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_tokens_updated_at ON tokens;

-- Trigger to auto-update updated_at for tokens
CREATE TRIGGER update_tokens_updated_at
    BEFORE UPDATE ON tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_tokens_updated_at();

-- Row Level Security (RLS) Policies
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to tokens" ON tokens;
DROP POLICY IF EXISTS "Allow authenticated users to modify tokens" ON tokens;
DROP POLICY IF EXISTS "Allow all operations on tokens" ON tokens;

-- Policy: Allow all operations on tokens (for admin dashboard)
-- Since this is an admin dashboard, we allow all operations without auth checks
CREATE POLICY "Allow all operations on tokens"
  ON tokens FOR ALL
  USING (true)
  WITH CHECK (true);

-- Insert default tokens (matching current config)
INSERT INTO tokens (key, name, symbol, mint_address, decimals, coingecko_id, fallback_price, is_active, display_order)
VALUES 
  ('SOL', 'Solana', 'SOL', 'So11111111111111111111111111111111111111112', 9, 'solana', 180, true, 1),
  ('USDC', 'USD Coin', 'USDC', '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', 6, 'usd-coin', 1, true, 2),
  ('TOKEN4', 'Token 4', 'TK4', '2npUomWXcWXjUfqGrtgRQCvjUSPiwx5CpyusES4pw2eg', 6, NULL, 1, true, 3)
ON CONFLICT (key) DO NOTHING;

-- Note: OGX token is not included here as it's the base token and handled separately
-- Only tokens that can be deposited/withdrawn are stored here


