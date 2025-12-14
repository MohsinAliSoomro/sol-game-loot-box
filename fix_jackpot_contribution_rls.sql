-- Quick fix for jackpot_contribution RLS issues
-- Run this if contributions aren't being inserted

-- Step 1: Ensure table exists (create if not)
CREATE TABLE IF NOT EXISTS jackpot_contribution (
    id SERIAL PRIMARY KEY,
    pool_id INTEGER NOT NULL REFERENCES jackpot_pools(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    amount NUMERIC(20, 8) NOT NULL,
    contribution_type VARCHAR(50) NOT NULL DEFAULT 'ticket_purchase',
    transaction_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_jackpot_contribution_pool_id ON jackpot_contribution(pool_id);
CREATE INDEX IF NOT EXISTS idx_jackpot_contribution_user_id ON jackpot_contribution(user_id);
CREATE INDEX IF NOT EXISTS idx_jackpot_contribution_created_at ON jackpot_contribution(created_at);

-- Step 3: Enable RLS
ALTER TABLE jackpot_contribution ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop existing policies and recreate them
DROP POLICY IF EXISTS "Anyone can insert contributions" ON jackpot_contribution;
DROP POLICY IF EXISTS "Users can view their own contributions" ON jackpot_contribution;
DROP POLICY IF EXISTS "Anyone can view contributions" ON jackpot_contribution;

-- Step 5: Create policies that definitely work
-- Allow INSERT for anyone (required for ticket purchases)
CREATE POLICY "Anyone can insert contributions" ON jackpot_contribution
    FOR INSERT WITH CHECK (true);

-- Allow SELECT for anyone (for viewing and winner selection)
CREATE POLICY "Anyone can view contributions" ON jackpot_contribution
    FOR SELECT USING (true);

-- Step 6: Test insert (this should work now)
-- Uncomment the line below to test, then delete the test record
-- INSERT INTO jackpot_contribution (pool_id, user_id, amount, contribution_type) VALUES (1, 'test', 100, 'ticket_purchase');

-- Verify policies
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'jackpot_contribution';

