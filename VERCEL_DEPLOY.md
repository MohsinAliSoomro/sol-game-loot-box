# 🚀 Vercel Deployment Guide

## Quick Start

### Step 1: Login to Vercel

```bash
cd spinloot_latest_safe
vercel login
```

This will:
- Open your browser for authentication
- Link your local machine to your Vercel account

### Step 2: Deploy

**Option A: Use the deployment script (Recommended)**
```bash
./scripts/deploy-vercel.sh
```

**Option B: Deploy manually**
```bash
vercel --prod
```

## What Happens During Deployment

1. **Authentication Check**: Verifies you're logged in
2. **Environment Setup**: Uses `.env.local` (already configured)
3. **Build**: Next.js builds the production bundle
4. **Deploy**: Uploads to Vercel and makes it live

## Environment Variables

Your `.env.local` file contains:
- `NEXT_PUBLIC_DEFAULT_PROJECT_ID=1762943561515`
- `NEXT_PUBLIC_CLIENT_NAME=asas`
- `NEXT_PUBLIC_CLIENT_SLUG=asas`

Vercel will automatically use these during deployment.

## First-Time Deployment

On first deployment, Vercel will ask:
1. **Set up and deploy?** → Yes
2. **Which scope?** → Your account or team
3. **Link to existing project?** → No (for new client)
4. **Project name?** → `spinloot-asas` (or your choice)
5. **Directory?** → `./` (current directory)

## Subsequent Deployments

After the first deployment, simply run:
```bash
vercel --prod
```

Or use the script:
```bash
./scripts/deploy-vercel.sh
```

## Custom Domain Setup

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Domains**
4. Add your custom domain
5. Follow DNS configuration instructions

## Troubleshooting

### "vercel: command not found"
```bash
npm install -g vercel
```

### "No existing credentials found"
```bash
vercel login
```

### Build fails
- Check for TypeScript errors: `npm run build`
- Verify all dependencies: `npm install`
- Check `.env.local` exists and is correct

### Environment variables not working
- Ensure variables start with `NEXT_PUBLIC_` for client-side access
- Check Vercel dashboard → Settings → Environment Variables
- Redeploy after adding variables

## Deployment URLs

After deployment, you'll get:
- **Preview URL**: `https://spinloot-asas-*.vercel.app`
- **Production URL**: `https://spinloot-asas.vercel.app` (or custom domain)

## Monitoring

- **Vercel Dashboard**: View deployments, logs, analytics
- **Build Logs**: Check for errors during build
- **Function Logs**: Monitor API routes and server functions

## Rollback

If something goes wrong:
1. Go to Vercel Dashboard
2. Select your project
3. Go to **Deployments**
4. Find the previous working deployment
5. Click **⋯** → **Promote to Production**

## Production Checklist

Before deploying to production:
- [ ] Build succeeds locally (`npm run build`)
- [ ] Environment variables are set
- [ ] Project ID is correct
- [ ] Supabase connection works
- [ ] Solana wallet integration works
- [ ] All features tested locally

---

**Ready to deploy?** Run `./scripts/deploy-vercel.sh` or `vercel --prod`

