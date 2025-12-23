# Configuration Guide

## Environment Variables

Create a `.env.local` file in your project root with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## How to Get Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Copy the "Project URL" and "anon public" key
4. Replace the placeholder values in your `.env.local` file

## Example Configuration

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Important Notes

- Never commit your `.env.local` file to version control
- The `.env.local` file is already in `.gitignore`
- Make sure to restart your development server after adding environment variables
