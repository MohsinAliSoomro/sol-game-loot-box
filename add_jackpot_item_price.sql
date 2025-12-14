-- Add item_price column to jackpot_pools table
-- This column stores the OGX/token price that users will receive when they win an item jackpot prize
-- For main website: price in OGX
-- For sub-projects: price in project tokens

DO $$ 
BEGIN
    -- Check if jackpot_pools table exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'jackpot_pools'
    ) THEN
        -- Add item_price column if it doesn't exist
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'jackpot_pools' 
            AND column_name = 'item_price'
        ) THEN
            ALTER TABLE jackpot_pools 
            ADD COLUMN item_price DECIMAL(20, 8) NULL;
            
            COMMENT ON COLUMN jackpot_pools.item_price IS 'Price in OGX/tokens that user will receive if they win this jackpot (for item prizes only)';
            
            RAISE NOTICE 'Added item_price column to jackpot_pools table';
        ELSE
            RAISE NOTICE 'item_price column already exists in jackpot_pools table';
        END IF;
    ELSE
        RAISE NOTICE 'jackpot_pools table does not exist';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error adding item_price to jackpot_pools: %', SQLERRM;
END $$;

