#!/bin/bash
# Vercel deployment script for client frontend

CLIENT_NAME="asas"
PROJECT_ID="1762943561515"

echo "🚀 Vercel Deployment Script"
echo "==========================="
echo "Client: $CLIENT_NAME"
echo "Project ID: $PROJECT_ID"
echo ""

# Check if logged in
echo "📋 Checking Vercel authentication..."
if ! vercel whoami &>/dev/null; then
    echo "⚠️  Not logged in to Vercel"
    echo ""
    echo "Please run: vercel login"
    echo "This will open a browser for authentication."
    echo ""
    read -p "Press Enter after you've logged in, or Ctrl+C to cancel..."
fi

# Verify login
if vercel whoami &>/dev/null; then
    echo "✅ Logged in as: $(vercel whoami)"
else
    echo "❌ Still not logged in. Please run 'vercel login' first."
    exit 1
fi

# Ensure we're in the right directory
cd "$(dirname "$0")/.." || exit 1

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local from .env.$CLIENT_NAME..."
    if [ -f ".env.$CLIENT_NAME" ]; then
        cp ".env.$CLIENT_NAME" .env.local
        echo "✅ Created .env.local"
    else
        echo "⚠️  .env.$CLIENT_NAME not found, creating default..."
        cat > .env.local << EOF
NEXT_PUBLIC_DEFAULT_PROJECT_ID=$PROJECT_ID
NEXT_PUBLIC_CLIENT_NAME=$CLIENT_NAME
NEXT_PUBLIC_CLIENT_SLUG=$CLIENT_NAME
EOF
    fi
fi

# Build first (optional but recommended)
echo ""
read -p "Do you want to build before deploying? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔨 Building project..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ Build failed! Fix errors before deploying."
        exit 1
    fi
    echo "✅ Build successful"
fi

# Deploy
echo ""
echo "🚀 Deploying to Vercel..."
echo ""
echo "📋 IMPORTANT: When prompted, use these answers:"
echo "   - Project name: spinloot-asas (lowercase, no spaces)"
echo "   - Directory: . (just a dot, means current directory)"
echo "   - Framework: Next.js (should auto-detect)"
echo ""

# Deploy with production flag
vercel --prod

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Your site is now live on Vercel"
    echo "2. Check the deployment URL in the output above"
    echo "3. Set up custom domain in Vercel dashboard if needed"
    echo "4. Environment variables are automatically synced from .env.local"
else
    echo ""
    echo "❌ Deployment failed. Check the error messages above."
    exit 1
fi

