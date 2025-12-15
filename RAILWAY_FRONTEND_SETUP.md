# Railway Backend - Frontend Connection Setup

## Problem
Your backend is running on Railway, but your frontend is trying to connect to `localhost:3001`, causing "FAILED TO FETCH" errors.

## Solution

### Step 1: Get Your Railway Backend URL

1. Go to your Railway dashboard
2. Click on your `Spinloot_backend` service
3. Go to the **"Settings"** tab
4. Scroll down to **"Networking"** section
5. You'll see your Railway URL, something like:
   - `https://spinloot-backend-production.up.railway.app`
   - Or a custom domain if you set one up

### Step 2: Create `.env.local` File

In the **root directory** of your project (same level as `package.json`), create a file named `.env.local`:

```env
# Replace with your actual Railway backend URL
NEXT_PUBLIC_BACKEND_URL=https://your-railway-backend-url.railway.app/api
NEXT_PUBLIC_BACKEND_API_URL=https://your-railway-backend-url.railway.app
```

**Example:**
```env
NEXT_PUBLIC_BACKEND_URL=https://spinloot-backend-production.up.railway.app/api
NEXT_PUBLIC_BACKEND_API_URL=https://spinloot-backend-production.up.railway.app
```

### Step 3: Update Railway CORS Settings

1. Go to Railway dashboard → Your service → **"Variables"** tab
2. Add or update the `ALLOWED_ORIGINS` environment variable:
   ```
   http://localhost:3000,http://localhost:3001,https://your-production-domain.com
   ```
   
   **For development, use:**
   ```
   http://localhost:3000,*
   ```
   
   **For production, use specific domains:**
   ```
   https://yourdomain.com,https://www.yourdomain.com,http://localhost:3000
   ```

3. **Restart your Railway service** after adding the variable (Railway will auto-restart)

### Step 4: Restart Your Frontend

After creating `.env.local`:

```bash
# Stop your frontend dev server (Ctrl+C)
# Then restart it
npm run dev
```

### Step 5: Test the Connection

1. Open your browser console (F12)
2. Try logging in
3. Check the Network tab to see if requests are going to your Railway URL instead of localhost

## Troubleshooting

### Still getting "FAILED TO FETCH"?

1. **Check Railway URL is correct:**
   - Test in browser: `https://your-railway-url.railway.app/health`
   - Should return: `{"status":"ok",...}`

2. **Check CORS:**
   - Open browser console
   - Look for CORS errors
   - Make sure `ALLOWED_ORIGINS` in Railway includes `http://localhost:3000`

3. **Check Environment Variables:**
   - Make sure `.env.local` is in the root directory (not in `backend/` or `app/`)
   - Restart your Next.js dev server after creating `.env.local`
   - Variable names must start with `NEXT_PUBLIC_` to be accessible in the browser

4. **Verify Railway Service is Running:**
   - Check Railway logs to ensure backend is running
   - Check the health endpoint: `https://your-railway-url.railway.app/health`

## Quick Test

Test your Railway backend directly:

```bash
# Health check
curl https://your-railway-url.railway.app/health

# Should return:
# {"status":"ok","timestamp":"...","database":"connected",...}
```

If this works, your backend is running correctly and the issue is just the frontend configuration.

