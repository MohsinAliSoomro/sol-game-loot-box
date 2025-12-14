-- Setup jackpot_contribution table for tracking ticket purchases
-- Run this in Supabase SQL Editor

-- Create jackpot_contribution table if it doesn't exist
-- Note: user_id is VARCHAR to support both UUID and wallet addresses
CREATE TABLE IF NOT EXISTS jackpot_contribution (
    id SERIAL PRIMARY KEY,
    pool_id INTEGER NOT NULL REFERENCES jackpot_pools(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    amount NUMERIC(20, 8) NOT NULL,
    contribution_type VARCHAR(50) NOT NULL DEFAULT 'ticket_purchase',
    transaction_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_jackpot_contribution_pool_id ON jackpot_contribution(pool_id);
CREATE INDEX IF NOT EXISTS idx_jackpot_contribution_user_id ON jackpot_contribution(user_id);
CREATE INDEX IF NOT EXISTS idx_jackpot_contribution_created_at ON jackpot_contribution(created_at);
CREATE INDEX IF NOT EXISTS idx_jackpot_contribution_type ON jackpot_contribution(contribution_type);

-- Enable RLS (Row Level Security)
ALTER TABLE jackpot_contribution ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow anyone to insert contributions (for ticket purchases)
DROP POLICY IF EXISTS "Anyone can insert contributions" ON jackpot_contribution;
CREATE POLICY "Anyone can insert contributions" ON jackpot_contribution
    FOR INSERT WITH CHECK (true);

-- Allow users to view their own contributions
DROP POLICY IF EXISTS "Users can view their own contributions" ON jackpot_contribution;
CREATE POLICY "Users can view their own contributions" ON jackpot_contribution
    FOR SELECT USING (true); -- Allow all for now, can restrict to auth.uid() = user_id if needed

-- Allow viewing all contributions (for admin/winner selection)
DROP POLICY IF EXISTS "Anyone can view contributions" ON jackpot_contribution;
CREATE POLICY "Anyone can view contributions" ON jackpot_contribution
    FOR SELECT USING (true);

-- Function to pick a random winner from contributions
CREATE OR REPLACE FUNCTION pick_jackpot_winner(pool_id_param INTEGER)
RETURNS TABLE (
    id INTEGER,
    user_id VARCHAR,
    amount NUMERIC,
    contribution_type VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        jc.id,
        jc.user_id,
        jc.amount,
        jc.contribution_type,
        jc.created_at
    FROM jackpot_contribution jc
    WHERE jc.pool_id = pool_id_param
    ORDER BY RANDOM()
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get all unique participants for a pool
CREATE OR REPLACE FUNCTION get_jackpot_participants(pool_id_param INTEGER)
RETURNS TABLE (
    user_id VARCHAR,
    ticket_count BIGINT,
    total_contributed NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        jc.user_id,
        COUNT(*)::BIGINT as ticket_count,
        SUM(jc.amount)::NUMERIC as total_contributed
    FROM jackpot_contribution jc
    WHERE jc.pool_id = pool_id_param
    GROUP BY jc.user_id
    ORDER BY ticket_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get total contributions for a pool
CREATE OR REPLACE FUNCTION get_jackpot_total_contributions(pool_id_param INTEGER)
RETURNS NUMERIC AS $$
DECLARE
    total NUMERIC;
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO total
    FROM jackpot_contribution
    WHERE pool_id = pool_id_param;
    
    RETURN total;
END;
$$ LANGUAGE plpgsql;

