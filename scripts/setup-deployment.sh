#!/bin/bash

# Deployment Setup Script for The Meme Radar
# This script configures all secrets and environment variables for production deployment

set -e

echo "========================================="
echo "The Meme Radar - Deployment Setup"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must run from project root directory${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Project directory confirmed"
echo ""

# Step 1: Get Vercel Token
echo "========================================="
echo "Step 1: Vercel Token"
echo "========================================="
echo ""
echo "To create a Vercel token:"
echo "1. Visit: https://vercel.com/account/tokens"
echo "2. Click 'Create Token'"
echo "3. Name it: 'GitHub Actions Deploy'"
echo "4. Copy the token"
echo ""
read -p "Paste your Vercel token here: " VERCEL_TOKEN

if [ -z "$VERCEL_TOKEN" ]; then
    echo -e "${RED}Error: Vercel token is required${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Vercel token received"
echo ""

# Step 2: Get Reddit Credentials
echo "========================================="
echo "Step 2: Reddit API Credentials"
echo "========================================="
echo ""
echo "To create Reddit OAuth app:"
echo "1. Visit: https://www.reddit.com/prefs/apps"
echo "2. Click 'create another app...'"
echo "3. Choose type: 'script'"
echo "4. Fill in name: 'Meme Radar'"
echo "5. Redirect URI: http://localhost:3000"
echo ""
read -p "Reddit Client ID: " REDDIT_CLIENT_ID
read -p "Reddit Client Secret: " REDDIT_CLIENT_SECRET
read -p "Your Reddit Username (for user agent): " REDDIT_USERNAME

if [ -z "$REDDIT_CLIENT_ID" ] || [ -z "$REDDIT_CLIENT_SECRET" ] || [ -z "$REDDIT_USERNAME" ]; then
    echo -e "${RED}Error: All Reddit credentials are required${NC}"
    exit 1
fi

REDDIT_USER_AGENT="MemeRadar/1.0 by $REDDIT_USERNAME"
echo -e "${GREEN}✓${NC} Reddit credentials received"
echo ""

# Step 3: Generate Production URL
echo "========================================="
echo "Step 3: Production URL"
echo "========================================="
echo ""
read -p "Enter your production domain (e.g., thememeradar.vercel.app): " PROD_DOMAIN

if [ -z "$PROD_DOMAIN" ]; then
    echo -e "${RED}Error: Production domain is required${NC}"
    exit 1
fi

NEXT_PUBLIC_APP_URL="https://$PROD_DOMAIN"
echo -e "${GREEN}✓${NC} Production URL: $NEXT_PUBLIC_APP_URL"
echo ""

# Configuration values (already generated)
VERCEL_ORG_ID="team_YjD133cQ9wVL0ELDL49KiDwE"
VERCEL_PROJECT_ID="prj_IyquR9XtGda1OjvnukUdfWX33fMP"
AWS_ACCESS_KEY_ID="[REDACTED]"
AWS_SECRET_ACCESS_KEY="[REDACTED]"
AWS_REGION="us-east-1"
JWT_SECRET="[REDACTED]"
SESSION_COOKIE_NAME="meme_radar_session"

echo "========================================="
echo "Step 4: Setting GitHub Secrets"
echo "========================================="
echo ""

# Set GitHub secrets
echo "Setting VERCEL_TOKEN..."
echo "$VERCEL_TOKEN" | gh secret set VERCEL_TOKEN

echo "Setting VERCEL_ORG_ID..."
echo "$VERCEL_ORG_ID" | gh secret set VERCEL_ORG_ID

echo "Setting VERCEL_PROJECT_ID..."
echo "$VERCEL_PROJECT_ID" | gh secret set VERCEL_PROJECT_ID

echo -e "${GREEN}✓${NC} GitHub secrets configured"
echo ""

echo "========================================="
echo "Step 5: Setting Vercel Environment Variables"
echo "========================================="
echo ""

# Set Vercel environment variables (production)
echo "Setting Reddit API credentials..."
vercel env add REDDIT_CLIENT_ID production <<< "$REDDIT_CLIENT_ID"
vercel env add REDDIT_CLIENT_SECRET production <<< "$REDDIT_CLIENT_SECRET"
vercel env add REDDIT_USER_AGENT production <<< "$REDDIT_USER_AGENT"

echo "Setting AWS credentials..."
vercel env add AWS_REGION production <<< "$AWS_REGION"
vercel env add AWS_ACCESS_KEY_ID production <<< "$AWS_ACCESS_KEY_ID"
vercel env add AWS_SECRET_ACCESS_KEY production <<< "$AWS_SECRET_ACCESS_KEY"

echo "Setting authentication secrets..."
vercel env add JWT_SECRET production <<< "$JWT_SECRET"
vercel env add SESSION_COOKIE_NAME production <<< "$SESSION_COOKIE_NAME"

echo "Setting application configuration..."
vercel env add NEXT_PUBLIC_APP_URL production <<< "$NEXT_PUBLIC_APP_URL"
vercel env add NODE_ENV production <<< "production"

echo -e "${GREEN}✓${NC} Vercel environment variables configured"
echo ""

echo "========================================="
echo "Step 6: Creating DynamoDB Tables"
echo "========================================="
echo ""

# Create DynamoDB tables in production
echo "Creating production DynamoDB tables..."
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
AWS_REGION=$AWS_REGION \
npx tsx scripts/init-db-production.ts

echo -e "${GREEN}✓${NC} DynamoDB tables created"
echo ""

echo "========================================="
echo "✅ Deployment Setup Complete!"
echo "========================================="
echo ""
echo "Summary:"
echo "  ✓ GitHub secrets configured (3)"
echo "  ✓ Vercel environment variables set (9)"
echo "  ✓ AWS IAM user created: memeradar-dynamodb"
echo "  ✓ DynamoDB tables ready"
echo ""
echo "Next steps:"
echo "1. Push to main branch to trigger deployment:"
echo "   git add ."
echo "   git commit -m 'Configure deployment'"
echo "   git push origin main"
echo ""
echo "2. Monitor deployment:"
echo "   GitHub Actions: https://github.com/markusbnet/thememeradar.com/actions"
echo "   Vercel Dashboard: https://vercel.com/dashboard"
echo ""
echo "3. Verify cron job is active:"
echo "   Vercel → Project → Settings → Crons"
echo ""
echo -e "${GREEN}Happy deploying! 🚀${NC}"
