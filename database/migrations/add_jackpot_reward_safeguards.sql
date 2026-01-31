-- =====================================================
-- Migration: Add Safeguards to Prevent Duplicate Jackpot Rewards
-- =====================================================
-- Problem: Jackpot rewards are being credited multiple times on page refresh
-- Solution: Add database-level safeguards to ensure idempotent reward claiming
-- =====================================================

-- Step 1: Add balance_credited flag to jackpot_wins table
DO $$ 
BEGIN
    -- Check if column already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'jackpot_wins' 
        AND column_name = 'balance_credited'
    ) THEN
        ALTER TABLE jackpot_wins 
        ADD COLUMN balance_credited BOOLEAN DEFAULT false NOT NULL;
        
        -- Set existing wins as already credited (to prevent re-crediting old wins)
        UPDATE jackpot_wins 
        SET balance_credited = true 
        WHERE balance_credited = false;
        
        RAISE NOTICE '✅ Added balance_credited column to jackpot_wins';
    ELSE
        RAISE NOTICE 'ℹ️  Column balance_credited already exists in jackpot_wins';
    END IF;
END $$;

-- Step 2: Create reward_claims table for idempotent reward tracking
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'reward_claims'
    ) THEN
        CREATE TABLE reward_claims (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            win_id INTEGER NOT NULL REFERENCES jackpot_wins(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL,
            pool_id INTEGER NOT NULL,
            project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
            reward_type TEXT NOT NULL, -- 'item', 'nft', 'sol'
            reward_amount NUMERIC(20, 6) NOT NULL,
            claimed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            
            -- Ensure one claim per win (idempotent)
            UNIQUE(win_id)
        );
        
        CREATE INDEX idx_reward_claims_user ON reward_claims(user_id);
        CREATE INDEX idx_reward_claims_pool ON reward_claims(pool_id);
        CREATE INDEX idx_reward_claims_project ON reward_claims(project_id) WHERE project_id IS NOT NULL;
        
        RAISE NOTICE '✅ Created reward_claims table with unique constraint on win_id';
    ELSE
        RAISE NOTICE 'ℹ️  Table reward_claims already exists';
    END IF;
END $$;

-- Step 3: Add index on balance_credited for faster lookups
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_jackpot_wins_balance_credited'
        AND tablename = 'jackpot_wins'
    ) THEN
        CREATE INDEX idx_jackpot_wins_balance_credited 
        ON jackpot_wins(balance_credited) 
        WHERE balance_credited = false;
        
        RAISE NOTICE '✅ Created index on balance_credited';
    ELSE
        RAISE NOTICE 'ℹ️  Index idx_jackpot_wins_balance_credited already exists';
    END IF;
END $$;

-- Step 4: Verify the changes
DO $$ 
DECLARE
    has_balance_credited BOOLEAN;
    has_reward_claims BOOLEAN;
BEGIN
    -- Check if balance_credited column exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'jackpot_wins' 
        AND column_name = 'balance_credited'
    ) INTO has_balance_credited;
    
    -- Check if reward_claims table exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'reward_claims'
    ) INTO has_reward_claims;
    
    IF has_balance_credited AND has_reward_claims THEN
        RAISE NOTICE '✅ Migration completed successfully!';
        RAISE NOTICE '   - balance_credited column: %', has_balance_credited;
        RAISE NOTICE '   - reward_claims table: %', has_reward_claims;
    ELSE
        RAISE WARNING '⚠️  Migration may be incomplete. balance_credited: %, reward_claims: %', has_balance_credited, has_reward_claims;
    END IF;
END $$;

-- =====================================================
-- Migration Summary:
-- =====================================================
-- ✅ Added: balance_credited BOOLEAN column to jackpot_wins
-- ✅ Created: reward_claims table with UNIQUE(win_id) constraint
-- ✅ Result: Database-level protection against duplicate rewards
-- ✅ Result: Idempotent reward claiming (safe to call multiple times)
-- =====================================================
