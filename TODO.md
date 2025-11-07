# The Meme Radar - Implementation TODO

**Created:** November 7, 2025
**Status:** In Progress - Gap Remediation
**Total Work:** ~63 hours remaining

---

## 🔴 PHASE 1: CRITICAL FIXES (24 hours) - IN PROGRESS

### Week 1 - Day 1-2 (16 hours)

- [ ] **1. Posts & Comments Database Tables (3h)** - HIGH PRIORITY
  - [ ] Add `posts` table schema to init-db.ts
    - PK: postId, SK: scannedAt
    - Attributes: subreddit, title, body, author, upvotes, createdAt, tickers
    - GSI: subreddit-scannedAt-index
    - TTL: 30 days
  - [ ] Add `comments` table schema to init-db.ts
    - PK: commentId, SK: scannedAt
    - Attributes: postId, subreddit, body, author, upvotes, createdAt, tickers
    - GSI: postId-index
    - TTL: 30 days
  - [ ] Update saveScanResults() to populate both tables
  - [ ] Run db:init to create tables
  - [ ] Add tests for table creation
  - [ ] Verify tables exist locally

- [ ] **2. Health API Endpoint (30min)** - QUICK WIN
  - [ ] Create src/app/api/health/route.ts
  - [ ] Check DynamoDB connectivity
  - [ ] Check Reddit API token validity (optional for MVP)
  - [ ] Return JSON with status + timestamp
  - [ ] Add integration test
  - [ ] Test endpoint manually

- [ ] **3. Stock Detail APIs (4h)**
  - [ ] Create src/app/api/stocks/[ticker]/route.ts
    - GET endpoint
    - Query stock_mentions by ticker
    - Return all 8 metrics
    - Include historical data (7 days)
    - Error handling (404 if ticker not found)
  - [ ] Create src/app/api/stocks/[ticker]/evidence/route.ts
    - GET endpoint
    - Query stock_evidence by ticker
    - Return top 10 posts/comments by upvotes
    - Include Reddit URLs
    - Pagination support (optional for MVP)
  - [ ] Add integration tests for both endpoints
  - [ ] Test manually with curl

- [ ] **4. Stock Detail Page - Phase 1 (8h)**
  - [ ] Create src/app/stock/[ticker]/page.tsx
    - Server Component with data fetching
    - Error boundary
    - Loading state
  - [ ] Create src/components/stock-detail/StockHeader.tsx
    - Display ticker symbol (large)
    - Current sentiment with emoji
    - Velocity indicator
  - [ ] Create src/components/stock-detail/EvidenceSection.tsx
    - List top 5 posts/comments
    - Show upvotes, subreddit
    - Highlight keywords (Phase 2)
    - Link to Reddit (use redditUrl from evidence)
  - [ ] Create src/components/stock-detail/StatsTable.tsx
    - Total mentions (24hr, 7d)
    - Sentiment breakdown (% bullish/neutral/bearish)
    - Top keywords
  - [ ] Test page navigation from dashboard
  - [ ] Mobile responsive check

### Week 1 - Day 3-4 (16 hours)

- [ ] **5. Rate Limiting Middleware (4h)**
  - [ ] Create src/lib/auth/rate-limiter.ts
    - In-memory Map store
    - Track by IP + email
    - 5 attempts per 15 minutes
    - Clean up old entries
  - [ ] Create src/lib/auth/rate-limit-middleware.ts
    - Extract IP from request
    - Check rate limit before processing
    - Return 429 if exceeded
  - [ ] Apply to /api/auth/signup
  - [ ] Apply to /api/auth/login
  - [ ] Add unit tests (rate limiter logic)
  - [ ] Add integration tests (429 responses)
  - [ ] Test manually (make 6+ requests)

