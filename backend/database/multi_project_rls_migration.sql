-- ============================================================
-- MULTI-PROJECT RLS MIGRATION
-- ============================================================
-- This migration adds Row Level Security (RLS) policies
-- to enforce project-level data isolation
-- ============================================================

-- ============================================================
-- 1. ENSURE PROJECT_ID COLUMNS EXIST
-- ============================================================

-- Add project_id to all relevant tables if they don't exist
DO $$ 
BEGIN
    -- Products table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'project_id'
        ) THEN
            ALTER TABLE products ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_products_project_id ON products(project_id);
        END IF;
    END IF;

    -- PrizeWin table (case-sensitive check)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prizeWin') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'prizeWin' AND column_name = 'project_id'
        ) THEN
            ALTER TABLE "prizeWin" ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_prizewin_project_id ON "prizeWin"(project_id);
        END IF;
    END IF;

    -- Transaction table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transaction') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'transaction' AND column_name = 'project_id'
        ) THEN
            ALTER TABLE transaction ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_transaction_project_id ON transaction(project_id);
        END IF;
    END IF;

    -- Withdraw table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'withdraw') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'withdraw' AND column_name = 'project_id'
        ) THEN
            ALTER TABLE withdraw ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_withdraw_project_id ON withdraw(project_id);
        END IF;
    END IF;

    -- Jackpot pools table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jackpot_pools') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'jackpot_pools' AND column_name = 'project_id'
        ) THEN
            ALTER TABLE jackpot_pools ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_jackpot_pools_project_id ON jackpot_pools(project_id);
        END IF;
    END IF;

    -- Jackpot tickets table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jackpot_tickets') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'jackpot_tickets' AND column_name = 'project_id'
        ) THEN
            ALTER TABLE jackpot_tickets ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_jackpot_tickets_project_id ON jackpot_tickets(project_id);
        END IF;
    END IF;

    -- Jackpot wins table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jackpot_wins') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'jackpot_wins' AND column_name = 'project_id'
        ) THEN
            ALTER TABLE jackpot_wins ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_jackpot_wins_project_id ON jackpot_wins(project_id);
        END IF;
    END IF;

    -- User table (optional - users might be shared or project-specific)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user' AND column_name = 'project_id'
        ) THEN
            ALTER TABLE "user" ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
            CREATE INDEX IF NOT EXISTS idx_user_project_id ON "user"(project_id);
        END IF;
    END IF;

    -- NFT reward percentages table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nft_reward_percentages') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'nft_reward_percentages' AND column_name = 'project_id'
        ) THEN
            ALTER TABLE nft_reward_percentages ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_nft_reward_percentages_project_id ON nft_reward_percentages(project_id);
        END IF;
    END IF;

    -- Jackpot contribution table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jackpot_contribution') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'jackpot_contribution' AND column_name = 'project_id'
        ) THEN
            ALTER TABLE jackpot_contribution ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_jackpot_contribution_project_id ON jackpot_contribution(project_id);
        END IF;
    END IF;
END $$;

-- ============================================================
-- 2. HELPER FUNCTIONS
-- ============================================================

