# Master Dashboard Integration Guide

Complete guide for integrating the multi-tenant backend with your master dashboard.

## Overview

The backend API provides a RESTful interface for managing whitelabel projects. The master dashboard can use this API to create and manage projects without needing Solana wallet connections.

## Setup

### 1. Configure Environment Variables

In `master_dashboard/.env.local`:

```env
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001/api
```

For production:
```env
NEXT_PUBLIC_BACKEND_API_URL=https://api.yourdomain.com/api
```

### 2. Backend API Client

The API client is already created in `master_dashboard/lib/backend-api.ts`. It provides:

- `authAPI` - Authentication (login/logout)
- `projectsAPI` - Project CRUD operations
- `brandingAPI` - Get project branding
- `nftsAPI` - NFT management (project-specific)

### 3. Component Integration

The `BackendProjectManagement` component is ready to use. It's already added to the master dashboard tabs.

## Usage Examples

### Creating a Project

```typescript
import { projectsAPI } from '@/lib/backend-api';

const response = await projectsAPI.create({
  name: 'My Project',
  slug: 'my-project',
  subdomain: 'myproject',
  admin_email: 'admin@project.com',
  admin_password: 'secure123',
  admin_full_name: 'Project Admin',
  branding: {
    logo_url: 'https://example.com/logo.png',
    primary_color: '#ff914d',
    secondary_color: '#ff6b35',
    theme: 'light'
  }
});

if (response.success) {
  console.log('Project created:', response.data.project);
  console.log('Admin token:', response.data.token);
  console.log('Access URLs:', response.data.access_urls);
}
```

### Listing Projects

```typescript
import { projectsAPI } from '@/lib/backend-api';

const response = await projectsAPI.list();
if (response.success) {
  console.log('Projects:', response.data);
}
```

### Authentication

```typescript
import { authAPI } from '@/lib/backend-api';

// Login
const response = await authAPI.login('admin@spinloot.com', 'password123');
if (response.success) {
  // Token is automatically stored
  console.log('Logged in as:', response.data.user);
}

// Check if authenticated
if (authAPI.isAuthenticated()) {
  console.log('User is authenticated');
}

// Logout
authAPI.logout();
```

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login (master admin or project admin)

### Projects (Master Admin Only)

- `POST /api/projects/create` - Create new project
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Deactivate project

### Branding

- `GET /api/branding` - Get project branding (auto-detects project)

### NFTs (Project-Specific)

- `GET /api/nfts` - List NFTs for current project
- `POST /api/nfts` - Create NFT
- `GET /api/nfts/:id` - Get NFT details
- `PUT /api/nfts/:id` - Update NFT
- `DELETE /api/nfts/:id` - Delete NFT

## Project Detection

The backend automatically detects the project context from:

1. **JWT Token** (highest priority) - `project_id` in token
2. **Subdomain** - `myproject.yourdomain.com`
3. **Header** - `X-Project-Id: 1`
4. **Query Parameter** - `?project_id=1`

## Workflow

### Creating a New Whitelabel Project

1. Master admin logs into dashboard
2. Navigate to "Whitelabel Projects" tab
3. Click "Create New Project"
4. Fill in:
   - Project name
   - Admin email and password
   - Branding (colors, logo, theme)
5. Submit - project and admin are created
6. Admin can immediately use the provided token to access their project

### Project Admin Access

1. Project admin logs in with their email/password
2. Token is generated with `project_id` embedded
3. All API calls automatically use their project context
4. They can only access their project's data

## Frontend Integration

### Using Project Branding

```typescript
import { brandingAPI } from '@/lib/backend-api';

// Get branding for a project
const response = await brandingAPI.get(projectId);
if (response.success) {
  const { branding } = response.data;
  
  // Apply to your UI
  document.documentElement.style.setProperty('--primary-color', branding.primary_color);
  document.documentElement.style.setProperty('--secondary-color', branding.secondary_color);
  
  // Use logo
  if (branding.logo_url) {
    // Display logo
  }
}
```

### Dynamic Styling

```css
/* Use CSS variables */
:root {
  --primary-color: #ff914d;
  --secondary-color: #ff6b35;
}

.button {
  background-color: var(--primary-color);
  color: var(--secondary-color);
}
```

```typescript
// Update CSS variables dynamically
const branding = await brandingAPI.get(projectId);
document.documentElement.style.setProperty('--primary-color', branding.primary_color);
```

## Error Handling

```typescript
try {
  const response = await projectsAPI.create(data);
  if (response.success) {
    // Handle success
  } else {
    // Handle API error
    console.error(response.error);
  }
} catch (error) {
  // Handle network/other errors
  console.error('Request failed:', error.message);
}
```

## Testing

### Test Backend Connection

```bash
# Health check
curl http://localhost:3001/health

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@spinloot.com","password":"password123"}'
```

### Test from Frontend

```typescript
// In browser console or component
import { projectsAPI } from '@/lib/backend-api';

// List projects
projectsAPI.list().then(console.log);
```

## Troubleshooting

### "Authentication required"

- Make sure you're logged in
- Check if token is stored: `localStorage.getItem('backend_auth_token')`
- Try logging in again

### "Project not found"

- Verify project exists in database
- Check project `is_active` status
- Verify project identifier (ID/slug/subdomain)

### CORS Errors

- Add frontend domain to `ALLOWED_ORIGINS` in backend `.env`
- Restart backend server

### Connection Refused

- Verify backend is running: `curl http://localhost:3001/health`
- Check `NEXT_PUBLIC_BACKEND_API_URL` in frontend `.env`

## Next Steps

1. ✅ Backend API is running
2. ✅ Master dashboard has API client
3. ✅ Components are integrated
4. ✅ Test creating a project
5. ✅ Test project admin login
6. ✅ Integrate branding in frontend

## Support

- Check backend logs for API errors
- Check browser console for frontend errors
- Verify environment variables
- Test API endpoints directly with curl/Postman