- [ ] **6. CSRF Protection (3h)**
  - [ ] Create src/lib/auth/csrf.ts
    - generateCSRFToken() function
    - validateCSRFToken() function
    - Use crypto.randomBytes(32)
  - [ ] Update login/signup to set CSRF cookie
    - Separate from JWT cookie
    - httpOnly: false (client needs to read)
    - sameSite: 'strict'
  - [ ] Create CSRF validation middleware
    - Check X-CSRF-Token header
    - Compare with cookie value
  - [ ] Apply to POST/DELETE endpoints
    - /api/auth/logout
    - /api/scan (if exposed)
  - [ ] Update client components to send CSRF header
  - [ ] Add tests
  - [ ] Test CSRF attack scenario

- [ ] **7. Code Quality Fixes (1.5h)**
  - [ ] Create src/lib/logger.ts
    - Environment-aware logging
    - Levels: debug, info, warn, error
    - Silent in production (or use proper service)
  - [ ] Replace all console.log (24 instances)
    - src/lib/reddit.ts (9)
    - src/app/api/scan/route.ts (7)
    - src/lib/scanner/scanner.ts (1)
    - src/lib/auth/client.ts (2)
    - Other routes (5)
  - [ ] Fix all `any` types (13 instances)
    - Error handling: catch (error: unknown)
    - Create proper error types
    - Update diagnostic route types
  - [ ] Run npx tsc --noEmit
  - [ ] Run npm run lint
  - [ ] All tests must pass

- [ ] **8. Stock Detail Page - Phase 2 (7.5h)**
  - [ ] Create src/components/stock-detail/MentionChart.tsx
    - Placeholder for sparkline (Phase 2)
    - Or simple text: "Chart coming soon"
  - [ ] Create src/components/stock-detail/SentimentChart.tsx
    - Placeholder for sentiment over time
  - [ ] Create src/components/stock-detail/SubredditBreakdown.tsx
    - Pie chart or bar chart of mentions by subreddit
    - Or simple table for MVP
  - [ ] Enhance EvidenceSection
    - Highlight keywords in context
    - Color-code sentiment (bullish=green, bearish=red)
  - [ ] Add E2E test for stock detail page
    - Navigate from dashboard
    - Verify data loads
    - Check evidence links
  - [ ] Polish UI/UX
  - [ ] Mobile testing

### Week 1 - Day 5 (8 hours)

- [ ] **9. Integration Testing & Bug Fixes**
  - [ ] Set up DynamoDB Local in test environment
    - Docker container start/stop in tests
    - Or use testcontainers
  - [ ] Fix 20 failing integration tests
  - [ ] Run full test suite
    - npm run test (unit + integration)
    - npm run test:e2e
  - [ ] Fix any failing tests
  - [ ] Manual QA testing
    - Sign up new user
    - Log in
    - View dashboard
    - Click stock → detail page
    - View evidence
    - Log out
  - [ ] Check rate limiting works
  - [ ] Check CSRF protection works
  - [ ] Test health endpoint
  - [ ] Fix bugs found

- [ ] **10. Code Review & Deploy to Staging**
  - [ ] Self code review
    - No console.log
    - No `any` types
    - All tests passing
    - CLAUDE.md compliance
  - [ ] Run linter: npm run lint
  - [ ] Run build: npm run build
  - [ ] Test production build locally: npm run start
  - [ ] Commit all changes
  - [ ] Push to branch
  - [ ] Deploy to Vercel staging (if available)
  - [ ] Smoke test on staging

---

## 🟡 PHASE 2: MVP QUALITY (24 hours) - PENDING

### Week 2 - Day 6-7 (16 hours)

- [ ] **11. Sparkline Charts (5h)**
  - [ ] Choose chart library (recharts recommended)
  - [ ] Install: npm install recharts
  - [ ] Create src/components/Sparkline.tsx
  - [ ] Fetch 7-day data in StockCard
  - [ ] Display mini line chart
  - [ ] Mobile responsive
  - [ ] Add to Stock Detail page charts
  - [ ] Tests

