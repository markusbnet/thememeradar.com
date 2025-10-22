# Architecture Plan: Reddit Data Collection & Stock Analysis

## Overview

This document outlines the architecture for implementing Reddit data collection, stock ticker detection, sentiment analysis, and the stock tracking dashboard.

---

## 1. Reddit Data Collection Architecture

### 1.1 Components

#### Reddit API Client (`src/lib/reddit/client.ts`)
```typescript
class RedditClient {
  - authenticate(): Promise<string> // OAuth 2.0
  - getHotPosts(subreddit: string, limit: number): Promise<Post[]>
  - getComments(postId: string): Promise<Comment[]>
  - getRateLimitStatus(): RateLimitInfo
}
```

#### Scanner Service (`src/lib/reddit/scanner.ts`)
```typescript
class RedditScanner {
  - scanSubreddit(name: string): Promise<ScanResult>
  - scanAllSubreddits(): Promise<ScanResult[]>
  - extractTickers(text: string): string[]
  - analyzeSentiment(text: string, tickers: string[]): SentimentResult[]
}
```

#### Cron Job (`src/app/api/cron/scan/route.ts`)
- Vercel Cron endpoint
- Runs every 5 minutes
- Orchestrates scanning process
- Handles errors and retries

### 1.2 Data Flow

```
Vercel Cron (every 5 min)
  ↓
Scanner Service
  ↓
Reddit API Client → [3 subreddits × 25 posts = 75 posts]
  ↓
For each post:
  - Extract tickers
  - Fetch comments
  - Analyze sentiment
  ↓
Store in DynamoDB
  - posts table
  - comments table
  - stock_mentions table
  - stock_evidence table
```

### 1.3 Rate Limiting Strategy

- Reddit API: 100 requests/min
- Per scan: ~78 requests (3 subreddit requests + 75 comment requests)
- Scan frequency: Every 5 minutes = ~15.6 req/min average
- Safety margin: Well within limits
- Implement exponential backoff on rate limit errors

### 1.4 Error Handling

- Retry failed requests (3 attempts with exponential backoff)
- Log errors to monitoring service
- Continue scanning other subreddits on individual failures
- Alert on consecutive scan failures (>3)

---

## 2. Stock Ticker Detection System

### 2.1 Ticker Detection Engine (`src/lib/stock/ticker-detector.ts`)

#### Regex Patterns
```typescript
const PATTERNS = {
  dollarSign: /\$([A-Z]{1,5})\b/g,        // $GME, $TSLA
  standalone: /\b([A-Z]{2,5})\b/g,        // GME, AAPL (2-5 letters)
};
```

#### Validation Strategy
1. **Pattern Matching**: Extract potential tickers from text
2. **Blacklist Filtering**: Remove common words (FOR, IT, ARE, OR, etc.)
3. **Ticker List Validation**: Check against NYSE/NASDAQ list
4. **Context Analysis**: Verify ticker appears in stock-related context

#### Ticker List Management
- Store valid tickers in `src/data/valid-tickers.json`
- Update monthly via API (e.g., Alpha Vantage, Polygon.io)
- Cache validation results (Redis/in-memory for serverless)

### 2.2 False Positive Prevention

```typescript
const BLACKLIST = [
  'FOR', 'IT', 'ARE', 'OR', 'ON', 'BY', 'AT', 'TO', 'IN', 'A', 'I',
  'CEO', 'CFO', 'IPO', 'SEC', 'ETF', 'USA', 'NYSE', 'NASDAQ',
  // ... more common words
];

const MIN_TICKER_CONFIDENCE = 0.7; // Require 70% confidence
```

---

## 3. Sentiment Analysis Engine

### 3.1 Sentiment Analyzer (`src/lib/sentiment/analyzer.ts`)

#### Keyword Dictionary
```typescript
const KEYWORDS = {
  bullish: {
    '💎🙌': 3,          // Diamond hands (high weight)
    '🚀': 3,            // To the moon
    'YOLO': 3,
    'DD': 2,            // Due diligence
    'Buy the dip': 2,
    'HODL': 3,
    'Calls': 2,
    'Squeeze': 3,
    // ... more keywords
  },
  bearish: {
    '📄': 3,            // Paper hands
    'Puts': 3,
    'Short': 2,
    'Dump': 3,
    'Rug pull': 3,
    'Bag holder': 2,
    'FUD': 2,
    // ... more keywords
  },
};
```

#### Scoring Algorithm
```typescript
function calculateSentiment(text: string, ticker: string): SentimentScore {
  1. Extract context window (±50 words around ticker mention)
  2. Count bullish/bearish keyword matches
  3. Apply keyword weights
  4. Calculate score: (bullish_weighted - bearish_weighted) / total_mentions
  5. Normalize to -1.0 to 1.0 scale
  6. Return score + reasoning
}
```

