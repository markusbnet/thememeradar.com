# CLAUDE.md - Meme Stock Radar Development Guide

## 🎯 Project Overview

**The Meme Radar** - A financial intelligence app that tracks meme stock trends from Reddit communities.

**What it does:**
- Monitors Reddit communities (r/wallstreetbets, r/stocks, r/investing) for stock mentions
- Analyzes sentiment using wallstreetbets terminology and slang
- Tracks which stocks are gaining or losing attention
- Displays trending stocks with real-time data and historical charts
- Provides transparency by showing raw posts/comments that influenced sentiment decisions

**Production URL:** TBD (will be hosted on Vercel)
**Status:** Greenfield project - building from scratch

---

## 🏗️ Tech Stack

**Frontend:**
- Next.js 14+ (App Router)
- React Server Components
- TypeScript (strict mode)
- Tailwind CSS (with Tailwind UI components)
- Mobile-first responsive design

**Backend:**
- Next.js API Routes (serverless functions)
- DynamoDB (AWS) - local development via DynamoDB Local
- Reddit API (OAuth 2.0 authentication)
- Vercel Cron Jobs (scheduled background tasks)

**Authentication:**
- Email + password (for all real users)
- No social OAuth login (Google, GitHub, etc.)
- JWT tokens for session management
- Secure password hashing (bcrypt)
- Email validation (format check, no verification email for MVP)
- Note: Reddit OAuth still needed for API access (separate from user login)

**Testing:**
- Jest (unit & integration tests)
- Playwright (E2E tests)
- Test-driven development (TDD) for all features

**Deployment:**
- Vercel (Hobby/Free tier)
- GitHub Actions CI/CD (automated testing + deployment)

---

## 💰 Cost Constraints

**Target: <$5/month (Currently: $0/month)**

**Cost Breakdown:**
- Vercel Hosting: **$0** (Hobby plan, 100GB bandwidth)
- DynamoDB: **$0** (Free tier: 25GB storage, 200M requests/month)
- Reddit API: **$0** (Free with OAuth, 100 req/min limit)
- GitHub Actions: **$0** (Free tier: 2,000 minutes/month)

**Usage Estimates:**
- Reddit API: ~15-16 requests/minute average (well within 100 req/min limit)
- DynamoDB Storage: ~8-10GB/month (within 25GB free tier)
- DynamoDB Requests: ~2M writes/month (within 200M free tier)
- Vercel Functions: ~72 GB-hours/month (within 100 GB-hours free tier)

**Cost Control Measures:**
- Use DynamoDB TTL to auto-expire data after 30 days
- Cache Reddit API responses (respect rate limits)
- Batch write operations to DynamoDB
- Monitor usage dashboards monthly
- Never exceed free tier limits

---

## 📋 Requirements and Best Practices

**Golden Rules:**
1. **Always use test-driven development (TDD)**
2. **Always read every line of code and every test before making changes**
3. **Always plan what you're implementing before writing code**
4. **Always run all tests locally before committing**
5. **Never skip tests - always fix them or fix the codebase**
6. **All tests must pass before deployment**
7. **Delete old code when replacing - no migration layers**

**Development Workflow:**
1. Research existing code and tests
2. Plan the implementation (get approval)
3. Write tests first (TDD)
4. Implement the feature
5. Verify all tests pass
6. Commit and push to trigger CI/CD

**When stuck:**
- Stop and re-read CLAUDE.md
- Consider spawning multiple agents for parallel work
- Ask questions before making assumptions
- Simplify - simple solutions are usually correct

---

## 🔍 Reddit Data Collection

### Subreddits to Track

**Initial (MVP):**
1. r/wallstreetbets (primary source for meme stocks)
2. r/stocks (broader stock discussion)
3. r/investing (general investment discussion)

**Future consideration:**
- r/pennystocks
- r/options
- r/SecurityAnalysis
- Others based on user feedback

### Scanning Configuration

**Frequency:** Every 5 minutes (288 scans/day)
- 3x more frequent than 15-minute scans
- Still within Vercel free tier (72 GB-hours/month out of 100 GB-hours limit)
- Configurable in UI (display current refresh rate)
- Runs via Vercel Cron Jobs

