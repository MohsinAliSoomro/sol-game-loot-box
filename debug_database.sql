-- Debug Database Issues
-- Run this in Supabase SQL Editor to diagnose problems

-- 1. Check if tickets table exists and its structure
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tickets' 
ORDER BY ordinal_position;

-- 2. Check if ticketPurchase table exists and its structure
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'ticketPurchase' 
ORDER BY ordinal_position;

-- 3. Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('tickets', 'ticketPurchase');

-- 4. Check table permissions
SELECT 
    table_name,
    privilege_type,
    grantee
FROM information_schema.table_privileges 
WHERE table_name IN ('tickets', 'ticketPurchase');

-- 5. Check current data in tickets table
SELECT COUNT(*) as total_tickets FROM tickets;
SELECT * FROM tickets ORDER BY id;

-- 6. Check current data in ticketPurchase table
SELECT COUNT(*) as total_purchases FROM ticketPurchase;
SELECT * FROM ticketPurchase ORDER BY created_at DESC LIMIT 10;

-- 7. Test specific queries that are failing
-- Test query for ID 3
SELECT * FROM tickets WHERE id = 3;

-- Test query for ID 11
SELECT * FROM tickets WHERE id = 11;

-- Test query for ID 19
SELECT * FROM tickets WHERE id = 19;

-- Test query for ID 20
SELECT * FROM tickets WHERE id = 20;

-- 8. Check if there are any constraints or issues
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid IN (
    SELECT oid FROM pg_class WHERE relname IN ('tickets', 'ticketPurchase')
);
