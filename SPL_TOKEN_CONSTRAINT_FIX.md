# SPL Token Mint Address Constraint Fix

## Problem

The `token_reward_percentages` table has a **global UNIQUE constraint** on `mint_address`, which prevents the same SPL token mint from being used as a reward across different projects. This is incorrect because:

- SPL tokens are fungible tokens on Solana
- One SPL mint can be used by unlimited apps/projects
- The current constraint violates multi-project/whitelabel architecture

**Error:** `duplicate key value violates unique constraint "token_reward_percentages_mint_address_key"`

## Solution

Replace the global constraint with a **composite unique constraint** on `(project_id, mint_address)`.

### SQL Migration

**File:** `database/migrations/fix_spl_token_mint_constraint.sql`

Execute this SQL in Supabase SQL Editor:

```sql
-- Step 1: Drop global constraint
ALTER TABLE token_reward_percentages 
DROP CONSTRAINT IF EXISTS token_reward_percentages_mint_address_key;

-- Step 2: Create composite constraint
CREATE UNIQUE INDEX token_reward_percentages_project_mint_unique 
ON token_reward_percentages(project_id, mint_address) 
WHERE mint_address IS NOT NULL;
```

### What This Does

1. **Removes** the global constraint that prevents cross-project reuse
2. **Creates** a composite constraint that:
   - ✅ Allows same mint in different projects: `(project_id=1, mint=ABC)` and `(project_id=2, mint=ABC)` ✅
   - ❌ Prevents duplicates within same project: `(project_id=1, mint=ABC)` twice ❌
   - Handles NULL values gracefully (for non-token rewards)

## Backend Changes Required

### 1. Ensure `project_id` is Always Set

The insert logic in `lib/hooks/useProjectRewards.ts` already sets `project_id`:

```typescript
const insertData: any = {
  product_id: lootboxId,
  project_id: activeProjectId,  // ✅ Already included
  // ...
};
```

**No changes needed** - the code already includes `project_id`.

### 2. Update Queries to be Project-Scoped (if any exist)

After the migration, any queries that check for duplicate mints should filter by `project_id`:

**Before (if exists):**
```typescript
// ❌ Checks globally
const { data } = await supabase
  .from('token_reward_percentages')
  .select('id')
  .eq('mint_address', mintAddress);
```

**After:**
```typescript
// ✅ Checks within project only
const { data } = await supabase
  .from('token_reward_percentages')
  .select('id')
  .eq('mint_address', mintAddress)
  .eq('project_id', activeProjectId);
```

**Note:** The current codebase doesn't appear to have application-level duplicate checks that need updating. The database constraint will handle uniqueness enforcement.

### 3. Error Handling

The database will now return constraint violations for project-level duplicates. Error handling should remain the same:

```typescript
catch (error: any) {
  if (error.code === '23505') {  // Unique constraint violation
    // Handle duplicate within project
  }
}
```

## Why This Design is Correct

### 1. **Matches Solana Architecture**
- SPL tokens are fungible and can be used by unlimited projects
- One mint address represents one token type, not one project's token
- The constraint should reflect project isolation, not token uniqueness

### 2. **Multi-Tenant Best Practice**
- Each project should be isolated
- Same resources (tokens) can be shared across tenants
- Uniqueness enforced at tenant level, not globally

### 3. **Data Integrity**
- Prevents accidental duplicates within a project
- Allows intentional reuse across projects
- Maintains referential integrity with `project_id` foreign key

### 4. **Scalability**
- Supports unlimited projects without constraint conflicts
- No need to create separate token entries per project
- Reduces database bloat

## Testing

After applying the migration:

1. ✅ Add SPL token (mint: ABC) to Project 1 → Success
2. ✅ Add same SPL token (mint: ABC) to Project 2 → Success (was failing before)
3. ❌ Try to add same token (mint: ABC) twice to Project 1 → Fails with constraint violation
4. ✅ Edit existing token reward in Project 1 → Success

## Rollback (if needed)

```sql
-- Remove composite constraint
DROP INDEX IF EXISTS token_reward_percentages_project_mint_unique;

-- Restore global constraint
ALTER TABLE token_reward_percentages 
ADD CONSTRAINT token_reward_percentages_mint_address_key 
UNIQUE (mint_address);
```

**Note:** Rollback will break multi-project functionality again.

## Summary

- **SQL Migration:** Drop global constraint, add composite constraint
- **Backend Changes:** Minimal - ensure `project_id` is set (already done)
- **Result:** Same SPL token can be used across projects, duplicates prevented within project
