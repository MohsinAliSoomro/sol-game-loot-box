-- Create jackpot_tickets table
CREATE TABLE IF NOT EXISTS jackpot_tickets (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pool_id INTEGER NOT NULL,
    ticket_count INTEGER NOT NULL DEFAULT 1,
    total_cost DECIMAL(20,8) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_jackpot_tickets_user_id ON jackpot_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_jackpot_tickets_pool_id ON jackpot_tickets(pool_id);
CREATE INDEX IF NOT EXISTS idx_jackpot_tickets_created_at ON jackpot_tickets(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE jackpot_tickets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own tickets" ON jackpot_tickets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tickets" ON jackpot_tickets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create jackpot_pools table if it doesn't exist
CREATE TABLE IF NOT EXISTS jackpot_pools (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    min_amount DECIMAL(20,8) DEFAULT 0,
    max_amount DECIMAL(20,8) DEFAULT 1000,
    current_amount DECIMAL(20,8) DEFAULT 0,
    contribution_rate DECIMAL(5,4) DEFAULT 0.01,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for jackpot_pools
ALTER TABLE jackpot_pools ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for jackpot_pools
CREATE POLICY "Anyone can view active jackpot pools" ON jackpot_pools
    FOR SELECT USING (is_active = true);

-- Insert a default jackpot pool if none exists
INSERT INTO jackpot_pools (id, name, description, min_amount, max_amount, current_amount, contribution_rate, is_active) 
VALUES (1, 'Mini Jackpot', 'Small daily jackpot for quick wins', 0.1, 10, 0.5, 0.01, true)
ON CONFLICT (id) DO NOTHING;
