-- Fix existing tokens: Set token_type for tokens that don't have it
-- This should be run after add_token_type_column.sql

-- First, ensure token_type column exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'project_tokens' AND column_name = 'token_type'
    ) THEN
        RAISE EXCEPTION 'token_type column does not exist. Please run add_token_type_column.sql first.';
    END IF;
END $$;

-- Set all default tokens as offchain (project native tokens)
UPDATE project_tokens 
SET token_type = 'offchain' 
WHERE is_default = true 
AND (token_type IS NULL OR token_type != 'offchain');

-- Set all non-default tokens as onchain (payment tokens)
-- Exclude tokens with mint_address = 'OFFCHAIN' (these are offchain tokens)
UPDATE project_tokens 
SET token_type = 'onchain' 
WHERE is_default = false 
AND (token_type IS NULL OR token_type != 'onchain')
AND mint_address != 'OFFCHAIN';

-- If a token has mint_address = 'OFFCHAIN', it's definitely offchain
UPDATE project_tokens 
SET token_type = 'offchain' 
WHERE mint_address = 'OFFCHAIN'
AND (token_type IS NULL OR token_type != 'offchain');

-- Verify: Show all tokens with their types
SELECT 
    id,
    project_id,
    name,
    symbol,
    token_type,
    is_default,
    is_active,
    mint_address
FROM project_tokens
ORDER BY project_id, token_type, is_default DESC;

