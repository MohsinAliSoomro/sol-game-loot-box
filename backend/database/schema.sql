-- =====================================================
-- Multi-Tenant Whitelabel Database Schema
-- =====================================================
-- This schema supports multiple projects (tenants) with:
-- - Separate admin users per project
-- - Project-specific data isolation
-- - Branding and configuration per project
-- =====================================================

-- =====================================================
-- 1. PROJECTS TABLE
-- =====================================================
-- Stores all whitelabel projects (tenants)
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE, -- URL-friendly identifier
    subdomain VARCHAR(100) UNIQUE, -- For subdomain routing (e.g., project1.example.com)
    
    -- Branding
    logo_url TEXT,
    favicon_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#ff914d', -- Hex color
    secondary_color VARCHAR(7) DEFAULT '#ff6b35',
    theme VARCHAR(50) DEFAULT 'light', -- light, dark, auto
    
    -- Configuration
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}'::jsonb, -- Flexible settings storage
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER, -- Reference to master admin who created this
    
    -- Constraints
    CONSTRAINT valid_hex_color CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]+$')
);

-- Add missing columns if table already exists (migration-safe)
DO $$ 
BEGIN
    -- Add slug column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'projects' 
        AND column_name = 'slug'
    ) THEN
        ALTER TABLE projects ADD COLUMN slug VARCHAR(255);
        -- Generate slugs from names for existing rows
        UPDATE projects 
        SET slug = LOWER(REGEXP_REPLACE(COALESCE(name, 'project-' || id::text), '[^a-zA-Z0-9]+', '-', 'g'))
        WHERE slug IS NULL OR slug = '';
        -- Handle duplicates by appending ID
        UPDATE projects p1
        SET slug = slug || '-' || id
        WHERE EXISTS (
            SELECT 1 FROM projects p2 
            WHERE p2.slug = p1.slug AND p2.id < p1.id
        );
        -- Make it NOT NULL and UNIQUE after populating
        ALTER TABLE projects ALTER COLUMN slug SET NOT NULL;
        -- Add unique constraint (drop first if exists)
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_slug_unique') THEN
            ALTER TABLE projects DROP CONSTRAINT projects_slug_unique;
        END IF;
        ALTER TABLE projects ADD CONSTRAINT projects_slug_unique UNIQUE(slug);
        -- Add check constraint (drop first if exists)
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_slug') THEN
            ALTER TABLE projects DROP CONSTRAINT valid_slug;
        END IF;
        ALTER TABLE projects ADD CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]+$');
    END IF;

    -- Add subdomain column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'projects' 
        AND column_name = 'subdomain'
    ) THEN
        ALTER TABLE projects ADD COLUMN subdomain VARCHAR(100);
        CREATE UNIQUE INDEX IF NOT EXISTS projects_subdomain_unique ON projects(subdomain) WHERE subdomain IS NOT NULL;
    END IF;

    -- Add other missing columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'projects' 
        AND column_name = 'logo_url'
    ) THEN
        ALTER TABLE projects ADD COLUMN logo_url TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'projects' 
        AND column_name = 'favicon_url'
    ) THEN
        ALTER TABLE projects ADD COLUMN favicon_url TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'projects' 
        AND column_name = 'primary_color'
    ) THEN
        ALTER TABLE projects ADD COLUMN primary_color VARCHAR(7) DEFAULT '#ff914d';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'projects' 
        AND column_name = 'secondary_color'
    ) THEN
        ALTER TABLE projects ADD COLUMN secondary_color VARCHAR(7) DEFAULT '#ff6b35';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'projects' 
        AND column_name = 'theme'
    ) THEN
        ALTER TABLE projects ADD COLUMN theme VARCHAR(50) DEFAULT 'light';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'projects' 
        AND column_name = 'settings'
    ) THEN
        ALTER TABLE projects ADD COLUMN settings JSONB DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'projects' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE projects ADD COLUMN created_by INTEGER;
    END IF;
END $$;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_subdomain ON projects(subdomain);
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(is_active) WHERE is_active = true;

