# Row Level Security (RLS) Usage Guide

## Overview

This guide explains how to use the Row Level Security (RLS) policies for multi-project data isolation in Supabase.

## How RLS Works

RLS policies automatically filter data based on the `current_project_id()` function, which reads from the PostgreSQL session variable `app.current_project_id`.

## Setting Project Context

### Method 1: Using Session Variables (Recommended for Backend)

Before executing queries, set the project context:

```sql
SET LOCAL app.current_project_id = <project_id>;
```

**Example in Node.js/Express:**

```javascript
// In your backend API route
async function getProjectData(projectId) {
  const { data, error } = await supabaseAdmin.rpc('exec_sql', {
    sql: `
      SET LOCAL app.current_project_id = ${projectId};
      SELECT * FROM products;
    `
  });
  return data;
}
```

**Better approach - Use Supabase connection with session variable:**

```javascript
// Set project context for a connection
const { data, error } = await supabaseAdmin
  .from('products')
  .select('*')
  // The RLS policy will automatically filter by current_project_id()
  // You need to set the session variable first
```

### Method 2: Using Helper Functions (Recommended for Frontend)

Use the helper functions that don't require session variables:

```sql
-- Get project by slug
SELECT * FROM get_project_by_slug('my-project-slug');

-- Get project ID by slug
SELECT get_project_id_by_slug('my-project-slug');

-- Validate admin access
SELECT validate_project_admin('my-project-slug', 'admin@example.com');
```

### Method 3: Direct Filtering (Current Implementation)

The frontend currently filters by `project_id` directly in queries:

```typescript
const projectId = getProjectId();
let query = supabase.from("products").select();
if (projectId) {
  query = query.eq("project_id", projectId);
}
```

## RLS Policies

The RLS policies allow access when:
- `project_id = current_project_id()` (matches current project)
- `project_id IS NULL` (backward compatibility during migration)

## Admin Validation

### Check if admin has access to project:

```sql
SELECT * FROM project_admin_validation 
WHERE project_slug = 'my-project' 
AND admin_email = 'admin@example.com'
AND admin_active = true
AND project_active = true;
```

### Validate admin in backend:

```javascript
const { data, error } = await supabaseAdmin
  .from('project_admin_validation')
  .select('*')
  .eq('project_slug', projectSlug)
  .eq('admin_email', adminEmail)
  .eq('admin_active', true)
  .eq('project_active', true)
  .single();

if (data) {
  // Admin has access
} else {
  // Admin does not have access
}
```

## Frontend Implementation

The frontend should:

1. **Get project ID from slug:**
   ```typescript
   const projectId = await getProjectIdBySlug(projectSlug);
   ```

2. **Filter all queries by project_id:**
   ```typescript
   let query = supabase.from("table").select();
   if (projectId) {
     query = query.eq("project_id", projectId);
   }
   ```

3. **Include project_id in inserts:**
   ```typescript
   const { data, error } = await supabase
     .from("table")
     .insert({
       ...data,
       project_id: projectId
     });
   ```

## Backend Implementation

The backend should:

1. **Set project context before queries:**
   ```javascript
   // Option 1: Use session variable (if using raw SQL)
   await supabaseAdmin.rpc('exec_sql', {
     sql: `SET LOCAL app.current_project_id = ${projectId};`
   });

   // Option 2: Filter directly in queries (current approach)
   const { data } = await supabaseAdmin
     .from('products')
     .select('*')
     .eq('project_id', projectId);
   ```

2. **Validate admin access:**
   ```javascript
   const { data } = await supabaseAdmin
     .from('project_admins')
     .select('*')
     .eq('project_id', projectId)
     .eq('email', adminEmail)
     .eq('is_active', true)
     .single();
   ```

## Migration Notes

1. **Run the migration:**
   ```bash
   # In Supabase SQL Editor
   # Run: backend/database/multi_project_rls_migration.sql
   ```

2. **Assign existing data to projects:**
   ```bash
   # Run: FIX_MAIN_DATA_COMPLETE.sql
   # This assigns all existing data to the first active project
   ```

3. **Test RLS policies:**
   ```sql
   -- Test with project context
   SET LOCAL app.current_project_id = 1;
   SELECT * FROM products; -- Should only show products for project 1
   
   SET LOCAL app.current_project_id = 2;
   SELECT * FROM products; -- Should only show products for project 2
   ```

## Important Notes

1. **RLS is enabled but allows NULL project_id** for backward compatibility
2. **Always include project_id in new inserts** to ensure proper isolation
3. **Frontend queries should filter by project_id** even with RLS enabled
4. **Backend can bypass RLS** using service role key, but should still filter by project_id

## Troubleshooting

### Issue: RLS blocking all queries

**Solution:** Check if `app.current_project_id` is set. If using direct filtering, ensure `project_id` is included in WHERE clauses.

### Issue: Can't see data after migration

**Solution:** 
1. Verify `project_id` columns exist
2. Check if data has `project_id` assigned
3. Ensure queries filter by `project_id` or use session variable

### Issue: Admin validation failing

**Solution:**
1. Verify project exists and is active
2. Check admin exists for that project
3. Ensure both `is_active` flags are true

