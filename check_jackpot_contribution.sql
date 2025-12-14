-- Diagnostic script to check jackpot_contribution table setup
-- Run this in Supabase SQL Editor to verify everything is set up correctly

-- 1. Check if table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'jackpot_contribution'
) AS table_exists;

-- 2. Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'jackpot_contribution'
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
WHERE tablename = 'jackpot_contribution';

-- 4. Check if RLS is enabled
SELECT 
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename = 'jackpot_contribution';

-- 5. Count existing contributions
SELECT COUNT(*) as total_contributions FROM jackpot_contribution;

-- 6. Show recent contributions
SELECT * FROM jackpot_contribution 
ORDER BY created_at DESC 
LIMIT 10;