-- =====================================================
-- 2. PROJECT_ADMINS TABLE
-- =====================================================
-- Admin users specific to each project
CREATE TABLE IF NOT EXISTS project_admins (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- bcrypt hashed password
    
    -- Admin details
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'admin', -- admin, super_admin, viewer
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(project_id, email) -- One email per project
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_admins_project ON project_admins(project_id);
CREATE INDEX IF NOT EXISTS idx_project_admins_email ON project_admins(email);
CREATE INDEX IF NOT EXISTS idx_project_admins_active ON project_admins(is_active, project_id) WHERE is_active = true;

-- =====================================================
-- 3. MASTER_ADMINS TABLE
-- =====================================================
-- Super admins who can create and manage all projects
CREATE TABLE IF NOT EXISTS master_admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'master_admin',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- 4. PROJECT_NFTS TABLE
-- =====================================================
-- NFTs specific to each project
CREATE TABLE IF NOT EXISTS project_nfts (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- NFT Details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    mint_address VARCHAR(255), -- Solana mint address
    collection_address VARCHAR(255),
    
    -- Metadata
    rarity VARCHAR(50),
    attributes JSONB DEFAULT '{}'::jsonb,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_nfts_project ON project_nfts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_nfts_active ON project_nfts(project_id, is_active) WHERE is_active = true;

-- =====================================================
-- 5. PROJECT_JACKPOTS TABLE
-- =====================================================
-- Jackpots specific to each project
CREATE TABLE IF NOT EXISTS project_jackpots (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Jackpot Details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    prize_amount DECIMAL(18, 8) DEFAULT 0, -- SOL amount
    current_balance DECIMAL(18, 8) DEFAULT 0,
    
    -- Configuration
    ticket_price DECIMAL(18, 8) DEFAULT 0,
    max_tickets INTEGER,
    draw_date TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'active', -- active, completed, cancelled
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_jackpots_project ON project_jackpots(project_id);
CREATE INDEX IF NOT EXISTS idx_project_jackpots_status ON project_jackpots(project_id, status);

-- =====================================================
-- 6. PROJECT_SETTINGS TABLE
-- =====================================================
-- Additional project-specific settings
CREATE TABLE IF NOT EXISTS project_settings (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Settings key-value pairs
    setting_key VARCHAR(255) NOT NULL,
    setting_value JSONB,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(project_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_project_settings_project ON project_settings(project_id, setting_key);

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================
-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_nfts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_jackpots ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 8. HELPER FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_admins_updated_at BEFORE UPDATE ON project_admins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_nfts_updated_at BEFORE UPDATE ON project_nfts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_jackpots_updated_at BEFORE UPDATE ON project_jackpots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_settings_updated_at BEFORE UPDATE ON project_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. VIEWS FOR EASY QUERYING
-- =====================================================

-- View: Active projects with admin count
CREATE OR REPLACE VIEW active_projects_summary AS
SELECT 
    p.id,
    p.name,
    p.slug,
    p.subdomain,
    p.is_active,
    p.created_at,
    COUNT(pa.id) as admin_count,
    COUNT(pn.id) as nft_count,
    COUNT(pj.id) as jackpot_count
FROM projects p
LEFT JOIN project_admins pa ON p.id = pa.project_id AND pa.is_active = true
LEFT JOIN project_nfts pn ON p.id = pn.project_id AND pn.is_active = true
LEFT JOIN project_jackpots pj ON p.id = pj.project_id AND pj.is_active = true
WHERE p.is_active = true
GROUP BY p.id, p.name, p.slug, p.subdomain, p.is_active, p.created_at;

-- =====================================================
-- 10. SAMPLE DATA (Optional - for testing)
-- =====================================================
-- Uncomment to insert sample data

/*
-- Sample master admin (password: admin123 - CHANGE IN PRODUCTION!)
INSERT INTO master_admins (email, password_hash, full_name) VALUES
('admin@spinloot.com', '$2a$10$YourHashedPasswordHere', 'Master Admin');

-- Sample project
INSERT INTO projects (name, slug, subdomain, primary_color, secondary_color) VALUES
('Demo Project', 'demo-project', 'demo', '#ff914d', '#ff6b35');
*/

