# Multi-Project Setup Guide

## Overview

This guide explains how to set up and use the multi-project (multi-tenant) system with complete data isolation using Row Level Security (RLS).

## Files Created

1. **`multi_project_rls_migration.sql`** - Complete SQL migration for RLS setup
2. **`RLS_USAGE_GUIDE.md`** - Detailed usage guide for RLS
3. **`backend/middleware/project-context.js`** - Backend middleware for project context

## Quick Start

### Step 1: Run the Migration

1. Open Supabase SQL Editor
2. Run the migration file: `backend/database/multi_project_rls_migration.sql`
3. This will:
   - Add `project_id` columns to all relevant tables
   - Create helper functions
   - Enable RLS on all tables
   - Create RLS policies for project isolation

### Step 2: Assign Existing Data

If you have existing data:

1. Run `FIX_MAIN_DATA_COMPLETE.sql` to assign all existing data to the first active project
2. Or manually assign data to specific projects:

```sql
UPDATE products SET project_id = 1 WHERE project_id IS NULL;
UPDATE "prizeWin" SET project_id = 1 WHERE project_id IS NULL;
-- etc.
```

### Step 3: Verify Setup

```sql
-- Check if project_id columns exist
SELECT column_name, table_name 
FROM information_schema.columns 
WHERE column_name = 'project_id'
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('products', 'prizeWin', 'transaction', 'withdraw');

-- Test helper functions
SELECT * FROM get_project_by_slug('your-project-slug');
SELECT get_project_id_by_slug('your-project-slug');
```

## System Architecture

### URL Structure

- **Frontend:** `https://spinloot.orangutanx.com/<projectSlug>`
- **Admin Panel:** `https://spinloot.orangutanx.com/<projectSlug>/<projectSlug>`

### Data Isolation

1. **Database Level (RLS):** Row Level Security policies automatically filter data by `project_id`
2. **Application Level:** Frontend queries filter by `project_id` explicitly
3. **Backend Level:** Backend validates project access and filters queries

### Project Resolution

1. Frontend extracts `projectSlug` from URL
2. Calls `getProjectBySlug(projectSlug)` to get project data
3. Stores `project_id` in context/localStorage
4. All queries filter by `project_id`

## Helper Functions

### `get_project_by_slug(slug)`

Returns full project data by slug.

```sql
SELECT * FROM get_project_by_slug('my-project');
```

### `get_project_id_by_slug(slug)`

Returns project ID by slug.

```sql
SELECT get_project_id_by_slug('my-project');
-- Returns: 1
```

### `validate_project_admin(project_slug, admin_email)`

Validates if an admin has access to a project.

```sql
SELECT validate_project_admin('my-project', 'admin@example.com');
-- Returns: true or false
```

### `current_project_id()`

Returns the current project ID from session variable (for RLS).

```sql
SET LOCAL app.current_project_id = 1;
SELECT current_project_id();
-- Returns: 1
```

## RLS Policies

RLS policies allow access when:
- `project_id = current_project_id()` (matches current project)
- `project_id IS NULL` (backward compatibility)

**Note:** The `current_project_id()` function reads from `app.current_project_id` session variable, which must be set before queries.

## Frontend Implementation

### Get Project Context

```typescript
import { useProject } from "@/lib/project-context";

const { currentProject, getProjectId } = useProject();
const projectId = getProjectId();
```

### Filter Queries

```typescript
const projectId = getProjectId();
let query = supabase.from("products").select();
if (projectId) {
  query = query.eq("project_id", projectId);
}
const { data } = await query;
```

### Insert with Project ID

```typescript
const projectId = getProjectId();
const { data, error } = await supabase
  .from("products")
  .insert({
    name: "Product Name",
    price: "100",
    project_id: projectId // Always include project_id
  });
```

## Backend Implementation

### Validate Project Access

```javascript
import { validateProjectAdmin, getProjectIdBySlug } from '../middleware/project-context.js';

// In your route handler
const projectSlug = req.params.projectSlug;
const adminEmail = req.user.email;

const hasAccess = await validateProjectAdmin(projectSlug, adminEmail);
if (!hasAccess) {
  return res.status(403).json({ error: 'Access denied' });
}

const projectId = await getProjectIdBySlug(projectSlug);
```

### Filter Queries by Project

```javascript
const projectId = await getProjectIdBySlug(projectSlug);

const { data, error } = await supabaseAdmin
  .from('products')
  .select('*')
  .eq('project_id', projectId);
```

## Admin Panel Route

The admin panel should be accessible at:

```
/<projectSlug>/<projectSlug>
```

**Validation:**
1. Extract both slugs from URL
2. Verify they match: `projectSlug === adminSlug`
3. If they don't match, return 404
4. Validate admin has access to that project

**Example:**

```typescript
// In [projectSlug]/[adminSlug]/page.tsx
const params = useParams();
const projectSlug = params.projectSlug;
const adminSlug = params.adminSlug;

if (projectSlug !== adminSlug) {
  return <NotFound />;
}

// Validate admin access
const hasAccess = await validateProjectAdmin(projectSlug, adminEmail);
if (!hasAccess) {
  return <Unauthorized />;
}
```

## Testing

### Test Project Isolation

```sql
-- Create two test projects
INSERT INTO projects (name, slug) VALUES 
  ('Project 1', 'project-1'),
  ('Project 2', 'project-2');

-- Add data to each project
INSERT INTO products (name, price, project_id) VALUES
  ('Product A', '100', 1),
  ('Product B', '200', 2);

-- Test RLS filtering
SET LOCAL app.current_project_id = 1;
SELECT * FROM products; -- Should only show Product A

SET LOCAL app.current_project_id = 2;
SELECT * FROM products; -- Should only show Product B
```

### Test Admin Validation

```sql
-- Create admin for project
INSERT INTO project_admins (project_id, email, password_hash) VALUES
  (1, 'admin@project1.com', 'hashed_password');

-- Validate access
SELECT validate_project_admin('project-1', 'admin@project1.com');
-- Should return: true

SELECT validate_project_admin('project-2', 'admin@project1.com');
-- Should return: false
```

## Troubleshooting

### RLS Not Working

1. **Check RLS is enabled:**
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables 
   WHERE tablename = 'products';
   ```

2. **Check policies exist:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'products';
   ```

3. **Test session variable:**
   ```sql
   SET LOCAL app.current_project_id = 1;
   SELECT current_project_id();
   ```

### Data Not Showing

1. **Verify project_id is set:**
   ```sql
   SELECT COUNT(*) FROM products WHERE project_id IS NULL;
   ```

2. **Check project exists:**
   ```sql
   SELECT * FROM projects WHERE slug = 'your-slug';
   ```

3. **Verify project is active:**
   ```sql
   SELECT * FROM projects WHERE slug = 'your-slug' AND is_active = true;
   ```

## Security Notes

1. **RLS is a defense-in-depth measure** - Always filter by `project_id` in application code too
2. **Backend uses service role key** - Can bypass RLS, so always validate project access
3. **Frontend queries are filtered** - Even with RLS, explicit filtering is safer
4. **Admin validation is required** - Always validate admin access before showing admin panel

## Next Steps

1. ✅ Run migration
2. ✅ Assign existing data to projects
3. ✅ Update frontend to use project context
4. ✅ Update backend to validate project access
5. ✅ Test admin panel route validation
6. ✅ Test data isolation between projects

