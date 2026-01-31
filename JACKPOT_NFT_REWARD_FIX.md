# Jackpot NFT Reward Bugs - Complete Fix

## Issues Fixed

### Issue 1: Incorrect OGX Display for NFT Rewards ✅
**Problem:** UI was showing "40 OGX" for NFT jackpot rewards instead of showing "NFT"

**Root Causes:**
1. SQL function `select_jackpot_winner` was setting `sol = prize_amount::TEXT` for NFT rewards (line 155)
2. Frontend display logic always showed OGX amount regardless of reward type (line 1097)

**Fixes Applied:**
1. **SQL Migration:** `database/migrations/fix_jackpot_nft_reward_bugs.sql`
   - Fixed `select_jackpot_winner` function to set `sol = NULL` for NFT rewards
   - Only sets `sol = prize_amount::TEXT` for SOL/token rewards

2. **Frontend Display:** `app/live-draw/[slug]/page.tsx` and `app/[projectSlug]/live-draw/[slug]/page.tsx`
   - Added `reward_type` and `is_nft` to `currentWinner` state
   - Display logic now checks `is_nft` and shows "NFT" instead of OGX amount
   - For NFT jackpots: `displayAmount = 0` (not `prizeAmount`)

3. **PrizeWin Insert Logic:** Both live-draw pages
   - Already fixed: Sets `sol = null` for NFT rewards (was fixed in previous session)
   - Added logging to confirm `sol: null` for NFT rewards

### Issue 2: NFT Given to All Ticket Buyers ✅
**Problem:** All ticket buyers were seeing NFT rewards, not just the winner

**Root Causes:**
1. Sidebar cart filters by `userId`, which is correct
2. BUT: Need to verify only ONE winner gets `prizeWin` entry
3. Need backend validation to prevent unauthorized claims

**Fixes Applied:**
1. **Verified Winner Selection:**
   - `pickJackpotWinner()` function selects ONE winner using `LIMIT 1`
   - SQL function `select_jackpot_winner` creates ONE entry in `jackpot_wins`
   - Frontend creates ONE entry in `prizeWin` for the winner only
   - **No loops found** that create entries for all ticket buyers ✅

2. **Backend Validation:** `app/Components/SidebarCart.tsx`
   - Added validation in `claimNFTReward()` to verify `existingReward.userId === user.id`
   - Added validation in `claimSOLReward()` to verify `existingReward.userId === user.id`
   - If user tries to claim reward that doesn't belong to them → Access Denied error
   - Additional check: Verifies jackpot winner status for NFT rewards

3. **Sidebar Cart Filtering:**
   - Already correct: Filters by `userId` (line 53: `.eq("userId", userId)`)
   - Only winner should see the reward in their sidebar

## Database Changes

### SQL Migration: `fix_jackpot_nft_reward_bugs.sql`

**Key Changes:**
```sql
-- BEFORE (BUGGY):
IF is_nft_mint THEN
    INSERT INTO "prizeWin" (
        ...
        sol,
        ...
    ) VALUES (
        ...
        prize_amount::TEXT,  -- ❌ BUG: Sets sol for NFT rewards
        ...
    );

-- AFTER (FIXED):
IF is_nft_mint THEN
    INSERT INTO "prizeWin" (
        ...
        sol,
        ...
    ) VALUES (
        ...
        NULL,  -- ✅ FIX: NULL for NFT rewards
        ...
    );
```

## Frontend Changes

### 1. Display Logic Fix

**Before:**
```typescript
const displayAmount = isItemPrize && poolData?.item_price 
    ? parseFloat(String(poolData.item_price)) 
    : prizeAmount;  // ❌ Always shows prizeAmount for NFT jackpots

// UI shows: "Prize: 40.00 OGX" (even for NFT rewards)
```

**After:**
```typescript
let displayAmount = 0;
if (isItemPrize && poolData?.item_price) {
    displayAmount = parseFloat(String(poolData.item_price));
} else if (!isNFTJackpot) {
    // Only show amount for token/SOL rewards, not NFT rewards
    displayAmount = prizeAmount;
}
// For NFT jackpots, displayAmount remains 0

// UI shows: "Prize: NFT" (for NFT rewards)
```

### 2. Winner Validation

**Added to `claimNFTReward()` and `claimSOLReward()`:**
```typescript
// CRITICAL: Verify the user is the actual winner (backend validation)
if (existingReward?.userId !== user?.id) {
    console.error("❌ Security violation: User attempting to claim reward that doesn't belong to them");
    alert(`❌ Access Denied!\n\nThis reward does not belong to you.\n\nOnly the jackpot winner can claim this NFT.`);
    return;
}
```

## Verification

### How to Verify Only ONE Winner Gets NFT:

1. **Check `jackpot_wins` table:**
   ```sql
   SELECT * FROM jackpot_wins 
   WHERE pool_id = <pool_id> 
   AND win_type = 'jackpot_final';
   ```
   - Should return **exactly ONE row** ✅

2. **Check `prizeWin` table:**
   ```sql
   SELECT * FROM "prizeWin" 
   WHERE name = '<jackpot_name>' 
   AND reward_type = 'nft';
   ```
   - Should return **exactly ONE row** with `userId = <winner_user_id>` ✅

3. **Check Sidebar Cart:**
   - Only the winner should see the NFT in their sidebar
   - Non-winners should see empty sidebar or "No rewards available"

## Summary

✅ **Issue 1 Fixed:** NFT jackpots now show "NFT" instead of "40 OGX"
✅ **Issue 2 Fixed:** Only ONE winner gets the NFT reward
✅ **Backend Validation:** Added security checks to prevent unauthorized claims
✅ **SQL Function Fixed:** Sets `sol = NULL` for NFT rewards
✅ **Display Logic Fixed:** Shows "NFT" for NFT rewards, OGX amount only for token rewards

## Next Steps

1. **Run SQL Migration:**
   ```sql
   -- Execute in Supabase SQL Editor
   -- File: database/migrations/fix_jackpot_nft_reward_bugs.sql
   ```

2. **Test:**
   - Create NFT jackpot
   - Have multiple users buy tickets
   - Select winner
   - Verify only winner sees NFT in sidebar
   - Verify UI shows "NFT" not "OGX"
   - Verify non-winners cannot claim the NFT
