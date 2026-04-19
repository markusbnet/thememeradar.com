# Gap Analysis: The Meme Radar vs. ApeWisdom

**Goal:** Make The Meme Radar at least as useful as ApeWisdom, but fresher and more actionable — so Mark can use it to advise himself on the meme stock market in near real time.

**Date:** 2026-04-17
**Disclaimer:** This is data, not investment advice.

---

## The one-paragraph summary

The Meme Radar already has architectural advantages over ApeWisdom — tighter scan cadence (5 min vs ~hourly), proper sentiment modeling with WSB-specific terminology weights, a surge detector, and evidence/transparency per mention. Where it loses today is **breadth and comparability**: ApeWisdom covers ~724 tickers across 10+ subreddits with clear 24h rank deltas; Meme Radar covers three subreddits and the top-25 hot posts each, which is thin coverage and misses the long tail where real meme spikes originate (e.g. BIRD jumping #528→#3). There is also no price data, no cross-platform signal, and no way to export or alert. Closing those gaps — plus layering on LunarCrush and SwaggyStocks — turns Meme Radar from a "Reddit trending list" into a proper decision surface.

---

## What The Meme Radar already has that ApeWisdom doesn't

A few things are genuinely better today, and are worth protecting as the product evolves:

**Scan cadence.** 5-minute Vercel cron vs. ApeWisdom's ~hourly refresh. For meme moves that happen on minute-scale, this is a real advantage — provided coverage catches up.

**Sentiment with proper weighting.** The `sentiment.ts` module scores each mention on a weighted WSB vocabulary (YOLO, diamond hands, squeeze, paper hands, puts, etc.) within a ±50-word window. ApeWisdom only shows a blunt bullish/bearish split based on upvote proxies.

**Surge detection.** The `surge.ts` multi-window baseline (3x over prior four 15-min intervals) is exactly the kind of derived signal ApeWisdom doesn't publish.

**Evidence and transparency.** Each mention stores raw text, keywords, subreddit, Reddit URL — so any rank can be justified. ApeWisdom is a black box.

**Structured storage.** DynamoDB tables with TTL and GSIs mean you can do time-series queries ApeWisdom can't support as a consumer.

---

## What ApeWisdom has that The Meme Radar is missing

This is the list that actually matters for "feature parity." Organised by impact, not alphabetically.

### Coverage breadth (high impact)

ApeWisdom returns ~724 tickers across 8 pages per subreddit. Meme Radar currently fetches top-25 hot posts from only 3 subreddits. Two problems:

1. **Subreddit coverage.** ApeWisdom covers WSB, stocks, investing, StockMarket, pennystocks, options, Daytrading, SecurityAnalysis, Superstonk, ValueInvesting, plus crypto subs. Meme Radar covers WSB, stocks, investing — miss pennystocks and Superstonk and you miss most microcap meme moves.
2. **Post depth.** Limiting to top-25 hot posts per sub skips the comment-driven spikes on `/new` and `/rising`. ApeWisdom scans much deeper. A ticker like BIRD going from rank 528 to rank 3 on a 1→152 mention jump would never show up in a top-25-hot-posts scan — that signal comes from `/new` plus comments.

### Rank delta metric (high impact)

ApeWisdom's headline metric is **rank change over 24h** (e.g. "#247 → #12, +235"). This is the single most intuitive way to spot what's emerging. Meme Radar calculates velocity (% change in mention count) but doesn't expose a "rank yesterday vs. today" field on the dashboard. This is cheap to add on top of existing `stock_mentions` data.

### Multi-timeframe view (medium impact)

ApeWisdom lets users flip between 24h and 1h. CLAUDE.md specifies 15m/1h/4h/24h/7d as intended timeframes, but the dashboard only shows a single view. Needed: a timeframe selector driving the ranking query.

### Absolute mention counts vs. percentage (medium impact)

ApeWisdom shows "850 mentions, +120 vs. yesterday." Meme Radar's dashboard shows a velocity percentage. Percentages alone are misleading — 500% of 2 mentions is noise. Showing both the absolute count and the delta is how traders actually read this data.

### API / data export (medium impact)

ApeWisdom has a public JSON API. Meme Radar has `/api/stocks/trending` internally but it's auth-gated and not documented for external use. If you ever want to feed the Stock scraper Google Sheet from Meme Radar (rather than the other way round), or build an iOS shortcut, you need a stable external API.

### Crypto support (low-medium impact)

ApeWisdom covers SatoshiStreetBets and r/cryptocurrency. Meme Radar is equities-only. Flagging this not because it's urgent, but because the same pipeline trivially supports crypto tickers once you add the subs and a symbol list.

### Simple, fast table UI (low impact, but worth noting)

ApeWisdom's homepage is a dense, sortable table. Meme Radar's dashboard is a card-based "Top 10 Trending / Top 10 Fading" layout. Cards are nicer for casual browsing; a dense table is better for scanning 50+ tickers at once. Probably want both, toggleable.

---

## What's needed to be *more up to date* than ApeWisdom

ApeWisdom refreshes roughly hourly. Beating it on freshness is where Meme Radar has the clearest moat, and it doesn't require a rewrite — just a few additions:

**Price overlay.** Without price data, a trending list is interesting but not actionable. Pulling current price, intraday % change, and volume from Google Finance formula (free) or Alpha Vantage (free tier) against every ranked ticker turns the dashboard into a proper signal screen. This is the single highest-leverage addition.

**Cross-platform sentiment via LunarCrush.** The LunarCrush MCP you already have connected returns Galaxy Score, AltRank, social dominance, and sentiment across X, YouTube, TikTok and Reddit. When Meme Radar's Reddit velocity spikes *and* LunarCrush shows rising broader social dominance, the signal is much stronger than either alone. This is how you get ahead of ApeWisdom — they only see Reddit.

**SwaggyStocks confirmatory layer.** The Stock scraper project treats SwaggyStocks as a secondary source for call/put OI and 30D IV. If an ApeWisdom-style meme spike on Meme Radar also shows rising options volume and IV on SwaggyStocks, the probability of a near-term move goes up materially.

**Creator/influencer tracking.** LunarCrush exposes creator data. When a 100K+ follower account starts posting about a ticker Meme Radar is already ranking, that's early acceleration.

**Alerting.** ApeWisdom has none. Meme Radar should — surge alert → email/push → drafts in Gmail. The LunarCrush-enriched "Opportunity Score ≥ 75" alert that's already queued as Task 59 in Todoist maps directly here.

---

## Data source reconciliation

There's a decision that needs making: does Meme Radar *scrape Reddit directly* (as it does now), or does it *consume ApeWisdom's API* and layer value on top?

| Approach | Pros | Cons |
|---|---|---|
| Keep direct Reddit scraping | Full transparency, own the data, no upstream dependency, faster refresh possible, preserves sentiment evidence per mention | Thin coverage today (25 hot posts × 3 subs); need to broaden `/new` + more subs to match ApeWisdom breadth; more dev work |
| Consume ApeWisdom API | Instantly matches their ~724-ticker breadth; simpler; no Reddit API rate-limit worries | Loses sentiment evidence transparency; you're only as fresh as they are (hourly); cedes the differentiator |
| **Hybrid (recommended)** | Use ApeWisdom API as a **coverage layer** (get the full 724 tickers + rank deltas); keep Reddit scanning as a **depth layer** (full sentiment evidence + 5-min freshness on the top ~50 of interest) | Two data pipelines to maintain |

The hybrid is how you are *more* up to date than ApeWisdom without sacrificing the evidence layer. Pull their ranked list hourly, then point your 5-min Reddit scanner at the top 50 from their list plus anything surging locally. You get their breadth and your freshness.

---

## Priority roadmap

A suggested ordering. Tasks 54–59 already in Todoist (LunarCrush pipeline, opportunity score, alerts) fit cleanly here.

**Phase A — close the parity gap with ApeWisdom (1–2 weeks of work)**
1. Add 24h rank-delta metric to the ranking algorithm and dashboard. Single most intuitive column; cheap.
2. Add timeframe selector (1h / 24h / 7d).
3. Show absolute mention counts alongside velocity %.
4. Broaden subreddit coverage: pennystocks, Superstonk, StockMarket, options.
5. Switch from top-25 hot to a `/new` + `/rising` sweep (deeper coverage).
6. Add a dense-table view toggle.

**Phase B — go beyond ApeWisdom (the LunarCrush tasks)**
7. LunarCrush API client + enrichment (Todoist #54, #55).
8. Opportunity score combining Reddit velocity + LunarCrush dominance + price/volume (Todoist #56).
9. Creator tracking for early acceleration signals (Todoist #57).
10. Enriched "Opportunities" dashboard section (Todoist #58).
11. Alerts and daily digest (Todoist #59).

**Phase C — the freshness moat**
12. Price overlay via Google Finance or Alpha Vantage (free tier).
13. SwaggyStocks options-data confirmatory layer.
14. Hybrid ApeWisdom-API coverage layer feeding the Reddit scanner's watchlist.
15. Public JSON API + iOS shortcut.

---

## One open question

Do you want Meme Radar to **replace** your Stock scraper Google Sheet as the primary meme-stock workspace, or to stay a separate app that *feeds* the sheet? The architectures overlap enough that maintaining both is duplicative. My read is: Meme Radar becomes the dashboard, the sheet becomes an export/archive. But worth confirming before we start wiring things together.
