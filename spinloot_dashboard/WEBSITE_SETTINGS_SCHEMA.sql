-- Website Settings Schema for Supabase
-- This schema creates tables to store website logo, slider images, and theme settings

-- Table: website_settings
-- Stores key-value pairs for website settings (logo, theme, etc.)
CREATE TABLE IF NOT EXISTS website_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: slider_images
-- Stores landing page slider images with ordering and active status
CREATE TABLE IF NOT EXISTS slider_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  image_path TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on slider_images for better query performance
CREATE INDEX IF NOT EXISTS idx_slider_images_order ON slider_images(order_index);
CREATE INDEX IF NOT EXISTS idx_slider_images_active ON slider_images(is_active);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist (to avoid conflicts)
DROP TRIGGER IF EXISTS update_website_settings_updated_at ON website_settings;
DROP TRIGGER IF EXISTS update_slider_images_updated_at ON slider_images;

-- Trigger to auto-update updated_at for website_settings
CREATE TRIGGER update_website_settings_updated_at
    BEFORE UPDATE ON website_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-update updated_at for slider_images
CREATE TRIGGER update_slider_images_updated_at
    BEFORE UPDATE ON slider_images
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
-- Enable RLS on both tables
ALTER TABLE website_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE slider_images ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public read access to website_settings" ON website_settings;
DROP POLICY IF EXISTS "Allow authenticated users to modify website_settings" ON website_settings;
DROP POLICY IF EXISTS "Allow all operations on website_settings" ON website_settings;
DROP POLICY IF EXISTS "Allow public read access to slider_images" ON slider_images;
DROP POLICY IF EXISTS "Allow authenticated users to modify slider_images" ON slider_images;
DROP POLICY IF EXISTS "Allow all operations on slider_images" ON slider_images;

-- Policy: Allow all operations on website_settings (for admin dashboard)
-- Since this is an admin dashboard, we allow all operations without auth checks
CREATE POLICY "Allow all operations on website_settings"
  ON website_settings FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policy: Allow all operations on slider_images (for admin dashboard)
-- Since this is an admin dashboard, we allow all operations without auth checks
CREATE POLICY "Allow all operations on slider_images"
  ON slider_images FOR ALL
  USING (true)
  WITH CHECK (true);

-- Insert default settings
INSERT INTO website_settings (key, value)
VALUES 
  ('theme', '{"primaryColor":"#FF6B35","secondaryColor":"#004E89","backgroundColor":"#FFFFFF","textColor":"#1F2937","fontFamily":"Waltograph"}'),
  ('lootbox', '{"boxBackgroundColor":"#FFFFFF"}'),
  ('wheel', '{"segmentFillColor":"#ff914d","segmentStrokeColor":"#f74e14","buttonBackgroundColor":"#f74e14","buttonHoverColor":"#e63900","pointerColor":"#f74e14","textColor":"#ffffff"}'),
  ('logo', NULL)
ON CONFLICT (key) DO NOTHING;

-- Note: The logo value will be NULL until you upload a logo through the dashboard.
-- After uploading, it will contain the path to the logo file in storage (e.g., 'website/logo/logo-1234567890.png')

-- Note: Lootboxes are stored in the 'products' table
-- Rewards for each lootbox are stored in the 'token_reward_percentages' table

-- Instructions:
-- 1. Run this SQL script in your Supabase SQL Editor
-- 2. Make sure you have a storage bucket named 'apes-bucket' (or update the bucket name in WebsiteSettings.jsx)
-- 3. Set up proper storage policies for the 'apes-bucket' to allow uploads
-- 4. Adjust RLS policies if you have a custom authentication system