**Data to Collect:**
- **Posts:** Title, body, author, upvotes, timestamp, subreddit
- **Comments:** Body, author, upvotes, timestamp
- **Stock tickers:** Extract from text using regex + validation
- **Sentiment indicators:** Keywords and phrases (see below)

**Per Scan:**
- Fetch top 25 hot posts from each subreddit (3 requests)
- Fetch all comments for each post (75 requests)
- Total: ~78 API requests per scan
- At 5-minute intervals: ~15.6 requests/minute average (within 100/min limit)
- Peak during scan: 78 requests in ~30 seconds (well within limits)

### Stock Ticker Detection

**Regex Patterns:**
- `$SYMBOL` format (e.g., $GME, $AMC, $TSLA)
- Standalone uppercase 1-5 letter symbols (e.g., GME, AAPL)
- Validate against NYSE/NASDAQ ticker list

**False Positive Filtering:**
- Exclude common words: $FOR, $IT, $ARE, $OR, $ON, $BY, $AT, $TO, $IN, $A, $I
- Exclude single-letter tickers unless prefixed with $
- Maintain blacklist of non-ticker words

---

## 📊 Sentiment Analysis

### WallStreetBets Terminology

**Research Sources:**
- Active monitoring of r/wallstreetbets
- Community glossaries and guides
- Real-time slang updates (2025 current)

**Bullish Indicators (Positive Sentiment):**

| Term | Meaning | Weight |
|------|---------|--------|
| 💎🙌 Diamond Hands | Holding through volatility with conviction | High |
| 🚀 To the Moon | Expecting big upside move | High |
| 🦍 Ape/Apes | Retail investors united on meme stocks | Medium |
| 🍗 Tendies | Profits/gains | Medium |
| YOLO | Betting it all on a position | High |
| DD (Due Diligence) | Deeply researched technical post | High |
| Buy the dip | Buying during price drops | Medium |
| HODL | Hold on for dear life | High |
| Long | Long position (bullish) | Medium |
| Calls | Call options (bullish bet) | Medium |
| Squeeze | Short squeeze potential | High |
| Gamma squeeze | Options-driven price spike | High |
| Stonk | Deliberate misspelling of "stock" (usually bullish) | Low |
| Brrrr | Money printer (bullish market) | Medium |

**Bearish Indicators (Negative Sentiment):**

| Term | Meaning | Weight |
|------|---------|--------|
| 📄 Paper Hands | Selling quickly out of fear | High |
| Puts | Put options (bearish bet) | High |
| Short | Short position (bearish) | High |
| Dump | Selling pressure | High |
| Rug pull | Scam/collapse | High |
| Bag holder | Holding losing position | Medium |
| FUD | Fear, Uncertainty, Doubt | Medium |
| Bear | Bearish market view | Medium |
| Crash | Market decline | High |

**Neutral/Contextual:**
- DD (Due Diligence) - Can be bullish or bearish depending on content
- Loss/Gain posts - Requires context analysis

### Sentiment Scoring

**Algorithm:**
1. Extract all mentions of a stock ticker
2. For each mention, analyze surrounding text (±50 words)
3. Count bullish vs bearish keywords
4. Apply keyword weights
5. Calculate sentiment score: `(bullish_weighted - bearish_weighted) / total_mentions`
6. Store raw post/comment text for transparency

**Sentiment Categories:**
- **Strong Bullish:** Score > 0.6
- **Bullish:** Score 0.2 to 0.6
- **Neutral:** Score -0.2 to 0.2
- **Bearish:** Score -0.6 to -0.2
- **Strong Bearish:** Score < -0.6

### Raw Output Storage

**For each stock mention, store:**
- Post/comment text (raw)
- Detected keywords and their weights
- Calculated sentiment score
- Reasoning for sentiment decision
- Link to original Reddit post/comment

**User Transparency:**
- Users can click on any stock to see supporting evidence
- Display sample posts/comments that influenced sentiment
- Show keyword matches highlighted in context
- Link to original Reddit threads

---

## 📈 Metrics & Ranking

### Stock Metrics to Track

