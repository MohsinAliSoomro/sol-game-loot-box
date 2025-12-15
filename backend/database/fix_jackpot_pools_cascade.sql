-- =====================================================
-- FIX jackpot_pools FOREIGN KEY TO USE CASCADE
-- =====================================================
-- This fixes the foreign key constraint to allow CASCADE deletion
-- Run this BEFORE deleting the project if you get foreign key errors

DO $$
BEGIN
    -- Check if constraint exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'jackpot_pools_project_id_fkey'
        AND table_name = 'jackpot_pools'
    ) THEN
        -- Drop existing constraint
        ALTER TABLE jackpot_pools DROP CONSTRAINT jackpot_pools_project_id_fkey;
        RAISE NOTICE '✅ Dropped old constraint';
        
        -- Recreate with CASCADE
        ALTER TABLE jackpot_pools 
        ADD CONSTRAINT jackpot_pools_project_id_fkey 
        FOREIGN KEY (project_id) 
        REFERENCES projects(id) 
        ON DELETE CASCADE;
        
        RAISE NOTICE '✅ Created new constraint with ON DELETE CASCADE';
    ELSE
        RAISE NOTICE '⚠️ Constraint jackpot_pools_project_id_fkey not found';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Error: %', SQLERRM;
    RAISE;
END $$;



