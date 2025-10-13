-- Quick Fix for Jackpot System
-- Run this in Supabase SQL Editor

-- Drop existing tables if they exist
DROP TABLE IF EXISTS jackpot_tickets CASCADE;
DROP TABLE IF EXISTS jackpot_pools CASCADE;

-- Create jackpot_pools table
CREATE TABLE jackpot_pools (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    current_amount DECIMAL(15,6) NOT NULL DEFAULT 0,
    ticket_price DECIMAL(10,2) NOT NULL DEFAULT 100,
    max_tickets INTEGER DEFAULT 1000,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create jackpot_tickets table
CREATE TABLE jackpot_tickets (
    id SERIAL PRIMARY KEY,
    pool_id INTEGER NOT NULL REFERENCES jackpot_pools(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    ticket_count INTEGER NOT NULL DEFAULT 1,
    total_cost DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert jackpot pools with proper prices
INSERT INTO jackpot_pools (id, name, description, current_amount, ticket_price, max_tickets, end_time) VALUES
(1, 'Daily Jackpot', 'Win amazing prizes in our daily jackpot draw! Each ticket gives you an equal chance to win the grand prize.', 0, 100, 1000, NOW() + INTERVAL '1 day'),
(2, 'Weekly Mega Jackpot', 'Our biggest weekly jackpot with incredible rewards! Perfect for serious players.', 0, 500, 500, NOW() + INTERVAL '7 days'),
(3, 'Monthly Super Jackpot', 'The ultimate monthly jackpot with life-changing prizes! Limited time only.', 0, 1000, 200, NOW() + INTERVAL '30 days');

-- Enable RLS
ALTER TABLE jackpot_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE jackpot_tickets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all operations on jackpot_pools" ON jackpot_pools FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on jackpot_tickets" ON jackpot_tickets FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON jackpot_pools TO anon;
GRANT ALL ON jackpot_pools TO authenticated;
GRANT ALL ON jackpot_tickets TO anon;
GRANT ALL ON jackpot_tickets TO authenticated;
GRANT USAGE ON SEQUENCE jackpot_pools_id_seq TO anon;
GRANT USAGE ON SEQUENCE jackpot_pools_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE jackpot_tickets_id_seq TO anon;
GRANT USAGE ON SEQUENCE jackpot_tickets_id_seq TO authenticated;

-- Verify the data
SELECT 'Jackpot pools created:' as status, COUNT(*) as count FROM jackpot_pools;
SELECT id, name, ticket_price, end_time FROM jackpot_pools ORDER BY id;
