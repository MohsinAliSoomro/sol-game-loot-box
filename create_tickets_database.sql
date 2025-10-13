-- Create Tickets Database Tables
-- Run this in Supabase SQL Editor

-- Drop existing tables if they exist (be careful!)
DROP TABLE IF EXISTS ticketPurchase CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;

-- Create tickets table
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 100,
    image VARCHAR(500),
    endTime TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ticketPurchase table
CREATE TABLE ticketPurchase (
    id SERIAL PRIMARY KEY,
    ticketId INTEGER NOT NULL,
    userId VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    totalPrice DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample tickets
INSERT INTO tickets (id, title, description, price, image, endTime) VALUES
(1, 'Golden Jackpot Ticket', 'Win amazing prizes with this golden ticket! Participate in our exclusive jackpot draw and stand a chance to win incredible rewards. Each ticket gives you an equal chance to win the grand prize.', 100, '/coin.png', NOW() + INTERVAL '7 days'),
(2, 'Silver Lottery Ticket', 'A premium silver ticket with great rewards and higher chances of winning. Perfect for those who want to maximize their winning potential.', 50, '/coin.png', NOW() + INTERVAL '5 days'),
(3, 'Bronze Entry Ticket', 'An affordable ticket with good chances of winning. Great for beginners who want to try their luck without breaking the bank.', 25, '/coin.png', NOW() + INTERVAL '3 days'),
(4, 'Diamond VIP Ticket', 'Exclusive VIP ticket with premium rewards and special privileges. Limited quantity available!', 200, '/coin.png', NOW() + INTERVAL '10 days'),
(5, 'Platinum Elite Ticket', 'Ultra-premium ticket for serious players. Maximum rewards and exclusive access to special draws.', 500, '/coin.png', NOW() + INTERVAL '14 days');

-- Create indexes for better performance
CREATE INDEX idx_tickets_active ON tickets(is_active);
CREATE INDEX idx_tickets_endtime ON tickets(endTime);
CREATE INDEX idx_ticketpurchase_ticketid ON ticketPurchase(ticketId);
CREATE INDEX idx_ticketpurchase_userid ON ticketPurchase(userId);

-- Enable Row Level Security
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticketPurchase ENABLE ROW LEVEL SECURITY;

-- Create policies for tickets table
CREATE POLICY "Anyone can view active tickets" ON tickets
    FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can view all tickets" ON tickets
    FOR SELECT USING (true);

-- Create policies for ticketPurchase table
CREATE POLICY "Anyone can view purchases" ON ticketPurchase
    FOR SELECT USING (true);

CREATE POLICY "Anyone can insert purchases" ON ticketPurchase
    FOR INSERT WITH CHECK (true);

-- Grant permissions
GRANT ALL ON tickets TO anon;
GRANT ALL ON tickets TO authenticated;
GRANT ALL ON ticketPurchase TO anon;
GRANT ALL ON ticketPurchase TO authenticated;
GRANT USAGE ON SEQUENCE tickets_id_seq TO anon;
GRANT USAGE ON SEQUENCE tickets_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE ticketpurchase_id_seq TO anon;
GRANT USAGE ON SEQUENCE ticketpurchase_id_seq TO authenticated;

-- Verify the data was inserted
SELECT * FROM tickets ORDER BY id;
