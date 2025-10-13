-- Add image column to jackpot_pools table and insert images
-- Run this in Supabase SQL Editor

-- Add image column to jackpot_pools table if it doesn't exist
ALTER TABLE jackpot_pools 
ADD COLUMN IF NOT EXISTS image VARCHAR(255);

-- Update existing jackpot pools with images
UPDATE jackpot_pools 
SET image = 'livedraw1.jpg' 
WHERE id = 1;

UPDATE jackpot_pools 
SET image = 'livedraw2.jpg' 
WHERE id = 2;

UPDATE jackpot_pools 
SET image = 'livedraw3.jpg' 
WHERE id = 3;

-- Insert new jackpot pools with images if they don't exist
INSERT INTO jackpot_pools (id, name, description, current_amount, ticket_price, max_tickets, end_time, is_active, image) 
VALUES 
(1, 'Daily Jackpot', 'Win amazing prizes in our daily jackpot draw! Each ticket gives you an equal chance to win the grand prize.', 0, 100, 1000, NOW() + INTERVAL '1 day', true, 'livedraw1.jpg'),
(2, 'Weekly Mega Jackpot', 'Our biggest weekly jackpot with incredible rewards! Perfect for serious players.', 0, 500, 500, NOW() + INTERVAL '7 days', true, 'livedraw2.jpg'),
(3, 'Monthly Super Jackpot', 'The ultimate monthly jackpot with life-changing prizes! Limited time only.', 0, 1000, 200, NOW() + INTERVAL '30 days', true, 'livedraw3.jpg')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    current_amount = EXCLUDED.current_amount,
    ticket_price = EXCLUDED.ticket_price,
    max_tickets = EXCLUDED.max_tickets,
    end_time = EXCLUDED.end_time,
    is_active = EXCLUDED.is_active,
    image = EXCLUDED.image;

-- Verify the updates
SELECT id, name, image FROM jackpot_pools ORDER BY id;