#### Sentiment Categories
- Strong Bullish: > 0.6
- Bullish: 0.2 to 0.6
- Neutral: -0.2 to 0.2
- Bearish: -0.6 to -0.2
- Strong Bearish: < -0.6

### 3.2 Evidence Storage

For transparency, store:
```typescript
interface StockEvidence {
  ticker: string;
  evidenceId: string;
  type: 'post' | 'comment';
  text: string;
  keywords: string[];        // Matched keywords
  sentimentScore: number;
  reasoning: string;         // Why this score?
  redditUrl: string;
  upvotes: number;
  subreddit: string;
  createdAt: number;
}
```

---

## 4. Dashboard UI Design

### 4.1 Component Architecture

```
DashboardPage
├─ Header (user info, logout, refresh timer)
├─ TrendingSection
│  ├─ SectionHeader ("📈 Top 10 Trending")
│  └─ StockGrid
│     └─ StockCard × 10
│        ├─ Ticker
│        ├─ VelocityIndicator (↑ +245%)
│        ├─ SentimentBadge (🚀 Bullish)
│        ├─ MentionCount (1.2K)
│        └─ Sparkline (7-day chart)
│
├─ FadingSection
│  ├─ SectionHeader ("📉 Top 10 Fading")
│  └─ StockGrid
│     └─ StockCard × 10
│
└─ RefreshTimer ("Last updated: 1 min ago • Next: 4 min")
```

### 4.2 Stock Card Design (Figma-style)

```
┌─────────────────────────────────────┐
│ $GME               ↑ +245%  🚀      │
│                                     │
│ Bullish • 1.2K mentions             │
│                                     │
│ ▁▂▃▅▇█▇▅▃ (sparkline)              │
│                                     │
│ r/wallstreetbets: 800               │
│ r/stocks: 300                       │
│ r/investing: 100                    │
└─────────────────────────────────────┘
```

### 4.3 Stock Detail Page Design

```
┌─────────────────────────────────────────────┐
│ ← Back                                      │
│                                             │
│ $GME - GameStop Corp.                       │
│ 🚀 Strong Bullish • ↑ +245% (1hr)          │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │   Mention Count (7 days)            │   │
│ │   [Line chart showing trend]         │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │   Sentiment Score (7 days)          │   │
│ │   [Line chart: -1 to +1]            │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ 📊 Statistics (24hr)                        │
│ • Total mentions: 1,200                     │
│ • Sentiment: 75% bullish, 15% neutral, 10% bearish │
│ • Top keywords: 🚀, 💎🙌, YOLO, Squeeze   │
│                                             │
│ 🗣️ Supporting Evidence                     │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ u/DeepValue • 2.5K ⬆ • 2h ago       │   │
│ │ r/wallstreetbets                     │   │
│ │                                      │   │
│ │ "GME is going to the 🚀🚀🚀 with    │   │
│ │ these 💎🙌. YOLO on calls!"         │   │
│ │                                      │   │
│ │ Sentiment: Strong Bullish (+0.85)    │   │
│ │ Keywords: 🚀, 💎🙌, YOLO             │   │
│ │                                      │   │
│ │ [View on Reddit →]                   │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ [More evidence...]                          │
└─────────────────────────────────────────────┘
```

### 4.4 UI Components List

#### Components to Build
1. `StockCard` - Individual stock display
2. `StockGrid` - Responsive grid layout
3. `VelocityIndicator` - Arrow + percentage
4. `SentimentBadge` - Emoji + label
5. `Sparkline` - Mini 7-day chart
6. `RefreshTimer` - Auto-updating timer
7. `StockChart` - Full-size charts (recharts)
8. `EvidenceCard` - Post/comment display
9. `SubredditBreakdown` - Pie/bar chart
10. `StatsTable` - Statistics display

