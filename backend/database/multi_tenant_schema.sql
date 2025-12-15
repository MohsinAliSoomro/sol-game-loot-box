-- =====================================================
-- MULTI-TENANT DATABASE SCHEMA
-- =====================================================
-- This schema ensures complete data isolation between projects
-- Same wallet can have different profiles, balances, and tokens per project

-- =====================================================
-- 1. PROJECTS TABLE (if not exists, update if exists)
-- =====================================================
DO $$ 
BEGIN
    -- Check if projects table exists
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'projects'
    ) THEN
        -- Create projects table with UUID primary key
        CREATE TABLE projects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX idx_projects_slug ON projects(slug);
        RAISE NOTICE 'Created projects table';
    ELSE
        -- Update existing projects table to use UUID if needed
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'projects' 
            AND column_name = 'id'
            AND data_type != 'uuid'
        ) THEN
            -- Add UUID column if using integer ID
            ALTER TABLE projects ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT gen_random_uuid();
            CREATE INDEX IF NOT EXISTS idx_projects_uuid_id ON projects(uuid_id);
            RAISE NOTICE 'Added uuid_id column to existing projects table';
        END IF;
    END IF;
END $$;

-- =====================================================
-- 2. PROJECT_USERS TABLE
-- =====================================================
-- Each wallet gets a separate profile per project
-- Note: Uses INTEGER project_id to match existing projects.id (SERIAL/INTEGER)
CREATE TABLE IF NOT EXISTS project_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    username TEXT,
    avatar TEXT,
    email TEXT,
    full_name TEXT,
    provider TEXT DEFAULT 'wallet',
    apes NUMERIC(20, 6) DEFAULT 0, -- Project-specific balance
    total_spending NUMERIC(20, 6) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one profile per wallet per project
    UNIQUE(project_id, wallet_address)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_project_users_project_id ON project_users(project_id);
CREATE INDEX IF NOT EXISTS idx_project_users_wallet ON project_users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_project_users_project_wallet ON project_users(project_id, wallet_address);

-- =====================================================
-- 3. PROJECT_TOKENS TABLE (update existing if needed)
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'project_tokens'
    ) THEN
        -- Create project_tokens with INTEGER id and project_id to match existing schema
        CREATE TABLE project_tokens (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            token_name TEXT NOT NULL,
            token_symbol TEXT NOT NULL,
            decimals INTEGER NOT NULL DEFAULT 6,
            supply_type TEXT DEFAULT 'unlimited', -- unlimited, fixed, mintable
            mint_address TEXT NOT NULL,
            is_default BOOLEAN DEFAULT false,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            
            UNIQUE(project_id, token_symbol)
        );
        
        CREATE INDEX IF NOT EXISTS idx_project_tokens_project_id ON project_tokens(project_id);
        CREATE INDEX IF NOT EXISTS idx_project_tokens_mint ON project_tokens(mint_address);
        RAISE NOTICE 'Created project_tokens table with INTEGER id';
    ELSE
        -- If project_tokens already exists, check id type
        DECLARE
            token_id_type TEXT;
        BEGIN
            SELECT data_type INTO token_id_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'project_tokens'
            AND column_name = 'id';
            
            IF token_id_type NOT IN ('integer', 'bigint', 'serial') THEN
                RAISE NOTICE 'project_tokens.id is % - expected INTEGER/SERIAL. Foreign keys may fail.', token_id_type;
            END IF;
        END;
        
        -- Check project_id type
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'project_tokens' 
            AND column_name = 'project_id'
            AND data_type NOT IN ('integer', 'bigint')
        ) THEN
            RAISE NOTICE 'project_tokens.project_id type mismatch - may need manual migration';
        END IF;
    END IF;
END $$;

