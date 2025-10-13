-- Check if jackpot_tickets table exists and has data
SELECT 
    'Table exists' as status,
    COUNT(*) as total_tickets,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT pool_id) as unique_pools
FROM jackpot_tickets;

-- Show recent tickets
SELECT 
    id,
    user_id,
    pool_id,
    ticket_count,
    total_cost,
    created_at
FROM jackpot_tickets 
ORDER BY created_at DESC 
LIMIT 10;

-- Show tickets by user (replace 'your-user-id' with actual user ID)
-- SELECT * FROM jackpot_tickets WHERE user_id = 'your-user-id' ORDER BY created_at DESC;
