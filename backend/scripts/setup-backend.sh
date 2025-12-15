#!/bin/bash
# Complete Backend Setup Script
# This script sets up the entire multi-tenant backend system

echo "🚀 Multi-Tenant Backend Setup"
echo "=============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must run from backend directory${NC}"
    exit 1
fi

# Step 1: Install dependencies
echo -e "${YELLOW}📦 Step 1: Installing dependencies...${NC}"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 2: Check .env file
echo -e "${YELLOW}📝 Step 2: Checking environment configuration...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ Created .env file${NC}"
        echo -e "${YELLOW}⚠️  Please edit .env and add your Supabase credentials${NC}"
    else
        echo -e "${RED}❌ .env.example not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ .env file exists${NC}"
fi
echo ""

# Step 3: Verify environment variables
echo -e "${YELLOW}🔍 Step 3: Verifying environment variables...${NC}"
source .env 2>/dev/null || true

MISSING_VARS=()
if [ -z "$SUPABASE_URL" ]; then MISSING_VARS+=("SUPABASE_URL"); fi
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then MISSING_VARS+=("SUPABASE_SERVICE_ROLE_KEY"); fi
if [ -z "$JWT_SECRET" ]; then MISSING_VARS+=("JWT_SECRET"); fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo -e "   - ${var}"
    done
    echo ""
    echo -e "${YELLOW}Please edit .env and add these variables${NC}"
    exit 1
fi
echo -e "${GREEN}✅ All required environment variables are set${NC}"
echo ""

# Step 4: Test database connection
echo -e "${YELLOW}🔌 Step 4: Testing database connection...${NC}"
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

supabase.from('projects').select('count').limit(1)
    .then(() => {
        console.log('✅ Database connection successful');
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Database connection failed:', err.message);
        process.exit(1);
    });
" 2>&1

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Database connection failed. Please check your Supabase credentials${NC}"
    exit 1
fi
echo ""

# Step 5: Database schema reminder
echo -e "${YELLOW}📊 Step 5: Database schema${NC}"
echo -e "${YELLOW}⚠️  Don't forget to run the database schema!${NC}"
echo -e "   1. Go to Supabase SQL Editor"
echo -e "   2. Copy contents of database/schema.sql"
echo -e "   3. Paste and execute"
echo ""

# Step 6: Create master admin reminder
echo -e "${YELLOW}👤 Step 6: Master Admin${NC}"
echo -e "${YELLOW}⚠️  Don't forget to create a master admin user!${NC}"
echo -e "   Run this SQL in Supabase (change password!):"
echo ""
echo -e "   INSERT INTO master_admins (email, password_hash, full_name)"
echo -e "   VALUES ("
echo -e "       'admin@spinloot.com',"
echo -e "       '\$2a\$10\$YourHashedPasswordHere',  -- Use bcrypt to hash your password"
echo -e "       'Master Admin'"
echo -e "   );"
echo ""

# Step 7: Start server option
echo -e "${YELLOW}🚀 Step 7: Start the server${NC}"
read -p "Do you want to start the server now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}Starting server...${NC}"
    npm run dev
else
    echo -e "${GREEN}Setup complete!${NC}"
    echo ""
    echo "To start the server later, run:"
    echo "  npm run dev"
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Run database/schema.sql in Supabase"
echo "2. Create master admin user"
echo "3. Start server: npm run dev"
echo "4. Test API: curl http://localhost:3001/health"

