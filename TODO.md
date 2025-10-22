# TODO.md - Meme Stock Radar Task List

## 🚀 Current Phase: Project Initialization

**Status:** Setting up project structure and planning architecture

---

## 📋 Phase 1: MVP (Minimum Viable Product)

### ✅ Completed
- [x] Created CLAUDE.md with comprehensive project requirements
- [x] Researched wallstreetbets terminology and sentiment keywords
- [x] Planned cost structure ($0/month within free tiers)

### 🏗️ Project Setup (In Progress)
- [ ] Initialize Next.js project with TypeScript + Tailwind CSS
- [ ] Set up project structure (src/, tests/, components/, lib/)
- [ ] Configure ESLint + Prettier
- [ ] Set up Git repository and .gitignore
- [ ] Configure GitHub Actions CI/CD workflow
- [ ] Set up DynamoDB Local (Docker)
- [ ] Create DynamoDB schema and init scripts
- [ ] Set up Reddit API OAuth application
- [ ] Configure environment variables (.env.local template)

### 🔐 Authentication System
- [ ] Design auth API routes (/api/auth/signup, /api/auth/login, /api/auth/logout)
- [ ] Write tests for authentication (TDD)
- [ ] Implement JWT token generation and validation
- [ ] Implement bcrypt password hashing
- [ ] Create user signup page (email + password)
- [ ] Create user login page
- [ ] Add email validation
- [ ] Implement rate limiting on auth endpoints
- [ ] Create protected route middleware
- [ ] Add session management (httpOnly cookies)
- [ ] Write E2E tests for auth flows

### 📡 Reddit API Integration
- [ ] Set up Reddit API client (OAuth 2.0)
- [ ] Write tests for Reddit API integration (TDD)
- [ ] Implement token refresh logic
- [ ] Create function to fetch hot posts from subreddit
- [ ] Create function to fetch comments for post
- [ ] Implement rate limit handling (exponential backoff)
- [ ] Add error handling and retry logic
- [ ] Test with r/wallstreetbets, r/stocks, r/investing
- [ ] Create /api/scan endpoint for cron job

### 🔍 Stock Ticker Detection
- [ ] Create ticker detection utility (regex + validation)
- [ ] Write tests for ticker detection (TDD)
- [ ] Implement NYSE/NASDAQ ticker list validation
- [ ] Add false positive filtering (common words)
- [ ] Test with real Reddit post samples
- [ ] Handle edge cases ($, spaces, multiple tickers)

### 💭 Sentiment Analysis
- [ ] Create sentiment analysis utility
- [ ] Write tests for sentiment analysis (TDD)
- [ ] Implement wallstreetbets keyword dictionary
- [ ] Implement bullish/bearish/neutral keyword matching
- [ ] Add keyword weighting system
- [ ] Calculate sentiment scores (-1 to 1)
- [ ] Test with real Reddit post/comment samples
- [ ] Handle sarcasm and context (future enhancement)

### 🗄️ DynamoDB Operations
- [ ] Create DynamoDB client wrapper
- [ ] Write tests for DB operations (TDD)
- [ ] Implement CRUD operations for users table
- [ ] Implement CRUD operations for posts table
- [ ] Implement CRUD operations for comments table
- [ ] Implement CRUD operations for stock_mentions table
- [ ] Implement CRUD operations for stock_evidence table
- [ ] Configure TTL (30-day expiration)
- [ ] Add batch write operations
- [ ] Create database seed scripts for testing

### ⏰ Background Jobs (Vercel Cron)
- [ ] Configure Vercel cron job (every 5 minutes)
- [ ] Implement scan orchestrator
- [ ] Fetch posts from all subreddits
- [ ] Fetch comments for all posts
- [ ] Extract tickers from posts and comments
- [ ] Calculate sentiment for each mention
- [ ] Aggregate data into stock_mentions table
- [ ] Store evidence in stock_evidence table
- [ ] Add monitoring and error logging
- [ ] Test scan job locally