**Per Stock, Per Time Period (15min, 1hr, 4hr, 24hr, 7d):**
1. **Mention Count:** Total number of mentions
2. **Unique Posts:** Number of distinct posts mentioning stock
3. **Unique Comments:** Number of distinct comments mentioning stock
4. **Sentiment Score:** Weighted average sentiment
5. **Velocity:** Rate of mention increase/decrease vs previous period
6. **Upvote Score:** Sum of upvotes on posts mentioning stock
7. **DD Count:** Number of Due Diligence posts
8. **Top Subreddit:** Which subreddit has most mentions

### Ranking Algorithm

**Top 10 Trending Stocks (Rising):**
- Primary: Mention velocity (biggest % increase in last 1 hour vs previous 1 hour)
- Secondary: Total mention count (tie-breaker)
- Filter: Minimum 5 mentions in last hour (reduce noise)

**Top 10 Fading Stocks (Losing Interest):**
- Primary: Mention velocity (biggest % decrease in last 1 hour vs previous 1 hour)
- Secondary: Total mention count (tie-breaker)
- Filter: Minimum 10 mentions in previous period (avoid false signals)

---

## 🎨 User Interface Requirements

### Design System
- **Framework:** Tailwind CSS
- **Components:** Tailwind UI (official component library)
- **Theme:** Modern, clean, professional
- **Mobile-first:** All features must work perfectly on mobile

### Main Dashboard

**Layout:**
```
┌─────────────────────────────────────────────┐
│ Header: Logo | Refresh Timer | User Menu   │
├─────────────────────────────────────────────┤
│ 📈 Top 10 Trending (Rising)                 │
│ ┌─────────────────────────────────────────┐ │
│ │ #1 $GME  ↑ 245%  🚀💎 Bullish  1.2K    │ │
│ │ #2 $AMC  ↑ 180%  🦍 Bullish  890       │ │
│ │ ...                                     │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ 📉 Top 10 Fading (Dropping Off)             │
│ ┌─────────────────────────────────────────┐ │
│ │ #1 $BBBY ↓ -65%  📄 Bearish  320       │ │
│ │ #2 $WISH ↓ -45%  😐 Neutral  210       │ │
│ │ ...                                     │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Stock Card Components:**
- Ticker symbol (large, bold)
- Velocity indicator (↑↓ with percentage)
- Sentiment emoji + label
- Mention count
- Sparkline chart (7-day trend)
- Click to expand details

**Refresh Timer:**
- Display: "Last updated: 1 minute ago"
- Show: "Next update in: 4 minutes"
- Auto-refresh UI when new data arrives

### Stock Detail Page

**Clicking a stock shows:**
1. **Header:** Ticker, current sentiment, velocity
2. **Charts:**
   - Mention count over time (7 days)
   - Sentiment score over time (7 days)
3. **Subreddit Breakdown:** Where mentions are coming from
4. **Supporting Evidence:**
   - Sample posts/comments (top 5 by upvotes)
   - Highlighted keywords in context
   - Link to original Reddit threads
5. **Statistics Table:**
   - Total mentions (24hr, 7d, 30d)
   - Sentiment breakdown (% bullish/neutral/bearish)
   - Top keywords associated with ticker

### Mobile Optimization

**Requirements:**
- Touch-friendly tap targets (min 44×44px)
- Swipeable cards
- Collapsible sections
- Responsive tables (stack on mobile)
- Fast load times (<2s)
- Optimized images and fonts

---

## 🔐 Authentication

### Requirements

**User Sign-up:**
- Email (required, validated format, unique)
- Password (required, min 8 chars, complexity rules)
- No email verification for MVP (just format validation)
- No username field

**User Login:**
- Email + password
- JWT token issued on successful auth
- Token stored in httpOnly cookie
- 7-day session expiration

**Security:**
- Bcrypt password hashing (10 rounds)
- Rate limiting on auth endpoints (5 attempts per 15 min)
- HTTPS only in production
- CSRF protection
- Input validation and sanitization
- Email uniqueness enforcement
- Email format validation (regex)

**No Social Login:**
- Email/password only for MVP
- Reddit OAuth is only for API access (not user login)
- Future: Consider email verification, password recovery

---

## 🗄️ DynamoDB Schema Design

### Table 1: `users`

**Primary Key:** `userId` (String)

**Attributes:**
- `userId`: UUID (PK)
- `email`: String (unique, validated format)
- `passwordHash`: String
- `createdAt`: Number (timestamp)
- `lastLoginAt`: Number (timestamp)

**GSI:** `email-index` (email as PK, for login lookups)

### Table 2: `posts`

**Primary Key:** `postId` (String)
**Sort Key:** `scannedAt` (Number, timestamp)

**Attributes:**
- `postId`: String (Reddit post ID)
- `subreddit`: String
- `title`: String
- `body`: String
- `author`: String
- `upvotes`: Number
- `createdAt`: Number (Reddit timestamp)
- `scannedAt`: Number (when we fetched it)
- `tickers`: List<String> (extracted tickers)
- `ttl`: Number (expires after 30 days)

**GSI:** `subreddit-scannedAt-index` (query posts by subreddit)

### Table 3: `comments`

**Primary Key:** `commentId` (String)
**Sort Key:** `scannedAt` (Number, timestamp)

**Attributes:**
- `commentId`: String (Reddit comment ID)
- `postId`: String (parent post)
- `subreddit`: String
- `body`: String
- `author`: String
- `upvotes`: Number
- `createdAt`: Number
- `scannedAt`: Number
- `tickers`: List<String>
- `ttl`: Number (expires after 30 days)

**GSI:** `postId-index` (query comments by post)

### Table 4: `stock_mentions`

**Primary Key:** `ticker` (String)
**Sort Key:** `timestamp` (Number)

**Attributes:**
- `ticker`: String (e.g., "GME")
- `timestamp`: Number (rounded to 15-min intervals)
- `mentionCount`: Number
- `uniquePosts`: Number
- `uniqueComments`: Number
- `sentimentScore`: Number (-1 to 1)
- `bullishCount`: Number
- `bearishCount`: Number
- `neutralCount`: Number
- `upvoteScore`: Number
- `subredditBreakdown`: Map<String, Number>
- `topKeywords`: List<String>
- `ttl`: Number (expires after 30 days)

**GSI:** `timestamp-index` (query all stocks at a time period)

### Table 5: `stock_evidence`

**Primary Key:** `ticker` (String)
**Sort Key:** `evidenceId` (String)

**Attributes:**
- `ticker`: String
- `evidenceId`: String (postId or commentId)
- `type`: String ("post" or "comment")
- `text`: String (raw content)
- `keywords`: List<String> (detected keywords)
- `sentimentScore`: Number
- `upvotes`: Number
- `subreddit`: String
- `redditUrl`: String (link to original)
- `createdAt`: Number
- `ttl`: Number (expires after 30 days)

**Purpose:** Store raw evidence for user transparency

---

## 🧪 Testing Protocol

### Test Organization

```
/tests
  ├─ /unit              → Unit tests (pure functions, utilities)
  ├─ /integration       → Integration tests (API routes, DB operations)
  └─ /e2e               → End-to-end tests (Playwright UI tests)
