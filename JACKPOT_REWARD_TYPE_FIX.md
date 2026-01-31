# Jackpot Reward Type Bug Fix

## Problem

When a jackpot is configured with an **NFT reward only**, users were incorrectly receiving **40 OGX tokens** in addition to the NFT reward in the sidebar.

**Root Cause:**
The jackpot win handling logic was setting `sol: String(prizeAmount)` for **all** jackpot rewards, including NFT-only jackpots. This caused the sidebar to show both the NFT and a token reward, even though the jackpot was configured as NFT-only.

## Solution

### Backend Logic Changes

**Files Modified:**
- `app/live-draw/[slug]/page.tsx` (Main project)
- `app/[projectSlug]/live-draw/[slug]/page.tsx` (Sub-projects)

**Changes:**
1. **Strict reward type checking:** Only set `sol` field for SOL/token rewards, NOT for NFT rewards
2. **Conditional `sol` field:** 
   - For NFT jackpots: `sol = null` (explicitly null)
   - For SOL/token jackpots: `sol = String(prizeAmount)`
3. **Added validation logging:** Console logs now confirm which reward type is being created

**Before (Buggy Code):**
```typescript
const prizeWinInsert: any = {
    userId: winner.user_id,
    name: jackpotName,
    image: jackpotImage,
    sol: String(prizeAmount), // ❌ BUG: Always set, even for NFT rewards
    reward_type: rewardType,
    // ...
};

if (isNFTJackpot) {
    prizeWinInsert.mint = poolData.image;
}
```

**After (Fixed Code):**
```typescript
const prizeWinInsert: any = {
    userId: winner.user_id,
    name: jackpotName,
    image: jackpotImage,
    // sol field is NOT set here - set conditionally below
    reward_type: rewardType,
    // ...
};

if (isNFTJackpot) {
    prizeWinInsert.sol = null; // ✅ Explicitly null for NFT rewards
    prizeWinInsert.mint = poolData.image;
} else {
    prizeWinInsert.sol = String(prizeAmount); // ✅ Only set for SOL/token rewards
}
```

### Frontend Fix (Sidebar Rendering)

**File:** `app/Components/SidebarCart.tsx`

**Status:** ✅ Already correct - sidebar filtering logic was already working properly

The sidebar correctly filters rewards by `reward_type`:
- NFT rewards: `reward_type === 'nft'` → shown in NFT section
- SOL rewards: `reward_type === 'sol'` → shown in SOL section
- Token rewards: `reward_type === 'token'` → shown in Token section

The bug was in the **data creation**, not the rendering.

## Why This Fix Works

### 1. **Strict Reward Type Separation**
- NFT jackpots: Only create NFT reward entries (`reward_type: 'nft'`, `sol: null`, `mint: <address>`)
- Token jackpots: Only create token reward entries (`reward_type: 'sol'`, `sol: <amount>`, no `mint`)

### 2. **Database-Level Consistency**
- `sol` field is now `null` for NFT rewards, preventing any token amount from being displayed
- Sidebar filtering by `reward_type` ensures only the correct reward type is shown

### 3. **Prevents Reward Mixing**
- No default/fallback token logic runs for NFT jackpots
- Each jackpot reward is created based strictly on the jackpot's configured reward type

## Testing

After applying the fix:

1. ✅ **NFT-only jackpot:** User should see ONLY the NFT in sidebar, no token reward
2. ✅ **Token-only jackpot:** User should see ONLY the token amount in sidebar, no NFT
3. ✅ **Mixed jackpots:** (If supported) Both rewards should appear, but only if explicitly configured

## Summary

- **Root Cause:** `sol` field was being set for all jackpot rewards, including NFT-only jackpots
- **Fix:** Conditionally set `sol` field only for SOL/token rewards; set to `null` for NFT rewards
- **Result:** NFT-only jackpots now correctly show only the NFT reward, no extra tokens
