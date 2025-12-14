#!/bin/bash
# Complete deployment script for client frontend
# This does everything: setup, test, build, and prepare for deployment

CLIENT_NAME="asas"
PROJECT_ID="1762943561515"

echo "🚀 Complete Client Frontend Deployment"
echo "======================================"
echo "Client: $CLIENT_NAME"
echo "Project ID: $PROJECT_ID"
echo ""

# Step 1: Copy environment file
echo "📝 Step 1: Setting up environment..."
if [ -f ".env.$CLIENT_NAME" ]; then
    cp .env.$CLIENT_NAME .env.local
    echo "✅ Copied .env.$CLIENT_NAME to .env.local"
else
    echo "⚠️  .env.$CLIENT_NAME not found, creating from scratch..."
    cat > .env.local << EOF
NEXT_PUBLIC_DEFAULT_PROJECT_ID=$PROJECT_ID
NEXT_PUBLIC_CLIENT_NAME=$CLIENT_NAME
NEXT_PUBLIC_CLIENT_SLUG=$CLIENT_NAME
EOF
    echo "✅ Created .env.local"
fi

# Step 2: Check dependencies
echo ""
echo "📦 Step 2: Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Step 3: Test build (optional - can skip if you want)
echo ""
echo "🔨 Step 3: Building for production..."
export NEXT_PUBLIC_DEFAULT_PROJECT_ID=$PROJECT_ID
export NEXT_PUBLIC_CLIENT_NAME=$CLIENT_NAME
export NEXT_PUBLIC_CLIENT_SLUG=$CLIENT_NAME

npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed! Check errors above."
    exit 1
fi

# Step 4: Create deployment package
echo ""
echo "📦 Step 4: Creating deployment package..."
mkdir -p ../deployments/$CLIENT_NAME

# Copy necessary files
cp -r .next ../deployments/$CLIENT_NAME/ 2>/dev/null || echo "⚠️  .next directory not found (build may have failed)"
cp -r public ../deployments/$CLIENT_NAME/ 2>/dev/null || echo "⚠️  public directory not found"
cp package.json ../deployments/$CLIENT_NAME/
cp package-lock.json ../deployments/$CLIENT_NAME/ 2>/dev/null || true
cp .env.local ../deployments/$CLIENT_NAME/.env.local
cp next.config.js ../deployments/$CLIENT_NAME/ 2>/dev/null || cp next.config.ts ../deployments/$CLIENT_NAME/ 2>/dev/null || true
cp tsconfig.json ../deployments/$CLIENT_NAME/ 2>/dev/null || true

echo "✅ Deployment package created in: ../deployments/$CLIENT_NAME"

# Step 5: Summary
echo ""
echo "✅ Complete! Summary:"
echo "===================="
echo "✅ Environment configured (.env.local)"
echo "✅ Production build completed"
echo "✅ Deployment package created"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Test locally (optional):"
echo "   npm run dev"
echo "   Then open http://localhost:3000"
echo ""
echo "2. Deploy to Vercel:"
echo "   vercel --prod"
echo ""
echo "3. Or deploy manually from:"
echo "   ../deployments/$CLIENT_NAME"
echo ""
echo "🎉 Ready to deploy!"


