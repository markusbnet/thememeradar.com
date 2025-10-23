# Deployment Guide

## Overview

The Meme Radar deploys automatically to Vercel via GitHub Actions when code is pushed to the `main` branch.

## Prerequisites

1. Vercel account (free tier)
2. Vercel project created and linked to this repository
3. GitHub repository with Actions enabled

## Required GitHub Secrets

To enable automated deployment, configure these secrets in your GitHub repository settings:

**Settings → Secrets and variables → Actions → New repository secret**

### `VERCEL_TOKEN`

Generate a Vercel API token:
1. Go to https://vercel.com/account/tokens
2. Click "Create Token"
3. Give it a name (e.g., "GitHub Actions Deploy")
4. Copy the token
5. Add as GitHub secret: `VERCEL_TOKEN`

### Getting Vercel Project IDs

Run these commands locally (after authenticating with `vercel login`):

```bash
# Link project (if not already linked)
vercel link

# Get project and org IDs
vercel project ls
```

Or retrieve from `.vercel/project.json` after linking:

```bash
cat .vercel/project.json
```

The file contains:
- `orgId` → Use for `VERCEL_ORG_ID` secret
- `projectId` → Use for `VERCEL_PROJECT_ID` secret

### Summary of Required Secrets

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `VERCEL_TOKEN` | API authentication token | https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | Organization/team ID | From `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | Project ID | From `.vercel/project.json` after `vercel link` |

## Environment Variables in Vercel

Configure these in Vercel Dashboard → Project → Settings → Environment Variables:

### Production Environment

**Reddit API:**
- `REDDIT_CLIENT_ID` - Reddit OAuth app client ID
- `REDDIT_CLIENT_SECRET` - Reddit OAuth app secret
- `REDDIT_USER_AGENT` - e.g., "MemeRadar/1.0"

**DynamoDB:**
- `AWS_REGION` - e.g., "us-east-1"
- `AWS_ACCESS_KEY_ID` - IAM user with DynamoDB access
- `AWS_SECRET_ACCESS_KEY` - IAM secret key

**Authentication:**
- `JWT_SECRET` - Generate with `openssl rand -base64 32`
- `SESSION_COOKIE_NAME` - "meme_radar_session"

**App:**
- `NEXT_PUBLIC_APP_URL` - Your production URL (e.g., "https://thememeradar.com")
- `NODE_ENV` - "production"

## Vercel Cron Job Configuration

The cron job is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/scan",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

This triggers `/api/scan` every 15 minutes to scan Reddit for stock mentions.

**Cost:** Free (within Vercel Hobby tier limits)
- 2,880 scans/month × 3 min execution × 1GB memory = 72 GB-hours/month
- Free tier includes 100 GB-hours/month
- Safety margin: 28%

## Deployment Workflow

### Automated Deployment

When you push to `main`:

1. **Tests run** - Unit, integration, and E2E tests
2. **Build completes** - Next.js production build
3. **Deploy triggers** - Only if all tests pass
4. **Vercel deploys** - Automatic production deployment
5. **Cron job activates** - Starts scanning Reddit every 15 minutes

### Manual Deployment

If needed, deploy manually:

```bash
# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

## Verification

After deployment, verify:

1. **Health check:** `curl https://your-domain.com/api/health`
2. **Manual scan:** `curl -X POST https://your-domain.com/api/scan`
3. **Dashboard:** Visit `https://your-domain.com/dashboard`
4. **Cron logs:** Check Vercel Dashboard → Project → Logs → Cron

## Troubleshooting

### Deployment fails in GitHub Actions

- Check GitHub Actions logs: `https://github.com/YOUR_USERNAME/thememeradar/actions`
- Verify all secrets are configured correctly
- Ensure Vercel project is linked

### Cron job not running

- Check Vercel Dashboard → Project → Settings → Crons
- Verify `vercel.json` is in repository root
- Check cron logs in Vercel Dashboard

### Environment variables not working

- Ensure variables are set in Vercel Dashboard (not just locally)
- Redeploy after adding new environment variables
- Check variable names match exactly (case-sensitive)

## Cost Monitoring

Monitor usage to stay within free tier:

**Vercel Dashboard → Usage:**
- Function Executions: Should be ~2,880/month
- GB-Hours: Should be ~72/month (out of 100 free)
- Bandwidth: Should be minimal

**DynamoDB (AWS Console):**
- Table size: Should be <25GB (auto-expires after 30 days)
- Read/Write requests: Should be <200M/month

**Alert thresholds:**
- Vercel GB-hours > 90/month → Reduce cron frequency
- DynamoDB size > 20GB → Check TTL is working
- Reddit API errors → Check rate limiting

## Support

- GitHub Issues: https://github.com/YOUR_USERNAME/thememeradar/issues
- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
