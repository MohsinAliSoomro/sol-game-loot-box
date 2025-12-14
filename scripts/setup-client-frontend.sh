#!/bin/bash
# Setup script for client-specific frontend deployment

CLIENT_NAME=$1
PROJECT_ID=$2
DOMAIN=${3:-""}

if [ -z "$CLIENT_NAME" ] || [ -z "$PROJECT_ID" ]; then
  echo "Usage: ./scripts/setup-client-frontend.sh <client-name> <project-id> [domain]"
  echo ""
  echo "Example:"
  echo "  ./scripts/setup-client-frontend.sh 'Client A' 1 client-a.example.com"
  exit 1
fi

echo "🚀 Setting up frontend for: $CLIENT_NAME"
echo "📋 Project ID: $PROJECT_ID"
echo ""

# Convert client name to safe format (lowercase, no spaces)
CLIENT_SLUG=$(echo "$CLIENT_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')

# 1. Create environment file
echo "📝 Creating environment file..."
cat > .env.$CLIENT_SLUG << EOF
# Client: $CLIENT_NAME
# Project ID: $PROJECT_ID
NEXT_PUBLIC_DEFAULT_PROJECT_ID=$PROJECT_ID
NEXT_PUBLIC_CLIENT_NAME=$CLIENT_NAME
NEXT_PUBLIC_CLIENT_SLUG=$CLIENT_SLUG
${DOMAIN:+NEXT_PUBLIC_DOMAIN=$DOMAIN}
EOF

echo "✅ Created .env.$CLIENT_SLUG"

# 2. Create client config directory if it doesn't exist
mkdir -p client-configs

# 3. Create client configuration file
echo "📝 Creating client configuration..."
cat > client-configs/$CLIENT_SLUG.json << EOF
{
  "clientName": "$CLIENT_NAME",
  "projectId": $PROJECT_ID,
  "slug": "$CLIENT_SLUG",
  "domain": "${DOMAIN:-}",
  "branding": {
    "primaryColor": "#FF6B35",
    "logo": "/logos/$CLIENT_SLUG.png"
  },
  "features": {
    "jackpot": true,
    "tickets": true,
    "nfts": true
  },
  "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

echo "✅ Created client-configs/$CLIENT_SLUG.json"

# 4. Create deployment directory
echo "📦 Creating deployment package..."
mkdir -p ../deployments/$CLIENT_SLUG

# 5. Build instructions
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Build the frontend with client configuration:"
echo "   export NEXT_PUBLIC_DEFAULT_PROJECT_ID=$PROJECT_ID"
echo "   export NEXT_PUBLIC_CLIENT_NAME='$CLIENT_NAME'"
echo "   npm run build"
echo ""
echo "2. Copy build files to deployment directory:"
echo "   cp -r .next ../deployments/$CLIENT_SLUG/"
echo "   cp -r public ../deployments/$CLIENT_SLUG/"
echo "   cp package.json ../deployments/$CLIENT_SLUG/"
echo "   cp .env.$CLIENT_SLUG ../deployments/$CLIENT_SLUG/.env.local"
echo ""
echo "3. Deploy to hosting:"
if [ -n "$DOMAIN" ]; then
  echo "   - Domain: $DOMAIN"
fi
echo "   - Vercel: vercel --prod --env NEXT_PUBLIC_DEFAULT_PROJECT_ID=$PROJECT_ID"
echo "   - Or use the deployment package in: ../deployments/$CLIENT_SLUG"
echo ""
echo "✅ Setup complete for $CLIENT_NAME!"