### 🎨 UI Components
- [ ] Set up Tailwind UI component library
- [ ] Create layout component (header, footer, nav)
- [ ] Create StockCard component
- [ ] Create StockList component (top 10 trending/fading)
- [ ] Create RefreshTimer component
- [ ] Create SentimentBadge component
- [ ] Create VelocityIndicator component
- [ ] Create Sparkline chart component
- [ ] Test all components with Storybook or similar

### 📊 Dashboard Page
- [ ] Create /dashboard route
- [ ] Write E2E tests for dashboard (TDD)
- [ ] Implement protected route (auth required)
- [ ] Fetch top 10 trending stocks (API call)
- [ ] Fetch top 10 fading stocks (API call)
- [ ] Display refresh timer (last updated, next update)
- [ ] Add auto-refresh when new data available
- [ ] Make mobile responsive
- [ ] Test on real mobile devices

### 📈 Stock Detail Page
- [ ] Create /stock/[ticker] route
- [ ] Write E2E tests for stock detail page (TDD)
- [ ] Fetch stock metrics (mentions, sentiment, velocity)
- [ ] Display 7-day mention count chart
- [ ] Display 7-day sentiment chart
- [ ] Show subreddit breakdown (pie chart or table)
- [ ] Display supporting evidence (top 5 posts/comments)
- [ ] Highlight keywords in evidence text
- [ ] Link to original Reddit threads
- [ ] Make mobile responsive

### 🧪 Testing & QA
- [ ] Write unit tests for all utility functions (100% coverage)
- [ ] Write integration tests for all API routes
- [ ] Write E2E tests for critical user flows
- [ ] Test with real Reddit data
- [ ] Performance testing (load times, API response times)
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Mobile device testing (iOS, Android)
- [ ] Accessibility testing (WCAG 2.1 AA)

### 🚢 Deployment
- [ ] Create Vercel project
- [ ] Configure production environment variables
- [ ] Set up production DynamoDB tables (AWS)
- [ ] Configure custom domain (thememeradar.com)
- [ ] Set up SSL certificate (Vercel auto)
- [ ] Configure GitHub Actions for CI/CD
- [ ] Deploy to production
- [ ] Run production smoke tests
- [ ] Monitor for errors (first 24 hours)

---

## 📋 Phase 2: Enhancements (Post-MVP)

### 🔖 Watchlists
- [ ] Design watchlist feature (UX/UI mockups)
- [ ] Add watchlists table to DynamoDB schema
- [ ] Write tests for watchlist functionality (TDD)
- [ ] Create API routes for watchlist CRUD
- [ ] Add "Add to Watchlist" button on stock cards
- [ ] Create /watchlist page to view saved stocks
- [ ] Show watchlist stocks on dashboard (separate section)
- [ ] Add remove from watchlist functionality
- [ ] Test with multiple users and stocks

### 🔔 Alerts & Notifications
- [ ] Design alert system (email, push, in-app)
- [ ] Add alerts table to DynamoDB schema
- [ ] Write tests for alert functionality (TDD)
- [ ] Implement alert trigger logic:
  - [ ] Stock enters top 10 trending
  - [ ] Mention count spike (>50% increase)
  - [ ] Sentiment shift (from bullish to bearish or vice versa)
- [ ] Set up email service (SendGrid or AWS SES)
- [ ] Create email templates
- [ ] Add alert preferences page (/settings/alerts)
- [ ] Implement alert delivery (email)
- [ ] Add in-app notification system (toast/banner)
- [ ] Test alert triggers and delivery

### 📊 User Preferences
- [ ] Create /settings page
- [ ] Add user preferences table to DynamoDB
- [ ] Allow users to customize:
  - [ ] Preferred subreddits to track
  - [ ] Top X stocks to display (10, 25, 50)
  - [ ] Default time range (1hr, 4hr, 24hr, 7d)
  - [ ] Alert preferences
  - [ ] Theme (light/dark mode)
