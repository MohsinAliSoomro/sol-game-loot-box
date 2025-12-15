# Vercel Deployment Guide

## Overview
Vercel deployment requires restructuring your Express app into serverless functions. This guide shows you how.

## Prerequisites
- GitHub account
- Vercel account (free at [vercel.com](https://vercel.com))
- Supabase credentials ready

## Step 1: Install Vercel CLI (Optional)

```bash
npm install -g vercel
```

## Step 2: Create Vercel Configuration

A `vercel.json` file has been created for you. It configures:
- Serverless function routing
- API routes
- Environment variables

## Step 3: Restructure for Vercel

### What Changed:
1. ✅ Created `api/index.js` - Serverless function handler
2. ✅ Created `vercel.json` - Vercel configuration
3. ✅ Original `server.js` remains for Railway/Render compatibility

### How It Works:
- Vercel uses `api/index.js` as the serverless entry point
- All routes are handled by a single serverless function
- Express app is exported as a handler (not using `app.listen()`)

## Step 4: Deploy on Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Configure project:
   - **Framework Preset:** Other
   - **Root Directory:** `backend` (if repo root is parent)
   - **Build Command:** Leave empty (or `npm install`)
   - **Output Directory:** Leave empty
   - **Install Command:** `npm install`

5. Add Environment Variables:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   JWT_SECRET=your-super-secret-key-min-32-characters
   JWT_EXPIRES_IN=7d
   NODE_ENV=production
   DOMAIN=yourdomain.com
   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

6. Click **"Deploy"**
7. Wait for deployment (~2-3 minutes)

### Option B: Via Vercel CLI

```bash
cd backend
vercel login
vercel
```

Follow prompts, then:
```bash
vercel --prod
```

## Step 5: Configure Custom Domain

1. In Vercel dashboard, go to your project
2. Click **"Settings"** → **"Domains"**
3. Add your domain
4. Follow DNS instructions

## Step 6: Update CORS Settings

Update `ALLOWED_ORIGINS` in Vercel environment variables to include:
- Your Vercel domain (`your-app.vercel.app`)
- Your custom domain
- Your frontend URL

## Step 7: Test Deployment

```bash
# Health check
curl https://your-app.vercel.app/health

# Test login
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

## Important Notes

### Execution Time Limits
- **Hobby:** 10 seconds per request
- **Pro:** 60 seconds per request
- **Enterprise:** 900 seconds per request

Your API should complete most requests well under 10 seconds.

### Cold Starts
- First request after inactivity: ~50-200ms delay
- Subsequent requests: Instant
- Not noticeable for most use cases

### Subdomain Routing
Vercel handles subdomains differently:
- Each subdomain needs its own deployment OR
- Use middleware to detect subdomain from `req.headers.host`
- Your `multiTenantMiddleware` already handles this!

## Troubleshooting

### Function Timeout
- Check for long-running operations
- Optimize database queries
- Consider upgrading to Pro plan (60s limit)

### Cold Start Issues
- Use Vercel Pro to reduce cold starts
- Consider keeping function warm with cron job

### Environment Variables Not Working
- Ensure variables are set in Vercel dashboard
- Redeploy after adding variables
- Check variable names match exactly

### Build Errors
- Check Node.js version (Vercel uses Node 18+ by default)
- Verify all dependencies are in `package.json`
- Check build logs in Vercel dashboard

## Cost
- **Hobby:** Free (generous limits)
- **Pro:** $20/month (better performance, 60s timeout)
- **Enterprise:** Custom pricing

## Monitoring
- View logs in Vercel dashboard
- Set up alerts in **"Settings"** → **"Monitoring"**
- Check function execution times

## Auto-Deploy
Vercel automatically deploys when you push to main branch!

## Next Steps
- Set up monitoring and alerts
- Configure edge functions (if needed)
- Set up preview deployments for PRs

## Reverting to Traditional Server

If you want to use Railway/Render instead:
- Just use `server.js` directly (no changes needed)
- Delete `api/index.js` and `vercel.json` if not using Vercel

