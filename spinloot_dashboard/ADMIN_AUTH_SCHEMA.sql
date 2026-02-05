-- Spinloot Dashboard Admin Table
-- Run this SQL in your Supabase SQL Editor

-- Create the admin table
CREATE TABLE IF NOT EXISTS spinloot_dashboard_admin (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE spinloot_dashboard_admin ENABLE ROW LEVEL SECURITY;

-- Create policy to allow reading for authentication (anon can check credentials)
CREATE POLICY "Allow anon to read admin for auth" ON spinloot_dashboard_admin
    FOR SELECT USING (true);

-- Insert default admin user
-- Default credentials: username: admin, password: admin123
-- Password is hashed using pgcrypto
INSERT INTO spinloot_dashboard_admin (username, password_hash)
VALUES ('admin', crypt('admin123', gen_salt('bf')))
ON CONFLICT (username) DO NOTHING;

-- Function to verify admin password
CREATE OR REPLACE FUNCTION verify_admin_password(p_username TEXT, p_password TEXT)
RETURNS TABLE (
    id UUID,
    username VARCHAR(50),
    is_valid BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.username,
        (a.password_hash = crypt(p_password, a.password_hash)) as is_valid
    FROM spinloot_dashboard_admin a
    WHERE a.username = p_username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
