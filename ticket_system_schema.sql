-- Ticket System Database Schema
-- Run this in your Supabase SQL editor

-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    image VARCHAR(500),
    endTime TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ticketPurchase table
CREATE TABLE IF NOT EXISTS ticketPurchase (
    id SERIAL PRIMARY KEY,
    ticketId INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    userId VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    totalPrice DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_active ON tickets(is_active);
CREATE INDEX IF NOT EXISTS idx_tickets_endtime ON tickets(endTime);
CREATE INDEX IF NOT EXISTS idx_ticketpurchase_ticketid ON ticketPurchase(ticketId);
CREATE INDEX IF NOT EXISTS idx_ticketpurchase_userid ON ticketPurchase(userId);

-- Enable Row Level Security (RLS)
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticketPurchase ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tickets table
CREATE POLICY IF NOT EXISTS "Anyone can view active tickets" ON tickets
    FOR SELECT USING (is_active = true);

CREATE POLICY IF NOT EXISTS "Authenticated users can view all tickets" ON tickets
    FOR SELECT USING (auth.role() = 'authenticated');

-- Create RLS policies for ticketPurchase table
CREATE POLICY IF NOT EXISTS "Users can view their own purchases" ON ticketPurchase
    FOR SELECT USING (auth.uid()::text = userId OR userId = auth.uid()::text);

CREATE POLICY IF NOT EXISTS "Users can insert their own purchases" ON ticketPurchase
    FOR INSERT WITH CHECK (auth.uid()::text = userId OR userId = auth.uid()::text);

-- Insert sample ticket data
INSERT INTO tickets (title, description, price, image, endTime) VALUES
('Golden Ticket', 'Win amazing prizes with this golden ticket!', 100, '/coin.png', NOW() + INTERVAL '7 days'),
('Silver Ticket', 'A silver ticket with great rewards.', 50, '/coin.png', NOW() + INTERVAL '5 days'),
('Bronze Ticket', 'Affordable ticket with good chances.', 25, '/coin.png', NOW() + INTERVAL '3 days')
ON CONFLICT DO NOTHING;

-- Grant necessary permissions
GRANT ALL ON tickets TO authenticated;
GRANT ALL ON ticketPurchase TO authenticated;
GRANT USAGE ON SEQUENCE tickets_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE ticketpurchase_id_seq TO authenticated;
