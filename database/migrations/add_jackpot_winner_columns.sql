-- =====================================================
-- Migration: Add Winner Tracking Columns to jackpot_pools
-- =====================================================
-- CRITICAL FIX: Winner must be selected ONCE and saved permanently
-- This migration adds columns to ensure winner is NEVER recalculated
-- =====================================================

-- Step 1: Add winner tracking columns to jackpot_pools
-- These columns ensure winner is fixed permanently after first selection
ALTER TABLE jackpot_pools 
ADD COLUMN IF NOT EXISTS winner_user_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Step 2: Add nft_claimed column to jackpot_wins for NFT claim tracking
ALTER TABLE jackpot_wins
ADD COLUMN IF NOT EXISTS nft_claimed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS nft_claim_tx TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS nft_claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Step 3: Create index for faster winner lookups
CREATE INDEX IF NOT EXISTS idx_jackpot_pools_winner ON jackpot_pools(winner_user_id) WHERE winner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jackpot_pools_settled ON jackpot_pools(is_settled) WHERE is_settled = TRUE;

-- Step 4: Set default is_settled = false for existing pools that don't have it
UPDATE jackpot_pools SET is_settled = FALSE WHERE is_settled IS NULL;

-- Step 4: Create function to settle jackpot (backend-authoritative)
-- This function ensures ONLY ONE winner is selected atomically
CREATE OR REPLACE FUNCTION settle_jackpot_winner(
    p_pool_id INTEGER,
    p_project_id INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pool RECORD;
    v_winner_user_id TEXT;
    v_contribution RECORD;
    v_total_contributions NUMERIC;
    v_prize_amount NUMERIC;
    v_is_nft BOOLEAN;
    v_existing_prize RECORD;
BEGIN
    -- Lock the pool row to prevent concurrent settlements
    IF p_project_id IS NULL THEN
        SELECT * INTO v_pool
        FROM jackpot_pools
        WHERE id = p_pool_id AND project_id IS NULL
        FOR UPDATE;
    ELSE
        SELECT * INTO v_pool
        FROM jackpot_pools
        WHERE id = p_pool_id AND project_id = p_project_id
        FOR UPDATE;
    END IF;

    -- Check if pool exists
    IF v_pool IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Jackpot pool not found'
        );
    END IF;

    -- Check if already settled (IDEMPOTENT)
    IF v_pool.is_settled = TRUE AND v_pool.winner_user_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_settled', true,
            'winner_user_id', v_pool.winner_user_id,
            'message', 'Jackpot already settled'
        );
    END IF;

    -- Check if jackpot has expired
    IF v_pool.end_time > NOW() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Jackpot has not expired yet'
        );
    END IF;

    -- Get random winner from contributions
    IF p_project_id IS NULL THEN
        SELECT user_id, amount INTO v_contribution
        FROM jackpot_contribution
        WHERE pool_id = p_pool_id AND project_id IS NULL
        ORDER BY RANDOM()
        LIMIT 1;
    ELSE
        SELECT user_id, amount INTO v_contribution
        FROM jackpot_contribution
        WHERE pool_id = p_pool_id AND project_id = p_project_id
        ORDER BY RANDOM()
        LIMIT 1;
    END IF;

    -- Check if any contributions exist
    IF v_contribution IS NULL THEN
        -- Mark as settled with no winner
        UPDATE jackpot_pools
        SET is_settled = TRUE, settled_at = NOW()
        WHERE id = p_pool_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'no_winner', true,
            'message', 'No contributions found'
        );
    END IF;

    v_winner_user_id := v_contribution.user_id;

    -- Calculate total contributions
    IF p_project_id IS NULL THEN
        SELECT COALESCE(SUM(amount), 0) INTO v_total_contributions
        FROM jackpot_contribution
        WHERE pool_id = p_pool_id AND project_id IS NULL;
    ELSE
        SELECT COALESCE(SUM(amount), 0) INTO v_total_contributions
        FROM jackpot_contribution
        WHERE pool_id = p_pool_id AND project_id = p_project_id;
    END IF;

    -- Determine prize amount
    v_prize_amount := COALESCE(v_pool.item_price, v_total_contributions);

    -- Check if prize is NFT
    v_is_nft := (
        v_pool.image IS NOT NULL AND
        LENGTH(v_pool.image) >= 32 AND
        LENGTH(v_pool.image) <= 44 AND
        v_pool.image !~ '[./]'
    );

    -- ATOMICALLY update pool with winner
    UPDATE jackpot_pools
    SET 
        winner_user_id = v_winner_user_id,
        is_settled = TRUE,
        settled_at = NOW()
    WHERE id = p_pool_id
    AND (winner_user_id IS NULL OR is_settled = FALSE);

    -- Record in jackpot_wins
    INSERT INTO jackpot_wins (
        pool_id, user_id, amount, win_type, is_claimed, nft_claimed, project_id, created_at
    ) VALUES (
        p_pool_id, v_winner_user_id::UUID, v_prize_amount, 'jackpot_final', FALSE, FALSE, p_project_id, NOW()
    )
    ON CONFLICT DO NOTHING;

    -- Create prizeWin entry ONLY for winner
    IF p_project_id IS NULL THEN
        SELECT id INTO v_existing_prize
        FROM "prizeWin"
        WHERE "userId" = v_winner_user_id
        AND name = v_pool.name
        AND project_id IS NULL
        LIMIT 1;
    ELSE
        SELECT id INTO v_existing_prize
        FROM "prizeWin"
        WHERE "userId" = v_winner_user_id
        AND name = v_pool.name
        AND project_id = p_project_id
        LIMIT 1;
    END IF;

    IF v_existing_prize IS NULL THEN
        IF v_is_nft THEN
            INSERT INTO "prizeWin" (
                "userId", name, image, sol, mint, "isWithdraw", reward_type, product_id, project_id, created_at
            ) VALUES (
                v_winner_user_id, v_pool.name, v_pool.image, NULL, v_pool.image, FALSE, 'nft', NULL, p_project_id, NOW()
            );
        ELSE
            INSERT INTO "prizeWin" (
                "userId", name, image, sol, "isWithdraw", reward_type, product_id, project_id, created_at
            ) VALUES (
                v_winner_user_id, v_pool.name, v_pool.image, v_prize_amount::TEXT, FALSE, 'sol', NULL, p_project_id, NOW()
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'winner_user_id', v_winner_user_id,
        'prize_amount', v_prize_amount,
        'is_nft', v_is_nft,
        'nft_mint', CASE WHEN v_is_nft THEN v_pool.image ELSE NULL END
    );