```

**All test files MUST be in `/tests` directory.**

### Test Users

**Standardized Test Users (for automated tests only):**
- Email: `testuser@thememeradar.test`
- Password: `TestUser123!`
- This user should be seeded in test database

**Real Users (production & development):**
- Must sign up with valid email + password
- Email format validation required
- No email verification for MVP (just format check)

**Do NOT create random test users in tests.**

### Testing Requirements

**Test-Driven Development (TDD):**
- Complex logic: Write tests FIRST
- Simple CRUD: Write tests AFTER
- Always required: E2E tests for user flows

**Test Coverage:**
- Unit tests: All utility functions, sentiment analysis, ticker detection
- Integration tests: All API routes, DynamoDB operations, Reddit API integration
- E2E tests: Authentication flows, dashboard, stock detail pages

**Before Committing:**
```bash
# Run all tests
npm run test

# Run E2E tests
npm run test:e2e

# Run linting
npm run lint

# All must pass ✅
```

### Definition of Done

**Code is complete when:**
- ✅ All linters pass (zero issues)
- ✅ All tests pass (unit + integration + e2e)
- ✅ Feature works end-to-end locally
- ✅ Old code deleted (no migration layers)
- ✅ Documented in code comments where complex

**If ANY test fails: STOP, investigate, fix, re-run.**

---

## 🚀 Development Workflow

### Local Development Setup

**Prerequisites:**
- Node.js 18+ (LTS)
- npm or pnpm
- Docker (for DynamoDB Local)
- AWS CLI (configured with local credentials)

**One-Time Setup:**

```bash
# 1. Initialize Next.js project (if not already done)
npx create-next-app@latest thememeradar --typescript --tailwind --app --src-dir

