-- Add project_id column to user table if it doesn't exist
-- This ensures each project has its own isolated user data

DO $$ 
BEGIN
    -- Check if user table exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user'
    ) THEN
        -- Add project_id column if it doesn't exist
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'user' 
            AND column_name = 'project_id'
        ) THEN
            ALTER TABLE "user" ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
            CREATE INDEX IF NOT EXISTS idx_user_project_id ON "user"(project_id);
            
            RAISE NOTICE 'Added project_id column to user table';
        ELSE
            RAISE NOTICE 'project_id column already exists in user table';
        END IF;
    ELSE
        RAISE NOTICE 'user table does not exist';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error adding project_id to user table: %', SQLERRM;
END $$;

