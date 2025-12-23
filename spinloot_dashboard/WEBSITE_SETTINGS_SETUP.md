# Website Settings Setup Guide

This guide explains how to set up the Website Settings feature in the Spinloot Dashboard.

## Features

The Website Settings page allows admins to manage:
1. **Website Logo** - Upload and update the website logo stored in Supabase Storage
2. **Landing Page Slider Images** - Add, reorder, activate/deactivate slider images
3. **Theme Settings** - Customize colors and font family for the website

## Setup Instructions

### 1. Database Setup

Run the SQL script in `WEBSITE_SETTINGS_SCHEMA.sql` in your Supabase SQL Editor:

```bash
# Access your Supabase dashboard
# Go to SQL Editor
# Copy and paste the contents of WEBSITE_SETTINGS_SCHEMA.sql
# Execute the script
```

This will create:
- `website_settings` table - stores logo path and theme settings
- `slider_images` table - stores slider images with ordering
- Necessary indexes and triggers
- Row Level Security (RLS) policies

### 2. Storage Bucket Setup

Make sure you have a storage bucket named `apes-bucket` in your Supabase Storage:

1. Go to Storage in your Supabase dashboard
2. If `apes-bucket` doesn't exist, create it
3. Set up storage policies to allow:
   - Public read access (for images to be displayed)
   - Authenticated write access (for admin uploads)

Example Storage Policy (adjust based on your auth setup):

```sql
-- Allow public read access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'apes-bucket' );

-- Allow authenticated users to upload
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'apes-bucket' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update
CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'apes-bucket' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'apes-bucket' 
  AND auth.role() = 'authenticated'
);
```

### 3. Access the Feature

1. Start your dashboard application
2. Navigate to the sidebar
3. Click on "Website Settings"
4. You'll see three sections:
   - Website Logo
   - Landing Page Slider Images
   - Theme Settings

## Usage

### Uploading Logo

1. Click "Choose File" under Website Logo section
2. Select an image file (PNG, SVG, JPG recommended)
3. Click "Upload Logo"
4. The logo will be stored in `apes-bucket/website/logo/` folder

### Managing Slider Images

1. **Add New Slider:**
   - Click "Choose File" under Landing Page Slider Images
   - Select an image
   - Click "Add Slider Image"

2. **Reorder Sliders:**
   - Change the order number in the input field
   - The order will update automatically

3. **Activate/Deactivate:**
   - Toggle the checkbox to show/hide a slider

4. **Delete Slider:**
   - Click the "Delete" button next to a slider image
   - Confirm the deletion

### Theme Settings

1. Modify any of the theme colors using:
   - Color picker (click the color box)
   - Or enter hex color code directly

2. Select a font family from the dropdown

3. Preview your changes in the preview box

4. Click "Save Theme Settings" to apply

## Data Structure

### website_settings Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| key | TEXT | Setting key (e.g., 'logo', 'theme') |
| value | TEXT | Setting value (JSON for theme, path for logo) |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### slider_images Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| image_path | TEXT | Path to image in storage |
| order_index | INTEGER | Display order (1 = first) |
| is_active | BOOLEAN | Whether slider is active |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

## Integration with Main Website

To use these settings in your main Spinloot website, you'll need to:

1. Fetch settings from Supabase:
   ```javascript
   // Get logo
   const { data: logoData } = await supabase
     .from('website_settings')
     .select('value')
     .eq('key', 'logo')
     .single();

   // Get theme
   const { data: themeData } = await supabase
     .from('website_settings')
     .select('value')
     .eq('key', 'theme')
     .single();

   // Get slider images
   const { data: sliders } = await supabase
     .from('slider_images')
     .select('*')
     .eq('is_active', true)
     .order('order_index', { ascending: true });
   ```

2. Apply theme settings dynamically:
   ```javascript
   const theme = JSON.parse(themeData.value);
   document.documentElement.style.setProperty('--primary-color', theme.primaryColor);
   document.documentElement.style.setProperty('--secondary-color', theme.secondaryColor);
   // etc.
   ```

## Troubleshooting

### Images not displaying
- Check that storage bucket has public read access
- Verify the image paths are correct in the database
- Check browser console for CORS errors

### Upload fails
- Ensure authenticated user has write permissions
- Check file size limits
- Verify storage bucket exists and is accessible

### Theme not saving
- Check RLS policies allow authenticated writes
- Verify JSON format is correct
- Check browser console for errors

## Notes

- Images are stored in the `apes-bucket` storage bucket
- Logo files are stored in `website/logo/` folder
- Slider images are stored in `website/slider/` folder
- Theme settings are stored as JSON in the database
- The feature requires authenticated access (adjust RLS policies as needed)

