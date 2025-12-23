-- Simple migration to add project_id to slider_images table
-- Run this in Supabase SQL Editor

-- Step 1: Add project_id column
ALTER TABLE slider_images 
ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;

-- Step 2: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_slider_images_project 
ON slider_images(project_id, order_index);

-- Step 3: Assign existing slider images to the first active project
UPDATE slider_images 
SET project_id = (
  SELECT id FROM projects 
  WHERE is_active = true 
  ORDER BY id ASC 
  LIMIT 1
)
WHERE project_id IS NULL;

-- Step 4: Drop old unique constraint on order_index if it exists
ALTER TABLE slider_images 
DROP CONSTRAINT IF EXISTS slider_images_order_index_key;

-- Step 5: Create new unique constraint on (project_id, order_index)
ALTER TABLE slider_images 
DROP CONSTRAINT IF EXISTS slider_images_project_order_unique;

ALTER TABLE slider_images 
ADD CONSTRAINT slider_images_project_order_unique 
UNIQUE (project_id, order_index);

