-- Fix incorrect reward_type entries in prizeWin table
-- This script fixes entries where reward_type is 'sol' but sol is NULL (should be 'nft')
-- and entries where reward_type is 'sol' but mint is not NULL (should be 'nft')

-- Step 1: Fix entries where reward_type is 'sol' but sol is NULL and mint exists
-- These are clearly NFT rewards that were incorrectly classified
UPDATE "prizeWin"
SET reward_type = 'nft'
WHERE reward_type = 'sol'
  AND sol IS NULL
  AND mint IS NOT NULL;

-- Step 2: Fix entries where reward_type is 'sol' but sol is NULL and image is a mint address
-- (mint addresses are 32-44 characters, no slashes or dots)
UPDATE "prizeWin"
SET reward_type = 'nft'
WHERE reward_type = 'sol'
  AND sol IS NULL
  AND image IS NOT NULL
  AND LENGTH(image) >= 32
  AND LENGTH(image) <= 44
  AND image !~ '[./]'
  AND mint IS NULL; -- Only update if mint is not already set

-- Step 3: Fix entries where reward_type is 'sol' but there's a mint address in the image column
-- and we can extract it to the mint column
UPDATE "prizeWin"
SET 
  reward_type = 'nft',
  mint = image,
  sol = NULL
WHERE reward_type = 'sol'
  AND image IS NOT NULL
  AND LENGTH(image) >= 32
  AND LENGTH(image) <= 44
  AND image !~ '[./]'
  AND mint IS NULL;

-- Step 4: Log the changes
DO $$
DECLARE
  fixed_count INTEGER;
BEGIN
  -- Count how many entries were fixed
  SELECT COUNT(*) INTO fixed_count
  FROM "prizeWin"
  WHERE reward_type = 'nft'
    AND sol IS NULL;
  
  RAISE NOTICE '✅ Fixed reward_type entries. Total NFT rewards with sol=NULL: %', fixed_count;
END $$;

-- Verification query (run this to see what was fixed):
-- SELECT id, name, image, sol, mint, reward_type, "userId", created_at
-- FROM "prizeWin"
-- WHERE reward_type = 'nft' AND sol IS NULL
-- ORDER BY created_at DESC
-- LIMIT 20;
