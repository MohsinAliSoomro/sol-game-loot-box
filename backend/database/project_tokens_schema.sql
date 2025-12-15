-- =====================================================
-- PROJECT TOKENS SCHEMA
-- =====================================================
-- Each project can have its own token(s) for deposits/withdrawals
-- This replaces the hardcoded OGX token system

-- =====================================================
-- 1. PROJECT_TOKENS TABLE
-- =====================================================
-- Stores project-specific token configurations
CREATE TABLE IF NOT EXISTS project_tokens (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Token Information
    name VARCHAR(255) NOT NULL, -- Display name (e.g., "Project Token", "OGX")
    symbol VARCHAR(50) NOT NULL, -- Token symbol (e.g., "OGX", "PTK", "LOOT")
    mint_address VARCHAR(255) NOT NULL, -- Solana token mint address
    decimals INTEGER NOT NULL DEFAULT 6, -- Token decimals (usually 6 or 9)
    
    -- Token Configuration
    is_default BOOLEAN DEFAULT false, -- Is this the default token for the project?
    is_active BOOLEAN DEFAULT true, -- Is this token active?
    display_order INTEGER DEFAULT 0, -- Order in dropdown (lower = first)
    
    -- Price/Exchange Rate (optional)
    coingecko_id TEXT, -- CoinGecko ID for price fetching
    fallback_price DECIMAL DEFAULT 1, -- Fallback USD price if CoinGecko unavailable
    exchange_rate_to_sol DECIMAL, -- Exchange rate to SOL (if applicable)
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(project_id, symbol), -- One symbol per project
    CONSTRAINT valid_decimals CHECK (decimals >= 0 AND decimals <= 18)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_project_tokens_project ON project_tokens(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tokens_default ON project_tokens(project_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_project_tokens_active ON project_tokens(project_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_project_tokens_symbol ON project_tokens(symbol);

-- =====================================================
-- 2. UPDATE PROJECTS TABLE
-- =====================================================
-- Add default_token_id to projects table
DO $$ 
BEGIN
    -- Add default_token_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'default_token_id'
    ) THEN
        ALTER TABLE projects ADD COLUMN default_token_id INTEGER REFERENCES project_tokens(id);
    END IF;
    
    -- Add token_symbol column for quick access (denormalized)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'token_symbol'
    ) THEN
        ALTER TABLE projects ADD COLUMN token_symbol VARCHAR(50) DEFAULT 'OGX';
    END IF;
END $$;

-- =====================================================
-- 3. FUNCTION TO GET DEFAULT TOKEN FOR PROJECT
-- =====================================================
CREATE OR REPLACE FUNCTION get_project_default_token(p_project_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    name VARCHAR,
    symbol VARCHAR,
    mint_address VARCHAR,
    decimals INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pt.id,
        pt.name,
        pt.symbol,
        pt.mint_address,
        pt.decimals
    FROM project_tokens pt
    WHERE pt.project_id = p_project_id
      AND pt.is_default = true
      AND pt.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. TRIGGER TO UPDATE updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_project_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_project_tokens_updated_at ON project_tokens;
CREATE TRIGGER update_project_tokens_updated_at
    BEFORE UPDATE ON project_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_project_tokens_updated_at();

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================
ALTER TABLE project_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Project admins can view their project tokens" ON project_tokens;
DROP POLICY IF EXISTS "Project admins can manage their project tokens" ON project_tokens;
DROP POLICY IF EXISTS "Public can view active project tokens" ON project_tokens;

-- Policy: Public can view active tokens (for frontend)
CREATE POLICY "Public can view active project tokens"
    ON project_tokens FOR SELECT
    USING (is_active = true);

-- Policy: Project admins can manage their project tokens
-- Note: This will be enforced by application logic checking project_admin role
CREATE POLICY "Project admins can manage their project tokens"
    ON project_tokens FOR ALL
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- 6. MIGRATION: Create default tokens for existing projects
-- =====================================================
-- This creates an OGX token for existing projects (backward compatibility)
DO $$
DECLARE
    project_record RECORD;
    token_id INTEGER;
BEGIN
    FOR project_record IN SELECT id, name FROM projects WHERE is_active = true
    LOOP
        -- Check if project already has a default token
        IF NOT EXISTS (
            SELECT 1 FROM project_tokens 
            WHERE project_id = project_record.id AND is_default = true
        ) THEN
            -- Insert default OGX token for this project
            INSERT INTO project_tokens (
                project_id,
                name,
                symbol,
                mint_address,
                decimals,
                is_default,
                is_active,
                display_order
            ) VALUES (
                project_record.id,
                'OGX Token',
                'OGX',
                'So11111111111111111111111111111111111111112', -- SOL mint as placeholder
                6,
                true,
                true,
                0
            ) RETURNING id INTO token_id;
            
            -- Update project with default token
            UPDATE projects 
            SET default_token_id = token_id, token_symbol = 'OGX'
            WHERE id = project_record.id;
        END IF;
    END LOOP;
END $$;

