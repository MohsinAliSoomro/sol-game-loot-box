-- =====================================================
-- CLEANUP: Remove Duplicate Jackpot NFT Prize Entries
-- =====================================================
-- This script removes duplicate prizeWin entries created by the bug
-- where ALL users who bought tickets received NFT rewards instead of
-- just the single winner.
-- 
-- RUN THIS AFTER deploying the fix to prevent new duplicates.
-- =====================================================

-- Step 1: Identify jackpot NFT prizes (mint address in image field)
-- These are prizes where the image is an NFT mint address (32-44 chars, no / or .)

-- Step 2: For each jackpot pool with NFT prize, keep only ONE prizeWin entry
-- The one to keep should be the actual winner from jackpot_wins table

-- First, let's see what duplicates exist (DRY RUN - just SELECT)
SELECT 
    pw.id,
    pw."userId",
    pw.name,
    pw.mint,
    pw.reward_type,
    pw."isWithdraw",
    pw.created_at,
    pw.project_id,
    jw.user_id as jackpot_winner_id,
    CASE WHEN pw."userId" = jw.user_id::TEXT THEN 'WINNER' ELSE 'NON-WINNER (DELETE)' END as status
FROM "prizeWin" pw
LEFT JOIN jackpot_pools jp ON jp.name = pw.name
LEFT JOIN jackpot_wins jw ON jw.pool_id = jp.id AND jw.win_type = 'jackpot_final'
WHERE pw.reward_type = 'nft'
  AND pw.mint IS NOT NULL
  AND LENGTH(pw.mint) >= 32
  AND LENGTH(pw.mint) <= 44
ORDER BY pw.name, pw.created_at;

-- Step 3: Delete non-winner prizeWin entries for jackpot NFTs
-- UNCOMMENT THE FOLLOWING TO ACTUALLY DELETE:

/*
DELETE FROM "prizeWin" 
WHERE id IN (
    SELECT pw.id
    FROM "prizeWin" pw
    INNER JOIN jackpot_pools jp ON jp.name = pw.name
    INNER JOIN jackpot_wins jw ON jw.pool_id = jp.id AND jw.win_type = 'jackpot_final'
    WHERE pw.reward_type = 'nft'
      AND pw.mint IS NOT NULL
      AND LENGTH(pw.mint) >= 32
      AND LENGTH(pw.mint) <= 44
      AND pw."userId" != jw.user_id::TEXT  -- Not the winner
);
*/

-- Step 4: Alternative - Delete ALL duplicate NFT prizes for a specific jackpot
-- keeping only the first one (oldest by created_at)
-- Use this if jackpot_wins doesn't have the winner recorded

/*
DELETE FROM "prizeWin" 
WHERE id IN (
    SELECT pw.id
    FROM "prizeWin" pw
    WHERE pw.reward_type = 'nft'
      AND pw.mint IS NOT NULL
      AND pw.id NOT IN (
          -- Keep the oldest entry for each mint+name combination
          SELECT MIN(id) 
          FROM "prizeWin" 
          WHERE reward_type = 'nft' AND mint IS NOT NULL
          GROUP BY mint, name, project_id
      )
);
*/

-- Step 5: Verify cleanup
SELECT 
    name,
    mint,
    COUNT(*) as entry_count,
    STRING_AGG("userId", ', ') as user_ids
FROM "prizeWin"
WHERE reward_type = 'nft' AND mint IS NOT NULL
GROUP BY name, mint, project_id
HAVING COUNT(*) > 1;

-- If the above returns no rows, cleanup is complete!

-- =====================================================
-- MANUAL CLEANUP for specific jackpot (GECKURA ELIXIR153)
-- =====================================================
-- Based on the screenshots, jackpot "GECKURA ELIXIR153" has duplicates

-- First, find the actual winner from jackpot_wins
SELECT jw.user_id, jw.pool_id, jw.created_at, jp.name
FROM jackpot_wins jw
JOIN jackpot_pools jp ON jp.id = jw.pool_id
WHERE jp.name LIKE '%GECKURA%' OR jp.name LIKE '%ELIXIR%'
AND jw.win_type = 'jackpot_final';

-- Then delete all prizeWin entries EXCEPT the winner
-- UNCOMMENT AND MODIFY with actual winner_user_id:

/*
DELETE FROM "prizeWin"
WHERE name LIKE '%GECKURA%'
  AND reward_type = 'nft'
  AND "userId" != 'ACTUAL_WINNER_USER_ID_HERE';
*/
