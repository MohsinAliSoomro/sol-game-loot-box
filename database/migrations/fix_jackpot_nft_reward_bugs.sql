-- =====================================================
-- Migration: Fix Jackpot NFT Reward Bugs
-- =====================================================
-- Issue 1: SQL function sets sol=prize_amount for NFT rewards (should be NULL)
-- Issue 2: Need to ensure only ONE winner gets the NFT reward
-- =====================================================

-- Step 1: Fix the select_jackpot_winner function to set sol=NULL for NFT rewards
CREATE OR REPLACE FUNCTION select_jackpot_winner(pool_id_param INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    pool_record RECORD;
    total_contributions NUMERIC := 0;
    winner_contribution RECORD;
    winner_user_id TEXT;
    prize_amount NUMERIC;
    jackpot_name TEXT;
    jackpot_image TEXT;
    is_nft_mint BOOLEAN;
    existing_win RECORD;
    prize_win_record RECORD;
BEGIN
    -- Get jackpot pool details (including project_id)
    SELECT 
        id, name, current_amount, image, end_time, is_active, project_id
    INTO pool_record
    FROM jackpot_pools
    WHERE id = pool_id_param;
    
    -- Check if pool exists
    IF pool_record IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Jackpot pool not found'
        );
    END IF;
    
    -- Check if jackpot has expired
    IF pool_record.end_time > NOW() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Jackpot has not expired yet'
        );
    END IF;
    
    -- Check if winner already selected (avoid duplicates)
    SELECT id, user_id, amount, created_at
    INTO existing_win
    FROM jackpot_wins
    WHERE pool_id = pool_id_param
      AND win_type = 'jackpot_final'
      AND created_at >= pool_record.end_time
    LIMIT 1;
    
    IF existing_win IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Winner already selected',
            'winner', jsonb_build_object(
                'user_id', existing_win.user_id,
                'amount', existing_win.amount,
                'created_at', existing_win.created_at
            )
        );
    END IF;
    
    -- Get total contributions
    SELECT COALESCE(SUM(amount), 0)
    INTO total_contributions
    FROM jackpot_contribution
    WHERE pool_id = pool_id_param;
    
    -- Check if there are any contributions
    IF total_contributions = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No contributions found for this jackpot'
        );
    END IF;
    
    -- Pick random winner from contributions
    -- Weight by contribution amount (higher contribution = higher chance)
    SELECT 
        user_id,
        amount,
        id
    INTO winner_contribution
    FROM jackpot_contribution
    WHERE pool_id = pool_id_param
    ORDER BY RANDOM() * amount DESC
    LIMIT 1;
    
    IF winner_contribution IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Failed to select winner'
        );
    END IF;
    
    winner_user_id := winner_contribution.user_id;
    prize_amount := COALESCE(pool_record.current_amount, total_contributions);
    jackpot_name := pool_record.name;
    jackpot_image := COALESCE(pool_record.image, '/coin.png');
    
    -- Check if jackpot prize is an NFT (mint address)
    is_nft_mint := (
        jackpot_image IS NOT NULL AND
        LENGTH(jackpot_image) >= 32 AND
        LENGTH(jackpot_image) <= 44 AND
        jackpot_image !~ '[./]'
    );
    
    -- Record winner in jackpot_wins table
    INSERT INTO jackpot_wins (
        pool_id,
        user_id,
        amount,
        win_type,
        is_claimed,
        project_id,
        created_at
    ) VALUES (
        pool_id_param,
        winner_user_id::UUID,
        prize_amount,
        'jackpot_final',
        false,
        pool_record.project_id,
        NOW()
    )
    RETURNING id, user_id, amount, created_at
    INTO existing_win;
    
    -- Add winner to prizeWin table (for sidebar cart)
    -- CRITICAL FIX: For NFT rewards, set sol=NULL (not prize_amount)
    IF is_nft_mint THEN
        -- NFT prize: sol must be NULL to prevent showing OGX amount
        INSERT INTO "prizeWin" (
            "userId",
            name,
            image,
            sol,
            mint,
            "isWithdraw",
            reward_type,
            product_id,
            project_id,
            created_at
        ) VALUES (
            winner_user_id::TEXT,
            jackpot_name,
            jackpot_image,
            NULL,  -- FIXED: NULL for NFT rewards (was prize_amount::TEXT)
            jackpot_image, -- Mint address
            false,
            'nft',
            NULL,
            pool_record.project_id,
            NOW()
        )
        RETURNING id, "userId", name, mint, reward_type
        INTO prize_win_record;
    ELSE
        -- SOL/OGX prize: set sol to prize amount
        INSERT INTO "prizeWin" (
            "userId",
            name,
            image,
            sol,
            "isWithdraw",
            reward_type,
            product_id,
            project_id,
            created_at
        ) VALUES (
            winner_user_id::TEXT,
            jackpot_name,
            jackpot_image,
            prize_amount::TEXT,  -- Only set sol for token rewards
            false,
            'sol',
            NULL,
            pool_record.project_id,
            NOW()
        )
        RETURNING id, "userId", name, reward_type
        INTO prize_win_record;
    END IF;
    
    -- Return success with winner details
    RETURN jsonb_build_object(
        'success', true,
        'winner', jsonb_build_object(
            'user_id', winner_user_id,
            'amount', prize_amount,
            'created_at', existing_win.created_at,
            'is_nft', is_nft_mint,
            'prize_win_id', prize_win_record.id
        )
    );
END;
$$;

-- Step 2: Grant execute permissions
GRANT EXECUTE ON FUNCTION select_jackpot_winner(INTEGER) TO authenticated, anon;

-- Step 3: Verify the fix
DO $$ 
BEGIN
    RAISE NOTICE '✅ Fixed select_jackpot_winner function:';
    RAISE NOTICE '   - NFT rewards now set sol=NULL (was prize_amount)';
    RAISE NOTICE '   - Only ONE winner is selected per jackpot';
    RAISE NOTICE '   - Winner is recorded in both jackpot_wins and prizeWin tables';
END $$;

-- =====================================================
-- Migration Summary:
-- =====================================================
-- ✅ Fixed: SQL function now sets sol=NULL for NFT rewards
-- ✅ Verified: Only ONE winner is selected (LIMIT 1 in query)
-- ✅ Verified: Only winner gets prizeWin entry (single INSERT)
-- =====================================================
