-- =====================================================
-- Migration: Fix SPL Token Mint Address Constraint
-- =====================================================
-- Problem: Global UNIQUE constraint on mint_address prevents same SPL token
--          from being used as a reward across different projects
-- Solution: Replace with composite unique constraint on (project_id, mint_address)
-- =====================================================
-- 
-- Context:
-- - SPL tokens are fungible tokens on Solana
-- - One SPL mint can be used by unlimited apps/projects
-- - Current constraint incorrectly prevents cross-project reuse
-- - New constraint allows same mint in different projects, prevents duplicates within project
-- =====================================================

-- Step 1: Drop the existing global unique constraint on mint_address
DO $$ 
BEGIN
    -- Check if the constraint exists before dropping
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'token_reward_percentages_mint_address_key'
        AND conrelid = 'token_reward_percentages'::regclass
    ) THEN
        ALTER TABLE token_reward_percentages 
        DROP CONSTRAINT token_reward_percentages_mint_address_key;
        
        RAISE NOTICE '✅ Dropped global unique constraint: token_reward_percentages_mint_address_key';
    ELSE
        RAISE NOTICE 'ℹ️  Constraint token_reward_percentages_mint_address_key does not exist, skipping drop';
    END IF;
END $$;

-- Step 2: Create composite unique constraint on (project_id, mint_address)
-- This allows:
--   - Same mint_address in different projects (project_id = 1, mint = ABC) and (project_id = 2, mint = ABC) ✅
--   - Prevents duplicates within same project (project_id = 1, mint = ABC) twice ❌
--   - Uses partial index to handle NULL mint_address values (for non-token rewards)
DO $$ 
BEGIN
    -- Check if the new constraint already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'token_reward_percentages_project_mint_unique'
        AND tablename = 'token_reward_percentages'
    ) THEN
        -- Create unique index for non-NULL mint_address values
        -- This allows multiple NULL mint_address values (for SOL rewards, off-chain items, etc.)
        CREATE UNIQUE INDEX token_reward_percentages_project_mint_unique 
        ON token_reward_percentages(project_id, mint_address) 
        WHERE mint_address IS NOT NULL;
        
        RAISE NOTICE '✅ Created composite unique constraint: token_reward_percentages_project_mint_unique';
    ELSE
        RAISE NOTICE 'ℹ️  Constraint token_reward_percentages_project_mint_unique already exists, skipping creation';
    END IF;
END $$;

-- Step 3: Verify the migration
DO $$ 
DECLARE
    global_constraint_count INTEGER;
    composite_constraint_count INTEGER;
BEGIN
    -- Count remaining global constraints on mint_address
    SELECT COUNT(*) INTO global_constraint_count
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'token_reward_percentages'
    AND c.conname LIKE '%mint_address_key'
    AND c.contype = 'u';
    
    -- Count composite constraints
    SELECT COUNT(*) INTO composite_constraint_count
    FROM pg_indexes
    WHERE tablename = 'token_reward_percentages'
    AND indexname = 'token_reward_percentages_project_mint_unique';
    
    IF global_constraint_count > 0 THEN
        RAISE WARNING '⚠️  Found % remaining global mint_address constraint(s). Manual review recommended.', global_constraint_count;
    END IF;
    
    IF composite_constraint_count = 0 THEN
        RAISE WARNING '⚠️  Composite constraint not found. Migration may have failed.';
    ELSE
        RAISE NOTICE '✅ Migration completed successfully!';
        RAISE NOTICE '   - Global constraints removed: %', (global_constraint_count = 0);
        RAISE NOTICE '   - Composite constraint created: %', (composite_constraint_count > 0);
    END IF;
END $$;

-- =====================================================
-- Migration Summary:
-- =====================================================
-- ✅ Removed: Global UNIQUE constraint on mint_address
-- ✅ Added: Composite UNIQUE constraint on (project_id, mint_address)
-- ✅ Result: Same SPL token mint can exist in different projects
-- ✅ Result: Same SPL token mint cannot be duplicated within same project
-- ✅ Handles: NULL mint_address values (for non-token rewards)
-- =====================================================
-- 
-- Test Cases After Migration:
-- =====================================================
-- ✅ Project 1, mint ABC → Success
-- ✅ Project 2, mint ABC → Success (now allowed!)
-- ❌ Project 1, mint ABC (duplicate) → Fails with constraint violation
-- ✅ Project 1, mint XYZ → Success
-- =====================================================