# 2. Install dependencies
npm install aws-sdk @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
npm install -D jest @testing-library/react @testing-library/jest-dom playwright

# 3. Start DynamoDB Local (Docker)
docker run -p 8000:8000 amazon/dynamodb-local

# 4. Create local DynamoDB tables
npm run db:init

# 5. Set up Reddit API credentials (create OAuth app at reddit.com/prefs/apps)
# Add to .env.local:
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
REDDIT_USER_AGENT=MemeRadar/1.0
```

**Daily Development:**

```bash
# Kill any existing processes on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null

# Start Next.js dev server
npm run dev

# In another terminal, run DynamoDB Local (if not running)
docker start dynamodb-local

# Run tests in watch mode (separate terminal)
npm run test:watch
```

### Development Commands

```bash
# Development
npm run dev                    # Start Next.js dev server (localhost:3000)

# Testing
npm run test                   # Run all unit & integration tests
npm run test:watch            # Run tests in watch mode
npm run test:e2e              # Run Playwright E2E tests
npm run test:e2e:headed       # Run E2E tests with browser visible

# Database
npm run db:init               # Create DynamoDB tables locally
npm run db:seed               # Seed test data
npm run db:reset              # Drop and recreate tables

# Linting & Formatting
npm run lint                  # ESLint
npm run format                # Prettier

# Build
npm run build                 # Production build
npm run start                 # Start production server locally

# Manual Reddit Scan (for testing)
npm run scan                  # Trigger one-time Reddit scan
```

---

## 🏭 Deployment Protocol

### Pre-Deployment Checklist

**BLOCKING - Must complete before deploying:**

```bash
# 1. All tests pass locally
npm run test && npm run test:e2e

# 2. Linting passes
npm run lint

# 3. Build succeeds
npm run build

# 4. Manual smoke test
npm run start  # Test production build locally

# 5. Commit and push to main (triggers CI/CD)
git add .
git commit -m "feat: descriptive message"
git push origin main
```

### GitHub Actions CI/CD

**Workflow triggered on push to `main`:**
1. Checkout code
2. Install dependencies
3. Run unit & integration tests
4. Run E2E tests
5. Build Next.js app
6. Deploy to Vercel production
7. Run production smoke tests
8. Post-deployment health check

**Monitor deployment:**
- GitHub Actions: https://github.com/YOUR_USERNAME/thememeradar/actions
- Vercel Dashboard: https://vercel.com/dashboard

### Post-Deployment Verification

```bash
# 1. Health check
curl https://thememeradar.com/api/health

# 2. Test authentication
# (Manual browser test: sign up, log in, view dashboard)

# 3. Verify Reddit data is being collected
# (Check dashboard shows stocks)

# 4. Check DynamoDB for recent data
# (AWS Console or CLI)
```

---

## 🛠️ Code Standards

### TypeScript

**Prohibited:**
- ❌ `any` types (use proper types or `unknown`)
- ❌ `console.log` in production code (use proper logging)
- ❌ Old + new code coexisting (delete old implementations)
- ❌ TODO comments in committed code (use TODO.md)

**Required:**
- ✅ Strict TypeScript mode
- ✅ Proper type definitions for all functions
- ✅ Early returns to reduce nesting
- ✅ Descriptive variable names

### React/Next.js

**Patterns:**
- ✅ Functional components with hooks
- ✅ Server Components by default (App Router)
- ✅ Client Components only when needed ('use client')
- ✅ Composition over inheritance
- ✅ Proper error boundaries

**File Structure:**
```
src/
├─ app/                     → Next.js App Router
│  ├─ (auth)/               → Auth group
│  │  ├─ login/
│  │  └─ signup/
│  ├─ dashboard/            → Main dashboard
│  ├─ stock/[ticker]/       → Stock detail pages
│  ├─ api/                  → API routes
│  │  ├─ auth/
│  │  ├─ stocks/
│  │  └─ scan/              → Reddit scan cron job
│  ├─ layout.tsx
│  └─ page.tsx
├─ components/              → React components
│  ├─ ui/                   → Tailwind UI components
│  ├─ StockCard.tsx
│  ├─ StockChart.tsx
│  └─ ...
├─ lib/                     → Utility libraries
│  ├─ db.ts                 → DynamoDB client
│  ├─ reddit.ts             → Reddit API client
│  ├─ sentiment.ts          → Sentiment analysis
│  ├─ ticker-detection.ts   → Ticker extraction
│  └─ auth.ts               → Authentication utilities
├─ types/                   → TypeScript types
└─ config/                  → Configuration files
```

### API Design

**RESTful Conventions:**
```typescript
GET    /api/stocks                → List top stocks
GET    /api/stocks/:ticker        → Get stock details
GET    /api/stocks/:ticker/evidence → Get raw posts/comments
POST   /api/auth/signup           → Create user
POST   /api/auth/login            → Login user
POST   /api/auth/logout           → Logout user
GET    /api/health                → Health check
POST   /api/scan                  → Trigger Reddit scan (cron)
```

**Response Format:**
```typescript
// Success
{
  success: true,
  data: { ... }
}