-- Function to get project by slug
CREATE OR REPLACE FUNCTION get_project_by_slug(p_slug VARCHAR)
RETURNS TABLE (
    id INTEGER,
    name VARCHAR,
    slug VARCHAR,
    subdomain VARCHAR,
    logo_url TEXT,
    primary_color VARCHAR,
    secondary_color VARCHAR,
    theme VARCHAR,
    is_active BOOLEAN,
    settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.slug,
        p.subdomain,
        p.logo_url,
        p.primary_color,
        p.secondary_color,
        p.theme,
        p.is_active,
        p.settings,
        p.created_at
    FROM projects p
    WHERE p.slug = p_slug
    AND p.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get project ID by slug
CREATE OR REPLACE FUNCTION get_project_id_by_slug(p_slug VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    v_project_id INTEGER;
BEGIN
    SELECT id INTO v_project_id
    FROM projects
    WHERE slug = p_slug
    AND is_active = true
    LIMIT 1;
    
    RETURN v_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate admin access to project
CREATE OR REPLACE FUNCTION validate_project_admin(
    p_project_slug VARCHAR,
    p_admin_email VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    v_project_id INTEGER;
    v_admin_exists BOOLEAN;
BEGIN
    -- Get project ID
    SELECT id INTO v_project_id
    FROM projects
    WHERE slug = p_project_slug
    AND is_active = true;
    
    IF v_project_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if admin exists for this project
    SELECT EXISTS(
        SELECT 1
        FROM project_admins
        WHERE project_id = v_project_id
        AND email = p_admin_email
        AND is_active = true
    ) INTO v_admin_exists;
    
    RETURN v_admin_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current project context (for RLS)
-- This will be set by the application using SET LOCAL
CREATE OR REPLACE FUNCTION current_project_id()
RETURNS INTEGER AS $$
BEGIN
    RETURN current_setting('app.current_project_id', true)::INTEGER;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all project-scoped tables
DO $$ 
BEGIN
    -- Products
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        ALTER TABLE products ENABLE ROW LEVEL SECURITY;
    END IF;

    -- PrizeWin
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prizeWin') THEN
        ALTER TABLE "prizeWin" ENABLE ROW LEVEL SECURITY;
    END IF;

    -- Transaction
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transaction') THEN
        ALTER TABLE transaction ENABLE ROW LEVEL SECURITY;
    END IF;

    -- Withdraw
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'withdraw') THEN
        ALTER TABLE withdraw ENABLE ROW LEVEL SECURITY;
    END IF;

    -- Jackpot pools
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jackpot_pools') THEN
        ALTER TABLE jackpot_pools ENABLE ROW LEVEL SECURITY;
    END IF;

    -- Jackpot tickets
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jackpot_tickets') THEN
        ALTER TABLE jackpot_tickets ENABLE ROW LEVEL SECURITY;
    END IF;

    -- Jackpot wins
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jackpot_wins') THEN
        ALTER TABLE jackpot_wins ENABLE ROW LEVEL SECURITY;
    END IF;

    -- User (optional - only if project-scoped)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user') THEN
        ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
    END IF;

    -- NFT reward percentages
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nft_reward_percentages') THEN
        ALTER TABLE nft_reward_percentages ENABLE ROW LEVEL SECURITY;
    END IF;

    -- Jackpot contribution
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jackpot_contribution') THEN
        ALTER TABLE jackpot_contribution ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ============================================================
-- 4. RLS POLICIES - PROJECT ISOLATION
-- ============================================================

-- Drop existing policies if they exist
DO $$ 
BEGIN
    -- Products policies
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        DROP POLICY IF EXISTS products_project_isolation ON products;
        DROP POLICY IF EXISTS products_select_project ON products;
        DROP POLICY IF EXISTS products_insert_project ON products;
        DROP POLICY IF EXISTS products_update_project ON products;
        DROP POLICY IF EXISTS products_delete_project ON products;
    END IF;

    -- PrizeWin policies
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prizeWin') THEN
        DROP POLICY IF EXISTS prizewin_project_isolation ON "prizeWin";
        DROP POLICY IF EXISTS prizewin_select_project ON "prizeWin";
        DROP POLICY IF EXISTS prizewin_insert_project ON "prizeWin";
        DROP POLICY IF EXISTS prizewin_update_project ON "prizeWin";
        DROP POLICY IF EXISTS prizewin_delete_project ON "prizeWin";
    END IF;

    -- Transaction policies
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transaction') THEN
        DROP POLICY IF EXISTS transaction_project_isolation ON transaction;
        DROP POLICY IF EXISTS transaction_select_project ON transaction;
        DROP POLICY IF EXISTS transaction_insert_project ON transaction;
        DROP POLICY IF EXISTS transaction_update_project ON transaction;
        DROP POLICY IF EXISTS transaction_delete_project ON transaction;
    END IF;

    -- Withdraw policies
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'withdraw') THEN
        DROP POLICY IF EXISTS withdraw_project_isolation ON withdraw;
        DROP POLICY IF EXISTS withdraw_select_project ON withdraw;
        DROP POLICY IF EXISTS withdraw_insert_project ON withdraw;
        DROP POLICY IF EXISTS withdraw_update_project ON withdraw;
        DROP POLICY IF EXISTS withdraw_delete_project ON withdraw;
    END IF;

    -- Jackpot pools policies
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jackpot_pools') THEN
        DROP POLICY IF EXISTS jackpot_pools_project_isolation ON jackpot_pools;
        DROP POLICY IF EXISTS jackpot_pools_select_project ON jackpot_pools;
        DROP POLICY IF EXISTS jackpot_pools_insert_project ON jackpot_pools;
        DROP POLICY IF EXISTS jackpot_pools_update_project ON jackpot_pools;
        DROP POLICY IF EXISTS jackpot_pools_delete_project ON jackpot_pools;
    END IF;

    -- Jackpot tickets policies
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jackpot_tickets') THEN
        DROP POLICY IF EXISTS jackpot_tickets_project_isolation ON jackpot_tickets;
        DROP POLICY IF EXISTS jackpot_tickets_select_project ON jackpot_tickets;
        DROP POLICY IF EXISTS jackpot_tickets_insert_project ON jackpot_tickets;
        DROP POLICY IF EXISTS jackpot_tickets_update_project ON jackpot_tickets;
        DROP POLICY IF EXISTS jackpot_tickets_delete_project ON jackpot_tickets;
    END IF;

    -- Jackpot wins policies
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jackpot_wins') THEN
        DROP POLICY IF EXISTS jackpot_wins_project_isolation ON jackpot_wins;
        DROP POLICY IF EXISTS jackpot_wins_select_project ON jackpot_wins;
        DROP POLICY IF EXISTS jackpot_wins_insert_project ON jackpot_wins;
        DROP POLICY IF EXISTS jackpot_wins_update_project ON jackpot_wins;
        DROP POLICY IF EXISTS jackpot_wins_delete_project ON jackpot_wins;
    END IF;

    -- NFT reward percentages policies
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nft_reward_percentages') THEN
        DROP POLICY IF EXISTS nft_reward_percentages_project_isolation ON nft_reward_percentages;
        DROP POLICY IF EXISTS nft_reward_percentages_select_project ON nft_reward_percentages;
        DROP POLICY IF EXISTS nft_reward_percentages_insert_project ON nft_reward_percentages;
        DROP POLICY IF EXISTS nft_reward_percentages_update_project ON nft_reward_percentages;
        DROP POLICY IF EXISTS nft_reward_percentages_delete_project ON nft_reward_percentages;
    END IF;

    -- Jackpot contribution policies
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jackpot_contribution') THEN
        DROP POLICY IF EXISTS jackpot_contribution_project_isolation ON jackpot_contribution;
        DROP POLICY IF EXISTS jackpot_contribution_select_project ON jackpot_contribution;
        DROP POLICY IF EXISTS jackpot_contribution_insert_project ON jackpot_contribution;
        DROP POLICY IF EXISTS jackpot_contribution_update_project ON jackpot_contribution;
        DROP POLICY IF EXISTS jackpot_contribution_delete_project ON jackpot_contribution;
    END IF;
END $$;

-- ============================================================
-- 5. CREATE RLS POLICIES
-- ============================================================
-- Policies allow access only when project_id matches current_project_id()
-- OR when project_id is NULL (for backward compatibility during migration)
-- ============================================================

-- Products policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        -- Allow SELECT if project_id matches or is NULL
        CREATE POLICY products_select_project ON products
            FOR SELECT
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        -- Allow INSERT if project_id matches or is NULL
        CREATE POLICY products_insert_project ON products
            FOR INSERT
            WITH CHECK (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        -- Allow UPDATE if project_id matches or is NULL
        CREATE POLICY products_update_project ON products
            FOR UPDATE
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            )
            WITH CHECK (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        -- Allow DELETE if project_id matches or is NULL
        CREATE POLICY products_delete_project ON products
            FOR DELETE
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            );
    END IF;
END $$;

-- PrizeWin policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prizeWin') THEN
        CREATE POLICY prizewin_select_project ON "prizeWin"
            FOR SELECT
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY prizewin_insert_project ON "prizeWin"
            FOR INSERT
            WITH CHECK (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY prizewin_update_project ON "prizeWin"
            FOR UPDATE
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            )
            WITH CHECK (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY prizewin_delete_project ON "prizeWin"
            FOR DELETE
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            );
    END IF;
END $$;

-- Transaction policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transaction') THEN
        CREATE POLICY transaction_select_project ON transaction
            FOR SELECT
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY transaction_insert_project ON transaction
            FOR INSERT
            WITH CHECK (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY transaction_update_project ON transaction
            FOR UPDATE
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            )
            WITH CHECK (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY transaction_delete_project ON transaction
            FOR DELETE
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            );
    END IF;
END $$;

-- Withdraw policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'withdraw') THEN
        CREATE POLICY withdraw_select_project ON withdraw
            FOR SELECT
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY withdraw_insert_project ON withdraw
            FOR INSERT
            WITH CHECK (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY withdraw_update_project ON withdraw
            FOR UPDATE
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            )
            WITH CHECK (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY withdraw_delete_project ON withdraw
            FOR DELETE
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            );
    END IF;
