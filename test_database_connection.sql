-- Test Database Connection
-- Run this in Supabase SQL Editor to verify tables exist

-- Check if tickets table exists and has data
SELECT 
    'tickets' as table_name,
    COUNT(*) as record_count,
    'Table exists' as status
FROM tickets
UNION ALL
SELECT 
    'ticketPurchase' as table_name,
    COUNT(*) as record_count,
    'Table exists' as status
FROM ticketPurchase;

-- Show all tickets
SELECT 
    id,
    title,
    price,
    endTime,
    is_active,
    created_at
FROM tickets 
ORDER BY id;

-- Show ticket purchases (if any)
SELECT 
    id,
    ticketId,
    userId,
    quantity,
    totalPrice,
    created_at
FROM ticketPurchase 
ORDER BY created_at DESC
LIMIT 10;
