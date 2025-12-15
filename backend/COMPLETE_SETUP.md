# Complete Multi-Tenant Backend Setup

This document provides a complete checklist for setting up the entire multi-tenant whitelabel system.

## ✅ Setup Checklist

### Phase 1: Backend Setup

- [ ] **Install Dependencies**
  ```bash
  cd backend
  npm install
  ```

- [ ] **Configure Environment**
  ```bash
  cp .env.example .env
  # Edit .env with your Supabase credentials
  ```

- [ ] **Run Database Schema**
  - Go to Supabase SQL Editor
  - Copy contents of `database/schema.sql`
  - Paste and execute
  - Verify tables were created

- [ ] **Create Master Admin**
  ```sql
  -- Hash your password first (use bcrypt)
  INSERT INTO master_admins (email, password_hash, full_name)
  VALUES (
    'admin@spinloot.com',
    '$2a$10$YourHashedPasswordHere',
    'Master Admin'
  );
  ```

- [ ] **Start Backend Server**
  ```bash
  npm run dev
  ```

- [ ] **Test Backend**
  ```bash
  # Health check
  curl http://localhost:3001/health

  # Login
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@spinloot.com","password":"yourpassword"}'
  ```

### Phase 2: Master Dashboard Integration

- [ ] **Configure Frontend Environment**
  ```bash
  cd master_dashboard
  # Add to .env.local
  NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001/api
  ```

- [ ] **Verify Components**
  - `BackendProjectManagement` component exists
  - Tab is added to master dashboard
  - API client (`backend-api.ts`) is configured

- [ ] **Test Frontend**
  ```bash
  npm run dev
  # Navigate to master dashboard
  # Click "Whitelabel Projects" tab
  # Try creating a project
  ```

### Phase 3: Testing

- [ ] **Test Project Creation**
  - Create a project via master dashboard
  - Verify project appears in list
  - Check database for new project

- [ ] **Test Project Admin Login**
  - Use admin email/password from created project
  - Verify token is generated
  - Test accessing project-specific endpoints

- [ ] **Test Branding**
  - Get project branding via API
  - Verify colors, logo, theme are returned
  - Test applying branding to frontend

- [ ] **Test Multi-Tenant Isolation**
  - Create two projects
  - Login as admin for project 1
  - Verify can only access project 1's data
  - Login as admin for project 2
  - Verify can only access project 2's data

### Phase 4: Production Deployment

- [ ] **Backend Deployment**
  - Set environment variables on hosting platform
  - Deploy backend server
  - Configure domain/subdomain routing
  - Set up SSL/HTTPS

- [ ] **Database Security**
  - Review RLS policies
  - Verify service role key is secure
  - Set up database backups

- [ ] **Frontend Deployment**
  - Update `NEXT_PUBLIC_BACKEND_API_URL` to production URL
  - Deploy master dashboard
  - Test production endpoints

- [ ] **Monitoring**
  - Set up error logging
  - Monitor API usage
  - Track project creation

## Quick Start Commands

```bash
# 1. Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env
npm run dev

# 2. Run database schema in Supabase SQL Editor
# Copy database/schema.sql and execute

# 3. Create master admin (in Supabase SQL Editor)
# See Phase 1 above

# 4. Test backend
curl http://localhost:3001/health

# 5. Master dashboard setup
cd ../master_dashboard
# Add NEXT_PUBLIC_BACKEND_API_URL to .env.local
npm run dev

# 6. Test in browser
# Open http://localhost:3000
# Navigate to "Whitelabel Projects" tab
# Create a project
```

## File Structure

```
backend/
├── config/
│   └── database.js          # Supabase connection
├── middleware/
│   ├── auth.js              # JWT authentication
│   └── multiTenant.js       # Project isolation
├── routes/
│   ├── auth.js              # Login endpoints
│   ├── projects.js          # Project CRUD
│   └── nfts.js              # NFT management
├── database/
│   └── schema.sql           # Database schema
├── server.js                # Main server
└── package.json

master_dashboard/
├── lib/
│   └── backend-api.ts       # API client
├── components/
│   └── BackendProjectManagement.tsx  # UI component
└── app/
    └── page.tsx             # Main page (with tabs)
```

## Common Issues & Solutions

### Issue: "column slug does not exist"
**Solution:** Run the migration-safe schema. See `database/MIGRATION_FIX.md`

### Issue: "Authentication required"
**Solution:** 
- Make sure you're logged in
- Check token in localStorage
- Verify JWT_SECRET matches

### Issue: "Project not found"
**Solution:**
- Verify project exists in database
- Check project is_active status
- Verify project identifier

### Issue: CORS errors
**Solution:**
- Add frontend URL to ALLOWED_ORIGINS in backend .env
- Restart backend server

## Next Steps After Setup

1. ✅ Create your first project
2. ✅ Test project admin login
3. ✅ Customize branding
4. ✅ Add more projects
5. ✅ Integrate with client frontends
6. ✅ Set up subdomain routing (optional)
7. ✅ Deploy to production

## Support Resources

- `README.md` - API documentation
- `SETUP_GUIDE.md` - Detailed setup instructions
- `INTEGRATION_GUIDE.md` - Frontend integration guide
- `MIGRATION_FIX.md` - Database migration help
- `examples/dynamic-branding.js` - Branding examples

---

**You're all set!** 🎉

Your multi-tenant whitelabel system is ready to create and manage projects.

