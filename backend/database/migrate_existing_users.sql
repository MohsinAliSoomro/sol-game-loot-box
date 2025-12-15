-- Migration Script: Move existing users to project_users table
-- Run this AFTER multi_tenant_schema.sql
-- This migrates data from the old 'user' table to the new 'project_users' table

DO $$ 
DECLARE
    default_project_id INTEGER;
    migrated_count INTEGER := 0;
    max_project_id BIGINT;
BEGIN
    -- Get or create a default project for migration
    -- projects.id is INTEGER/SERIAL, not UUID
    SELECT id INTO default_project_id
    FROM projects
    WHERE slug = 'default' OR id = 1
    LIMIT 1;
    
    -- If no default project exists, create one with all required fields
    IF default_project_id IS NULL THEN
        -- Get max project_id to generate a unique one
        SELECT COALESCE(MAX(project_id), 0) + 1 INTO max_project_id
        FROM projects;
        
        -- Create default project with all required NOT NULL fields
        INSERT INTO projects (
            project_id,
            project_pda,
            name,
            client_name,
            admin_wallet,
            slug,
            created_at
        )
        VALUES (
            max_project_id,
            'whitelabel-default-' || max_project_id,
            'Default Project',
            'Default Project',
            '00000000000000000000000000000000000000000000', -- Placeholder admin wallet
            'default',
            NOW()
        )
        RETURNING id INTO default_project_id;
        
        RAISE NOTICE 'Created default project with ID: %', default_project_id;
    END IF;
    
    -- Migrate users from 'user' table to 'project_users'
    -- project_users.project_id is INTEGER, matching projects.id
    INSERT INTO project_users (
        project_id,
        wallet_address,
        username,
        avatar,
        email,
        full_name,
        provider,
        apes,
        total_spending,
        created_at,
        updated_at
    )
    SELECT 
        COALESCE(
            -- Use user's project_id if it exists and is valid
            CASE 
                WHEN u.project_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM projects WHERE id = u.project_id
                ) THEN u.project_id::INTEGER
                ELSE default_project_id
            END,
            -- Fallback to default project
            default_project_id
        ) as project_id,
        u."walletAddress" as wallet_address,
        u.full_name as username,
        u.avatar_url as avatar,
        u.email,
        u.full_name,
        COALESCE(u.provider, 'wallet') as provider,
        COALESCE(u.apes, 0) as apes,
        0 as total_spending, -- Calculate from transactions if needed
        COALESCE(u.created_at, NOW()) as created_at,
        COALESCE(u.updated_at, NOW()) as updated_at
    FROM "user" u
    WHERE u."walletAddress" IS NOT NULL
    AND u."walletAddress" != ''
    ON CONFLICT (project_id, wallet_address) DO NOTHING;
    
    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    
    RAISE NOTICE '✅ Migrated % users to project_users table', migrated_count;
    
    -- Migrate token balances if project_tokens exist
    -- This assumes you have project_tokens set up
    INSERT INTO project_token_balances (
        project_id,
        wallet_address,
        token_id,
        balance,
        created_at,
        updated_at
    )
    SELECT DISTINCT
        pu.project_id,
        pu.wallet_address,
        pt.id as token_id,
        pu.apes as balance, -- Use apes as default token balance
        NOW() as created_at,
        NOW() as updated_at
    FROM project_users pu
    CROSS JOIN project_tokens pt
    WHERE pt.project_id = pu.project_id
    AND pt.is_default = true
    AND pu.apes > 0
    ON CONFLICT (project_id, wallet_address, token_id) DO NOTHING;
    
    RAISE NOTICE '✅ Migrated token balances';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error during migration: %', SQLERRM;
    RAISE;
END $$;

-- Verify migration
SELECT 
    'project_users' as table_name,
    COUNT(*) as total_users,
    COUNT(DISTINCT wallet_address) as unique_wallets,
    COUNT(DISTINCT project_id) as projects_with_users
FROM project_users;

