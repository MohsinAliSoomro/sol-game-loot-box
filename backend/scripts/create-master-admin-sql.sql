-- ============================================================
-- CREATE MASTER ADMIN - SQL VERSION
-- ============================================================
-- Use this if you prefer to create the admin directly in SQL
-- 
-- IMPORTANT: Replace 'your-password-here' with your actual password hash
-- To generate a password hash, run:
--   node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('yourpassword', 10).then(console.log);"
-- ============================================================

-- Option 1: Create new master admin
INSERT INTO master_admins (email, password_hash, full_name, role, is_active)
VALUES (
    'admin@spinloot.com',  -- Change this email
    '$2a$10$YourHashedPasswordHere',  -- Replace with bcrypt hash (see instructions above)
    'Master Admin',  -- Optional: Change full name
    'master_admin',
    true
)
ON CONFLICT (email) DO UPDATE
SET 
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    is_active = true,
    updated_at = CURRENT_TIMESTAMP;

-- Option 2: Update existing admin password
-- UPDATE master_admins
-- SET 
--     password_hash = '$2a$10$YourHashedPasswordHere',  -- Replace with bcrypt hash
--     updated_at = CURRENT_TIMESTAMP
-- WHERE email = 'admin@spinloot.com';

-- Verify the admin was created
SELECT id, email, full_name, role, is_active, created_at
FROM master_admins
WHERE email = 'admin@spinloot.com';

