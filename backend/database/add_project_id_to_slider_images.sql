-- Migration: Add project_id to slider_images table for multi-tenant support
-- This ensures each project has its own isolated slider images

-- Step 1: Add project_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'slider_images' 
        AND column_name = 'project_id'
    ) THEN
        ALTER TABLE slider_images 
        ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;
        
        -- Create index for better query performance
        CREATE INDEX IF NOT EXISTS idx_slider_images_project 
        ON slider_images(project_id, order_index);
        
        RAISE NOTICE 'Added project_id column to slider_images table';
    ELSE
        RAISE NOTICE 'project_id column already exists in slider_images table';
    END IF;
END $$;

-- Step 2: Update existing slider_images to assign them to a default project
-- This is a safety measure - you may want to review and manually assign
-- existing slider images to appropriate projects
DO $$
DECLARE
    default_project_id INTEGER;
BEGIN
    -- Get the first active project as default
    SELECT id INTO default_project_id 
    FROM projects 
    WHERE is_active = true 
    ORDER BY id ASC 
    LIMIT 1;
    
    IF default_project_id IS NOT NULL THEN
        -- Update existing slider images to belong to the default project
        UPDATE slider_images 
        SET project_id = default_project_id 
        WHERE project_id IS NULL;
        
        RAISE NOTICE 'Assigned existing slider images to project ID: %', default_project_id;
    ELSE
        RAISE NOTICE 'No active projects found. Existing slider images will have NULL project_id.';
    END IF;
END $$;

-- Step 3: Add constraint to ensure project_id is set for new records (optional)
-- Uncomment if you want to enforce project_id as required
-- ALTER TABLE slider_images 
-- ALTER COLUMN project_id SET NOT NULL;

-- Step 4: Update the unique constraint to include project_id
-- This allows each project to have its own slider images with the same order_index
DO $$
BEGIN
    -- Drop existing unique constraint on order_index if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'slider_images_order_index_key'
    ) THEN
        ALTER TABLE slider_images DROP CONSTRAINT slider_images_order_index_key;
        RAISE NOTICE 'Dropped existing unique constraint on order_index';
    END IF;
    
    -- Create new unique constraint on (project_id, order_index)
    -- This allows each project to have slider images with order_index 1, 2, 3, etc.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'slider_images_project_order_unique'
    ) THEN
        ALTER TABLE slider_images 
        ADD CONSTRAINT slider_images_project_order_unique 
        UNIQUE (project_id, order_index);
        
        RAISE NOTICE 'Created unique constraint on (project_id, order_index)';
    END IF;
END $$;

