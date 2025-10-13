-- Add ticket with ID 3 to match the application queries
-- Run this in Supabase SQL Editor

INSERT INTO tickets (id, title, description, price, image, endTime) VALUES
(3, 'Bronze Entry Ticket', 'An affordable ticket with good chances of winning. Great for beginners who want to try their luck without breaking the bank.', 25, '/coin.png', NOW() + INTERVAL '3 days')
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    image = EXCLUDED.image,
    endTime = EXCLUDED.endTime;

-- Verify the ticket was added
SELECT * FROM tickets WHERE id = 3;
