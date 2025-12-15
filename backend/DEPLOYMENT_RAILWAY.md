# Railway Deployment Guide

## Overview
Railway is the **easiest** deployment option - zero code changes required!

## Prerequisites
- GitHub account
- Railway account (free at [railway.app](https://railway.app))
- Supabase credentials ready

## Step 1: Prepare Your Repository

1. Ensure your code is pushed to GitHub
2. Make sure `.env` is in `.gitignore` (don't commit secrets!)

## Step 2: Deploy on Railway

### 2.1 Create New Project
1. Go to [railway.app](https://railway.app) and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository
5. Railway will auto-detect it's a Node.js project

### 2.2 Configure Environment Variables
1. Click on your service
2. Go to **"Variables"** tab
3. Add all your environment variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-super-secret-key-min-32-characters
JWT_EXPIRES_IN=7d
NODE_ENV=production
PORT=3001
DOMAIN=yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### 2.3 Configure Build Settings
Railway should auto-detect, but verify:
- **Build Command:** `npm install` (or leave empty)
- **Start Command:** `npm start`
- **Root Directory:** `backend` (if your repo root is parent folder)

### 2.4 Deploy
1. Railway will automatically deploy
2. Wait for build to complete (~2-3 minutes)
3. Your app will be live at a Railway-provided URL

## Step 3: Configure Custom Domain (Optional)

1. In Railway, go to **"Settings"** → **"Networking"**
2. Click **"Generate Domain"** to get a Railway domain
3. Or add your custom domain:
   - Click **"Custom Domain"**
   - Enter your domain
   - Follow DNS instructions

## Step 4: Update CORS Settings

Update `ALLOWED_ORIGINS` in Railway environment variables to include:
- Your Railway domain
- Your custom domain
- Your frontend URL

## Step 5: Test Deployment

```bash
# Health check
curl https://your-app.railway.app/health

# Test login
curl -X POST https://your-app.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

## Step 6: Subdomain Routing (If Needed)

If you need subdomain routing:

1. **Option A: Use Railway's domain**
   - Railway provides: `your-app.railway.app`
   - You can use: `project1.your-app.railway.app` (requires custom setup)

2. **Option B: Use custom domain with wildcard DNS**
   - Add DNS record: `*.yourdomain.com` → Railway IP
   - Configure in Railway networking settings

## Troubleshooting

### Build Fails
- Check Node.js version in `package.json` (add `"engines": { "node": ">=18" }`)
- Verify all dependencies are in `package.json`

### Environment Variables Not Working
- Ensure variables are set in Railway dashboard
- Restart the service after adding variables

### Database Connection Issues
- Verify Supabase credentials are correct
- Check Supabase project is active
- Ensure IP is not blocked (Railway IPs are dynamic)

## Cost
- **Free tier:** $5 credit/month (usually enough for small apps)
- **Hobby:** $5/month (if you exceed free tier)
- **Pro:** $20/month (for production)

## Monitoring
- Railway provides logs in real-time
- Check **"Metrics"** tab for CPU, memory, network usage
- Set up alerts in **"Settings"** → **"Notifications"**

## Auto-Deploy
Railway automatically deploys when you push to your main branch!

## Next Steps
- Set up monitoring and alerts
- Configure backups (if needed)
- Set up staging environment (create another Railway project)