END $$;

-- Jackpot pools policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jackpot_pools') THEN
        CREATE POLICY jackpot_pools_select_project ON jackpot_pools
            FOR SELECT
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY jackpot_pools_insert_project ON jackpot_pools
            FOR INSERT
            WITH CHECK (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY jackpot_pools_update_project ON jackpot_pools
            FOR UPDATE
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            )
            WITH CHECK (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY jackpot_pools_delete_project ON jackpot_pools
            FOR DELETE
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            );
    END IF;
END $$;

-- Jackpot tickets policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jackpot_tickets') THEN
        CREATE POLICY jackpot_tickets_select_project ON jackpot_tickets
            FOR SELECT
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY jackpot_tickets_insert_project ON jackpot_tickets
            FOR INSERT
            WITH CHECK (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY jackpot_tickets_update_project ON jackpot_tickets
            FOR UPDATE
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            )
            WITH CHECK (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY jackpot_tickets_delete_project ON jackpot_tickets
            FOR DELETE
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            );
    END IF;
END $$;

-- Jackpot wins policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jackpot_wins') THEN
        CREATE POLICY jackpot_wins_select_project ON jackpot_wins
            FOR SELECT
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY jackpot_wins_insert_project ON jackpot_wins
            FOR INSERT
            WITH CHECK (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY jackpot_wins_update_project ON jackpot_wins
            FOR UPDATE
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            )
            WITH CHECK (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY jackpot_wins_delete_project ON jackpot_wins
            FOR DELETE
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            );
    END IF;
