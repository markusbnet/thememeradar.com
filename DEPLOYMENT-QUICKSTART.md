# Deployment Quick Start

## What's Already Been Set Up

I've configured most of your deployment infrastructure automatically:

### ✅ Completed

1. **AWS IAM User Created**: `memeradar-dynamodb`
   - Access Key ID: `[REDACTED - Configured in Vercel]`
   - Secret Access Key: `[REDACTED - Configured in Vercel]`
   - DynamoDB permissions configured

2. **GitHub Secrets Set**:
   - ✅ `VERCEL_ORG_ID`
   - ✅ `VERCEL_PROJECT_ID`
   - ⏳ `VERCEL_TOKEN` (you need to provide this)

3. **JWT Secret Generated**: `[REDACTED]`

4. **Vercel Project Linked**: `thememeradar.com`

5. **Deployment Files Created**:
   - `vercel.json` (cron job configuration)
   - `.github/workflows/ci.yml` (CI/CD pipeline with deployment)
   - `scripts/setup-deployment.sh` (interactive setup script)
   - `scripts/init-db-production.ts` (production DB initialization)

## What You Need To Do

### Option 1: Automated Setup (Recommended)

Run the interactive setup script:

```bash
./scripts/setup-deployment.sh
```

This will prompt you for:
1. **Vercel Token** (create at https://vercel.com/account/tokens)
2. **Reddit API Credentials** (create at https://reddit.com/prefs/apps)
3. **Production Domain** (e.g., thememeradar.vercel.app)

The script will then:
- Configure all GitHub secrets
- Set all Vercel environment variables
- Create production DynamoDB tables
- Validate the setup

### Option 2: Manual Setup

If you prefer to set things up manually:

#### 1. Create Vercel Token

1. Visit: https://vercel.com/account/tokens
2. Click "Create Token"
3. Name: "GitHub Actions Deploy"
4. Set the GitHub secret:
   ```bash
   gh secret set VERCEL_TOKEN
   # Paste the token when prompted
   ```

#### 2. Create Reddit OAuth App

1. Visit: https://reddit.com/prefs/apps
2. Click "create another app..."
3. Type: "script"
4. Name: "Meme Radar"
5. Redirect URI: http://localhost:3000

#### 3. Set Vercel Environment Variables

```bash
# Reddit API
vercel env add REDDIT_CLIENT_ID production
vercel env add REDDIT_CLIENT_SECRET production
vercel env add REDDIT_USER_AGENT production

# AWS (already generated)
vercel env add AWS_REGION production  # us-east-1
vercel env add AWS_ACCESS_KEY_ID production  # [REDACTED]
vercel env add AWS_SECRET_ACCESS_KEY production  # [REDACTED]

# Authentication (already generated)
vercel env add JWT_SECRET production  # [REDACTED]
vercel env add SESSION_COOKIE_NAME production  # meme_radar_session

# App config
vercel env add NEXT_PUBLIC_APP_URL production  # https://your-domain.vercel.app
vercel env add NODE_ENV production  # production
```

#### 4. Create Production DynamoDB Tables

```bash
AWS_ACCESS_KEY_ID=[REDACTED] \
AWS_SECRET_ACCESS_KEY=[REDACTED] \
AWS_REGION=us-east-1 \
npx tsx scripts/init-db-production.ts
```

## Deploy

Once configured, push to main to trigger deployment:

```bash
git add .
git commit -m "Configure production deployment"
git push origin main
```

## Monitor Deployment

- **GitHub Actions**: https://github.com/markusbnet/thememeradar.com/actions
- **Vercel Dashboard**: https://vercel.com/dashboard
- **View logs**: `vercel logs --follow`

## Verify

After deployment:

1. **Health check**: `curl https://your-domain.vercel.app/api/health`
2. **Manual scan**: `curl -X POST https://your-domain.vercel.app/api/scan`
3. **View dashboard**: https://your-domain.vercel.app/dashboard
4. **Check cron**: Vercel Dashboard → Project → Settings → Crons

## Cost Monitoring

Your setup stays within free tiers:

- **Vercel**: 72 GB-hours/month (out of 100 free)
- **DynamoDB**: PAY_PER_REQUEST billing (free tier: 25GB, 200M requests/month)
- **Reddit API**: Free with OAuth (100 req/min limit)

Monitor usage:
- Vercel: https://vercel.com/dashboard/usage
- AWS: https://console.aws.amazon.com/billing/

## Troubleshooting

### Deployment fails

- Check GitHub Actions logs
- Verify all secrets are set: `gh secret list`
- Verify Vercel env vars: `vercel env ls`

### Cron not running

- Check Vercel Dashboard → Project → Settings → Crons
- Verify `vercel.json` is in repository root
- Check cron logs in Vercel Dashboard

### DynamoDB errors

- Verify IAM user has correct permissions
- Check table names match (memeradar- prefix in production)
- Verify AWS credentials in Vercel environment variables

## Support

- Full Documentation: `DEPLOYMENT.md`
- GitHub Issues: https://github.com/markusbnet/thememeradar.com/issues
