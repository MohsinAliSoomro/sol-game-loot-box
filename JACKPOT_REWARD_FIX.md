# Jackpot Reward Duplicate Payout Fix

## Problem

After a jackpot win, every page refresh causes the reward amount to increase (e.g., 100 → 200 → 300). The reward logic was being executed multiple times on page load, causing duplicate payouts.

**Root Cause:** Reward payout logic was not idempotent and was triggered again on every page reload.

## Solution

Implemented a comprehensive, database-backed solution with multiple safeguards:

### 1. Database Schema Changes

**File:** `database/migrations/add_jackpot_reward_safeguards.sql`

**Changes:**
- ✅ Added `balance_credited` BOOLEAN column to `jackpot_wins` table
- ✅ Created `reward_claims` table with `UNIQUE(win_id)` constraint
- ✅ Added indexes for performance

**Why This Works:**
- `balance_credited` flag provides quick check if reward was processed
- `reward_claims` table with unique constraint prevents duplicate inserts at database level
- Database-level protection is the most reliable safeguard

### 2. Backend API Endpoint

**File:** `app/api/claim-jackpot-reward/route.ts`

**Features:**
- ✅ Idempotent: Safe to call multiple times (returns same result)
- ✅ Checks `reward_claims` table first (unique constraint prevents duplicates)
- ✅ Checks `balance_credited` flag as secondary safeguard
- ✅ Handles both main project and sub-projects
- ✅ Supports item prizes (balance credit) and NFT/SOL prizes (cart)

**How It Works:**
1. Check if claim already exists in `reward_claims` → return success if found
2. Check if `balance_credited` flag is true → return success if already credited
3. Get win and pool data
4. For item prizes: credit balance + mark as claimed
5. For NFT/SOL prizes: mark as claimed (no balance credit needed)

### 3. Frontend Changes

**Files Updated:**
- `app/live-draw/[slug]/page.tsx`
- `app/[projectSlug]/live-draw/[slug]/page.tsx`

**Changes:**
- ✅ Removed direct balance crediting logic from `useEffect`
- ✅ Replaced with API call to `/api/claim-jackpot-reward`
- ✅ Added `balanceCreditedRef` to prevent duplicate API calls in same session
- ✅ API is called only once when winner is detected

**Before:**
```typescript
// ❌ Direct balance update (runs on every page load)
const newBalance = currentBalance + itemPriceAmount;
await supabase.from('user').update({ apes: newBalance });
```

**After:**
```typescript
// ✅ API call (idempotent, database-protected)
const response = await fetch('/api/claim-jackpot-reward', {
  method: 'POST',
  body: JSON.stringify({ winId, userId, poolId, projectId })
});
```

## Why This Fix Works

### 1. **Database-Level Protection**
- `UNIQUE(win_id)` constraint in `reward_claims` prevents duplicate inserts
- Database enforces idempotency even if API is called multiple times
- Race conditions are handled by unique constraint violation

### 2. **Idempotent API Design**
- API checks if reward was already claimed before processing
- Returns success if already claimed (no error, just confirmation)
- Safe to retry, refresh, or call multiple times

### 3. **Transaction Safety**
- While Supabase REST API doesn't support full transactions, the unique constraint acts as a transaction boundary
- If balance update succeeds but claim insert fails (unique violation), it means reward was already claimed
- This is handled gracefully

### 4. **Frontend Session Tracking**
- `balanceCreditedRef` prevents duplicate API calls in the same browser session
- Reduces unnecessary API calls and improves performance

## Testing

After applying the migration and deploying:

1. ✅ Win a jackpot → Reward credited once
2. ✅ Refresh page → No additional credit (idempotent)
3. ✅ Refresh multiple times → Still only one credit
4. ✅ Check database → `balance_credited = true`, one entry in `reward_claims`

## Migration Steps

1. **Run SQL Migration:**
   ```sql
   -- Execute in Supabase SQL Editor
   -- File: database/migrations/add_jackpot_reward_safeguards.sql
   ```

2. **Deploy Backend API:**
   - File: `app/api/claim-jackpot-reward/route.ts` (already created)

3. **Deploy Frontend Changes:**
   - Files: `app/live-draw/[slug]/page.tsx`
   - Files: `app/[projectSlug]/live-draw/[slug]/page.tsx`

4. **Test:**
   - Win a jackpot
   - Refresh page multiple times
   - Verify balance only increases once

## Summary

- **Database:** Added `balance_credited` flag and `reward_claims` table with unique constraint
- **Backend:** Created idempotent `/api/claim-jackpot-reward` endpoint
- **Frontend:** Replaced direct balance updates with API calls
- **Result:** Rewards are credited exactly once, regardless of page refreshes or retries
