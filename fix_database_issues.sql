-- Fix Common Database Issues
-- Run this in Supabase SQL Editor

-- 1. Ensure tickets table exists with correct structure
CREATE TABLE IF NOT EXISTS tickets (
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

-- 2. Ensure ticketPurchase table exists with correct structure
CREATE TABLE IF NOT EXISTS ticketPurchase (
    id SERIAL PRIMARY KEY,
    ticketId INTEGER NOT NULL,
    userId VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    totalPrice DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Insert ticket with ID 3 if it doesn't exist
INSERT INTO tickets (id, title, description, price, image, endTime) VALUES
(3, 'Bronze Entry Ticket', 'An affordable ticket with good chances of winning. Great for beginners who want to try their luck without breaking the bank.', 25, '/coin.png', NOW() + INTERVAL '3 days')
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    image = EXCLUDED.image,
    endTime = EXCLUDED.endTime;

-- 4. Enable RLS
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticketPurchase ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view all tickets" ON tickets;
DROP POLICY IF EXISTS "Anyone can view active tickets" ON tickets;
DROP POLICY IF EXISTS "Anyone can view purchases" ON ticketPurchase;
DROP POLICY IF EXISTS "Anyone can insert purchases" ON ticketPurchase;

-- 6. Create new policies
CREATE POLICY "Allow all operations on tickets" ON tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on ticketPurchase" ON ticketPurchase FOR ALL USING (true) WITH CHECK (true);

-- 7. Grant all permissions
GRANT ALL ON tickets TO anon;
GRANT ALL ON tickets TO authenticated;
GRANT ALL ON ticketPurchase TO anon;
GRANT ALL ON ticketPurchase TO authenticated;
GRANT USAGE ON SEQUENCE tickets_id_seq TO anon;
GRANT USAGE ON SEQUENCE tickets_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE ticketpurchase_id_seq TO anon;
GRANT USAGE ON SEQUENCE ticketpurchase_id_seq TO authenticated;

-- 8. Verify the fix
SELECT 'Tickets table:' as status, COUNT(*) as count FROM tickets;
SELECT 'TicketPurchase table:' as status, COUNT(*) as count FROM ticketPurchase;
SELECT 'Ticket ID 3:' as status, * FROM tickets WHERE id = 3;