END;
$$;

-- Step 5: Grant execute permissions
GRANT EXECUTE ON FUNCTION settle_jackpot_winner(INTEGER, INTEGER) TO authenticated, anon;

-- Step 6: Create function to check if user is winner
CREATE OR REPLACE FUNCTION check_jackpot_winner(
    p_pool_id INTEGER,
    p_user_id TEXT,
    p_project_id INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pool RECORD;
    v_is_winner BOOLEAN;
    v_is_nft BOOLEAN;
BEGIN
    IF p_project_id IS NULL THEN
        SELECT * INTO v_pool
        FROM jackpot_pools
        WHERE id = p_pool_id AND project_id IS NULL;
    ELSE
        SELECT * INTO v_pool
        FROM jackpot_pools
        WHERE id = p_pool_id AND project_id = p_project_id;
    END IF;

    IF v_pool IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Pool not found'
        );
    END IF;

    v_is_winner := (v_pool.winner_user_id = p_user_id);
    v_is_nft := (
        v_pool.image IS NOT NULL AND
        LENGTH(v_pool.image) >= 32 AND
        LENGTH(v_pool.image) <= 44 AND
        v_pool.image !~ '[./]'
    );

    RETURN jsonb_build_object(
        'success', true,
        'is_settled', v_pool.is_settled,
        'has_winner', v_pool.winner_user_id IS NOT NULL,
        'is_winner', v_is_winner,
        'winner_user_id', v_pool.winner_user_id,
        'is_nft', v_is_nft,
        'nft_mint', CASE WHEN v_is_nft AND v_is_winner THEN v_pool.image ELSE NULL END,
        'can_claim', v_is_winner AND v_pool.is_settled
    );
END;
$$;

GRANT EXECUTE ON FUNCTION check_jackpot_winner(INTEGER, TEXT, INTEGER) TO authenticated, anon;

-- Step 7: Verification
DO $$ 
BEGIN
    RAISE NOTICE '✅ Migration complete: Jackpot winner tracking columns added';
    RAISE NOTICE '   - winner_user_id: Stores the single winner';
    RAISE NOTICE '   - is_settled: Prevents multiple settlements';
    RAISE NOTICE '   - settled_at: Timestamp of settlement';
    RAISE NOTICE '   - nft_claimed: Tracks NFT claim status in jackpot_wins';
    RAISE NOTICE '   - settle_jackpot_winner(): Atomic settlement function';
    RAISE NOTICE '   - check_jackpot_winner(): Winner verification function';
END $$;
