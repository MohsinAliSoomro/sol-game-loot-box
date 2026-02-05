# Fix: NFT Jackpots Showing SOL Rewards Instead of NFT Rewards

## Problem
Users are receiving SOL rewards (1 SOL, 2 SOL) when they win NFT jackpots, instead of receiving the NFT itself. This happens because:

1. **NFT Detection Logic Fails**: The code checks if `jackpot_pools.image` is a mint address (32-44 chars, no slashes/dots), but we now store image URLs in the `image` column (from our recent fix to display NFT images).

2. **Missing Mint Address**: When creating NFT jackpots, we store the image URL but not the mint address, so when settling the jackpot, we can't identify it as an NFT jackpot.

3. **SOL Value Set Incorrectly**: When the detection fails, the code treats NFT jackpots as SOL/token jackpots and sets `sol` to the prize amount instead of `null`.

## Solution

### Immediate Fix (Applied)
1. **Improved NFT Detection**: Updated `app/api/jackpot/settle/route.ts` to:
   - Check if `image` is a mint address (old format)
   - If `image` is a URL, check existing `prizeWin` entries for `mint` field
   - Use `reward_type === 'nft'` from existing entries as a fallback

2. **Mint Address Retrieval**: When creating `prizeWin` entries for NFT jackpots:
   - If `image` is a mint address, use it directly
   - If `image` is a URL, check existing `prizeWin` entries for the mint address
   - Don't create `prizeWin` entry if mint address cannot be found

3. **SOL Value Fix**: Ensured `sol = null` for all NFT rewards (not the prize amount)

### Long-term Fix (Recommended)
**Store mint address when creating NFT jackpots:**

1. **Option A**: Add a `mint_address` column to `jackpot_pools` table
   ```sql
   ALTER TABLE jackpot_pools ADD COLUMN mint_address VARCHAR(255);
   ```

2. **Option B**: Store mint address in a separate metadata JSONB column
   ```sql
   ALTER TABLE jackpot_pools ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
   -- Store: metadata->>'mint_address'
   ```

3. **Update jackpot creation code** to store mint address:
   - In `spinloot_dashboard/src/Pages/JackpotSettings.jsx`: Store `selectedNFT.mint` in `mint_address` column
   - In `app/[projectSlug]/admin/jackpot-settings/page.tsx`: Store `selectedNFT.mint` in `mint_address` column
   - In `lib/hooks/useProjectJackpotPools.ts`: Store mint address when creating NFT jackpots

## Files Modified
- `app/api/jackpot/settle/route.ts` - Improved NFT detection and mint address retrieval
- `app/live-draw/[slug]/page.tsx` - Fixed NFT detection and mint address handling
- `app/[projectSlug]/live-draw/[slug]/page.tsx` - Fixed NFT detection and mint address handling

## Testing
1. Create a new NFT jackpot (should store mint address)
2. Wait for jackpot to expire
3. Verify winner receives NFT reward (not SOL reward)
4. Check `prizeWin` table: `sol` should be `NULL`, `mint` should be set, `reward_type` should be `'nft'`

## Notes
- Existing jackpots with image URLs (not mint addresses) will need their mint addresses stored separately
- The fix checks existing `prizeWin` entries to find mint addresses, but this is a workaround
- For new jackpots, we should store the mint address when creating them
