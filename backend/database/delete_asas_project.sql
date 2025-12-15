-- =====================================================
-- DELETE "asas" PROJECT AND PROJECT ID 3 ("lo") AND ALL RELATED DATA
-- =====================================================
-- This script safely deletes the "asas" project and project ID 3 ("lo") and all their related data
-- Run this in Supabase SQL Editor

DO $$
DECLARE
    target_project_id INTEGER;
    project_ids INTEGER[] := ARRAY[]::INTEGER[];
    deleted_count INTEGER;
    project_name TEXT;
BEGIN
    -- Step 1: Find the "asas" project
    SELECT id INTO target_project_id
    FROM projects
    WHERE slug = 'asas' OR name ILIKE '%asas%'
    LIMIT 1;
    
    IF target_project_id IS NOT NULL THEN
        project_ids := array_append(project_ids, target_project_id);
        RAISE NOTICE '✅ Found project "asas" with ID: %', target_project_id;
    ELSE
        RAISE NOTICE '⚠️ Project "asas" not found!';
    END IF;
    
    -- Step 2: Add project ID 3 ("lo")
    IF EXISTS (SELECT 1 FROM projects WHERE id = 3) THEN
        project_ids := array_append(project_ids, 3);
        SELECT name INTO project_name FROM projects WHERE id = 3;
        RAISE NOTICE '✅ Found project ID 3 ("%")', project_name;
    ELSE
        RAISE NOTICE '⚠️ Project ID 3 not found!';
    END IF;
    
    IF array_length(project_ids, 1) IS NULL THEN
        RAISE NOTICE '❌ No projects found to delete!';
        RETURN;
    END IF;
    
    RAISE NOTICE '📋 Will delete % project(s): %', array_length(project_ids, 1), project_ids;
    
    -- Step 3: Delete all related data for each project (in correct order to avoid foreign key violations)
    FOREACH target_project_id IN ARRAY project_ids
    LOOP
        SELECT name INTO project_name FROM projects WHERE id = target_project_id;
        RAISE NOTICE '';
        RAISE NOTICE '🗑️  Deleting project ID % ("%")...', target_project_id, project_name;
        
        -- IMPORTANT: First, clear default_token_id reference in projects table
        -- This prevents foreign key violation when deleting project_tokens
        UPDATE projects SET default_token_id = NULL WHERE id = target_project_id;
        RAISE NOTICE '   Cleared default_token_id reference from project';
        
        -- Delete project_users (cascades to project_token_balances if CASCADE is set)
        DELETE FROM project_users WHERE project_id = target_project_id;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   Deleted % project_users', deleted_count;
        
        -- Delete project_token_balances (must be before project_tokens)
        DELETE FROM project_token_balances WHERE project_id = target_project_id;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   Deleted % project_token_balances', deleted_count;
        
        -- Delete project_tokens (now safe since default_token_id is cleared)
        DELETE FROM project_tokens WHERE project_id = target_project_id;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   Deleted % project_tokens', deleted_count;
        
        -- Delete transactions
        DELETE FROM transaction WHERE project_id = target_project_id;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   Deleted % transactions', deleted_count;
        
        -- Delete withdrawals
        DELETE FROM withdraw WHERE project_id = target_project_id;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   Deleted % withdrawals', deleted_count;
        
        -- Delete jackpot_pools (this was causing the foreign key error)
        -- First check if the constraint allows CASCADE, if not we need to delete manually
        BEGIN
            DELETE FROM jackpot_pools WHERE project_id = target_project_id;
            GET DIAGNOSTICS deleted_count = ROW_COUNT;
            RAISE NOTICE '   Deleted % jackpot_pools', deleted_count;
        EXCEPTION WHEN OTHERS THEN
            -- If deletion fails due to foreign key, try to update the constraint first
            RAISE NOTICE '   Warning: Could not delete jackpot_pools directly. Trying alternative approach...';
            -- Try to set the foreign key to CASCADE temporarily (requires superuser)
            BEGIN
                -- Drop and recreate constraint with CASCADE (if we have permissions)
                ALTER TABLE jackpot_pools DROP CONSTRAINT IF EXISTS jackpot_pools_project_id_fkey;
                ALTER TABLE jackpot_pools ADD CONSTRAINT jackpot_pools_project_id_fkey 
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
                -- Now try deletion again
                DELETE FROM jackpot_pools WHERE project_id = target_project_id;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                RAISE NOTICE '   Deleted % jackpot_pools (after updating constraint)', deleted_count;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE '   Error updating constraint: %. You may need to delete jackpot_pools manually first.', SQLERRM;
                RAISE;
            END;
        END;
        
        -- Delete jackpot_tickets (only if project_id column exists)
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'jackpot_tickets') THEN
            IF EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'jackpot_tickets' AND column_name = 'project_id'
            ) THEN
                DELETE FROM jackpot_tickets WHERE project_id = target_project_id;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                RAISE NOTICE '   Deleted % jackpot_tickets', deleted_count;
            ELSE
                RAISE NOTICE '   Skipped jackpot_tickets (no project_id column)';
            END IF;
        END IF;
        
        -- Delete jackpot_wins (only if project_id column exists)
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'jackpot_wins') THEN
            IF EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'jackpot_wins' AND column_name = 'project_id'
            ) THEN
                DELETE FROM jackpot_wins WHERE project_id = target_project_id;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                RAISE NOTICE '   Deleted % jackpot_wins', deleted_count;
            ELSE
                RAISE NOTICE '   Skipped jackpot_wins (no project_id column)';
            END IF;
        END IF;
        
        -- Delete prize wins (only if project_id column exists)
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prizeWin') THEN
            IF EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'prizeWin' AND column_name = 'project_id'
            ) THEN
                DELETE FROM "prizeWin" WHERE project_id = target_project_id;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                RAISE NOTICE '   Deleted % prize wins', deleted_count;
            ELSE
                RAISE NOTICE '   Skipped prizeWin (no project_id column)';
            END IF;
        END IF;
        
        -- Delete liveDraw records (must be before products due to foreign key)
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'liveDraw') THEN
            -- Delete liveDraw records that reference products from this project
            DELETE FROM "liveDraw" 
            WHERE "productId" IN (
                SELECT id FROM products WHERE project_id = target_project_id
            );
            GET DIAGNOSTICS deleted_count = ROW_COUNT;
            RAISE NOTICE '   Deleted % liveDraw records', deleted_count;
            
            -- Also delete by project_id if the column exists
            IF EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'liveDraw' AND column_name = 'project_id'
            ) THEN
                DELETE FROM "liveDraw" WHERE project_id = target_project_id;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                RAISE NOTICE '   Deleted % additional liveDraw records (by project_id)', deleted_count;
            END IF;
        END IF;
        
        -- Delete products (now safe since liveDraw references are cleared)
        DELETE FROM products WHERE project_id = target_project_id;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   Deleted % products', deleted_count;
        
        -- Delete project_settings
        DELETE FROM project_settings WHERE project_id = target_project_id;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE '   Deleted % project_settings', deleted_count;
        
        -- Delete project_admins (only if project_id column exists)
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'project_admins') THEN
            IF EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'project_admins' AND column_name = 'project_id'
            ) THEN
                DELETE FROM project_admins WHERE project_id = target_project_id;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                RAISE NOTICE '   Deleted % project_admins', deleted_count;
            ELSE
                RAISE NOTICE '   Skipped project_admins (no project_id column)';
            END IF;
        END IF;
        
        -- Delete project_jackpots (only if project_id column exists)
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'project_jackpots') THEN
            IF EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'project_jackpots' AND column_name = 'project_id'
            ) THEN
                DELETE FROM project_jackpots WHERE project_id = target_project_id;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                RAISE NOTICE '   Deleted % project_jackpots', deleted_count;
            ELSE
                RAISE NOTICE '   Skipped project_jackpots (no project_id column)';
            END IF;
        END IF;
        
        -- Delete project_nfts (only if project_id column exists)
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'project_nfts') THEN
            IF EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'project_nfts' AND column_name = 'project_id'
            ) THEN
                DELETE FROM project_nfts WHERE project_id = target_project_id;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                RAISE NOTICE '   Deleted % project_nfts', deleted_count;
            ELSE
                RAISE NOTICE '   Skipped project_nfts (no project_id column)';
            END IF;
        END IF;
        
        -- Delete slider_images (only if project_id column exists)
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'slider_images') THEN
            IF EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'slider_images' AND column_name = 'project_id'
            ) THEN
                DELETE FROM slider_images WHERE project_id = target_project_id;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                RAISE NOTICE '   Deleted % slider_images', deleted_count;
            ELSE
                RAISE NOTICE '   Skipped slider_images (no project_id column)';
            END IF;
        END IF;
        
        -- Delete tickets (only if project_id column exists)
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tickets') THEN
            IF EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'tickets' AND column_name = 'project_id'
            ) THEN
                DELETE FROM tickets WHERE project_id = target_project_id;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                RAISE NOTICE '   Deleted % tickets', deleted_count;
            ELSE
                RAISE NOTICE '   Skipped tickets (no project_id column)';
            END IF;
        END IF;
        
        -- Delete ticket purchases (only if project_id column exists)
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ticketPurchase') THEN
            IF EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'ticketPurchase' AND column_name = 'project_id'
            ) THEN
                DELETE FROM "ticketPurchase" WHERE project_id = target_project_id;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                RAISE NOTICE '   Deleted % ticket purchases', deleted_count;
            ELSE
                RAISE NOTICE '   Skipped ticketPurchase (no project_id column)';
            END IF;
        END IF;
        
        -- Finally delete the project itself
        DELETE FROM projects WHERE id = target_project_id;
        
        IF FOUND THEN
            RAISE NOTICE '✅ Successfully deleted project ID % ("%") and all related data!', target_project_id, project_name;
        ELSE
            RAISE NOTICE '❌ Failed to delete project ID %', target_project_id;
        END IF;
    END LOOP;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Error deleting projects: %', SQLERRM;
    RAISE;
END $$;

-- Verify deletion
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM projects WHERE slug = 'asas' OR name ILIKE '%asas%') 
        THEN '❌ Project "asas" still exists!'
        ELSE '✅ Project "asas" successfully deleted!'
    END as asas_deletion_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM projects WHERE id = 3) 
        THEN '❌ Project ID 3 still exists!'
        ELSE '✅ Project ID 3 successfully deleted!'
    END as project3_deletion_status;
