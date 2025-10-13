-- Create jackpot_pools table
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

-- Create jackpot_tickets table
CREATE TABLE IF NOT EXISTS jackpot_tickets (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pool_id INTEGER NOT NULL REFERENCES jackpot_pools(id) ON DELETE CASCADE,
    ticket_count INTEGER NOT NULL DEFAULT 1,
    total_cost DECIMAL(20,8) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create jackpot_wins table
CREATE TABLE IF NOT EXISTS jackpot_wins (
    id SERIAL PRIMARY KEY,
    pool_id INTEGER NOT NULL REFERENCES jackpot_pools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(20,8) NOT NULL,
    win_type VARCHAR(50) DEFAULT 'jackpot',
    is_claimed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create jackpot_settings table
CREATE TABLE IF NOT EXISTS jackpot_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_jackpot_tickets_user_id ON jackpot_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_jackpot_tickets_pool_id ON jackpot_tickets(pool_id);
CREATE INDEX IF NOT EXISTS idx_jackpot_tickets_created_at ON jackpot_tickets(created_at);

CREATE INDEX IF NOT EXISTS idx_jackpot_wins_user_id ON jackpot_wins(user_id);
CREATE INDEX IF NOT EXISTS idx_jackpot_wins_pool_id ON jackpot_wins(pool_id);
CREATE INDEX IF NOT EXISTS idx_jackpot_wins_created_at ON jackpot_wins(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE jackpot_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE jackpot_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE jackpot_wins ENABLE ROW LEVEL SECURITY;
ALTER TABLE jackpot_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for jackpot_pools
CREATE POLICY "Anyone can view active jackpot pools" ON jackpot_pools
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admin can manage jackpot pools" ON jackpot_pools
    FOR ALL USING (auth.role() = 'service_role');

-- Create RLS policies for jackpot_tickets
CREATE POLICY "Users can view their own tickets" ON jackpot_tickets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tickets" ON jackpot_tickets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for jackpot_wins
CREATE POLICY "Users can view their own wins" ON jackpot_wins
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert wins" ON jackpot_wins
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own wins" ON jackpot_wins
    FOR UPDATE USING (auth.uid() = user_id);

-- Create RLS policies for jackpot_settings
CREATE POLICY "Anyone can view settings" ON jackpot_settings
    FOR SELECT USING (true);

CREATE POLICY "Admin can manage settings" ON jackpot_settings
    FOR ALL USING (auth.role() = 'service_role');

-- Insert default jackpot pools
INSERT INTO jackpot_pools (name, description, min_amount, max_amount, current_amount, contribution_rate, is_active) VALUES
('Mini Jackpot', 'Small daily jackpot for quick wins', 0.1, 10, 0.5, 0.01, true),
('Daily Jackpot', 'Daily jackpot with medium prizes', 1, 100, 5.0, 0.02, true),
('Weekly Jackpot', 'Weekly jackpot with big prizes', 10, 1000, 50.0, 0.05, true),
('Mega Jackpot', 'Monthly mega jackpot with huge prizes', 100, 10000, 500.0, 0.1, true)
ON CONFLICT DO NOTHING;

-- Insert default settings
INSERT INTO jackpot_settings (key, value, description) VALUES
('jackpot_win_chance', '0.001', 'Base win chance for jackpot (0.1%)'),
('ticket_price', '0.01', 'Price per jackpot ticket in SOL'),
('min_spin_amount', '0.1', 'Minimum spin amount to contribute to jackpot')
ON CONFLICT (key) DO NOTHING;
