# The Meme Radar - Complete Remediation Plan

**Generated:** November 7, 2025
**Status:** Ready for implementation
**Total Work Remaining:** ~63 hours (3 weeks)

---

## 🎯 Executive Summary

A comprehensive gap analysis has identified **24 functionality gaps** across the codebase:
- **6 Critical gaps** blocking production (24 hours)
- **6 High priority gaps** needed for MVP quality (24 hours)
- **12 Medium/Low priority gaps** for polish (15 hours)

**Key Finding:** The project is **70-75% complete** with a solid foundation but missing critical components like the Stock Detail Page, database tables, and security features.

---

## 🔴 CRITICAL GAPS (Blocking - 24 hours)

### 1. Stock Detail Page - MISSING (8-10 hours)

**Current State:** Route doesn't exist; clicking stock cards leads to 404
**Required:** Full detail view at `/stock/[ticker]`

**Implementation Tasks:**
- [ ] Create `src/app/stock/[ticker]/page.tsx`
- [ ] Header component (ticker, sentiment, velocity)
- [ ] Charts: Mention count over time (7 days)
- [ ] Charts: Sentiment score over time (7 days)
- [ ] Subreddit Breakdown component
- [ ] Supporting Evidence section (top 5 posts by upvotes)
- [ ] Highlighted keywords in context
- [ ] Links to original Reddit posts
- [ ] Statistics table (24hr/7d/30d mentions, sentiment breakdown)

**Files to Create:**
```
src/app/stock/[ticker]/page.tsx
src/components/stock-detail/StockHeader.tsx
src/components/stock-detail/MentionChart.tsx
src/components/stock-detail/SentimentChart.tsx
src/components/stock-detail/SubredditBreakdown.tsx
src/components/stock-detail/EvidenceSection.tsx
src/components/stock-detail/StatsTable.tsx
```

---

### 2. Stock APIs - MISSING (4 hours)

**Current State:** Only `/api/stocks/trending` exists
**Required:** Individual stock endpoints

**Implementation Tasks:**
- [ ] Create `src/app/api/stocks/[ticker]/route.ts`
  - GET endpoint returning stock details
  - Include all 8 metrics
  - Historical data for charts
- [ ] Create `src/app/api/stocks/[ticker]/evidence/route.ts`
  - GET endpoint returning raw posts/comments
  - Filter by ticker from stock_evidence table
  - Include Reddit URLs
  - Pagination support (top 10 default)

**Files to Create:**
```
src/app/api/stocks/[ticker]/route.ts
src/app/api/stocks/[ticker]/evidence/route.ts
```

---

### 3. Health API - MISSING (30 minutes)

**Current State:** Endpoint doesn't exist
**Required:** `GET /api/health` for monitoring

**Implementation Tasks:**
- [ ] Create `src/app/api/health/route.ts`
- [ ] Check DynamoDB connectivity
- [ ] Check Reddit API token validity
- [ ] Return status + component health
- [ ] Add integration test

**Response Format:**
```json
{
  "status": "healthy",
  "timestamp": 1699363200,
  "services": {
    "database": "ok",
    "reddit": "ok"
  }
}
```

---

### 4. Posts & Comments Tables - MISSING (3 hours)

**Current State:** Not in schema; CLAUDE.md requires them
**Impact:** Cannot store raw Reddit data historically

**Implementation Tasks:**
- [ ] Add `posts` table to `src/lib/db/init-db.ts`
  - PK: postId
  - SK: scannedAt
  - Attributes: subreddit, title, body, author, upvotes, createdAt, tickers
  - GSI: subreddit-scannedAt-index
  - TTL: 30 days
- [ ] Add `comments` table
  - PK: commentId
  - SK: scannedAt
  - Attributes: postId, subreddit, body, author, upvotes, createdAt, tickers
  - GSI: postId-index
  - TTL: 30 days
- [ ] Update `saveScanResults()` to populate both tables
- [ ] Add tests for table creation
- [ ] Update production schema

**Schema Reference:** CLAUDE.md lines 275-323

---

### 5. Rate Limiting - MISSING (4 hours)

**Current State:** No protection; brute force attacks possible
**Required:** 5 attempts per 15 minutes (CLAUDE.md requirement)

**Implementation Tasks:**
- [ ] Create `src/lib/auth/rate-limiter.ts`
  - In-memory store (Map) for development
  - Redis-compatible interface for production (future)
  - Track attempts by IP + email
  - 5 attempts per 15 minutes window
- [ ] Create middleware for auth endpoints
- [ ] Apply to `/api/auth/signup` and `/api/auth/login`
- [ ] Return 429 status when limit exceeded
- [ ] Add unit tests
- [ ] Add integration tests

**Example Implementation:**
```typescript
// Rate limiter tracks: IP + email -> attempts[]
// Clean up entries older than 15 minutes
// Reject if 5+ attempts in window
```

