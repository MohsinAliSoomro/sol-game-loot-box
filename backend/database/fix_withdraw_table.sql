-- Fix withdraw table to work with project_users instead of user table
-- This allows withdrawals to work with the new multi-tenant system

DO $$ 
BEGIN
    -- Check if withdraw table exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'withdraw'
    ) THEN
        -- Drop the old foreign key constraint if it exists
        -- Find and drop any foreign key constraint on userId/user_id columns
        DECLARE
            constraint_rec RECORD;
        BEGIN
            -- Find all foreign key constraints on withdraw table that reference user-related columns
            FOR constraint_rec IN
                SELECT tc.constraint_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                WHERE tc.table_name = 'withdraw'
                    AND tc.constraint_type = 'FOREIGN KEY'
                    AND (
                        kcu.column_name IN ('userId', 'user_id', 'user')
                        OR tc.constraint_name LIKE '%user%'
                    )
            LOOP
                BEGIN
                    EXECUTE format('ALTER TABLE withdraw DROP CONSTRAINT %I', constraint_rec.constraint_name);
                    RAISE NOTICE 'Dropped foreign key constraint: %', constraint_rec.constraint_name;
                EXCEPTION WHEN OTHERS THEN
                    RAISE NOTICE 'Could not drop constraint %: %', constraint_rec.constraint_name, SQLERRM;
                END;
            END LOOP;
        END;

        -- Add project_user_id column if it doesn't exist
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'withdraw' 
            AND column_name = 'project_user_id'
        ) THEN
            ALTER TABLE withdraw ADD COLUMN project_user_id UUID;
            RAISE NOTICE 'Added project_user_id column to withdraw table';
        END IF;

        -- Make userId nullable (we'll use project_user_id instead)
        -- Only if userId column exists and has NOT NULL constraint
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'withdraw' 
            AND column_name = 'userId'
        ) THEN
            BEGIN
                ALTER TABLE withdraw ALTER COLUMN "userId" DROP NOT NULL;
                RAISE NOTICE 'Made userId column nullable';
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not make userId nullable (may already be nullable): %', SQLERRM;
            END;
        END IF;
        
        -- Add foreign key to project_users if project_users table exists
        IF EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'project_users'
        ) THEN
            -- Add foreign key constraint to project_users
            IF NOT EXISTS (
                SELECT FROM information_schema.table_constraints 
                WHERE table_name = 'withdraw' 
                AND constraint_name = 'withdraw_project_user_id_fkey'
            ) THEN
                ALTER TABLE withdraw 
                ADD CONSTRAINT withdraw_project_user_id_fkey 
                FOREIGN KEY (project_user_id) 
                REFERENCES project_users(id) 
                ON DELETE CASCADE;
                RAISE NOTICE 'Added foreign key constraint to project_users';
            END IF;
        END IF;

        -- Create index on project_user_id for better query performance
        IF NOT EXISTS (
            SELECT FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'withdraw' 
            AND indexname = 'idx_withdraw_project_user_id'
        ) THEN
            CREATE INDEX idx_withdraw_project_user_id ON withdraw(project_user_id);
            RAISE NOTICE 'Created index on project_user_id';
        END IF;

        RAISE NOTICE '✅ Withdraw table updated for multi-tenant system';
    ELSE
        RAISE NOTICE 'Withdraw table does not exist, skipping migration';
    END IF;
END $$;

