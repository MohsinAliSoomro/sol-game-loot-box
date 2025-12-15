# Migration Fix for Missing `slug` Column

## Problem

If you're getting the error:
```
ERROR: 42703: column "slug" does not exist
```

This happens when:
1. The `projects` table already exists (from previous schema or existing database)
2. The table doesn't have the `slug` column
3. The view `active_projects_summary` tries to reference `p.slug` which doesn't exist

## Solution

The schema has been updated to be **migration-safe**. It now:

1. ✅ Creates the table if it doesn't exist
2. ✅ Adds missing columns if the table exists
3. ✅ Generates slugs from existing project names
4. ✅ Handles duplicate slugs by appending project ID
5. ✅ Adds constraints safely

## How to Fix

### Option 1: Run the Updated Schema (Recommended)

Simply run the updated `schema.sql` file in Supabase SQL Editor. It will:
- Check if columns exist before adding them
- Migrate existing data safely
- Not break existing tables

### Option 2: Manual Fix (If Option 1 Fails)

If you still get errors, run this manually:

```sql
-- 1. Add slug column if missing
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- 2. Generate slugs from names for existing rows
UPDATE projects 
SET slug = LOWER(REGEXP_REPLACE(COALESCE(name, 'project-' || id::text), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

-- 3. Handle duplicates
UPDATE projects p1
SET slug = slug || '-' || id
WHERE EXISTS (
    SELECT 1 FROM projects p2 
    WHERE p2.slug = p1.slug AND p2.id < p1.id
);

-- 4. Make it NOT NULL
ALTER TABLE projects ALTER COLUMN slug SET NOT NULL;

-- 5. Add unique constraint
ALTER TABLE projects ADD CONSTRAINT projects_slug_unique UNIQUE(slug);

-- 6. Add check constraint
ALTER TABLE projects ADD CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]+$');

-- 7. Create index
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
```

### Option 3: Drop and Recreate (⚠️ Data Loss Warning)

**Only use this if you don't have important data:**

```sql
-- Drop the view first
DROP VIEW IF EXISTS active_projects_summary;

-- Drop the table (WARNING: This deletes all data!)
DROP TABLE IF EXISTS projects CASCADE;

-- Then run the full schema.sql
```

## Verification

After running the migration, verify it worked:

```sql
-- Check if slug column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'projects' AND column_name = 'slug';

-- Check if all projects have slugs
SELECT id, name, slug FROM projects;

-- Test the view
SELECT * FROM active_projects_summary;
```

## Common Issues

### Issue: "duplicate key value violates unique constraint"

**Solution:** The migration script now handles duplicates by appending the project ID. If you still get this error, run:

```sql
-- Find duplicates
SELECT slug, COUNT(*) 
FROM projects 
GROUP BY slug 
HAVING COUNT(*) > 1;

-- Fix them manually
UPDATE projects 
SET slug = slug || '-' || id
WHERE id IN (SELECT id FROM projects WHERE slug IN (
    SELECT slug FROM projects GROUP BY slug HAVING COUNT(*) > 1
));
```

### Issue: "column "slug" contains null values"

**Solution:** Run the UPDATE statement to populate slugs:

```sql
UPDATE projects 
SET slug = LOWER(REGEXP_REPLACE(COALESCE(name, 'project-' || id::text), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;
```

## Next Steps

After fixing the schema:

1. ✅ Verify all columns exist
2. ✅ Test creating a new project via API
3. ✅ Verify the view works
4. ✅ Continue with backend setup

The updated schema is now safe to run multiple times - it won't break existing tables or data.