---

### 6. CSRF Protection - MISSING (3 hours)

**Current State:** Only sameSite cookie protection
**Required:** Token-based CSRF validation

**Implementation Tasks:**
- [ ] Generate CSRF token on login/signup
- [ ] Store in httpOnly cookie separate from JWT
- [ ] Require CSRF header on POST/DELETE requests
- [ ] Create `src/lib/auth/csrf.ts`
  - Generate token function
  - Validate token function
- [ ] Add middleware to verify CSRF tokens
- [ ] Update client to send CSRF header
- [ ] Add tests

---

## 🟡 HIGH PRIORITY GAPS (MVP Quality - 24 hours)

### 7. Sparkline Charts - MISSING (5 hours)

**Current State:** StockCard shows no chart
**Required:** 7-day trend sparkline

**Implementation Tasks:**
- [ ] Choose chart library (recharts or lightweight SVG)
- [ ] Create `src/components/Sparkline.tsx`
- [ ] Fetch 7-day data from stock_mentions table
- [ ] Query by ticker + timestamp range
- [ ] Display mini line chart in StockCard
- [ ] Mobile responsive
- [ ] Add loading state
- [ ] Add tests

---

### 8. Multiple Time Periods - ONLY 15min (6 hours)

**Current State:** Only 15-minute intervals
**Required:** 15min, 1hr, 4hr, 24hr, 7d

**Implementation Tasks:**
- [ ] Update `roundToInterval()` in `src/lib/db/storage.ts`
  - Add support for multiple intervals
- [ ] Modify `saveScanResults()` to save to multiple time periods
  - Write to 15min, 1hr, 4hr, 24hr intervals
  - Use batch write for efficiency
- [ ] Update aggregation logic
  - Sum metrics across time windows
- [ ] Add time period selector to UI
- [ ] Update API to accept period parameter
- [ ] Add tests for each interval

**Database Impact:**
- 5x more writes per scan
- Still within DynamoDB free tier (200M requests/month)

---

### 9. Fetch ALL Comments - LIMITED (4 hours)

**Current State:** 100 comments max, depth=1 only
**Required:** ALL comments including nested

**Implementation Tasks:**
- [ ] Update `getPostComments()` in `src/lib/reddit.ts`
- [ ] Implement pagination loop
  - Use `after` parameter for pagination
  - Continue until no more comments
- [ ] Fetch nested comments (increase depth)
- [ ] Add exponential backoff for rate limits
- [ ] Respect 100 req/min Reddit limit
- [ ] Add tests with mocked pagination

**Reddit API Pagination:**
```
GET /comments?limit=100&after=t1_abc123
```

---

### 10. Exponential Backoff - MISSING (3 hours)

**Current State:** No retry logic
**Required:** Retry failed Reddit API calls with exponential backoff

**Implementation Tasks:**
- [ ] Create `src/lib/utils/retry.ts`
- [ ] Implement exponential backoff function
  - Initial delay: 2 seconds
  - Max retries: 4
  - Backoff: 2s, 4s, 8s, 16s
- [ ] Apply to all Reddit API calls
- [ ] Handle rate limit errors (429)
- [ ] Add logging
- [ ] Add tests

**CLAUDE.md Reference:** "retry up to 4 times with exponential backoff"

---

### 11. ±50 Word Sentiment Window - NOT IMPLEMENTED (4 hours)

**Current State:** Analyzes entire text
**Required:** Analyze ±50 words around ticker mention

**Implementation Tasks:**
- [ ] Update `analyzeSentiment()` in `src/lib/sentiment.ts`
- [ ] Find ticker position in text
- [ ] Extract ±50 words window
- [ ] Run sentiment analysis on window only
- [ ] Handle multiple mentions (analyze each)
- [ ] Return aggregated sentiment
- [ ] Add tests with windowed examples

**Impact:** More accurate sentiment scores

---

### 12. DD Count & Top Subreddit - MISSING (2 hours)

**Current State:** 6/8 metrics implemented
**Required:** All 8 metrics per CLAUDE.md

**Implementation Tasks:**
- [ ] Add `ddCount` to stock_mentions schema
- [ ] Detect "DD" flair or "Due Diligence" in title
- [ ] Increment ddCount in aggregation
- [ ] Add `topSubreddit` field
- [ ] Track mentions per subreddit
- [ ] Determine top subreddit (most mentions)
- [ ] Update API responses
- [ ] Add tests

**CLAUDE.md Reference:** Table in Metrics & Ranking section

---

## 🟢 MEDIUM PRIORITY GAPS (Polish - 15 hours)

### 13. Ticker Validation - NOT USED (1 hour)

**Current State:** `valid-tickers.json` exists but not imported
**Required:** Validate against NYSE/NASDAQ list

