-- Add token_type column to project_tokens table
-- This distinguishes between off-chain project tokens and on-chain payment tokens

-- Add token_type column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'project_tokens' AND column_name = 'token_type'
    ) THEN
        ALTER TABLE project_tokens 
        ADD COLUMN token_type VARCHAR(20) DEFAULT 'onchain' 
        CHECK (token_type IN ('offchain', 'onchain'));
        
        -- Set existing default tokens as offchain
        UPDATE project_tokens 
        SET token_type = 'offchain' 
        WHERE is_default = true;
        
        -- Set all other tokens as onchain
        UPDATE project_tokens 
        SET token_type = 'onchain' 
        WHERE is_default = false OR is_default IS NULL;
        
        RAISE NOTICE 'Added token_type column to project_tokens table';
    ELSE
        RAISE NOTICE 'token_type column already exists';
    END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_project_tokens_type ON project_tokens(project_id, token_type);

-- Add constraint: Only one offchain token per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_tokens_one_offchain 
ON project_tokens(project_id) 
WHERE token_type = 'offchain' AND is_active = true;


