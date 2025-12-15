-- =====================================================
-- RESTORE MAIN PROJECT DATA
-- =====================================================
-- This script assigns all existing data (where project_id IS NULL) 
-- to the main project (first active project)
-- Run this in Supabase SQL Editor

DO $$
DECLARE
    main_project_id INTEGER;
    updated_count INTEGER;
BEGIN
    -- Step 1: Find the main project (first active project)
    SELECT id INTO main_project_id
    FROM projects
    WHERE is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF main_project_id IS NULL THEN
        RAISE EXCEPTION '❌ No active project found! Please create a project first.';
    END IF;
    
    RAISE NOTICE '✅ Found main project ID: %', main_project_id;
    
    -- Step 2: Assign all existing data to main project
    RAISE NOTICE '';
    RAISE NOTICE '📋 Assigning existing data to project %...', main_project_id;
    
    -- Update jackpot_pools
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'jackpot_pools') THEN
        UPDATE jackpot_pools 
        SET project_id = main_project_id 
        WHERE project_id IS NULL;
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE '   ✅ jackpot_pools: % rows updated', updated_count;
    END IF;
    
    -- Update jackpot_tickets
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'jackpot_tickets') THEN
        UPDATE jackpot_tickets 
        SET project_id = main_project_id 
        WHERE project_id IS NULL;
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE '   ✅ jackpot_tickets: % rows updated', updated_count;
    END IF;
    
    -- Update jackpot_wins
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'jackpot_wins') THEN
        UPDATE jackpot_wins 
        SET project_id = main_project_id 
        WHERE project_id IS NULL;
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE '   ✅ jackpot_wins: % rows updated', updated_count;
    END IF;
    
    -- Update prizeWin (case-sensitive)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prizeWin') THEN
        UPDATE "prizeWin" 
        SET project_id = main_project_id 
        WHERE project_id IS NULL;
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE '   ✅ prizeWin: % rows updated', updated_count;
    END IF;
    
    -- Update products
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'products') THEN
        UPDATE products 
        SET project_id = main_project_id 
        WHERE project_id IS NULL;
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE '   ✅ products: % rows updated', updated_count;
    END IF;
    
    -- Update transaction (deposits)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transaction') THEN
        UPDATE transaction 
        SET project_id = main_project_id 
        WHERE project_id IS NULL;
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE '   ✅ transaction: % rows updated', updated_count;
    END IF;
    
    -- Update withdraw
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'withdraw') THEN
        UPDATE withdraw 
        SET project_id = main_project_id 
        WHERE project_id IS NULL;
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE '   ✅ withdraw: % rows updated', updated_count;
    END IF;
    
    -- Update liveDraw (if project_id column exists)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'liveDraw') THEN
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'liveDraw' AND column_name = 'project_id'
        ) THEN
            UPDATE "liveDraw" 
            SET project_id = main_project_id 
            WHERE project_id IS NULL;
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            RAISE NOTICE '   ✅ liveDraw: % rows updated', updated_count;
        ELSE
            RAISE NOTICE '   ⚠️ liveDraw table exists but has no project_id column';
        END IF;
    END IF;
    
    -- Update slider_images (if project_id column exists)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'slider_images') THEN
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'slider_images' AND column_name = 'project_id'
        ) THEN
            UPDATE slider_images 
            SET project_id = main_project_id 
            WHERE project_id IS NULL;
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            RAISE NOTICE '   ✅ slider_images: % rows updated', updated_count;
        END IF;
    END IF;
    
    -- Update tickets (if project_id column exists)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tickets') THEN
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'tickets' AND column_name = 'project_id'
        ) THEN
            UPDATE tickets 
            SET project_id = main_project_id 
            WHERE project_id IS NULL;
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            RAISE NOTICE '   ✅ tickets: % rows updated', updated_count;
        END IF;
    END IF;
    
    -- Update ticketPurchase (if project_id column exists)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ticketPurchase') THEN
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'ticketPurchase' AND column_name = 'project_id'
        ) THEN
            UPDATE "ticketPurchase" 
            SET project_id = main_project_id 
            WHERE project_id IS NULL;
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            RAISE NOTICE '   ✅ ticketPurchase: % rows updated', updated_count;
        END IF;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Data assignment complete!';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Error: %', SQLERRM;
    RAISE;
END $$;

-- Step 3: Verify the fix
SELECT 
    'Summary' as info,
    (SELECT COUNT(*) FROM jackpot_pools WHERE project_id IS NOT NULL) as jackpot_pools_with_project_id,
    (SELECT COUNT(*) FROM products WHERE project_id IS NOT NULL) as products_with_project_id,
    (SELECT COUNT(*) FROM transaction WHERE project_id IS NOT NULL) as transactions_with_project_id,
    (SELECT COUNT(*) FROM "prizeWin" WHERE project_id IS NOT NULL) as prize_wins_with_project_id;

-- Show main project info
SELECT 
    id as project_id,
    name,
    slug,
    is_active
FROM projects
WHERE is_active = true
ORDER BY created_at ASC
LIMIT 1;