#### Design System
- **Colors**:
  - Bullish: Green (#10B981)
  - Bearish: Red (#EF4444)
  - Neutral: Gray (#6B7280)
  - Background: Slate-900 (#0f172a)
- **Typography**:
  - Headings: Bold, Inter font
  - Body: Regular, Inter font
- **Spacing**: Tailwind scale (4px base)
- **Animations**: Smooth transitions (200ms)

---

## 5. Metrics & Ranking System

### 5.1 Metrics Calculation (`src/lib/metrics/calculator.ts`)

#### Real-time Metrics (Updated every 5 min)
```typescript
interface StockMetrics {
  ticker: string;
  timestamp: number;

  // Counts
  mentionCount: number;
  uniquePosts: number;
  uniqueComments: number;

  // Sentiment
  sentimentScore: number;      // -1.0 to 1.0
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;

  // Engagement
  upvoteScore: number;         // Sum of upvotes
  ddCount: number;             // Due diligence posts

  // Distribution
  subredditBreakdown: {
    [subreddit: string]: number;
  };

  // Keywords
  topKeywords: string[];
}
```

#### Velocity Calculation
```typescript
function calculateVelocity(
  current: StockMetrics,
  previous: StockMetrics
): number {
  const currentCount = current.mentionCount;
  const previousCount = previous.mentionCount || 1; // Avoid division by zero

  const percentChange = ((currentCount - previousCount) / previousCount) * 100;
  return percentChange;
}
```

### 5.2 Ranking Algorithm

#### Top 10 Trending (Rising)
```typescript
function getRisingStocks(timeframe: '15min' | '1hr' | '4hr' = '1hr'): Stock[] {
  1. Calculate velocity for all stocks
  2. Filter: mentionCount >= 5 (reduce noise)
  3. Sort by: velocity DESC, then mentionCount DESC
  4. Take top 10
}
```

#### Top 10 Fading (Losing Interest)
```typescript
function getFadingStocks(timeframe: '1hr' | '4hr' | '24hr' = '1hr'): Stock[] {
  1. Calculate velocity for all stocks
  2. Filter: previousMentionCount >= 10 (avoid false signals)
  3. Filter: velocity < 0 (only decreasing)
  4. Sort by: velocity ASC (most negative first)
  5. Take top 10
}
```

---

## 6. Scalability Considerations

### 6.1 Database Optimization

#### DynamoDB Design
- **Partition Key**: Efficient distribution
- **Sort Keys**: Time-based for range queries
- **GSIs**: For common query patterns
- **TTL**: Auto-expire old data (30 days)
- **Batch Operations**: Write in batches of 25

#### Caching Strategy
- Cache ticker validation results (1 day)
- Cache sentiment keyword lookups (in-memory)
- Cache frequently accessed stock data (5 min)

### 6.2 Performance Targets

- **Scan Duration**: < 60 seconds per scan
- **API Response**: < 500ms for dashboard data
- **Database Query**: < 100ms per query
- **UI Render**: < 2 seconds initial load

### 6.3 Cost Management

- **Reddit API**: Free (stay within 100 req/min)
- **DynamoDB**: Use free tier (25GB storage, 200M requests/month)
- **Vercel**: Stay within Hobby plan (100 GB-hours/month)
- **Monitoring**: Track usage weekly, alert at 80% of limits

---

## 7. Testing Strategy

### 7.1 Unit Tests
- Ticker detection logic
- Sentiment analysis algorithm
- Metrics calculation
- Velocity calculation
- Keyword matching

### 7.2 Integration Tests
- Reddit API client
- DynamoDB operations
- Cron job execution
- API endpoints

### 7.3 E2E Tests
- Dashboard displays stocks
- Stock detail page shows data
- Real-time updates work
- Error states handled

### 7.4 Test Data
- Mock Reddit responses
- Sample posts/comments
- Known ticker lists
- Expected sentiment scores

---

## 8. Implementation Order

### Phase 1: Foundation (This Sprint)
1. ✅ Unit tests for ticker detection
2. ✅ Implement ticker detector
3. ✅ Unit tests for sentiment analysis
4. ✅ Implement sentiment analyzer
5. ✅ Integration tests for Reddit client
6. ✅ Implement Reddit client

### Phase 2: Data Collection
1. ✅ Create DynamoDB tables (init script)
2. ✅ Implement scanner service
3. ✅ Create cron job endpoint
4. ✅ Test full scan flow
5. ✅ Deploy and monitor

### Phase 3: Dashboard UI
1. ✅ Create UI components
2. ✅ Implement dashboard page
3. ✅ Create stock detail page
4. ✅ E2E tests
5. ✅ Polish and optimize

### Phase 4: Polish & Deploy
1. ✅ Add loading states
2. ✅ Error handling
3. ✅ Mobile optimization
4. ✅ Deploy to Vercel
5. ✅ Monitor and iterate

---

## 9. Monitoring & Alerts

### Metrics to Track
- Scan success rate
- API rate limit usage
- DynamoDB read/write units
- Error rates
- Response times

### Alerts
- Scan failures (> 3 consecutive)
- Rate limit approaching (> 80 req/min)
- Database errors
- High response times (> 2s)

---

## Next Steps

1. Review and approve this architecture plan
2. Create ticker validation list (`valid-tickers.json`)
3. Implement ticker detector with unit tests (TDD)
4. Implement sentiment analyzer with unit tests (TDD)
5. Implement Reddit client with integration tests
6. Build scanner service and cron job
7. Create dashboard UI components
8. Deploy and test in production

---

**Ready to proceed with implementation?**
