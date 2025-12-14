# Deploy Client Frontend - Quick Guide

## Current Status
✅ Client configuration created for: **asas**
✅ Project ID: **1762943561515**
✅ Environment file: `.env.asas`
✅ Client config: `client-configs/asas.json`

## Next Steps

### Option 1: Deploy to Vercel (Recommended - Easiest)

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy with environment variables**:
   ```bash
   vercel --prod \
     --env NEXT_PUBLIC_DEFAULT_PROJECT_ID=1762943561515 \
     --env NEXT_PUBLIC_CLIENT_NAME="asas"
   ```

4. **Or use the .env file**:
   ```bash
   # Copy env file
   cp .env.asas .env.local
   
   # Deploy
   vercel --prod
   ```

### Option 2: Build and Deploy Package

1. **Set environment variables and build**:
   ```bash
   export NEXT_PUBLIC_DEFAULT_PROJECT_ID=1762943561515
   export NEXT_PUBLIC_CLIENT_NAME="asas"
   npm run build
   ```

2. **Copy files to deployment directory**:
   ```bash
   cp -r .next ../deployments/asas/
   cp -r public ../deployments/asas/
   cp package.json ../deployments/asas/
   cp .env.asas ../deployments/asas/.env.local
   ```

3. **Deploy the package** (upload to your hosting service)

### Option 3: Test Locally First

1. **Copy env file**:
   ```bash
   cp .env.asas .env.local
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Verify**:
   - Open http://localhost:3000
   - Check that the correct project loads
   - Verify data isolation

## Quick Commands

```bash
# Test locally
cp .env.asas .env.local && npm run dev

# Build for production
export NEXT_PUBLIC_DEFAULT_PROJECT_ID=1762943561515
export NEXT_PUBLIC_CLIENT_NAME="asas"
npm run build

# Deploy to Vercel
vercel --prod --env NEXT_PUBLIC_DEFAULT_PROJECT_ID=1762943561515 --env NEXT_PUBLIC_CLIENT_NAME="asas"
```

## What Happens After Deployment

- Frontend connects to project ID: 1762943561515
- Only data from this project will be shown
- Project switcher will show this as the default project
- Client can access their isolated frontend

## Troubleshooting

- **Project not loading?** Check `NEXT_PUBLIC_DEFAULT_PROJECT_ID` is set correctly
- **Wrong data showing?** Verify project ID in Supabase matches
- **Build fails?** Make sure all environment variables are set