- [ ] **12. Multi-Period Metrics (6h)**
  - [ ] Update roundToInterval() for 1hr, 4hr, 24hr, 7d
  - [ ] Modify saveScanResults() to save to multiple periods
  - [ ] Use batch write for efficiency
  - [ ] Add time period selector to UI
  - [ ] Update API to accept period parameter
  - [ ] Tests for each interval
  - [ ] Verify DynamoDB write volume (still in free tier)

- [ ] **13. DD Count & Top Subreddit (2h)**
  - [ ] Add ddCount to stock_mentions schema
  - [ ] Detect DD flair/title
  - [ ] Add topSubreddit field
  - [ ] Track mentions per subreddit
  - [ ] Update API responses
  - [ ] Display in UI
  - [ ] Tests

- [ ] **14. Testing (3h)**
  - [ ] Add tests for sparkline component
  - [ ] Add tests for multi-period metrics
  - [ ] Add tests for new fields
  - [ ] E2E tests for charts
  - [ ] Fix any broken tests

### Week 2 - Day 8-9 (16 hours)

- [ ] **15. Fetch ALL Comments (4h)**
  - [ ] Update getPostComments() in reddit.ts
  - [ ] Implement pagination loop
  - [ ] Use `after` parameter
  - [ ] Fetch nested comments (depth > 1)
  - [ ] Respect 100 req/min limit
  - [ ] Add delay between requests if needed
  - [ ] Tests with mocked pagination
  - [ ] Monitor scan time (should still complete in <2min)

- [ ] **16. Exponential Backoff (3h)**
  - [ ] Create src/lib/utils/retry.ts
  - [ ] Implement exponential backoff function
    - Max retries: 4
    - Delays: 2s, 4s, 8s, 16s
  - [ ] Apply to all Reddit API calls
  - [ ] Handle 429 rate limit errors
  - [ ] Add logging
  - [ ] Tests

- [ ] **17. ±50 Word Sentiment Window (4h)**
  - [ ] Update analyzeSentiment() in sentiment.ts
  - [ ] Find ticker position in text
  - [ ] Extract ±50 words around ticker
  - [ ] Run sentiment on window only
  - [ ] Handle multiple ticker mentions
  - [ ] Aggregate sentiment scores
  - [ ] Tests with windowed examples
  - [ ] Compare accuracy vs full-text

- [ ] **18. Testing (5h)**
  - [ ] Add tests for comment pagination
  - [ ] Add tests for retry logic
  - [ ] Add tests for sentiment windowing
  - [ ] Integration tests for Reddit client
  - [ ] E2E tests for full scan flow
  - [ ] Performance testing

### Week 2 - Day 10 (8 hours)

- [ ] **19. Integration & E2E Testing**
  - [ ] Run full test suite
  - [ ] Fix failing tests
  - [ ] Manual testing
  - [ ] Check scan still completes in time
  - [ ] Verify sentiment accuracy improved
  - [ ] Check all comments being fetched

- [ ] **20. Performance Testing**
  - [ ] Measure scan execution time
  - [ ] Measure API response times
  - [ ] Measure page load times
  - [ ] Optimize slow queries
  - [ ] Add caching if needed

- [ ] **21. Deploy to Staging**
  - [ ] Commit & push
  - [ ] Deploy to staging
  - [ ] Smoke test
  - [ ] Bug fixes

---

## 🟢 PHASE 3: POLISH (15 hours) - PENDING

### Week 3 - Day 11-12 (16 hours)

- [ ] **22. Mobile Optimization (6h)**
  - [ ] Verify touch targets (44×44px min)
  - [ ] Add swipeable cards (react-swipeable)
  - [ ] Add collapsible sections
  - [ ] Test responsive tables
  - [ ] Measure load times
  - [ ] Optimize images/fonts
  - [ ] Test on real devices
  - [ ] Fix mobile bugs

- [ ] **23. Auto-Refresh Improvements (4h)**
  - [ ] Add timestamp to API responses
  - [ ] Poll /api/stocks/trending every 30s
  - [ ] Show "New data available" notification
  - [ ] Manual refresh button
  - [ ] Use React Query or SWR
  - [ ] Tests

