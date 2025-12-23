-- Quick fix for RLS policies to allow all operations
-- Run this in Supabase SQL Editor to fix the upload permission error

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow public read access to website_settings" ON website_settings;
DROP POLICY IF EXISTS "Allow authenticated users to modify website_settings" ON website_settings;
DROP POLICY IF EXISTS "Allow all operations on website_settings" ON website_settings;
DROP POLICY IF EXISTS "Allow public read access to slider_images" ON slider_images;
DROP POLICY IF EXISTS "Allow authenticated users to modify slider_images" ON slider_images;
DROP POLICY IF EXISTS "Allow all operations on slider_images" ON slider_images;

-- Create permissive policies for admin dashboard
-- This allows all operations (SELECT, INSERT, UPDATE, DELETE) without authentication checks
CREATE POLICY "Allow all operations on website_settings"
  ON website_settings FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on slider_images"
  ON slider_images FOR ALL
  USING (true)
  WITH CHECK (true);