END $$;

-- NFT reward percentages policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nft_reward_percentages') THEN
        CREATE POLICY nft_reward_percentages_select_project ON nft_reward_percentages
            FOR SELECT
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY nft_reward_percentages_insert_project ON nft_reward_percentages
            FOR INSERT
            WITH CHECK (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY nft_reward_percentages_update_project ON nft_reward_percentages
            FOR UPDATE
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            )
            WITH CHECK (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY nft_reward_percentages_delete_project ON nft_reward_percentages
            FOR DELETE
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            );
    END IF;
END $$;

-- Jackpot contribution policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jackpot_contribution') THEN
        CREATE POLICY jackpot_contribution_select_project ON jackpot_contribution
            FOR SELECT
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY jackpot_contribution_insert_project ON jackpot_contribution
            FOR INSERT
            WITH CHECK (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY jackpot_contribution_update_project ON jackpot_contribution
            FOR UPDATE
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            )
            WITH CHECK (
                project_id = current_project_id() 
                OR project_id IS NULL
            );

        CREATE POLICY jackpot_contribution_delete_project ON jackpot_contribution
            FOR DELETE
            USING (
                project_id = current_project_id() 
                OR project_id IS NULL
            );
    END IF;
END $$;

-- ============================================================
-- 6. ADMIN VALIDATION QUERIES
-- ============================================================

-- View: Project admin validation
CREATE OR REPLACE VIEW project_admin_validation AS
SELECT 
    p.id as project_id,
    p.slug as project_slug,
    p.name as project_name,
    pa.id as admin_id,
    pa.email as admin_email,
    pa.full_name as admin_name,
    pa.role as admin_role,
    pa.is_active as admin_active,
    p.is_active as project_active
FROM projects p
INNER JOIN project_admins pa ON p.id = pa.project_id
WHERE p.is_active = true
AND pa.is_active = true;

-- ============================================================
-- 7. GRANT PERMISSIONS
-- ============================================================

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION get_project_by_slug(VARCHAR) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_project_id_by_slug(VARCHAR) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION validate_project_admin(VARCHAR, VARCHAR) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION current_project_id() TO authenticated, anon;

-- Grant select on views
GRANT SELECT ON project_admin_validation TO authenticated, anon;

-- ============================================================
-- 8. USAGE NOTES
-- ============================================================
-- 
-- To use RLS with project isolation:
-- 
-- 1. Before executing queries, set the project context:
--    SET LOCAL app.current_project_id = <project_id>;
-- 
-- 2. Or use the helper function in your queries:
--    SELECT * FROM products 
--    WHERE project_id = get_project_id_by_slug('my-project-slug');
-- 
-- 3. For admin validation:
--    SELECT * FROM project_admin_validation 
--    WHERE project_slug = 'my-project' AND admin_email = 'admin@example.com';
-- 
-- 4. The RLS policies will automatically filter data based on 
--    the current_project_id() function result.
-- 
-- ============================================================

