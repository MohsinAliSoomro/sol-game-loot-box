# Multi-Tenant Backend Setup Guide

Complete step-by-step guide to set up your multi-tenant whitelabel backend.

## Prerequisites

- Node.js 18+ installed
- Supabase account and project
- Basic knowledge of Express.js and SQL

## Step 1: Install Dependencies

```bash
cd backend
npm install
```

## Step 2: Set Up Supabase

### 2.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note down your:
   - Project URL
   - Anon Key
   - Service Role Key (found in Settings → API)

### 2.2 Run Database Schema

1. Open Supabase SQL Editor
2. Copy the entire contents of `database/schema.sql`
3. Paste and execute in SQL Editor
4. Verify tables were created:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

You should see:
- `projects`
- `project_admins`
- `master_admins`
- `project_nfts`
- `project_jackpots`
- `project_settings`

## Step 3: Configure Environment Variables

Create `.env` file in the `backend` directory:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# JWT Configuration
JWT_SECRET=your-super-secret-key-min-32-characters-long
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3001
NODE_ENV=development

# Domain Configuration
DOMAIN=yourdomain.com

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

**Important:** 
- Use a strong, random `JWT_SECRET` (at least 32 characters)
- Keep `SUPABASE_SERVICE_ROLE_KEY` secret (never commit to git)

## Step 4: Create Master Admin

Create your first master admin user:

### Option A: Via SQL (Recommended for first admin)

```sql
-- Hash password: "admin123" (CHANGE THIS!)
-- Use: https://bcrypt-generator.com/ or Node.js:
-- const bcrypt = require('bcryptjs');
-- bcrypt.hash('admin123', 10).then(console.log);

INSERT INTO master_admins (email, password_hash, full_name, role)
VALUES (
    'admin@spinloot.com',
    '$2a$10$YourHashedPasswordHere',  -- Replace with actual hash
    'Master Admin',
    'master_admin'
);
```

### Option B: Via API (after server is running)

```bash
# First, create a temporary script to hash password
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('yourpassword', 10).then(console.log);"

# Then insert into database with the hash
```

## Step 5: Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

You should see:
```
================================================
🚀 Multi-Tenant Whitelabel Backend Server
================================================
✅ Server running on port 3001
✅ Environment: development
✅ Database: Connected
================================================
```

## Step 6: Test the API

### 6.1 Health Check

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": "connected",
  "environment": "development"
}
```

### 6.2 Login as Master Admin

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@spinloot.com",
    "password": "admin123"
  }'
```

Save the `token` from the response.

### 6.3 Create Your First Project

```bash
curl -X POST http://localhost:3001/api/projects/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_MASTER_ADMIN_TOKEN" \
  -d '{
    "name": "Demo Project",
    "slug": "demo-project",
    "subdomain": "demo",
    "admin_email": "demo@example.com",
    "admin_password": "demo123456",
    "admin_full_name": "Demo Admin",
    "branding": {
      "logo_url": "https://example.com/logo.png",
      "primary_color": "#ff914d",
      "secondary_color": "#ff6b35",
      "theme": "light"
    }
  }'
```

### 6.4 Login as Project Admin

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "demo123456",
    "project_id": 1
  }'
```

### 6.5 Test Project-Specific Endpoint

```bash
# Get project branding
curl http://localhost:3001/api/branding?project_id=1 \
  -H "Authorization: Bearer PROJECT_ADMIN_TOKEN"
```

## Step 7: Subdomain Routing (Optional)

### 7.1 DNS Configuration

1. Add wildcard DNS record:
   - Type: A
   - Name: `*`
   - Value: Your server IP

### 7.2 Nginx Configuration

Create `/etc/nginx/sites-available/multitenant`:

```nginx
server {
    listen 80;
    server_name *.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/multitenant /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7.3 Test Subdomain

```bash
curl http://demo.yourdomain.com/api/branding \
  -H "Authorization: Bearer TOKEN"
```

## Step 8: Integration with Frontend

### 8.1 Update Frontend API Base URL

In your frontend `.env`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 8.2 Create API Client

```javascript
// lib/api-client.js
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
            ...options.headers
        }
    });
    
    return response.json();
}

// Usage
export async function getProjectBranding(projectId) {
    return apiRequest(`/branding?project_id=${projectId}`);
}
```

## Step 9: Production Deployment

### 9.1 Environment Variables

Set all environment variables in your hosting platform:
- Vercel: Project Settings → Environment Variables
- Railway: Variables tab
- Heroku: `heroku config:set KEY=value`

### 9.2 Security Checklist

- [ ] Strong `JWT_SECRET` (32+ characters, random)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` kept secret
- [ ] CORS configured for production domains
- [ ] Rate limiting enabled
- [ ] HTTPS enabled
- [ ] Database backups configured

### 9.3 Process Manager (PM2)

```bash
npm install -g pm2
pm2 start server.js --name multitenant-backend
pm2 save
pm2 startup
```

## Troubleshooting

### Database Connection Failed

- Check Supabase URL and keys
- Verify network connectivity
- Check Supabase project is active

### JWT Token Invalid

- Verify `JWT_SECRET` matches
- Check token expiration
- Ensure token format is correct

### Project Not Found

- Verify project exists in database
- Check project `is_active` status
- Verify project identifier (ID/slug/subdomain)

### CORS Errors

- Add your frontend domain to `ALLOWED_ORIGINS`
- Check CORS middleware configuration

## Next Steps

1. ✅ Backend is running
2. ✅ Create projects via API
3. ✅ Integrate with frontend
4. ✅ Set up subdomain routing (optional)
5. ✅ Deploy to production
6. ✅ Monitor and maintain

## Support

- Check `README.md` for API documentation
- Review code comments for implementation details
- Check Supabase logs for database issues

---

**You're all set!** 🎉

Your multi-tenant backend is ready to create and manage whitelabel projects.

