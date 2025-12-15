# Multi-Tenant Whitelabel Backend

Express.js backend API for managing multiple whitelabel Spinloot projects.

## Features

- ✅ Multi-tenant architecture with project isolation
- ✅ JWT-based authentication (master admins & project admins)
- ✅ Subdomain-based routing support
- ✅ Project-specific branding and configuration
- ✅ Automatic project context detection
- ✅ Row-level security with Supabase

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for admin operations)
- `JWT_SECRET` - Secret key for JWT tokens
- `DOMAIN` - Your domain for subdomain routing

### 3. Set Up Database

Run the SQL schema in Supabase:

```bash
# Copy the contents of database/schema.sql
# Paste into Supabase SQL Editor and execute
```

### 4. Start the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server will start on `http://localhost:3001`

## API Endpoints

### Authentication

#### `POST /api/auth/login`
Login for master admins or project admins.

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "password123",
  "project_id": 1  // Optional, for project admin login
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "admin@example.com",
      "role": "master_admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "project_id": null
  }
}
```

### Project Management (Master Admin Only)

#### `POST /api/projects/create`
Create a new whitelabel project with admin user.

**Headers:**
```
Authorization: Bearer <master_admin_token>
```

**Request:**
```json
{
  "name": "My Project",
  "slug": "my-project",  // Optional, auto-generated if not provided
  "subdomain": "myproject",  // Optional
  "admin_email": "admin@myproject.com",
  "admin_password": "securepassword123",
  "admin_full_name": "Project Admin",
  "branding": {
    "logo_url": "https://example.com/logo.png",
    "primary_color": "#ff914d",
    "secondary_color": "#ff6b35",
    "theme": "light"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Project and admin created successfully",
  "data": {
    "project": {
      "id": 1,
      "name": "My Project",
      "slug": "my-project",
      "subdomain": "myproject",
      "branding": { ... }
    },
    "admin": { ... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "access_urls": {
      "api": "https://myproject.yourdomain.com/api",
      "dashboard": "https://myproject.yourdomain.com"
    }
  }
}
```

#### `GET /api/projects`
List all projects (master admin only).

#### `GET /api/projects/:id`
Get project details.

#### `PUT /api/projects/:id`
Update project.

#### `DELETE /api/projects/:id`
Deactivate project (soft delete).

### NFT Management (Project-Specific)

All NFT endpoints automatically use the project context from:
- JWT token (`project_id` in token)
- Subdomain (e.g., `myproject.yourdomain.com`)
- `X-Project-Id` header
- `project_id` query parameter

#### `GET /api/nfts`
Get all NFTs for the current project.

**Headers:**
```
Authorization: Bearer <project_admin_token>
X-Project-Id: 1  // Optional if using subdomain or token
```

#### `POST /api/nfts`
Create a new NFT.

**Request:**
```json
{
  "name": "Cool NFT",
  "description": "A cool NFT",
  "image_url": "https://example.com/nft.png",
  "mint_address": "So11111111111111111111111111111111111111112",
  "rarity": "legendary",
  "attributes": {
    "power": 100,
    "speed": 50
  }
}
```

### Branding

#### `GET /api/branding`
Get project branding information (automatically detects project).

**Access via:**
- Subdomain: `https://myproject.yourdomain.com/api/branding`
- Header: `X-Project-Id: 1`
- Query: `?project_id=1`

## Multi-Tenant Middleware

The middleware automatically:
1. Extracts project identifier from token/subdomain/header/query
2. Resolves project from database
3. Attaches project context to `req.project` and `req.projectId`
4. Enforces access control

### Usage in Routes

```javascript
import { multiTenantMiddleware, verifyProjectAccess } from '../middleware/multiTenant.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

router.use(multiTenantMiddleware);  // Detect project
router.use(authenticateToken);      // Verify auth
router.use(requireAdmin);           // Check admin role
router.use(verifyProjectAccess);    // Verify project access
```

## Subdomain Routing

To enable subdomain routing:

1. Configure DNS wildcard: `*.yourdomain.com` → Your server IP
2. Set `DOMAIN` in `.env`
3. Use reverse proxy (nginx) to route subdomains to your Express server

### Nginx Example

```nginx
server {
    listen 80;
    server_name *.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Database Schema

See `database/schema.sql` for complete schema including:
- `projects` - Project/tenant information
- `project_admins` - Admin users per project
- `master_admins` - Super admins
- `project_nfts` - Project-specific NFTs
- `project_jackpots` - Project-specific jackpots
- `project_settings` - Additional settings

## Security

- ✅ JWT token authentication
- ✅ Password hashing with bcrypt
- ✅ Row-level security (RLS) in Supabase
- ✅ Rate limiting
- ✅ Helmet security headers
- ✅ CORS configuration
- ✅ Input validation with express-validator

## Development

```bash
# Install dependencies
npm install

# Run in development mode (with nodemon)
npm run dev

# Run in production mode
npm start
```

## Testing

Test the API with curl or Postman:

```bash
# Health check
curl http://localhost:3001/health

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'

# Create project (requires master admin token)
curl -X POST http://localhost:3001/api/projects/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Test Project","admin_email":"test@example.com","admin_password":"password123"}'
```

## Project Structure

```
backend/
├── config/
│   └── database.js          # Supabase configuration
├── middleware/
│   ├── auth.js              # JWT authentication
│   └── multiTenant.js       # Multi-tenant middleware
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── projects.js          # Project management routes
│   └── nfts.js              # NFT routes (project-specific)
├── database/
│   └── schema.sql           # Database schema
├── server.js                # Main server file
├── package.json
└── .env.example
```

## Next Steps

1. Set up Supabase database with the provided schema
2. Create a master admin user (manually or via SQL)
3. Use the `/api/projects/create` endpoint to create projects
4. Configure subdomain routing (optional)
5. Integrate with your frontend

## Support

For issues or questions, check the code comments or create an issue.