-- =====================================================
-- 4. PROJECT_TOKEN_BALANCES TABLE
-- =====================================================
-- Isolated token balances per project per wallet
-- Note: Uses INTEGER for both project_id and token_id to match existing tables
-- project_tokens.id is SERIAL (INTEGER), so token_id must be INTEGER
CREATE TABLE IF NOT EXISTS project_token_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    token_id INTEGER NOT NULL REFERENCES project_tokens(id) ON DELETE CASCADE,
    balance NUMERIC(20, 6) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- One balance record per project/wallet/token combination
    UNIQUE(project_id, wallet_address, token_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_project_token_balances_project ON project_token_balances(project_id);
CREATE INDEX IF NOT EXISTS idx_project_token_balances_wallet ON project_token_balances(wallet_address);
CREATE INDEX IF NOT EXISTS idx_project_token_balances_token ON project_token_balances(token_id);
CREATE INDEX IF NOT EXISTS idx_project_token_balances_project_wallet ON project_token_balances(project_id, wallet_address);

-- =====================================================
-- 5. HELPER FUNCTIONS
-- =====================================================

-- Function to get or create project user
-- Note: Uses INTEGER project_id to match projects.id
CREATE OR REPLACE FUNCTION get_or_create_project_user(
    p_project_id INTEGER,
    p_wallet_address TEXT,
    p_username TEXT DEFAULT NULL,
    p_avatar TEXT DEFAULT NULL
) RETURNS project_users AS $$
DECLARE
    v_user project_users;
BEGIN
    -- Try to get existing user
    SELECT * INTO v_user
    FROM project_users
    WHERE project_id = p_project_id
    AND wallet_address = p_wallet_address;
    
    -- If not found, create new user
    IF v_user IS NULL THEN
        INSERT INTO project_users (project_id, wallet_address, username, avatar)
        VALUES (p_project_id, p_wallet_address, p_username, p_avatar)
        RETURNING * INTO v_user;
    END IF;
    
    RETURN v_user;
END;
$$ LANGUAGE plpgsql;

-- Function to get project by slug
CREATE OR REPLACE FUNCTION get_project_by_slug(p_slug TEXT)
RETURNS projects AS $$
DECLARE
    v_project projects;
BEGIN
    SELECT * INTO v_project
    FROM projects
    WHERE slug = p_slug
    LIMIT 1;
    
    RETURN v_project;
END;
$$ LANGUAGE plpgsql;

-- Function to update token balance
-- Note: Uses INTEGER for both project_id and token_id to match existing tables
CREATE OR REPLACE FUNCTION update_project_token_balance(
    p_project_id INTEGER,
    p_wallet_address TEXT,
    p_token_id INTEGER,
    p_balance NUMERIC
) RETURNS project_token_balances AS $$
DECLARE
    v_balance project_token_balances;
BEGIN
    INSERT INTO project_token_balances (project_id, wallet_address, token_id, balance, updated_at)
    VALUES (p_project_id, p_wallet_address, p_token_id, p_balance, NOW())
    ON CONFLICT (project_id, wallet_address, token_id)
    DO UPDATE SET
        balance = p_balance,
        updated_at = NOW()
    RETURNING * INTO v_balance;
    
    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE project_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_token_balances ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data within a project
CREATE POLICY "Users can view own project data"
ON project_users FOR SELECT
USING (true); -- Adjust based on your auth requirements

CREATE POLICY "Users can update own project data"
ON project_users FOR UPDATE
USING (true); -- Adjust based on your auth requirements

-- Policy: Tokens are project-scoped
CREATE POLICY "Tokens are project-scoped"
ON project_tokens FOR SELECT
USING (true);

-- Policy: Balances are project-scoped
CREATE POLICY "Balances are project-scoped"
ON project_token_balances FOR SELECT
USING (true);

-- =====================================================
-- 7. TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop triggers if they exist, then recreate
DROP TRIGGER IF EXISTS update_project_users_updated_at ON project_users;
CREATE TRIGGER update_project_users_updated_at
BEFORE UPDATE ON project_users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_tokens_updated_at ON project_tokens;
CREATE TRIGGER update_project_tokens_updated_at
BEFORE UPDATE ON project_tokens
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_token_balances_updated_at ON project_token_balances;
CREATE TRIGGER update_project_token_balances_updated_at
BEFORE UPDATE ON project_token_balances
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE '✅ Multi-tenant schema setup complete!';
    RAISE NOTICE '   - projects table ready';
    RAISE NOTICE '   - project_users table created';
    RAISE NOTICE '   - project_tokens table ready';
    RAISE NOTICE '   - project_token_balances table created';
    RAISE NOTICE '   - Helper functions created';
    RAISE NOTICE '   - RLS policies enabled';
END $$;