**Implementation Tasks:**
- [ ] Import `valid-tickers.json` in `src/lib/ticker-detection.ts`
- [ ] Add validation check after regex detection
- [ ] Filter out non-NYSE/NASDAQ tickers
- [ ] Keep blacklist for common words
- [ ] Add tests

---

### 14. Auto-refresh on New Data - TIMER ONLY (4 hours)

**Current State:** Only refreshes every 5 minutes
**Required:** Poll for new data and refresh when available

**Implementation Tasks:**
- [ ] Add timestamp to API responses
- [ ] Poll `/api/stocks/trending` every 30 seconds
- [ ] Compare timestamp with current data
- [ ] Refresh UI when new data detected
- [ ] Show "New data available" notification
- [ ] Add manual refresh button
- [ ] Optimize with React Query or SWR

---

### 15. Missing NPM Scripts (1 hour)

**Current State:** 3 scripts missing from package.json
**Required:** `db:reset`, `format`, `scan`

**Implementation Tasks:**
- [ ] Add `db:reset`: Drop and recreate tables
  ```json
  "db:reset": "npm run db:init && npm run db:seed"
  ```
- [ ] Add `format`: Run Prettier
  ```json
  "format": "prettier --write \"src/**/*.{ts,tsx}\""
  ```
- [ ] Add `scan`: Manual Reddit scan trigger
  ```json
  "scan": "tsx scripts/manual-scan.ts"
  ```
- [ ] Test all scripts

---

### 16. Mobile Optimization - NOT VERIFIED (6 hours)

**Current State:** Basic responsive layout, specific requirements not tested
**Required:** CLAUDE.md mobile requirements

**Implementation Tasks:**
- [ ] Verify touch targets (min 44×44px)
  - Stock cards
  - Navigation buttons
  - Form inputs
- [ ] Add swipeable cards (react-swipeable)
  - Swipe through trending stocks
  - Swipe to refresh
- [ ] Add collapsible sections
  - Stock evidence
  - Statistics tables
- [ ] Test responsive tables (stack on mobile)
- [ ] Measure load times (<2s target)
- [ ] Optimize fonts and images
- [ ] Test on real devices (iOS Safari, Chrome Android)

---

### 17. TTL Verification - NOT VERIFIED (1 hour)

**Current State:** `getTTL()` function exists; production not verified
**Required:** Verify TTL enabled on all tables

**Implementation Tasks:**
- [ ] Check DynamoDB table settings in AWS Console
- [ ] Verify TTL attribute enabled
- [ ] Verify TTL field name matches code (`ttl`)
- [ ] Test with old data (should auto-delete after 30 days)
- [ ] Document in deployment checklist

---

### 18. scan_history Table - NOT USED (2 hours)

**Current State:** Table created but never populated
**Required:** Track scan history for debugging

**Implementation Tasks:**
- [ ] Update `/api/scan` to write to scan_history
- [ ] Store: timestamp, subreddits scanned, posts fetched, errors
- [ ] Add query function for recent scans
- [ ] Display in diagnostic UI (optional)
- [ ] Add tests

---

### 19. Fading Stocks Filter - WRONG (1 hour)

**Current State:** Uses 5 mentions (same as trending)
**Required:** 10 mentions in previous period

**Implementation Tasks:**
- [ ] Update `getFadingStocks()` in `src/lib/db/storage.ts:242`
- [ ] Change filter from `current >= 5` to `previous >= 10`
- [ ] Ensure checking previous period, not current
- [ ] Add test for filter threshold
- [ ] Update documentation

---

### 20. Reddit URL Population - MISSING (1 hour)

**Current State:** Field exists in schema but not filled
**Required:** Store Reddit post/comment URLs

**Implementation Tasks:**
- [ ] Update `saveStockEvidence()` in `src/lib/db/storage.ts:161-175`
- [ ] Construct Reddit URL from post/comment ID
  - Post: `https://reddit.com/r/{subreddit}/comments/{postId}`
  - Comment: `https://reddit.com/r/{subreddit}/comments/{postId}/_/{commentId}`
- [ ] Add to evidence records
- [ ] Display links in Stock Detail Page
- [ ] Add test

---

## 🧪 Testing Gaps

### Integration Tests - BLOCKED (2 hours)

**Current State:** 20 tests failing due to DynamoDB Local not running
**Required:** Set up test environment

**Implementation Tasks:**
- [ ] Add DynamoDB Local to GitHub Actions workflow
  - Docker container in CI
- [ ] Update test setup to start/stop DynamoDB
- [ ] Add wait-for-db script
- [ ] Fix all 20 failing integration tests
- [ ] Verify in CI/CD

---

### Missing API Route Tests (3 hours)

**Current State:** 6 routes with no tests