- [ ] Save preferences to database
- [ ] Apply preferences across app

### 📥 Export Data
- [ ] Add "Export" button to dashboard and stock detail pages
- [ ] Implement CSV export for stock mentions
- [ ] Implement JSON export for stock mentions
- [ ] Include metadata (timestamp, sentiment, etc.)
- [ ] Test export with large datasets

---

## 📋 Phase 3: Advanced Features

### 💵 Stock Price Integration
- [ ] Research stock price APIs (Alpha Vantage, Finnhub, etc.)
- [ ] Choose API based on free tier limits
- [ ] Integrate stock price API
- [ ] Display current stock price on stock cards
- [ ] Show price change (%, $) on stock cards
- [ ] Add price chart alongside mention chart
- [ ] Correlate Reddit activity with price movement

### 📈 Correlation Analysis
- [ ] Calculate correlation between:
  - [ ] Mention count vs stock price
  - [ ] Sentiment score vs stock price
  - [ ] Reddit activity vs volume traded
- [ ] Display correlation metrics on stock detail page
- [ ] Create correlation chart (scatter plot)
- [ ] Add statistical significance indicators

### 🌐 More Subreddits
- [ ] Add r/pennystocks
- [ ] Add r/options
- [ ] Add r/SecurityAnalysis
- [ ] Add r/StockMarket
- [ ] Add r/investing
- [ ] Make subreddit list configurable per user

### 🧠 Advanced Sentiment Analysis
- [ ] Research NLP libraries (Hugging Face Transformers, etc.)
- [ ] Implement context-aware sentiment (sarcasm detection)
- [ ] Add entity recognition (distinguish between stocks and companies)
- [ ] Train custom model on wallstreetbets data
- [ ] A/B test new sentiment model vs keyword-based

---

## 📋 Phase 4: Scaling & Premium

### 📱 Mobile App
- [ ] Design mobile app (React Native)
- [ ] Set up React Native project
- [ ] Share API and utilities with web app
- [ ] Implement authentication in mobile app
- [ ] Implement dashboard in mobile app
- [ ] Add push notifications
- [ ] Deploy to TestFlight (iOS)
- [ ] Deploy to Google Play (Android)

### 👥 Social Features
- [ ] Add user profiles
- [ ] Allow users to share stocks (social links)
- [ ] Add commenting/discussion on stocks
- [ ] Implement upvoting/downvoting
- [ ] Create trending discussions page

### 💰 Premium Tier
- [ ] Design premium features:
  - Real-time updates (< 15 min)
  - Top 100 stocks (vs top 10)
  - Advanced analytics
  - API access
  - No ads (if we add ads to free tier)
- [ ] Integrate Stripe for payments
- [ ] Create subscription plans (monthly, yearly)
- [ ] Implement paywall for premium features
- [ ] Add billing page (/settings/billing)
- [ ] Handle subscription lifecycle (cancel, renew, etc.)

---

## 🐛 Known Issues / Tech Debt

_(None yet - project just started)_

---

## 📝 Notes & Ideas

### Random Ideas (Not Prioritized)
- Twitter/X integration (track meme stocks on Twitter)
- Discord integration (track Discord servers)
- GameStop/AMC historical analysis (case studies)
- Reddit user influence scores (identify key opinion leaders)
- Meme image detection (classify posts with meme images)
- Short interest data integration (track stocks with high short interest)
- Options flow data (track unusual options activity)
- Institutional holdings data (track what hedge funds are doing)

### Research Needed
- [ ] Study successful meme stock events (GME, AMC, BBBY)
- [ ] Analyze what signals preceded stock spikes
- [ ] Interview active r/wallstreetbets users
- [ ] Competitive analysis (similar tools?)
- [ ] Legal considerations (financial advice disclaimers)

---

**Last Updated:** 2025-10-22
**Current Focus:** Phase 1 - MVP Development
