#!/bin/bash
# Fully automated Vercel deployment script
# This script handles all deployment steps automatically

CLIENT_NAME="asas"
PROJECT_ID="1762943561515"
PROJECT_NAME="spinloot-asas"

echo "🚀 Automated Vercel Deployment"
echo "==============================="
echo "Client: $CLIENT_NAME"
echo "Project ID: $PROJECT_ID"
echo "Project Name: $PROJECT_NAME"
echo ""

# Ensure we're in the right directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR" || exit 1

echo "📁 Working directory: $PROJECT_DIR"

# Check if logged in
echo ""
echo "📋 Checking Vercel authentication..."
if ! vercel whoami &>/dev/null; then
    echo "❌ Not logged in to Vercel"
    echo "Please run: vercel login"
    exit 1
fi

echo "✅ Logged in as: $(vercel whoami)"

# Ensure .env.local exists
if [ ! -f ".env.local" ]; then
    echo ""
    echo "📝 Creating .env.local..."
    if [ -f ".env.$CLIENT_NAME" ]; then
        cp ".env.$CLIENT_NAME" .env.local
        echo "✅ Copied from .env.$CLIENT_NAME"
    else
        cat > .env.local << EOF
NEXT_PUBLIC_DEFAULT_PROJECT_ID=$PROJECT_ID
NEXT_PUBLIC_CLIENT_NAME=$CLIENT_NAME
NEXT_PUBLIC_CLIENT_SLUG=$CLIENT_NAME
EOF
        echo "✅ Created default .env.local"
    fi
fi

# Build the project
echo ""
echo "🔨 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Fix errors before deploying."
    exit 1
fi

echo "✅ Build successful"

# Check if project already exists
echo ""
echo "🔍 Checking if project exists on Vercel..."
if vercel ls | grep -q "$PROJECT_NAME"; then
    echo "✅ Project '$PROJECT_NAME' already exists"
    DEPLOY_MODE="existing"
else
    echo "📝 Project '$PROJECT_NAME' does not exist yet"
    DEPLOY_MODE="new"
fi

# Deploy
echo ""
echo "🚀 Deploying to Vercel..."
echo ""

if [ "$DEPLOY_MODE" = "new" ]; then
    # For new projects, we need to link first, then deploy
    echo "📦 Linking project..."
    
    # Create .vercel directory if it doesn't exist
    mkdir -p .vercel
    
    # Try to link with project name (non-interactive)
    echo "$PROJECT_NAME" | vercel link --yes --name "$PROJECT_NAME" 2>&1 || {
        echo "⚠️  Auto-linking failed, will use interactive mode"
        echo ""
        echo "📋 Please answer the prompts:"
        echo "   - Project name: $PROJECT_NAME"
        echo "   - Directory: ."
        echo "   - Framework: Next.js (should auto-detect)"
        echo ""
        vercel link
    }
fi

# Deploy to production
echo ""
echo "🚀 Deploying to production..."
vercel --prod --yes

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Your site is now live on Vercel"
    echo "2. Check the deployment URL above"
    echo "3. Set up environment variables in Vercel dashboard if needed"
    echo "4. Configure custom domain if needed"
    echo ""
    
    # Try to get the deployment URL
    DEPLOYMENT_URL=$(vercel ls "$PROJECT_NAME" --json 2>/dev/null | grep -o '"url":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$DEPLOYMENT_URL" ]; then
        echo "🌐 Deployment URL: https://$DEPLOYMENT_URL"
    fi
else
    echo ""
    echo "❌ Deployment failed. Check the error messages above."
    exit 1
fi