**Implementation Tasks:**
- [ ] Test `/api/auth/logout` (1 test file)
- [ ] Test `/api/auth/me` (1 test file)
- [ ] Test `/api/scan` GET/POST (1 test file)
- [ ] Test `/api/stocks/trending` (1 test file)
- [ ] Test `/api/diagnostic` (1 test file)
- [ ] Test new `/api/stocks/:ticker` (when implemented)
- [ ] Test new `/api/stocks/:ticker/evidence` (when implemented)

---

### Component Tests - MISSING (2 hours)

**Current State:** No component tests

**Implementation Tasks:**
- [ ] Test `StockCard.tsx`
  - Renders correctly
  - Shows sentiment emoji
  - Displays velocity
  - Clickable link
- [ ] Test `RefreshTimer.tsx`
  - Countdown logic
  - Refresh callback
- [ ] Test new components (charts, detail page)

---

## 🔒 Security & Code Quality Gaps

### Console.log Violations - 24 INSTANCES (30 minutes)

**Files to Fix:**
- `src/lib/reddit.ts` (9 instances)
- `src/app/api/scan/route.ts` (7 instances)
- `src/lib/scanner/scanner.ts` (1 instance)
- `src/lib/auth/client.ts` (2 instances)
- 5 other API routes (1 each)

**Implementation Tasks:**
- [ ] Create `src/lib/logger.ts`
  - Structured logging
  - Environment-aware (silent in production)
  - Error tracking integration (Sentry/Datadog)
- [ ] Replace all `console.log` with logger
- [ ] Replace all `console.error` with logger
- [ ] Add ESLint rule to prevent future violations

---

### `any` Type Violations - 13 INSTANCES (1 hour)

**Implementation Tasks:**
- [ ] Fix error handling: `catch (error: any)` → `catch (error: unknown)`
- [ ] Create proper error types
- [ ] Update diagnostic route with proper types
- [ ] Update test-signup route
- [ ] Run `npx tsc --noEmit` to verify

---

## 📊 Implementation Timeline

### Week 1: Critical Fixes (40 hours)

**Monday-Tuesday (16h):**
- Posts & Comments tables (3h)
- Health API (0.5h)
- Stock APIs (:ticker, :ticker/evidence) (4h)
- Stock Detail Page - Phase 1 (8h)

**Wednesday-Thursday (16h):**
- Rate limiting (4h)
- CSRF protection (3h)
- Console.log cleanup (0.5h)
- `any` type fixes (1h)
- Stock Detail Page - Phase 2 (7.5h)

**Friday (8h):**
- Integration testing
- Bug fixes
- Code review
- Deploy to staging

**Deliverable:** Production-ready baseline

---

### Week 2: MVP Quality (40 hours)

**Monday-Tuesday (16h):**
- Sparkline charts (5h)
- Multi-period metrics (6h)
- DD Count & Top Subreddit (2h)
- Testing (3h)

**Wednesday-Thursday (16h):**
- Fetch ALL comments (4h)
- Exponential backoff (3h)
- ±50 word sentiment window (4h)
- Testing (5h)

**Friday (8h):**
- Integration testing
- E2E testing
- Performance testing
- Deploy to staging

**Deliverable:** Full-featured MVP

---

### Week 3: Polish (30 hours)

**Monday-Tuesday (16h):**
- Mobile optimization (6h)
- Auto-refresh (4h)
- Ticker validation (1h)
- Missing npm scripts (1h)
- Testing (4h)

**Wednesday-Thursday (14h):**
- TTL verification (1h)
- scan_history usage (2h)
- Fading filter fix (1h)
- Reddit URL population (1h)
- Final E2E testing (4h)
- Performance optimization (3h)
- Documentation (2h)

**Friday:**
- Production deployment
- Monitoring setup
- Launch! 🚀

**Deliverable:** Production-ready app

---

## 🎯 Definition of Done

Before marking any task complete, verify:

- [ ] All linters pass (zero issues)
- [ ] All tests pass (unit + integration + e2e)
- [ ] Feature works end-to-end locally
- [ ] No console.log statements
- [ ] No `any` types
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Committed and pushed

---

## 📈 Progress Tracking

**Current Status:** 70% complete (as of Nov 7, 2025)

**Weekly Goals:**
- Week 1: 85% complete (critical fixes)
- Week 2: 95% complete (MVP features)
- Week 3: 100% complete (polish + launch)

**Track progress in GitHub Issues or Project Board**

---

## 🚀 Quick Start

To begin implementation:

```bash
# 1. Create a new branch
git checkout -b feature/remediation-phase-1

# 2. Start with highest priority items
# Begin with Posts & Comments tables (foundational)

# 3. Work through checklist systematically
# Update this document as items are completed

# 4. Run tests frequently
npm run test

# 5. Commit often
git add . && git commit -m "feat: add posts/comments tables"
```

---

**Last Updated:** November 7, 2025
**Next Review:** After Week 1 completion
**Owner:** Development Team