// Error
{
  success: false,
  error: "Error message"
}
```

---

## 📝 Future Features

**Track in TODO.md (not in this file):**

### Phase 2 (Post-MVP)
- Watchlists (users can save favorite stocks)
- Alerts (email/push when watchlist stock trends)
- User preferences (customize scan frequency, subreddits)
- Export data (CSV/JSON download)

### Phase 3
- Stock price integration (Alpha Vantage API)
- Correlation analysis (Reddit activity vs stock price)
- More subreddits (r/pennystocks, r/options, etc.)
- Advanced sentiment (NLP, machine learning)

### Phase 4
- Mobile app (React Native)
- Social features (share stocks, discussions)
- Premium tier (real-time updates, more stocks, advanced analytics)

---

## 🧠 Problem-Solving Protocol

**When stuck:**
1. **Stop** - Don't spiral into complexity
2. **Re-read** - Review this CLAUDE.md file
3. **Research** - Read existing code and tests
4. **Delegate** - Spawn agents for parallel investigation
5. **Simplify** - Simple solution is usually correct
6. **Ask** - "I see two approaches: [A] vs [B]. Which do you prefer?"

**Communication style:**
```
✓ Implemented Reddit API integration (all tests passing)
✓ Added sentiment analysis with wallstreetbets terminology
✗ Found issue with ticker detection - investigating false positives
```

---

## 📚 Reference

### Environment Variables

**Local Development (`.env.local`):**
```bash
# Reddit API
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
REDDIT_USER_AGENT=MemeRadar/1.0

# DynamoDB Local
DYNAMODB_ENDPOINT=http://localhost:8000
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local

# Authentication
JWT_SECRET=generate_with_openssl_rand_base64_32
SESSION_COOKIE_NAME=meme_radar_session

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

**Production (Vercel Environment Variables):**
```bash
# Reddit API (same as local)
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=

# DynamoDB Production
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=       # IAM user with DynamoDB access
AWS_SECRET_ACCESS_KEY=

# Authentication
JWT_SECRET=              # Generate new for production
SESSION_COOKIE_NAME=meme_radar_session

# App
NEXT_PUBLIC_APP_URL=https://thememeradar.com
NODE_ENV=production
```

### Useful Commands

```bash
# Monitor Vercel logs (real-time)
vercel logs --follow

# Check DynamoDB table size
aws dynamodb describe-table --table-name stock_mentions --endpoint-url http://localhost:8000

# Test Reddit API connection
curl -X POST https://www.reddit.com/api/v1/access_token \
  -u "CLIENT_ID:CLIENT_SECRET" \
  -d "grant_type=client_credentials"

# Generate JWT secret
openssl rand -base64 32
```

---

## 🎯 Working Memory Management

**When context gets long:**
- Re-read CLAUDE.md (this file)
- Review TODO.md for current tasks
- Check recent git commits for context

**Every 30 minutes:**
- Verify you're following TDD
- Check all tests still pass
- Update TODO.md with progress

---

**Last updated:** 2025-10-22
**Status:** Greenfield project initialization
**Remember:** Always test locally before deploying. All tests must pass. Simple solutions are best.
