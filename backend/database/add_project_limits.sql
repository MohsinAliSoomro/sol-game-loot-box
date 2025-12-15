-- Migration: Add project limits for lootboxes and jackpots
-- This allows master admins to set limits on how many lootboxes and jackpots
-- each project admin can create

-- Add columns to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS max_lootboxes INTEGER NULL,
ADD COLUMN IF NOT EXISTS max_jackpots INTEGER NULL;

-- Add comments for documentation
COMMENT ON COLUMN projects.max_lootboxes IS 'Maximum number of lootboxes allowed for this project. NULL = unlimited';
COMMENT ON COLUMN projects.max_jackpots IS 'Maximum number of jackpots allowed for this project. NULL = unlimited';

-- Create index for faster queries when checking limits
CREATE INDEX IF NOT EXISTS idx_projects_limits ON projects(max_lootboxes, max_jackpots);

-- Verification query - show all projects with their limits
-- SELECT id, name, slug, max_lootboxes, max_jackpots FROM projects;
