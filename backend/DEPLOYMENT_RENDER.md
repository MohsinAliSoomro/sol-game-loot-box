# Render Deployment Guide

## Overview
Render is a great production-ready option with zero code changes!

## Prerequisites
- GitHub account
- Render account (free at [render.com](https://render.com))
- Supabase credentials ready

## Step 1: Prepare Your Repository

1. Ensure your code is pushed to GitHub
2. Make sure `.env` is in `.gitignore`

## Step 2: Deploy on Render

### 2.1 Create New Web Service
1. Go to [render.com](https://render.com) and sign in
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account (if not already)
4. Select your repository
5. Click **"Connect"**

### 2.2 Configure Service Settings

**Basic Settings:**
- **Name:** `spinloot-backend` (or your preferred name)
- **Environment:** `Node`
- **Region:** Choose closest to your users
- **Branch:** `main` (or your default branch)
- **Root Directory:** `backend` (if repo root is parent folder)

**Build & Deploy:**
- **Build Command:** `npm install`
- **Start Command:** `npm start`

**Plan:**
- **Free:** For testing (spins down after inactivity)
- **Starter ($7/month):** For production (always on)

### 2.3 Configure Environment Variables
Click **"Environment"** tab and add:

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

### 2.4 Deploy
1. Click **"Create Web Service"**
2. Render will start building (~3-5 minutes)
3. Watch the build logs
4. Your app will be live at: `https://your-app.onrender.com`

## Step 3: Configure Custom Domain (Optional)

1. In Render dashboard, go to **"Settings"**
2. Scroll to **"Custom Domains"**
3. Click **"Add Custom Domain"**
4. Enter your domain
5. Follow DNS instructions:
   - Add CNAME record: `yourdomain.com` → `your-app.onrender.com`
   - Or A record: `yourdomain.com` → Render IP

## Step 4: Update CORS Settings

Update `ALLOWED_ORIGINS` in Render environment variables to include:
- Your Render domain
- Your custom domain
- Your frontend URL

## Step 5: Test Deployment

```bash
# Health check
curl https://your-app.onrender.com/health

# Test login
curl -X POST https://your-app.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

## Step 6: Subdomain Routing (If Needed)

For subdomain routing with custom domain:

1. Add wildcard DNS record:
   - Type: `CNAME`
   - Name: `*`
   - Value: `your-app.onrender.com`

2. Render will handle subdomain routing automatically

## Important Notes

### Free Tier Limitations
- ⚠️ Service spins down after 15 minutes of inactivity
- ⚠️ First request after spin-down takes ~30 seconds (cold start)
- ⚠️ Upgrade to Starter plan for always-on service

### Auto-Deploy
- Render automatically deploys on git push to main branch
- You can disable this in **"Settings"** → **"Auto-Deploy"**

## Troubleshooting

### Build Fails
- Check build logs in Render dashboard
- Verify Node.js version (add to `package.json`):
  ```json
  "engines": {
    "node": ">=18"
  }
  ```

### Service Keeps Restarting
- Check logs for errors
- Verify all environment variables are set
- Check database connection

### Slow First Request (Free Tier)
- This is normal on free tier (cold start)
- Upgrade to Starter plan for always-on

## Cost
- **Free:** $0 (with limitations)
- **Starter:** $7/month (always on, 512MB RAM)
- **Standard:** $25/month (1GB RAM, better performance)

## Monitoring
- View logs in real-time in Render dashboard
- Set up alerts in **"Settings"** → **"Alerts"**
- Monitor metrics in **"Metrics"** tab

## Health Checks
Render automatically checks your `/health` endpoint. Make sure it returns 200 OK.

## Next Steps
- Set up staging environment (create another Render service)
- Configure backups
- Set up monitoring alerts
- Consider upgrading to Starter plan for production