- [ ] **24. Ticker Validation (1h)**
  - [ ] Import valid-tickers.json
  - [ ] Add validation in ticker-detection.ts
  - [ ] Keep blacklist for common words
  - [ ] Tests
  - [ ] Verify fewer false positives

- [ ] **25. Missing NPM Scripts (1h)**
  - [ ] Add db:reset script
  - [ ] Add format script
  - [ ] Add scan script
  - [ ] Test all scripts
  - [ ] Update documentation

- [ ] **26. Testing (4h)**
  - [ ] Test mobile UI
  - [ ] Test auto-refresh
  - [ ] Test ticker validation
  - [ ] E2E tests on mobile
  - [ ] Fix bugs

### Week 3 - Day 13-14 (14 hours)

- [ ] **27. Minor Fixes (5h)**
  - [ ] TTL verification in production
  - [ ] scan_history table usage
  - [ ] Fix fading stocks filter (10 mentions)
  - [ ] Populate Reddit URLs in evidence
  - [ ] Fix sentiment category threshold (bearish)
  - [ ] Tests for all fixes

- [ ] **28. Final E2E Testing (4h)**
  - [ ] Complete user flow testing
  - [ ] Cross-browser testing
  - [ ] Mobile device testing
  - [ ] Performance testing
  - [ ] Security testing
  - [ ] Fix all bugs found

- [ ] **29. Performance Optimization (3h)**
  - [ ] Database query optimization
  - [ ] API response caching
  - [ ] Image optimization
  - [ ] Bundle size optimization
  - [ ] Lighthouse audit
  - [ ] Fix performance issues

- [ ] **30. Documentation (2h)**
  - [ ] Update README.md
  - [ ] Update CLAUDE.md if needed
  - [ ] Add deployment checklist
  - [ ] Add monitoring guide
  - [ ] Code comments for complex logic

### Week 3 - Day 15 (Friday)

- [ ] **31. Production Deployment**
  - [ ] Final code review
  - [ ] All tests passing
  - [ ] Linter passing
  - [ ] Build successful
  - [ ] Environment variables set in Vercel
  - [ ] Database tables created in production
  - [ ] TTL enabled on all tables
  - [ ] Deploy to production
  - [ ] Post-deployment verification
    - Health check
    - Sign up test user
    - View dashboard
    - View stock details
    - Check Reddit data flowing
  - [ ] Set up monitoring
  - [ ] Launch! 🚀

---

## 📊 Progress Tracking

**Updated:** November 7, 2025

### Completion Status
- Phase 1 (Critical): 0% (0/10 tasks)
- Phase 2 (High Priority): 0% (0/11 tasks)
- Phase 3 (Polish): 0% (0/11 tasks)

**Overall: 0/32 tasks complete (0%)**

### Time Spent
- Week 1: 0/40 hours
- Week 2: 0/40 hours
- Week 3: 0/30 hours

**Total: 0/110 hours**

### Blockers
None currently

### Notes
- Started: November 7, 2025
- Target completion: November 28, 2025 (3 weeks)
- Review this file daily and update progress
- Mark tasks complete with [x] as you finish them
- Add notes about any issues or blockers

---

## 🎯 Daily Checklist

Before ending each day:
- [ ] Update TODO.md with progress
- [ ] Mark completed tasks with [x]
- [ ] Note any blockers or issues
- [ ] Run tests: npm run test
- [ ] Commit changes: git add . && git commit -m "..."
- [ ] Push to branch: git push

Before starting each day:
- [ ] Review TODO.md
- [ ] Pull latest changes: git pull
- [ ] Plan the day's tasks (3-4 tasks max)
- [ ] Set up environment (DynamoDB Local, etc.)
- [ ] Run existing tests to ensure starting from clean state

---

**Remember:**
- Test-driven development (write tests first when possible)
- All tests must pass before committing
- No console.log statements
- No `any` types
- Simple solutions are best
- Read existing code before making changes
